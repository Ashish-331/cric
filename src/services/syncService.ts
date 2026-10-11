import { supabase } from './supabaseClient';
import type { IMatchRepository, OutboxEvent } from '../repositories/types';
import type { Match } from '../types/cricket';

export interface SyncResult {
  processedCount: number;
  syncedCount: number;
  failedCount: number;
  conflictsCount: number;
  isOnline: boolean;
  errors: string[];
}

export class SyncService {
  private static isSyncing = false;
  private static customTransmitter: ((event: OutboxEvent) => Promise<{
    accepted: boolean;
    conflict?: boolean;
    canonicalRevision?: number;
    error?: string;
  }>) | null = null;

  static setTransmitter(
    transmitter: ((event: OutboxEvent) => Promise<{
      accepted: boolean;
      conflict?: boolean;
      canonicalRevision?: number;
      error?: string;
    }>) | null
  ): void {
    this.customTransmitter = transmitter;
  }

  /**
   * Processes all pending actions in the local durable outbox.
   * Guarantees strictly ordered, idempotent delivery to the canonical cloud backend.
   */
  static async processOutbox(matchRepo: IMatchRepository): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        processedCount: 0,
        syncedCount: 0,
        failedCount: 0,
        conflictsCount: 0,
        isOnline: true,
        errors: ['Sync already in progress'],
      };
    }

    this.isSyncing = true;
    const result: SyncResult = {
      processedCount: 0,
      syncedCount: 0,
      failedCount: 0,
      conflictsCount: 0,
      isOnline: true,
      errors: [],
    };

    try {
      const pendingEvents = await matchRepo.getPendingSyncOutbox();
      result.processedCount = pendingEvents.length;

      // Group per matchId so a conflict on match A does not starve match B
      const blockedMatchIds = new Set<string>();

      for (const event of pendingEvents) {
        if (blockedMatchIds.has(event.matchId)) {
          continue;
        }

        try {
          const outcome = await this.transmitAction(event);

          if (outcome.accepted) {
            await matchRepo.markOutboxSynced([event.id]);
            result.syncedCount += 1;
          } else if (outcome.conflict) {
            result.conflictsCount += 1;
            blockedMatchIds.add(event.matchId);
            await matchRepo.markOutboxFailed(
              event.id,
              `Revision conflict: canonical is ${outcome.canonicalRevision}`,
              true
            );
          } else {
            result.failedCount += 1;
            blockedMatchIds.add(event.matchId);
            await matchRepo.markOutboxFailed(event.id, outcome.error || 'Transmission rejected');
          }
        } catch (err: any) {
          result.isOnline = false;
          result.failedCount += 1;
          result.errors.push(err.message || 'Network disconnected');
          await matchRepo.markOutboxFailed(event.id, err.message || 'Network failure');
          // Offline network loss halts outbox processing
          break;
        }
      }
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  /**
   * Transmits a single scoring action to the canonical Edge Function.
   * Fails closed: Never marks sync success without verified server acceptance.
   */
  private static async transmitAction(
    event: OutboxEvent
  ): Promise<{ accepted: boolean; conflict?: boolean; canonicalRevision?: number; error?: string }> {
    if (this.customTransmitter) {
      return this.customTransmitter(event);
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      // Fail closed: Never pretend synchronization happened without an authenticated session
      if (!token) {
        return {
          accepted: false,
          error: 'NO_SESSION: Outbox sync blocked awaiting authenticated session.',
        };
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'}/functions/v1/commit-match-action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            matchId: event.matchId,
            expectedRevision: event.expectedRevision,
            actionId: event.actionId,
            authorityEpoch: event.authorityEpoch,
            action: event.payload,
          }),
        }
      );

      if (response.status === 409) {
        const conflictData = await response.json();
        return {
          accepted: false,
          conflict: true,
          canonicalRevision: conflictData.canonicalRevision,
        };
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return { accepted: false, error: errData.error || `HTTP ${response.status}` };
      }

      return { accepted: true };
    } catch (err: any) {
      throw err;
    }
  }

  /**
   * Subscribes to Realtime revision updates for a live match.
   * Viewers receive immediate lightweight revision notifications without polling large payloads.
   */
  static subscribeToMatchRevisions(
    matchId: string,
    onRevisionUpdate: (newRevision: number) => void
  ): () => void {
    const channel = supabase
      .channel(`match:${matchId}:revisions`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          const newRevision = payload.new?.revision;
          if (typeof newRevision === 'number') {
            onRevisionUpdate(newRevision);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}
