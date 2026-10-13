import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageService, TEAMS_STORAGE_KEY, TOURNAMENTS_STORAGE_KEY } from '../storage/storageService';
import { supabase } from './supabaseClient';
import type { Player, Team, PlayerSearchMatchResult } from '../types/cricket';
import { toCanonicalUUID } from '../utils/uuid';

export class PlayerIdentityService {
  /**
   * Search for existing registered player profiles or reusable ghost profiles
   * by exact email, normalized phone, or display name query.
   * Preserves privacy by returning only permitted public profile fields.
   */
  static async searchPlayerProfiles(
    query: string,
    currentUserId?: string
  ): Promise<PlayerSearchMatchResult[]> {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    const isEmailQuery = q.includes('@');
    const isPhoneQuery = /^\+?[0-9\s\-()]{6,}$/.test(q);
    const normalizedPhone = isPhoneQuery ? StorageService.normalizePhone(q) : null;

    const resultsMap = new Map<string, PlayerSearchMatchResult>();

    // 1. Search locally stored teams and players
    const localTeams = await StorageService.getTeams();
    for (const team of localTeams) {
      for (const p of team.players) {
        let isMatch = false;

        if (isEmailQuery && p.email && p.email.toLowerCase() === q) {
          isMatch = true;
        } else if (normalizedPhone && p.phoneNumber && StorageService.normalizePhone(p.phoneNumber) === normalizedPhone) {
          isMatch = true;
        } else if (!isEmailQuery && !isPhoneQuery && p.name.toLowerCase().includes(q)) {
          isMatch = true;
        }

        if (isMatch) {
          // Check if already in results
          if (!resultsMap.has(p.id)) {
            const isOwnerOrCreator =
              p.claimedByUserId === currentUserId ||
              team.createdByUserId === currentUserId ||
              team.managerUserId === currentUserId;

            resultsMap.set(p.id, {
              id: p.id,
              name: p.name,
              role: p.role || 'all-rounder',
              avatarUrl: p.avatarUrl,
              avatarPreset: p.avatarPreset,
              city: p.city || team.city,
              matchesCount: p.careerStats?.matches || 0,
              isRegisteredUser: Boolean(p.isVerified && !p.isGuest),
              isClaimed: Boolean(p.claimedByUserId || p.isClaimed),
              // Expose contact info ONLY if viewer is authorized creator/manager
              email: isOwnerOrCreator ? p.email : undefined,
              phoneNumber: isOwnerOrCreator ? p.phoneNumber : undefined,
            });
          }
        }
      }
    }

    // 2. Search canonical cloud backend if online
    try {
      if (isEmailQuery) {
        // Find by verified account email in public view
        const { data: cloudAccounts } = await supabase
          .from('account_profiles')
          .select('id, display_name, avatar_url')
          .eq('email', q)
          .limit(1);

        if (cloudAccounts && cloudAccounts.length > 0) {
          const acc = cloudAccounts[0];
          if (!resultsMap.has(acc.id)) {
            resultsMap.set(acc.id, {
              id: acc.id,
              name: acc.display_name || 'Registered Cricketer',
              role: 'all-rounder',
              avatarUrl: acc.avatar_url,
              matchesCount: 0,
              isRegisteredUser: true,
              isClaimed: true,
            });
          }
        }
      } else if (normalizedPhone) {
        // Query canonical players linked to phone
        const { data: cloudPlayers } = await supabase
          .from('players')
          .select('id, canonical_name, role, avatar_url, city')
          .eq('phone_number', normalizedPhone)
          .limit(3);

        if (cloudPlayers) {
          for (const cp of cloudPlayers) {
            if (!resultsMap.has(cp.id)) {
              resultsMap.set(cp.id, {
                id: cp.id,
                name: cp.canonical_name,
                role: cp.role || 'all-rounder',
                avatarUrl: cp.avatar_url,
                city: cp.city,
                matchesCount: 0,
                isRegisteredUser: false,
                isClaimed: false,
              });
            }
          }
        }
      }
    } catch {
      // Offline fallback: rely on local results
    }

    return Array.from(resultsMap.values());
  }

  /**
   * Verified Email Claiming:
   * When an authenticated user signs in with a verified email address,
   * this claims any matching ghost profiles across local storage and cloud.
   * Phone number alone NEVER triggers an automatic claim.
   */
  static async claimPlayerProfilesByVerifiedEmail(
    email: string,
    verifiedAccountId: string,
    verifiedName: string
  ): Promise<{ claimedCount: number; updatedTeams: Team[]; firstClaimedPlayerId?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { claimedCount: 0, updatedTeams: [] };
    }

    const teams = await StorageService.getTeams();
    let claimedCount = 0;
    let firstClaimedPlayerId: string | undefined;

    const updatedTeams = teams.map((team) => {
      let teamModified = false;
      const updatedPlayers = team.players.map((player) => {
        if (
          player.email &&
          player.email.trim().toLowerCase() === cleanEmail &&
          (player.isGuest || !player.isClaimed || !player.isVerified)
        ) {
          claimedCount += 1;
          if (!firstClaimedPlayerId) {
            firstClaimedPlayerId = player.id;
          }
          teamModified = true;
          return {
            ...player,
            isGuest: false,
            isVerified: true,
            isClaimed: true,
            claimedByUserId: verifiedAccountId,
            name: verifiedName.trim() || player.name,
          };
        }
        return player;
      });

      return teamModified ? { ...team, players: updatedPlayers } : team;
    });

    if (claimedCount > 0) {
      // Update tournaments for consistency
      const tournaments = await StorageService.getTournaments();
      let tournamentsModified = false;
      const updatedTournaments = tournaments.map((tourn) => {
        let tourTeamMod = false;
        const tourTeams = tourn.teams.map((t) => {
          const matching = updatedTeams.find((ut) => ut.id === t.id);
          if (matching) {
            tourTeamMod = true;
            return matching;
          }
          return t;
        });
        if (tourTeamMod) {
          tournamentsModified = true;
          return { ...tourn, teams: tourTeams };
        }
        return tourn;
      });

      const multiSetPairs: [string, string][] = [
        [TEAMS_STORAGE_KEY, JSON.stringify(updatedTeams)],
      ];
      if (tournamentsModified) {
        multiSetPairs.push([TOURNAMENTS_STORAGE_KEY, JSON.stringify(updatedTournaments)]);
      }
      await AsyncStorage.multiSet(multiSetPairs);

      // Attempt cloud link if online
      try {
        if (firstClaimedPlayerId) {
          await supabase.from('player_account_links').upsert({
            player_id: toCanonicalUUID(firstClaimedPlayerId),
            account_id: toCanonicalUUID(verifiedAccountId),
            is_primary: true,
            status: 'verified',
          });
        }
      } catch {
        // Offline link queued
      }
    }

    return { claimedCount, updatedTeams, firstClaimedPlayerId };
  }
}
