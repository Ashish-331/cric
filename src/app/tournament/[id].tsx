import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { Tournament, Team, Match, Player } from '../../types/cricket';
import { formatOvers } from '../../engine/cricketEngine';
import { Colors } from '../../utils/colors';

interface TeamStanding {
  team: Team;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  runsScored: number;
  oversFacedDecimal: number;
  runsConceded: number;
  oversBowledDecimal: number;
  nrr: number;
}

interface PlayerTournamentStat {
  player: Player;
  team: Team;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  highScore: number;
  timesOut: number;
  wickets: number;
  legalBallsBowled: number;
  runsConceded: number;
  maidens: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  mvpPoints: number;
}

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    tournaments,
    matches,
    teams: allAvailableTeams,
    getTournamentById,
    addTeamToTournament,
    userProfile,
  } = useCricket();

  const [activeTab, setActiveTab] = useState<'standings' | 'matches' | 'leaderboard' | 'teams'>('standings');
  const [addTeamModalVisible, setAddTeamModalVisible] = useState(false);

  const tournament = useMemo(() => {
    return tournaments.find((t) => t.id === id) || getTournamentById(id || '');
  }, [tournaments, id, getTournamentById]);

  // Matches belonging to this tournament
  const tournamentMatches = useMemo(() => {
    if (!tournament) return [];
    // Either stored directly inside tournament.matches or matched via tournamentId in global matches
    const map = new Map<string, Match>();
    tournament.matches.forEach((m) => map.set(m.id, m));
    matches.filter((m) => m.tournamentId === tournament.id).forEach((m) => map.set(m.id, m));
    return Array.from(map.values());
  }, [tournament, matches]);

  // 1. Dynamic Points Table & Net Run Rate (NRR) Calculation
  const standings: TeamStanding[] = useMemo(() => {
    if (!tournament) return [];

    const statsMap = new Map<string, TeamStanding>();
    tournament.teams.forEach((team) => {
      statsMap.set(team.id, {
        team,
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        noResult: 0,
        points: 0,
        runsScored: 0,
        oversFacedDecimal: 0,
        runsConceded: 0,
        oversBowledDecimal: 0,
        nrr: 0,
      });
    });

    tournamentMatches.forEach((m) => {
      const inn1 = m.innings[0];
      const inn2 = m.innings[1];

      // Ensure teams are tracked even if added during schedule
      if (!statsMap.has(m.team1.id)) {
        statsMap.set(m.team1.id, {
          team: m.team1,
          played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0,
          runsScored: 0, oversFacedDecimal: 0, runsConceded: 0, oversBowledDecimal: 0, nrr: 0,
        });
      }
      if (!statsMap.has(m.team2.id)) {
        statsMap.set(m.team2.id, {
          team: m.team2,
          played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0,
          runsScored: 0, oversFacedDecimal: 0, runsConceded: 0, oversBowledDecimal: 0, nrr: 0,
        });
      }

      const st1 = statsMap.get(m.team1.id)!;
      const st2 = statsMap.get(m.team2.id)!;

      if (m.status === 'completed' || m.status === 'tied' || m.status === 'abandoned') {
        st1.played += 1;
        st2.played += 1;

        if (m.status === 'abandoned') {
          st1.noResult += 1;
          st2.noResult += 1;
          st1.points += 1;
          st2.points += 1;
          return;
        }

        if (m.status === 'tied' || m.result?.toLowerCase().includes('tie')) {
          st1.tied += 1;
          st2.tied += 1;
          st1.points += 1;
          st2.points += 1;
        } else if (m.result?.toLowerCase().includes(m.team1.name.toLowerCase())) {
          st1.won += 1;
          st2.lost += 1;
          st1.points += 2;
        } else if (m.result?.toLowerCase().includes(m.team2.name.toLowerCase())) {
          st2.won += 1;
          st1.lost += 1;
          st2.points += 2;
        }

        // Tally runs & overs for NRR computation
        if (inn1 && inn2) {
          const inn1BatTeamId = inn1.battingTeamId;
          const inn1TeamSt = statsMap.get(inn1BatTeamId);
          const inn2TeamSt = statsMap.get(inn2.battingTeamId);

          if (inn1TeamSt && inn2TeamSt) {
            // Innings 1 batting tally
            const inn1Balls = inn1.totalWickets >= (m.rules.playersPerTeam - 1)
              ? m.rules.totalOvers * 6
              : inn1.legalBallsBowled;
            const inn1Overs = inn1Balls / 6;
            inn1TeamSt.runsScored += inn1.totalRuns;
            inn1TeamSt.oversFacedDecimal += inn1Overs;
            inn2TeamSt.runsConceded += inn1.totalRuns;
            inn2TeamSt.oversBowledDecimal += inn1Overs;

            // Innings 2 batting tally
            const inn2Balls = inn2.totalWickets >= (m.rules.playersPerTeam - 1)
              ? m.rules.totalOvers * 6
              : inn2.legalBallsBowled;
            const inn2Overs = inn2Balls / 6;
            inn2TeamSt.runsScored += inn2.totalRuns;
            inn2TeamSt.oversFacedDecimal += inn2Overs;
            inn1TeamSt.runsConceded += inn2.totalRuns;
            inn1TeamSt.oversBowledDecimal += inn2Overs;
          }
        }
      }
    });

    // Compute Net Run Rate: (Runs Scored / Overs Faced) - (Runs Conceded / Overs Bowled)
    const list = Array.from(statsMap.values()).map((s) => {
      const runRateFor = s.oversFacedDecimal > 0 ? s.runsScored / s.oversFacedDecimal : 0;
      const runRateAgainst = s.oversBowledDecimal > 0 ? s.runsConceded / s.oversBowledDecimal : 0;
      const rawNrr = isFinite(runRateFor - runRateAgainst) ? runRateFor - runRateAgainst : 0;
      const nrr = Math.abs(rawNrr) < 0.0005 ? 0 : Number(rawNrr.toFixed(3));
      return { ...s, nrr };
    });

    // Sort by Points DESC, then NRR DESC, then Won DESC
    list.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.nrr !== a.nrr) return b.nrr - a.nrr;
      return b.won - a.won;
    });

    return list;
  }, [tournament, tournamentMatches]);

  // 2. Dynamic Tournament Leaderboards (MVP, Orange Cap, Purple Cap, Fielders)
  const playerStats = useMemo(() => {
    if (!tournament) return [];

    const pMap = new Map<string, PlayerTournamentStat>();

    // Seed all registered players across all tournament teams
    tournament.teams.forEach((t) => {
      t.players.forEach((p) => {
        pMap.set(p.id, {
          player: p,
          team: t,
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          highScore: 0,
          timesOut: 0,
          wickets: 0,
          legalBallsBowled: 0,
          runsConceded: 0,
          maidens: 0,
          catches: 0,
          stumpings: 0,
          runOuts: 0,
          mvpPoints: 0,
        });
      });
    });

    // Aggregate stats dynamically across all tournament match deliveries & scorecards
    tournamentMatches.forEach((m) => {
      m.innings.forEach((inn) => {
        if (!inn) return;

        // Batting stats
        Object.values(inn.batterStats).forEach((b) => {
          let stat = pMap.get(b.playerId);
          if (!stat) {
            const playerObj = [...m.team1.players, ...m.team2.players].find((p) => p.id === b.playerId);
            if (playerObj) {
              const teamObj = m.team1.players.some((p) => p.id === b.playerId) ? m.team1 : m.team2;
              stat = {
                player: playerObj,
                team: teamObj,
                runs: 0, ballsFaced: 0, fours: 0, sixes: 0, highScore: 0, timesOut: 0,
                wickets: 0, legalBallsBowled: 0, runsConceded: 0, maidens: 0,
                catches: 0, stumpings: 0, runOuts: 0, mvpPoints: 0,
              };
              pMap.set(b.playerId, stat);
            }
          }

          if (stat) {
            stat.runs += b.runs;
            stat.ballsFaced += b.ballsFaced;
            stat.fours += b.fours;
            stat.sixes += b.sixes;
            if (b.runs > stat.highScore) stat.highScore = b.runs;
            if (b.isOut) stat.timesOut += 1;
          }
        });

        // Bowling stats
        Object.values(inn.bowlerStats).forEach((bw) => {
          const stat = pMap.get(bw.playerId);
          if (stat) {
            stat.wickets += bw.wickets;
            stat.legalBallsBowled += bw.legalBalls;
            stat.runsConceded += bw.runsConceded;
            stat.maidens += bw.maidens;
          }
        });

        // Fielding stats from deliveries
        inn.deliveries.forEach((d) => {
          if (d.isWicket && d.wicketDetails?.fielderId) {
            const fId = d.wicketDetails.fielderId;
            const stat = pMap.get(fId);
            if (stat) {
              if (d.wicketDetails.dismissalType === 'caught' || d.wicketDetails.dismissalType === 'caught_and_bowled') {
                stat.catches += 1;
              } else if (d.wicketDetails.dismissalType === 'stumped') {
                stat.stumpings += 1;
              } else if (d.wicketDetails.dismissalType === 'run_out') {
                stat.runOuts += 1;
              }
            }
          }
        });
      });
    });

    // Calculate MVP Points:
    // Runs * 1 + Fours * 1 + Sixes * 2 + Wickets * 25 + Maidens * 8 + Catches * 8 + Stumpings * 12 + RunOuts * 8
    const list = Array.from(pMap.values()).map((st) => {
      const mvp =
        st.runs * 1 +
        st.fours * 1 +
        st.sixes * 2 +
        st.wickets * 25 +
        st.maidens * 8 +
        st.catches * 8 +
        st.stumpings * 12 +
        st.runOuts * 8;
      return { ...st, mvpPoints: mvp };
    });

    return list;
  }, [tournament, tournamentMatches]);

  // Derived Leaderboard categories
  const topMVP = useMemo(() => {
    return [...playerStats].sort((a, b) => b.mvpPoints - a.mvpPoints).slice(0, 5);
  }, [playerStats]);

  const topBatters = useMemo(() => {
    return [...playerStats].filter((p) => p.runs > 0).sort((a, b) => b.runs - a.runs).slice(0, 5);
  }, [playerStats]);

  const topBowlers = useMemo(() => {
    return [...playerStats].filter((p) => p.wickets > 0 || p.legalBallsBowled > 0).sort((a, b) => b.wickets - a.wickets).slice(0, 5);
  }, [playerStats]);

  const topFielders = useMemo(() => {
    return [...playerStats]
      .filter((p) => p.catches > 0 || p.stumpings > 0 || p.runOuts > 0)
      .sort((a, b) => b.catches + b.stumpings + b.runOuts - (a.catches + a.stumpings + a.runOuts))
      .slice(0, 5);
  }, [playerStats]);

  if (!tournament) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Tournament not found.</Text>
      </View>
    );
  }

  const handleEnrollTeam = async (team: Team) => {
    try {
      await addTeamToTournament(tournament.id, team);
      setAddTeamModalVisible(false);
      Alert.alert('Team Enrolled', `${team.name} has been added to the tournament.`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleScheduleMatchPress = () => {
    if (userProfile && (!userProfile.isVerified || userProfile.isGuest)) {
      Alert.alert(
        'Verification Required',
        'Please verify your phone number to organize tournaments and schedule matches.',
        [
          { text: 'Verify Phone', onPress: () => router.push('/auth/login') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    if (tournament.teams.length < 2) {
      Alert.alert('Teams Required', 'Please add at least 2 teams to the tournament before scheduling matches.');
      return;
    }

    router.push({
      pathname: '/(tabs)/new-match',
      params: { tournamentId: tournament.id },
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Tournament Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{tournament.status.toUpperCase()}</Text>
                </View>
                <View style={styles.formatBadge}>
                  <Text style={styles.formatBadgeText}>{tournament.format.toUpperCase()} • {tournament.totalOvers} OV</Text>
                </View>
              </View>
              <Text style={styles.tournamentName}>{tournament.name}</Text>
              <Text style={styles.organizerText}>
                Organized by: <Text style={styles.organizerBold}>{tournament.creatorName}</Text>
              </Text>
            </View>

            <TouchableOpacity style={styles.scheduleMatchBtn} onPress={handleScheduleMatchPress}>
              <Ionicons name="add-circle" size={18} color="#070D1E" />
              <Text style={styles.scheduleMatchBtnText}>Schedule Match</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Unverified banner if guest */}
        {userProfile && (!userProfile.isVerified || userProfile.isGuest) && (
          <TouchableOpacity
            style={styles.verifyBanner}
            onPress={() => router.push('/auth/login')}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color="#B45309" />
            <Text style={styles.verifyBannerText}>
              Please verify phone number to schedule matches & organize tournaments. Tap to verify.
            </Text>
          </TouchableOpacity>
        )}

        {/* Sub-Tabs: Standings | Matches | Leaderboard | Teams */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'standings' && styles.tabItemActive]}
            onPress={() => setActiveTab('standings')}
          >
            <Text style={[styles.tabItemText, activeTab === 'standings' && styles.tabItemTextActive]}>
              Points Table
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'matches' && styles.tabItemActive]}
            onPress={() => setActiveTab('matches')}
          >
            <Text style={[styles.tabItemText, activeTab === 'matches' && styles.tabItemTextActive]}>
              Fixtures ({tournamentMatches.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'leaderboard' && styles.tabItemActive]}
            onPress={() => setActiveTab('leaderboard')}
          >
            <Text style={[styles.tabItemText, activeTab === 'leaderboard' && styles.tabItemTextActive]}>
              Leaderboards
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'teams' && styles.tabItemActive]}
            onPress={() => setActiveTab('teams')}
          >
            <Text style={[styles.tabItemText, activeTab === 'teams' && styles.tabItemTextActive]}>
              Teams ({tournament.teams.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab 1: Points Table & Net Run Rate */}
        {activeTab === 'standings' && (
          <View style={styles.cardContainer}>
            <Text style={styles.sectionHeading}>Official Tournament Points Table</Text>
            <Text style={styles.subtext}>
              Points: Win = 2, Tie/NR = 1 • NRR = (Runs/Ov Faced) - (Runs/Ov Bowled)
            </Text>

            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 2 }]}>TEAM</Text>
              <Text style={[styles.th, styles.thNum]}>P</Text>
              <Text style={[styles.th, styles.thNum]}>W</Text>
              <Text style={[styles.th, styles.thNum]}>L</Text>
              <Text style={[styles.th, styles.thNum]}>NR</Text>
              <Text style={[styles.th, styles.thNum, { flex: 1.2 }]}>NRR</Text>
              <Text style={[styles.th, styles.thNum, { fontWeight: '900', color: Colors.pitchGreen }]}>PTS</Text>
            </View>

            {standings.map((s, idx) => (
              <View key={s.team.id} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
                <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.rankNum}>{idx + 1}</Text>
                  <Text style={styles.teamShortName} numberOfLines={1}>{s.team.name}</Text>
                </View>
                <Text style={[styles.td, styles.thNum]}>{s.played}</Text>
                <Text style={[styles.td, styles.thNum]}>{s.won}</Text>
                <Text style={[styles.td, styles.thNum]}>{s.lost}</Text>
                <Text style={[styles.td, styles.thNum]}>{s.noResult + s.tied}</Text>
                <Text
                  style={[
                    styles.td,
                    styles.thNum,
                    {
                      flex: 1.2,
                      color: s.nrr > 0 ? '#38BDF8' : s.nrr < 0 ? '#F87171' : '#94A3B8',
                    },
                  ]}
                >
                  {s.nrr > 0 ? `+${s.nrr.toFixed(3)}` : s.nrr.toFixed(3)}
                </Text>
                <Text style={[styles.td, styles.thNum, styles.pointsHighlight]}>
                  {s.points}
                </Text>
              </View>
            ))}

            {standings.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No tournament teams registered yet.</Text>
              </View>
            )}
          </View>
        )}

        {/* Tab 2: Tournament Fixtures & Results */}
        {activeTab === 'matches' && (
          <View style={styles.matchesList}>
            <View style={styles.matchesHeaderRow}>
              <Text style={styles.sectionHeading}>Tournament Matches</Text>
              <TouchableOpacity style={styles.addMatchSmallBtn} onPress={handleScheduleMatchPress}>
                <Ionicons name="add" size={14} color="#FFF" />
                <Text style={styles.addMatchSmallBtnText}>Schedule Match</Text>
              </TouchableOpacity>
            </View>

            {tournamentMatches.map((m) => (
              <View key={m.id} style={styles.matchCard}>
                <View style={styles.matchCardHeader}>
                  <Text style={styles.matchDate}>{m.date} • {m.venue}</Text>
                  <View style={[styles.matchStatusPill, m.status === 'live' && styles.matchStatusLive]}>
                    <Text style={styles.matchStatusPillText}>{m.status.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.matchScoreRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.matchTeamName}>{m.team1.name}</Text>
                    <Text style={styles.matchScoreText}>
                      {m.innings[0] ? `${m.innings[0].totalRuns}/${m.innings[0].totalWickets} (${m.innings[0].oversFormatted} ov)` : 'Yet to bat'}
                    </Text>
                  </View>

                  <Text style={styles.vsText}>VS</Text>

                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.matchTeamName}>{m.team2.name}</Text>
                    <Text style={styles.matchScoreText}>
                      {m.innings[1] ? `${m.innings[1].totalRuns}/${m.innings[1].totalWickets} (${m.innings[1].oversFormatted} ov)` : 'Yet to bat'}
                    </Text>
                  </View>
                </View>

                {m.result ? (
                  <Text style={styles.matchResultText}>{m.result}</Text>
                ) : null}

                <View style={styles.matchActionsRow}>
                  {m.status !== 'completed' && m.status !== 'abandoned' ? (
                    <TouchableOpacity
                      style={styles.openScorerBtn}
                      onPress={() => router.push(`/match/${m.id}/scorer`)}
                    >
                      <Ionicons name="flash" size={14} color="#070D1E" />
                      <Text style={styles.openScorerBtnText}>Live Scorer</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={styles.viewScorecardBtn}
                    onPress={() => router.push(`/match/${m.id}`)}
                  >
                    <Text style={styles.viewScorecardBtnText}>Match Centre</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {tournamentMatches.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No matches scheduled in this tournament yet.</Text>
                <TouchableOpacity style={styles.scheduleMatchEmptyBtn} onPress={handleScheduleMatchPress}>
                  <Text style={styles.scheduleMatchEmptyText}>Schedule First Match</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Tab 3: Dynamic Leaderboards */}
        {activeTab === 'leaderboard' && (
          <View style={styles.leaderboardsContainer}>
            {/* MVP Leaderboard */}
            <View style={styles.leaderboardCard}>
              <View style={styles.cardTitleRow}>
                <MaterialCommunityIcons name="crown" size={20} color="#FFD700" />
                <Text style={styles.leaderboardTitle}>Most Valuable Player (MVP)</Text>
              </View>
              <Text style={styles.cardFormulaSub}>
                Formula: Runs*1 + 4s*1 + 6s*2 + Wkts*25 + Maidens*8 + Catches*8 + Stumpings*12
              </Text>

              {topMVP.map((st, i) => (
                <View key={st.player.id} style={styles.leaderRow}>
                  <Text style={styles.rankNum}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leaderName}>{st.player.name}</Text>
                    <Text style={styles.leaderTeamSub}>{st.team.name}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.leaderMetricHigh}>{st.mvpPoints} pts</Text>
                    <Text style={styles.leaderDetailSub}>
                      {st.runs} runs • {st.wickets} wkts • {st.catches + st.stumpings} catches
                    </Text>
                  </View>
                </View>
              ))}

              {topMVP.length === 0 && (
                <Text style={styles.emptySub}>No tournament deliveries recorded yet.</Text>
              )}
            </View>

            {/* Orange Cap: Top Batsman */}
            <View style={styles.leaderboardCard}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="baseball" size={18} color="#FB923C" />
                <Text style={styles.leaderboardTitle}>Orange Cap (Top Batsman)</Text>
              </View>
              {topBatters.map((st, i) => {
                const sr = st.ballsFaced > 0 ? ((st.runs / st.ballsFaced) * 100).toFixed(1) : '0.0';
                return (
                  <View key={st.player.id} style={styles.leaderRow}>
                    <Text style={styles.rankNum}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.leaderName}>{st.player.name}</Text>
                      <Text style={styles.leaderTeamSub}>{st.team.name}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.leaderMetricHigh, { color: '#FB923C' }]}>{st.runs} Runs</Text>
                      <Text style={styles.leaderDetailSub}>
                        SR: {sr} • HS: {st.highScore} • {st.fours}x4, {st.sixes}x6
                      </Text>
                    </View>
                  </View>
                );
              })}
              {topBatters.length === 0 && (
                <Text style={styles.emptySub}>No batting runs recorded yet.</Text>
              )}
            </View>

            {/* Purple Cap: Top Bowler */}
            <View style={styles.leaderboardCard}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="trophy" size={18} color="#D500F9" />
                <Text style={styles.leaderboardTitle}>Purple Cap (Top Bowler)</Text>
              </View>
              {topBowlers.map((st, i) => {
                const ov = formatOvers(st.legalBallsBowled);
                const econ = st.legalBallsBowled > 0 ? (st.runsConceded / (st.legalBallsBowled / 6)).toFixed(2) : '0.00';
                return (
                  <View key={st.player.id} style={styles.leaderRow}>
                    <Text style={styles.rankNum}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.leaderName}>{st.player.name}</Text>
                      <Text style={styles.leaderTeamSub}>{st.team.name}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.leaderMetricHigh, { color: '#D500F9' }]}>{st.wickets} Wkts</Text>
                      <Text style={styles.leaderDetailSub}>
                        Econ: {econ} • {ov} ov • {st.maidens} maidens
                      </Text>
                    </View>
                  </View>
                );
              })}
              {topBowlers.length === 0 && (
                <Text style={styles.emptySub}>No bowling wickets recorded yet.</Text>
              )}
            </View>

            {/* Top Fielders */}
            <View style={styles.leaderboardCard}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="hand-left-outline" size={18} color="#00E5FF" />
                <Text style={styles.leaderboardTitle}>Top Fielders</Text>
              </View>
              {topFielders.map((st, i) => (
                <View key={st.player.id} style={styles.leaderRow}>
                  <Text style={styles.rankNum}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leaderName}>{st.player.name}</Text>
                    <Text style={styles.leaderTeamSub}>{st.team.name}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.leaderMetricHigh, { color: '#00E5FF' }]}>
                      {st.catches + st.stumpings + st.runOuts} Dismissals
                    </Text>
                    <Text style={styles.leaderDetailSub}>
                      {st.catches} ct • {st.stumpings} st • {st.runOuts} ro
                    </Text>
                  </View>
                </View>
              ))}
              {topFielders.length === 0 && (
                <Text style={styles.emptySub}>No fielding dismissals recorded yet.</Text>
              )}
            </View>
          </View>
        )}

        {/* Tab 4: Tournament Teams */}
        {activeTab === 'teams' && (
          <View style={styles.teamsTabContainer}>
            <View style={styles.matchesHeaderRow}>
              <Text style={styles.sectionHeading}>Enrolled Teams ({tournament.teams.length})</Text>
              <TouchableOpacity
                style={styles.addMatchSmallBtn}
                onPress={() => setAddTeamModalVisible(true)}
              >
                <Ionicons name="add" size={14} color="#FFF" />
                <Text style={styles.addMatchSmallBtnText}>Enroll Team</Text>
              </TouchableOpacity>
            </View>

            {tournament.teams.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={styles.teamCard}
                onPress={() => router.push(`/teams/${t.id}`)}
              >
                <View style={styles.teamCardIconWrap}>
                  <Ionicons name="shield" size={24} color={Colors.pitchGreen} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamNameText}>{t.name}</Text>
                  <Text style={styles.teamPlayersSub}>{t.players.length} Registered Players</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#64748B" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal: Enroll Team into Tournament */}
      <Modal visible={addTeamModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enroll Team into Tournament</Text>
            <Text style={styles.modalSubtitle}>
              Select a club or team to add to {tournament.name}
            </Text>

            <ScrollView style={styles.teamPickerScroll}>
              {allAvailableTeams
                .filter((t) => !tournament.teams.some((et) => et.id === t.id))
                .map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.teamPickItem}
                    onPress={() => handleEnrollTeam(t)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.teamPickName}>{t.name}</Text>
                      <Text style={styles.teamPickSub}>{t.players.length} players</Text>
                    </View>
                    <Ionicons name="add-circle" size={22} color={Colors.pitchGreen} />
                  </TouchableOpacity>
                ))}

              {allAvailableTeams.filter((t) => !tournament.teams.some((et) => et.id === t.id)).length === 0 && (
                <Text style={styles.emptyText}>All existing teams are already enrolled in this tournament.</Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setAddTeamModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  statusBadge: {
    backgroundColor: Colors.pitchGreen,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: '#070D1E',
    fontSize: 10,
    fontWeight: '900',
  },
  formatBadge: {
    backgroundColor: '#1E293B',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  formatBadgeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  tournamentName: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
  },
  organizerText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  organizerBold: {
    color: '#F1F5F9',
    fontWeight: '700',
  },
  scheduleMatchBtn: {
    backgroundColor: Colors.pitchGreen,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  scheduleMatchBtnText: {
    color: '#070D1E',
    fontWeight: '900',
    fontSize: 12,
  },
  verifyBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  verifyBannerText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    marginBottom: 12,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: Colors.primary,
  },
  tabItemText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  tabItemTextActive: {
    color: '#FFFFFF',
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primary,
  },
  subtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingHorizontal: 6,
  },
  th: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  thNum: {
    flex: 1,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  rankNum: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    width: 14,
  },
  teamShortName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  td: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  pointsHighlight: {
    color: Colors.primary,
    fontWeight: '900',
    fontSize: 13,
  },
  matchesList: {
    gap: 10,
  },
  matchesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  addMatchSmallBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  addMatchSmallBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  matchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  matchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  matchDate: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  matchStatusPill: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  matchStatusLive: {
    backgroundColor: Colors.pitchGreen,
  },
  matchStatusPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0F172A',
  },
  matchScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  matchTeamName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  matchScoreText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  vsText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94A3B8',
    paddingHorizontal: 8,
  },
  matchResultText: {
    fontSize: 12,
    color: Colors.pitchGreen,
    fontWeight: '700',
    marginBottom: 10,
  },
  matchActionsRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  openScorerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.pitchGreen,
    paddingVertical: 8,
    borderRadius: 8,
  },
  openScorerBtnText: {
    color: '#070D1E',
    fontWeight: '900',
    fontSize: 12,
  },
  viewScorecardBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewScorecardBtnText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 12,
    fontStyle: 'italic',
  },
  scheduleMatchEmptyBtn: {
    marginTop: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  scheduleMatchEmptyText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  leaderboardsContainer: {
    gap: 12,
  },
  leaderboardCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  leaderboardTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  cardFormulaSub: {
    color: '#64748B',
    fontSize: 10,
    marginBottom: 10,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 8,
  },
  leaderName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  leaderTeamSub: {
    color: '#94A3B8',
    fontSize: 10,
  },
  leaderMetricHigh: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '900',
  },
  leaderDetailSub: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 1,
  },
  emptySub: {
    color: '#64748B',
    fontSize: 11,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  teamsTabContainer: {
    gap: 8,
  },
  teamCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  teamCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamNameText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  teamPlayersSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 12,
  },
  teamPickerScroll: {
    maxHeight: 280,
  },
  teamPickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  teamPickName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  teamPickSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
});
