// Supabase Edge Function: commit-match-action
// Validates JWT, derives authentic actor session, validates scoring delivery via pure CricketEngine,
// computes canonical state progression, and atomically commits canonical revision and append-only match_actions.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  CricketEngine,
  validateDeliveryInput,
  createInitialInnings,
} from '../_shared/cricketEngine.ts';
import type {
  Match,
  Innings,
  InningsAction,
} from '../_shared/types.ts';

interface CommitActionPayload {
  matchId: string;
  expectedRevision: number;
  actionId: string;
  authorityEpoch: number;
  action: InningsAction;
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
      return new Response(
        JSON.stringify({ error: 'Invalid payload: matchId, actionId, expectedRevision, action required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
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

    // 4. Retrieve canonical match to compute state progression
    const { data: matchRow, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError || !matchRow) {
      return new Response(JSON.stringify({ error: 'Match not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Parse current match state payload
    const currentMatchState: Match = (typeof matchRow.state_payload === 'string'
      ? JSON.parse(matchRow.state_payload)
      : matchRow.state_payload) || {
      id: matchId,
      title: matchRow.title,
      format: matchRow.format,
      status: matchRow.sporting_status,
      revision: matchRow.revision,
      innings: [],
      currentInningsIndex: 0,
      rules: { totalOvers: 20, playersPerTeam: 11, wideValue: 1, noBallValue: 1 },
    };

    const innIndex = currentMatchState.currentInningsIndex ?? 0;
    const currentInnings = currentMatchState.innings?.[innIndex];

    // 6. Cricket Engine Domain Validation
    if (action.type === 'DELIVERY') {
      if (!currentInnings) {
        return new Response(
          JSON.stringify({ error: 'No active innings found for scoring delivery.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (currentInnings.isCompleted) {
        return new Response(
          JSON.stringify({ error: 'Current innings is already completed.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const deliveryValidation = validateDeliveryInput(
        action.delivery,
        currentInnings,
        currentMatchState.rules
      );

      if (!deliveryValidation.isValid) {
        return new Response(
          JSON.stringify({
            error: 'INVALID_DELIVERY',
            reason: deliveryValidation.reason || 'Delivery failed cricket rules validation',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Participant Squad Eligibility Check (if playing lineups are specified)
      const battingSquad = currentInnings.battingTeamId === currentMatchState.team1?.id
        ? currentMatchState.playingXITeam1
        : currentMatchState.playingXITeam2;
      const bowlingSquad = currentInnings.bowlingTeamId === currentMatchState.team1?.id
        ? currentMatchState.playingXITeam1
        : currentMatchState.playingXITeam2;

      if (battingSquad && battingSquad.length > 0) {
        if (!battingSquad.includes(action.delivery.strikerId)) {
          return new Response(
            JSON.stringify({
              error: 'INVALID_PARTICIPANT',
              reason: `Striker ${action.delivery.strikerId} is not in the batting squad`,
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (!battingSquad.includes(action.delivery.nonStrikerId)) {
          return new Response(
            JSON.stringify({
              error: 'INVALID_PARTICIPANT',
              reason: `Non-striker ${action.delivery.nonStrikerId} is not in the batting squad`,
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      if (bowlingSquad && bowlingSquad.length > 0) {
        if (!bowlingSquad.includes(action.delivery.bowlerId)) {
          return new Response(
            JSON.stringify({
              error: 'INVALID_PARTICIPANT',
              reason: `Bowler ${action.delivery.bowlerId} is not in the bowling squad`,
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // 7. Compute Next State Progression using CricketEngine
    let nextMatchState: Match = { ...currentMatchState };
    const nextRevision = expectedRevision + 1;

    if (currentInnings) {
      const updatedInningsArray: [Innings, Innings?] = [...currentMatchState.innings];

      if (action.type === 'DELIVERY') {
        const commandResult = CricketEngine.executeScoringCommand(
          currentInnings,
          action.delivery,
          currentMatchState.rules,
          currentMatchState.targetRuns
        );

        if (!commandResult.accepted) {
          return new Response(
            JSON.stringify({
              error: 'INVALID_DELIVERY',
              reason: commandResult.rejectionReason || 'Delivery failed cricket rules validation',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        updatedInningsArray[innIndex] = commandResult.innings;
        nextMatchState = {
          ...nextMatchState,
          innings: updatedInningsArray,
          status: commandResult.isMatchComplete ? 'completed' : nextMatchState.status,
          result: commandResult.isMatchComplete
            ? CricketEngine.evaluateMatchResult(nextMatchState) || 'Match Concluded'
            : nextMatchState.result,
        };
      } else if (action.type === 'RETIRE_BATTER') {
        updatedInningsArray[innIndex] = CricketEngine.retireBatter(
          currentInnings,
          action.playerId,
          action.dismissalType,
          action.timestamp || Date.now()
        );
        nextMatchState = { ...nextMatchState, innings: updatedInningsArray };
      } else if (action.type === 'RETURN_BATTER') {
        updatedInningsArray[innIndex] = CricketEngine.returnBatter(
          currentInnings,
          action.playerId,
          action.slot,
          action.timestamp || Date.now()
        );
        nextMatchState = { ...nextMatchState, innings: updatedInningsArray };
      } else if (action.type === 'SELECT_BOWLER') {
        const actions = [...(currentInnings.actions || []), action];
        updatedInningsArray[innIndex] = {
          ...currentInnings,
          currentBowlerId: action.bowlerId,
          actions,
        };
        nextMatchState = { ...nextMatchState, innings: updatedInningsArray };
      } else if (action.type === 'SELECT_BATTER') {
        const actions = [...(currentInnings.actions || []), action];
        const updatedBatterStats = { ...currentInnings.batterStats };
        if (!updatedBatterStats[action.playerId]) {
          updatedBatterStats[action.playerId] = {
            playerId: action.playerId,
            runs: 0,
            ballsFaced: 0,
            fours: 0,
            sixes: 0,
            strikeRate: 0,
            isOut: false,
            battingOrder: Object.keys(updatedBatterStats).length + 1,
          };
        }
        updatedInningsArray[innIndex] = {
          ...currentInnings,
          batterStats: updatedBatterStats,
          currentStrikerId: action.slot === 'striker' ? action.playerId : currentInnings.currentStrikerId,
          currentNonStrikerId: action.slot === 'nonStriker' ? action.playerId : currentInnings.currentNonStrikerId,
          actions,
        };
        nextMatchState = { ...nextMatchState, innings: updatedInningsArray };
      } else if (action.type === 'SWAP_ENDS') {
        const actions = [...(currentInnings.actions || []), action];
        updatedInningsArray[innIndex] = {
          ...currentInnings,
          currentStrikerId: currentInnings.currentNonStrikerId,
          currentNonStrikerId: currentInnings.currentStrikerId,
          actions,
        };
        nextMatchState = { ...nextMatchState, innings: updatedInningsArray };
      } else if (action.type === 'UNDO') {
        const pastActions = currentInnings.actions?.slice(0, -1) || [];
        updatedInningsArray[innIndex] = CricketEngine.replayInnings(
          currentMatchState.innings[innIndex]!,
          pastActions,
          currentMatchState.rules,
          currentMatchState.targetRuns
        );
        nextMatchState = { ...nextMatchState, innings: updatedInningsArray };
      } else if (action.type === 'END_INNINGS') {
        const finishedInnings: Innings = {
          ...currentInnings,
          isCompleted: true,
          completedReason: currentInnings.completedReason || 'Innings Concluded',
        };
        updatedInningsArray[innIndex] = finishedInnings;

        if (innIndex === 0) {
          // Transition from Innings 1 to Innings 2
          const targetRuns = finishedInnings.totalRuns + 1;
          const battingTeamId = finishedInnings.bowlingTeamId;
          const bowlingTeamId = finishedInnings.battingTeamId;

          const inn2 = createInitialInnings(
            2,
            battingTeamId,
            bowlingTeamId,
            action.strikerId,
            action.nonStrikerId,
            action.bowlerId
          );

          nextMatchState = {
            ...nextMatchState,
            innings: [finishedInnings, inn2],
            currentInningsIndex: 1,
            targetRuns,
            status: 'live',
          };
        } else {
          // 2nd innings ended -> Match completed
          nextMatchState = {
            ...nextMatchState,
            innings: updatedInningsArray,
            status: 'completed',
            result: CricketEngine.evaluateMatchResult({
              ...nextMatchState,
              innings: updatedInningsArray,
            }) || 'Match Concluded',
          };
        }
      } else {
        return new Response(
          JSON.stringify({ error: `Unsupported action type: ${(action as any).type}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    nextMatchState.revision = nextRevision;
    nextMatchState.lastUpdated = Date.now();

    // 8. Atomically Commit via PostgreSQL RPC commit_match_action_atomic
    const { data: rpcResult, error: rpcError } = await supabase.rpc('commit_match_action_atomic', {
      p_match_id: matchId,
      p_action_id: actionId,
      p_expected_revision: expectedRevision,
      p_authority_epoch: authorityEpoch,
      p_actor_account_id: actorAccountId,
      p_action_type: action.type,
      p_action_payload: action,
      p_next_state_payload: nextMatchState,
      p_next_revision: nextRevision,
    });

    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('UNAUTHORIZED')) {
        return new Response(JSON.stringify({ error: 'UNAUTHORIZED', message: msg }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (msg.includes('MATCH_NOT_FOUND')) {
        return new Response(JSON.stringify({ error: 'MATCH_NOT_FOUND', message: msg }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'DATABASE_ERROR', details: msg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!rpcResult.accepted) {
      return new Response(
        JSON.stringify({
          error: 'REVISION_CONFLICT',
          canonicalRevision: rpcResult.canonical_revision,
          message: rpcResult.message || 'Concurrency revision conflict',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        accepted: true,
        idempotentReplay: Boolean(rpcResult.idempotent_replay),
        revision: rpcResult.revision,
        actionId,
        match: rpcResult.match,
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
