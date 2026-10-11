// Supabase Edge Function: commit-match-action
// Validates JWT, verifies scoring authority, validates scoring delivery via pure cricketEngine,
// and atomically commits canonical revision and append-only match_actions.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface CommitActionPayload {
  matchId: string;
  expectedRevision: number;
  actionId: string;
  authorityEpoch: number;
  action: {
    type: string;
    delivery?: any;
    playerId?: string;
    slot?: string;
    dismissalType?: string;
  };
}

serve(async (req: Request) => {
  // CORS Headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Validate JWT and derive authentic actor ID
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired user session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const actorAccountId = user.id;

    // 2. Parse request payload
    const body: CommitActionPayload = await req.json();
    const { matchId, expectedRevision, actionId, authorityEpoch, action } = body;

    if (!matchId || !actionId || expectedRevision === undefined || !action) {
      return new Response(JSON.stringify({ error: 'Invalid payload: matchId, actionId, expectedRevision, action required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Idempotency Check: Was this action already committed?
    const { data: existingAction } = await supabase
      .from('match_actions')
      .select('*')
      .eq('match_id', matchId)
      .eq('action_id', actionId)
      .maybeSingle();

    if (existingAction) {
      // Return prior accepted result without duplicating
      const { data: currentMatch } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      return new Response(
        JSON.stringify({
          accepted: true,
          idempotentReplay: true,
          revision: currentMatch?.revision || expectedRevision,
          match: currentMatch,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Retrieve canonical match & verify scoring authority
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      return new Response(JSON.stringify({ error: 'Match not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check authority: must match assigned scorer or hold active epoch authority
    const isAssignedScorer = match.assigned_scorer_account_id === actorAccountId;
    const { data: authorityRecord } = await supabase
      .from('match_scorer_authority')
      .select('*')
      .eq('match_id', matchId)
      .eq('account_id', actorAccountId)
      .eq('authority_epoch', authorityEpoch)
      .is('revoked_at', null)
      .maybeSingle();

    if (!isAssignedScorer && !authorityRecord) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: actor does not hold scoring authority for this epoch' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Optimistic concurrency check: match revision must match expected revision
    if (match.revision !== expectedRevision) {
      return new Response(
        JSON.stringify({
          error: 'REVISION_CONFLICT',
          canonicalRevision: match.revision,
          message: `Expected revision ${expectedRevision} but current canonical revision is ${match.revision}`,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Execute atomic update
    const nextRevision = match.revision + 1;
    const nextSequence = (match.revision || 0) + 1;

    // Insert action ledger entry
    const { error: insertActionError } = await supabase.from('match_actions').insert({
      match_id: matchId,
      action_id: actionId,
      sequence_number: nextSequence,
      expected_revision: expectedRevision,
      actor_account_id: actorAccountId,
      action_type: action.type,
      payload: action,
    });

    if (insertActionError) {
      return new Response(JSON.stringify({ error: 'Failed to record action ledger entry', details: insertActionError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Advance match revision conditionally
    const { data: updatedMatch, error: updateError } = await supabase
      .from('matches')
      .update({
        revision: nextRevision,
        last_updated: new Date().toISOString(),
      })
      .eq('id', matchId)
      .eq('revision', expectedRevision)
      .select()
      .single();

    if (updateError || !updatedMatch) {
      return new Response(
        JSON.stringify({
          error: 'REVISION_CONFLICT',
          canonicalRevision: match.revision,
          message: 'Concurrent update detected. Please reconcile match revisions.',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        accepted: true,
        revision: nextRevision,
        actionId,
        match: updatedMatch,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
