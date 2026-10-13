import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import {
  Team,
  Player,
  MatchFormat,
  TossDecision,
  BallType,
  PlayingRole,
  Tournament,
  PlayerSearchMatchResult,
} from '../../types/cricket';
import { Colors } from '../../utils/colors';
import { CricketHaptics } from '../../services/haptics';
import { StatsRollupEngine } from '../../engine/statsRollupEngine';
import { validateMatchOversQuota } from '../../engine/cricketEngine';
import { PlayerIdentityService } from '../../services/playerIdentityService';
import { useTheme, ThemeColors } from '../../theme/useTheme';

const COLOR_OPTIONS = [
  '#004BA0', // Classic Navy
  '#D32F2F', // Crimson Red
  '#2E7D32', // Forest Green
  '#FF8F00', // Amber
  '#6A1B9A', // Royal Purple
  '#00838F', // Cyan
  '#37474F', // Slate
];

export default function NewMatchScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {
    teams,
    tournaments,
    createNewMatch,
    createNewTeam,
    saveTeam,
    userProfile,
  } = useCricket();

  // Execution Mode: Start Now vs Schedule For Later
  const [matchMode, setMatchMode] = useState<'start_now' | 'schedule'>('start_now');

  // Match Context: Standalone Match vs Tournament Match
  const [matchContext, setMatchContext] = useState<'standalone' | 'tournament'>('standalone');
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(
    tournaments[0]?.id || ''
  );

  // Match Details & Schedule
  const [title, setTitle] = useState('Premier Grassroots Clash');
  const [venue, setVenue] = useState('Gymkhana Ground, Pitch 1');
  const [city, setCity] = useState('Mumbai');
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [matchTime, setMatchTime] = useState('10:00 AM');
  const [totalOvers, setTotalOvers] = useState('20');
  const [format, setFormat] = useState<MatchFormat>('t20');
  const [ballType, setBallType] = useState<BallType>('leather');
  const [squadSize, setSquadSize] = useState<number>(11);
  const [isCustomSquad, setIsCustomSquad] = useState(false);
  const [customSquadSizeInput, setCustomSquadSizeInput] = useState('11');
  const [scorerName, setScorerName] = useState(
    userProfile?.name || 'Assigned Scorer'
  );
  const [organizerName, setOrganizerName] = useState(
    userProfile?.name || 'Match Organizing Committee'
  );

  // Selected Competing Teams
  const [team1Id, setTeam1Id] = useState<string>(teams[0]?.id || '');
  const [team2Id, setTeam2Id] = useState<string>(teams[1]?.id || '');

  // Keep selection in sync when teams change
  useEffect(() => {
    if (teams.length > 0 && !team1Id) {
      setTeam1Id(teams[0].id);
    }
    if (teams.length > 1 && !team2Id) {
      setTeam2Id(teams[1].id);
    }
  }, [teams, team1Id, team2Id]);

  // Lineup selection per match: array of player IDs participating today
  const [team1Lineup, setTeam1Lineup] = useState<string[]>([]);
  const [team2Lineup, setTeam2Lineup] = useState<string[]>([]);
  const [team1CaptainId, setTeam1CaptainId] = useState<string>('');
  const [team1WicketkeeperId, setTeam1WicketkeeperId] = useState<string>('');
  const [team2CaptainId, setTeam2CaptainId] = useState<string>('');
  const [team2WicketkeeperId, setTeam2WicketkeeperId] = useState<string>('');

  // Team Picker Modal State
  const [teamPickerSlot, setTeamPickerSlot] = useState<'team1' | 'team2' | null>(null);
  const [teamPickerTab, setTeamPickerTab] = useState<'your' | 'opponents'>('your');
  const [teamPickerSearch, setTeamPickerSearch] = useState('');

  // Inline Add Team Modal State
  const [isAddTeamModalVisible, setIsAddTeamModalVisible] = useState(false);
  const [addTeamSlot, setAddTeamSlot] = useState<'team1' | 'team2'>('team1');
  const [addTeamType, setAddTeamType] = useState<'your' | 'opponent'>('your');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamShortName, setNewTeamShortName] = useState('');
  const [newTeamCity, setNewTeamCity] = useState('Mumbai');
  const [newTeamColor, setNewTeamColor] = useState('#004BA0');
  const [newTeamCaptainName, setNewTeamCaptainName] = useState('');
  const [newTeamCaptainEmail, setNewTeamCaptainEmail] = useState('');
  const [newTeamCaptainPhone, setNewTeamCaptainPhone] = useState('');
  const [addSelfToNewTeam, setAddSelfToNewTeam] = useState(true);

  // Toss State (For Start Now)
  const [tossWinnerId, setTossWinnerId] = useState<string>('');
  const [tossDecision, setTossDecision] = useState<TossDecision>('bat');

  // Openers State (For Start Now)
  const [strikerId, setStrikerId] = useState<string>('');
  const [nonStrikerId, setNonStrikerId] = useState<string>('');
  const [bowlerId, setBowlerId] = useState<string>('');

  // Search-First Add Player Modal
  const [addPlayerSlot, setAddPlayerSlot] = useState<'team1' | 'team2' | null>(null);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerSearchResults, setPlayerSearchResults] = useState<PlayerSearchMatchResult[]>([]);
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
  const [showManualPlayerForm, setShowManualPlayerForm] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerRole, setNewPlayerRole] = useState<PlayingRole>('all-rounder');
  const [newPlayerEmail, setNewPlayerEmail] = useState('');
  const [newPlayerPhone, setNewPlayerPhone] = useState('');
  const [isMatchGuestOnly, setIsMatchGuestOnly] = useState(false);

  // Resolve team entities
  const team1 = useMemo(() => teams.find((t) => t.id === team1Id) || teams[0], [teams, team1Id]);
  const team2 = useMemo(() => teams.find((t) => t.id === team2Id) || teams[1], [teams, team2Id]);

  // Synchronize default lineup when teams or squad size change
  useEffect(() => {
    if (team1) {
      const activeIds = team1.players.slice(0, squadSize).map((p) => p.id);
      setTeam1Lineup(activeIds);
      setTeam1CaptainId(team1.captainPlayerId || activeIds[0] || '');
      const wk = team1.players.find((p) => p.isWicketkeeper || p.role === 'wicketkeeper');
      setTeam1WicketkeeperId(wk?.id || activeIds[1] || '');
    }
  }, [team1?.id, squadSize]);

  useEffect(() => {
    if (team2) {
      const activeIds = team2.players.slice(0, squadSize).map((p) => p.id);
      setTeam2Lineup(activeIds);
      setTeam2CaptainId(team2.captainPlayerId || activeIds[0] || '');
      const wk = team2.players.find((p) => p.isWicketkeeper || p.role === 'wicketkeeper');
      setTeam2WicketkeeperId(wk?.id || activeIds[1] || '');
    }
  }, [team2?.id, squadSize]);

  // Validate Overs Quota in real-time
  const oversValidation = useMemo(() => {
    return validateMatchOversQuota(totalOvers);
  }, [totalOvers]);

  // Tournament Entity
  const selectedTournament = useMemo(
    () => tournaments.find((t) => t.id === selectedTournamentId),
    [tournaments, selectedTournamentId]
  );

  // Validation: Team 1 and Team 2 must be different canonical teams
  const areTeamsIdentical = Boolean(team1 && team2 && team1.id === team2.id);

  // Batting and Bowling teams based on toss
  const effectiveTossWinner = tossWinnerId || team1?.id || '';
  const team1BattingFirst =
    (effectiveTossWinner === team1?.id && tossDecision === 'bat') ||
    (effectiveTossWinner === team2?.id && tossDecision === 'bowl');

  const battingTeam = team1BattingFirst ? team1 : team2;
  const bowlingTeam = team1BattingFirst ? team2 : team1;

  // Filter available openers to players currently in match-day lineup
  const battingLineupPlayers = useMemo(() => {
    if (!battingTeam) return [];
    const lineupIds = battingTeam.id === team1?.id ? team1Lineup : team2Lineup;
    return battingTeam.players.filter((p) => lineupIds.includes(p.id));
  }, [battingTeam, team1, team1Lineup, team2Lineup]);

  const bowlingLineupPlayers = useMemo(() => {
    if (!bowlingTeam) return [];
    const lineupIds = bowlingTeam.id === team1?.id ? team1Lineup : team2Lineup;
    return bowlingTeam.players.filter((p) => lineupIds.includes(p.id));
  }, [bowlingTeam, team1, team1Lineup, team2Lineup]);

  const currentStriker = strikerId || battingLineupPlayers[0]?.id || '';
  const currentNonStriker = nonStrikerId || battingLineupPlayers[1]?.id || '';
  const currentBowler = bowlerId || bowlingLineupPlayers[0]?.id || '';

  // Handle Overs preset button
  const handleOversPreset = (ov: string) => {
    CricketHaptics.toggle();
    setTotalOvers(ov);
    const quotaRes = validateMatchOversQuota(ov);
    if (quotaRes.valid && quotaRes.format) {
      setFormat(quotaRes.format);
    }
  };

  // Handle squad size preset
  const handleSquadSizePreset = (size: number) => {
    CricketHaptics.toggle();
    setIsCustomSquad(false);
    setSquadSize(size);
  };

  const handleCustomSquadSizeChange = (val: string) => {
    setCustomSquadSizeInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 2 && parsed <= 30) {
      setSquadSize(parsed);
    }
  };

  // Toggle player inclusion in match-day lineup
  const togglePlayerInLineup = (teamSlot: 'team1' | 'team2', playerId: string) => {
    CricketHaptics.toggle();
    if (teamSlot === 'team1') {
      if (team1Lineup.includes(playerId)) {
        if (team1Lineup.length <= 2) {
          Alert.alert('Minimum Lineup', 'A match-day lineup requires at least 2 players.');
          return;
        }
        setTeam1Lineup((prev) => prev.filter((id) => id !== playerId));
      } else {
        setTeam1Lineup((prev) => [...prev, playerId]);
      }
    } else {
      if (team2Lineup.includes(playerId)) {
        if (team2Lineup.length <= 2) {
          Alert.alert('Minimum Lineup', 'A match-day lineup requires at least 2 players.');
          return;
        }
        setTeam2Lineup((prev) => prev.filter((id) => id !== playerId));
      } else {
        setTeam2Lineup((prev) => [...prev, playerId]);
      }
    }
  };

  // Handle Team Picker selection
  const handleSelectTeamFromPicker = (selected: Team) => {
    CricketHaptics.toggle();
    if (teamPickerSlot === 'team1') {
      setTeam1Id(selected.id);
      setStrikerId('');
      setNonStrikerId('');
      setBowlerId('');
    } else if (teamPickerSlot === 'team2') {
      setTeam2Id(selected.id);
      setStrikerId('');
      setNonStrikerId('');
      setBowlerId('');
    }
    setTeamPickerSlot(null);
  };

  // Handle creating a new team inline
  const handleCreateNewTeamInline = async () => {
    if (!newTeamName.trim()) {
      Alert.alert('Team Name Required', 'Please enter a name for the new team.');
      return;
    }
    const shortName = newTeamShortName.trim() || newTeamName.trim().substring(0, 3).toUpperCase();

    try {
      CricketHaptics.milestone();
      const isOpponent = addTeamType === 'opponent';

      const created = await createNewTeam(
        newTeamName.trim(),
        shortName,
        newTeamColor,
        {
          city: newTeamCity.trim(),
          isOpponent,
          addSelfAsPlayer: isOpponent ? false : addSelfToNewTeam,
          captainName: newTeamCaptainName.trim() || undefined,
          captainEmail: newTeamCaptainEmail.trim() || undefined,
          captainPhone: newTeamCaptainPhone.trim() || undefined,
        }
      );

      if (addTeamSlot === 'team1') {
        setTeam1Id(created.id);
      } else {
        setTeam2Id(created.id);
      }

      setIsAddTeamModalVisible(false);
      setNewTeamName('');
      setNewTeamShortName('');
      setNewTeamCaptainName('');
      setNewTeamCaptainEmail('');
      setNewTeamCaptainPhone('');

      Alert.alert(
        'Team Created! 🏏',
        `${created.name} (${created.shortName}) has been added and selected.`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create team.');
    }
  };

  // Perform search in Add Player Modal
  const handleSearchPlayers = async (text: string) => {
    setPlayerSearchQuery(text);
    if (!text.trim() || text.trim().length < 2) {
      setPlayerSearchResults([]);
      return;
    }
    setIsSearchingPlayers(true);
    try {
      const results = await PlayerIdentityService.searchPlayerProfiles(text, userProfile?.id);
      setPlayerSearchResults(results);
    } catch (e) {
      console.warn('Search error:', e);
    } finally {
      setIsSearchingPlayers(false);
    }
  };

  // Add existing player profile to target team
  const handleAddExistingPlayer = async (result: PlayerSearchMatchResult) => {
    const targetTeam = addPlayerSlot === 'team1' ? team1 : team2;
    if (!targetTeam) return;

    if (targetTeam.players.some((p) => p.id === result.id)) {
      Alert.alert('Already on Roster', `${result.name} is already on this team.`);
      return;
    }

    try {
      CricketHaptics.milestone();
      const newPlayer: Player = {
        id: result.id,
        name: result.name,
        role: result.role,
        battingHand: 'right',
        bowlingStyle: 'fast-medium',
        phoneNumber: result.phoneNumber,
        email: result.email,
        isGuest: !result.isClaimed,
        isVerified: Boolean(result.isClaimed || result.isRegisteredUser),
        careerStats: StatsRollupEngine.createEmptyCareerStats(),
        recentScores: [],
      };

      const updatedTeam: Team = {
        ...targetTeam,
        players: [...targetTeam.players, newPlayer],
      };

      await saveTeam(updatedTeam);

      // Add to match lineup automatically
      if (addPlayerSlot === 'team1') {
        setTeam1Lineup((prev) => [...prev, newPlayer.id]);
      } else {
        setTeam2Lineup((prev) => [...prev, newPlayer.id]);
      }

      setAddPlayerSlot(null);
      setPlayerSearchQuery('');
      setPlayerSearchResults([]);
      Alert.alert('Player Added! 🏏', `${newPlayer.name} has been added to ${targetTeam.name}.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add player.');
    }
  };

  // Add new player profile / ghost to team
  const handleCreateNewPlayerSubmit = async () => {
    if (!newPlayerName.trim()) {
      Alert.alert('Name Required', 'Please enter player full name.');
      return;
    }
    const targetTeam = addPlayerSlot === 'team1' ? team1 : team2;
    if (!targetTeam) return;

    try {
      CricketHaptics.milestone();
      const newPlayer: Player = {
        id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: newPlayerName.trim(),
        role: newPlayerRole,
        battingHand: 'right',
        email: newPlayerEmail.trim() || undefined,
        phoneNumber: newPlayerPhone.trim() || undefined,
        isGuest: true,
        isMatchGuest: isMatchGuestOnly,
        careerStats: StatsRollupEngine.createEmptyCareerStats(),
        recentScores: [],
      };

      if (!isMatchGuestOnly) {
        // Save to persistent team roster
        const updatedTeam: Team = {
          ...targetTeam,
          players: [...targetTeam.players, newPlayer],
        };
        await saveTeam(updatedTeam);
      }

      // Add to current match lineup
      if (addPlayerSlot === 'team1') {
        setTeam1Lineup((prev) => [...prev, newPlayer.id]);
      } else {
        setTeam2Lineup((prev) => [...prev, newPlayer.id]);
      }

      setAddPlayerSlot(null);
      setNewPlayerName('');
      setNewPlayerEmail('');
      setNewPlayerPhone('');
      setIsMatchGuestOnly(false);
      setShowManualPlayerForm(false);

      Alert.alert(
        'Player Added! 🏏',
        `${newPlayer.name} has been added as a ${
          isMatchGuestOnly ? 'match-only guest' : 'permanent roster player'
        }.`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not add player.');
    }
  };

  // Submission handler for Start Now or Schedule
  const handleFormSubmit = async () => {
    if (!team1 || !team2 || areTeamsIdentical) {
      Alert.alert('Invalid Teams', 'Team A and Team B must be two distinct canonical teams.');
      return;
    }

    if (!oversValidation.valid) {
      Alert.alert('Invalid Overs Quota', oversValidation.error || 'Please enter a valid overs quota.');
      return;
    }

    const oversNum = oversValidation.overs!;

    // For Start Now: Toss and Openers are required
    if (matchMode === 'start_now') {
      if (!currentStriker || !currentNonStriker || currentStriker === currentNonStriker) {
        Alert.alert('Batters Required', 'Please select two distinct opening batters from the active lineup.');
        return;
      }

      if (!currentBowler) {
        Alert.alert('Bowler Required', 'Please select an opening bowler from the active lineup.');
        return;
      }
    }

    try {
      CricketHaptics.milestone();

      const match = await createNewMatch({
        title: title.trim() || 'Premier Grassroots Clash',
        format: oversValidation.format || format,
        venue: `${venue.trim()}, ${city.trim()}`,
        team1,
        team2,
        tossWinnerId: matchMode === 'start_now' ? effectiveTossWinner : undefined,
        tossDecision: matchMode === 'start_now' ? tossDecision : undefined,
        totalOvers: oversNum,
        playersPerTeam: squadSize,
        playingXITeam1: team1Lineup,
        playingXITeam2: team2Lineup,
        team1CaptainId,
        team1WicketkeeperId,
        team2CaptainId,
        team2WicketkeeperId,
        strikerId: matchMode === 'start_now' ? currentStriker : undefined,
        nonStrikerId: matchMode === 'start_now' ? currentNonStriker : undefined,
        openingBowlerId: matchMode === 'start_now' ? currentBowler : undefined,
        ballType,
        scorerName: scorerName.trim() || 'Official Scorer',
        organizerName: organizerName.trim() || 'Match Organizing Committee',
        tournamentId: matchContext === 'tournament' ? selectedTournamentId : undefined,
        status: matchMode === 'start_now' ? 'live' : 'scheduled',
        date: matchDate.trim() || new Date().toISOString().split('T')[0],
        time: matchTime.trim() || '10:00 AM',
      });

      if (matchMode === 'start_now') {
        router.push(`/match/${match.id}/scorer`);
      } else {
        Alert.alert(
          'Fixture Scheduled! 📅',
          `Match "${match.title}" has been scheduled for ${match.date} at ${match.time || '10:00 AM'}.`,
          [{ text: 'View Home', onPress: () => router.push('/') }]
        );
      }
    } catch (err: any) {
      CricketHaptics.wicket();
      Alert.alert('Error', err.message || 'Failed to initialize match.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mode Switcher: Start Now vs Schedule For Later */}
      <View style={styles.modeCard}>
        <Text style={styles.modeCardLabel}>SELECT MATCH WORKFLOW</Text>
        <View style={styles.modeTabsRow}>
          <TouchableOpacity
            style={[styles.modeTab, matchMode === 'start_now' && styles.modeTabActive]}
            onPress={() => {
              CricketHaptics.toggle();
              setMatchMode('start_now');
            }}
          >
            <Ionicons
              name="flash"
              size={16}
              color={matchMode === 'start_now' ? '#070D1E' : '#00E676'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.modeTabText,
                matchMode === 'start_now' && styles.modeTabTextActive,
              ]}
            >
              Start Now (Live Scorer)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, matchMode === 'schedule' && styles.modeTabActive]}
            onPress={() => {
              CricketHaptics.toggle();
              setMatchMode('schedule');
            }}
          >
            <Ionicons
              name="calendar"
              size={16}
              color={matchMode === 'schedule' ? '#070D1E' : '#FFB300'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.modeTabText,
                matchMode === 'schedule' && styles.modeTabTextActive,
              ]}
            >
              Schedule For Later
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Match Context Switcher */}
      <View style={styles.contextCard}>
        <Text style={styles.cardSectionLabel}>1. MATCH CONTEXT</Text>
        <View style={styles.contextTabsRow}>
          <TouchableOpacity
            style={[styles.contextTab, matchContext === 'standalone' && styles.contextTabActive]}
            onPress={() => {
              CricketHaptics.toggle();
              setMatchContext('standalone');
            }}
          >
            <Ionicons
              name="shield-outline"
              size={16}
              color={matchContext === 'standalone' ? '#070D1E' : '#94A3B8'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.contextTabText,
                matchContext === 'standalone' && styles.contextTabTextActive,
              ]}
            >
              Standalone Match
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.contextTab, matchContext === 'tournament' && styles.contextTabActive]}
            onPress={() => {
              CricketHaptics.toggle();
              setMatchContext('tournament');
            }}
          >
            <Ionicons
              name="trophy-outline"
              size={16}
              color={matchContext === 'tournament' ? '#070D1E' : '#94A3B8'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.contextTabText,
                matchContext === 'tournament' && styles.contextTabTextActive,
              ]}
            >
              Tournament Match
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tournament Selector (If Tournament Match) */}
        {matchContext === 'tournament' && (
          <View style={styles.tournamentSelectorBox}>
            <Text style={styles.inputLabel}>Select Tournament</Text>
            {tournaments.length === 0 ? (
              <View style={styles.noTournamentBox}>
                <Text style={styles.noTournamentText}>No tournaments registered yet.</Text>
                <TouchableOpacity
                  style={styles.createTournamentBtn}
                  onPress={() => router.push('/tournaments/create')}
                >
                  <Ionicons name="add" size={14} color="#070D1E" />
                  <Text style={styles.createTournamentBtnText}>Create Tournament</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                {tournaments.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.tournamentChip,
                      selectedTournamentId === t.id && styles.tournamentChipActive,
                    ]}
                    onPress={() => {
                      CricketHaptics.toggle();
                      setSelectedTournamentId(t.id);
                      setTitle(t.name);
                    }}
                  >
                    <Ionicons
                      name="trophy"
                      size={14}
                      color={selectedTournamentId === t.id ? '#070D1E' : '#FFB300'}
                    />
                    <Text
                      style={[
                        styles.tournamentChipText,
                        selectedTournamentId === t.id && styles.tournamentChipTextActive,
                      ]}
                    >
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>

      {/* Competing Teams Section (0 & 1 Team Resilience) */}
      <View style={styles.card}>
        <Text style={styles.cardSectionLabel}>2. SELECT COMPETING TEAMS</Text>
        <Text style={styles.cardSub}>
          Select two distinct canonical teams from your managed teams or the opponent directory.
        </Text>

        {/* 0 Teams Resilience */}
        {teams.length === 0 && (
          <View style={styles.zeroTeamsBox}>
            <Ionicons name="information-circle-outline" size={24} color="#00E5FF" />
            <Text style={styles.zeroTeamsTitle}>No Teams Registered Yet</Text>
            <Text style={styles.zeroTeamsDesc}>
              To organize a match, you need your team and an opponent team. Create them right now:
            </Text>
            <View style={styles.zeroTeamsActionsRow}>
              <TouchableOpacity
                style={styles.zeroTeamsBtnPrimary}
                onPress={() => {
                  setAddTeamSlot('team1');
                  setAddTeamType('your');
                  setIsAddTeamModalVisible(true);
                }}
              >
                <Ionicons name="add-circle" size={16} color="#070D1E" />
                <Text style={styles.zeroTeamsBtnPrimaryText}>+ Create Your Team</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.zeroTeamsBtnSecondary}
                onPress={() => {
                  setAddTeamSlot('team2');
                  setAddTeamType('opponent');
                  setIsAddTeamModalVisible(true);
                }}
              >
                <Ionicons name="people-outline" size={16} color="#00E5FF" />
                <Text style={styles.zeroTeamsBtnSecondaryText}>+ Add Opponent Team</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 1 Team Resilience */}
        {teams.length === 1 && (
          <View style={styles.oneTeamHelperBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.oneTeamHelperTitle}>You have 1 team ready</Text>
              <Text style={styles.oneTeamHelperDesc}>
                Add an opponent team to schedule or start this fixture.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addOpponentBtn}
              onPress={() => {
                setAddTeamSlot('team2');
                setAddTeamType('opponent');
                setIsAddTeamModalVisible(true);
              }}
            >
              <Ionicons name="add" size={15} color="#070D1E" />
              <Text style={styles.addOpponentBtnText}>Add Opponent</Text>
            </TouchableOpacity>
          </View>
        )}

        {areTeamsIdentical && teams.length >= 2 && (
          <View style={styles.identicalWarningBox}>
            <Ionicons name="warning-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
            <Text style={styles.identicalWarningText}>
              Team A and Team B cannot be the same team. Please choose a different opponent.
            </Text>
          </View>
        )}

        {/* Team 1 and Team 2 Selection Cards */}
        {teams.length > 0 && (
          <View style={styles.teamSelectRow}>
            {/* Team 1 Card */}
            <View style={styles.teamSlotCard}>
              <Text style={styles.slotLabel}>TEAM A (HOST / SIDE 1)</Text>
              <View style={styles.slotMain}>
                <View
                  style={[
                    styles.slotBadge,
                    { backgroundColor: team1?.primaryColor || '#004BA0' },
                  ]}
                >
                  <Text style={styles.slotBadgeText}>{team1?.shortName || 'T1'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.slotTeamName}>{team1?.name || 'Select Team A'}</Text>
                  <Text style={styles.slotTeamCity}>
                    {team1?.city || 'Club'} • {team1?.players.length || 0} Players
                  </Text>
                </View>
              </View>

              <View style={styles.slotButtonsRow}>
                <TouchableOpacity
                  style={styles.changeTeamBtn}
                  onPress={() => {
                    setTeamPickerSlot('team1');
                    setTeamPickerTab('your');
                  }}
                >
                  <Text style={styles.changeTeamBtnText}>CHANGE TEAM A</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addPlayerMiniBtn}
                  onPress={() => {
                    setAddPlayerSlot('team1');
                    setShowManualPlayerForm(false);
                    setPlayerSearchQuery('');
                    setPlayerSearchResults([]);
                  }}
                >
                  <Ionicons name="person-add" size={13} color="#00E5FF" />
                  <Text style={styles.addPlayerMiniBtnText}>+ Player</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* VS Divider */}
            <View style={styles.vsCircle}>
              <Text style={styles.vsText}>VS</Text>
            </View>

            {/* Team 2 Card */}
            <View style={styles.teamSlotCard}>
              <Text style={styles.slotLabel}>TEAM B (OPPONENT / SIDE 2)</Text>
              <View style={styles.slotMain}>
                <View
                  style={[
                    styles.slotBadge,
                    { backgroundColor: team2?.primaryColor || '#D32F2F' },
                  ]}
                >
                  <Text style={styles.slotBadgeText}>{team2?.shortName || 'T2'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.slotTeamName}>{team2?.name || 'Select Team B'}</Text>
                  <Text style={styles.slotTeamCity}>
                    {team2?.city || 'Club'} • {team2?.players.length || 0} Players
                  </Text>
                </View>
              </View>

              <View style={styles.slotButtonsRow}>
                <TouchableOpacity
                  style={styles.changeTeamBtn}
                  onPress={() => {
                    setTeamPickerSlot('team2');
                    setTeamPickerTab('opponents');
                  }}
                >
                  <Text style={styles.changeTeamBtnText}>CHANGE TEAM B</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addPlayerMiniBtn}
                  onPress={() => {
                    setAddPlayerSlot('team2');
                    setShowManualPlayerForm(false);
                    setPlayerSearchQuery('');
                    setPlayerSearchResults([]);
                  }}
                >
                  <Ionicons name="person-add" size={13} color="#00E5FF" />
                  <Text style={styles.addPlayerMiniBtnText}>+ Player</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Rules, Squad Size & Numeric Overs */}
      <View style={styles.card}>
        <Text style={styles.cardSectionLabel}>3. RULES & SQUAD SIZE</Text>

        {/* Squad Size Selector (Configurable short-sided or standard) */}
        <Text style={styles.inputLabel}>Players Per Side (Configurable Squad)</Text>
        <View style={styles.presetsRow}>
          {[6, 7, 8, 11].map((size) => (
            <TouchableOpacity
              key={size}
              style={[styles.oversBtn, !isCustomSquad && squadSize === size && styles.oversBtnActive]}
              onPress={() => handleSquadSizePreset(size)}
            >
              <Text style={[styles.oversBtnText, !isCustomSquad && squadSize === size && styles.oversBtnTextActive]}>
                {size}-a-side
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.oversBtn, isCustomSquad && styles.oversBtnActive]}
            onPress={() => {
              CricketHaptics.toggle();
              setIsCustomSquad(true);
            }}
          >
            <Text style={[styles.oversBtnText, isCustomSquad && styles.oversBtnTextActive]}>
              Custom Size
            </Text>
          </TouchableOpacity>
        </View>

        {isCustomSquad && (
          <View style={styles.customSquadBox}>
            <Text style={styles.subInputLabel}>Enter Squad Size (2 to 30 players)</Text>
            <TextInput
              style={styles.input}
              value={customSquadSizeInput}
              onChangeText={handleCustomSquadSizeChange}
              keyboardType="number-pad"
              placeholder="e.g. 5"
              placeholderTextColor="#64748B"
            />
          </View>
        )}

        {/* Overs Per Innings: Numeric Input + Presets */}
        <Text style={[styles.inputLabel, { marginTop: 14 }]}>Overs Per Innings (1 to 100 ov)</Text>
        <View style={styles.oversInputRow}>
          <TextInput
            style={[
              styles.oversNumericInput,
              !oversValidation.valid && styles.oversNumericInputError,
            ]}
            value={totalOvers}
            onChangeText={(txt) => setTotalOvers(txt)}
            keyboardType="numeric"
            placeholder="e.g. 20"
            placeholderTextColor="#64748B"
          />
          <View style={styles.oversPresetsInline}>
            {['5', '10', '15', '20', '50'].map((ov) => (
              <TouchableOpacity
                key={ov}
                style={[styles.oversPresetPill, totalOvers === ov && styles.oversPresetPillActive]}
                onPress={() => handleOversPreset(ov)}
              >
                <Text
                  style={[
                    styles.oversPresetPillText,
                    totalOvers === ov && styles.oversPresetPillTextActive,
                  ]}
                >
                  {ov}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Decimal / Invalid Overs Error Warning */}
        {!oversValidation.valid && (
          <View style={styles.oversErrorBox}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 6 }} />
            <Text style={styles.oversErrorText}>{oversValidation.error}</Text>
          </View>
        )}

        {/* Ball Type */}
        <Text style={[styles.inputLabel, { marginTop: 14 }]}>Ball Type</Text>
        <View style={styles.presetsRow}>
          {[
            { type: 'leather', label: '🏏 Leather' },
            { type: 'tennis', label: '🎾 Tennis' },
            { type: 'tape', label: '⚾ Tape Ball' },
          ].map((item) => (
            <TouchableOpacity
              key={item.type}
              style={[styles.presetBtn, ballType === item.type && styles.presetBtnActive]}
              onPress={() => setBallType(item.type as BallType)}
            >
              <Text style={[styles.presetText, ballType === item.type && styles.presetTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Match-Day Lineups Selection */}
      {team1 && team2 && (
        <View style={styles.card}>
          <Text style={styles.cardSectionLabel}>4. MATCH-DAY LINEUP & CAPTAINS</Text>
          <Text style={styles.cardSub}>
            Select participating players for today ({squadSize}-a-side) and designate the captain & wicketkeeper.
          </Text>

          {/* Team A Lineup */}
          <Text style={styles.lineupTeamHeader}>
            {team1.name} Lineup ({team1Lineup.length}/{squadSize} Selected)
          </Text>
          <View style={styles.lineupChipsGrid}>
            {team1.players.map((p) => {
              const isSelected = team1Lineup.includes(p.id);
              const isCap = team1CaptainId === p.id;
              const isWk = team1WicketkeeperId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.lineupPlayerChip, isSelected && styles.lineupPlayerChipActive]}
                  onPress={() => togglePlayerInLineup('team1', p.id)}
                >
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={14}
                    color={isSelected ? '#070D1E' : '#94A3B8'}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.lineupPlayerName,
                      isSelected && styles.lineupPlayerNameActive,
                    ]}
                  >
                    {p.name} {isCap ? '(C)' : ''} {isWk ? '(WK)' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Team B Lineup */}
          <Text style={[styles.lineupTeamHeader, { marginTop: 14 }]}>
            {team2.name} Lineup ({team2Lineup.length}/{squadSize} Selected)
          </Text>
          <View style={styles.lineupChipsGrid}>
            {team2.players.map((p) => {
              const isSelected = team2Lineup.includes(p.id);
              const isCap = team2CaptainId === p.id;
              const isWk = team2WicketkeeperId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.lineupPlayerChip, isSelected && styles.lineupPlayerChipActive]}
                  onPress={() => togglePlayerInLineup('team2', p.id)}
                >
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={14}
                    color={isSelected ? '#070D1E' : '#94A3B8'}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.lineupPlayerName,
                      isSelected && styles.lineupPlayerNameActive,
                    ]}
                  >
                    {p.name} {isCap ? '(C)' : ''} {isWk ? '(WK)' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Match Details & Venue */}
      <View style={styles.card}>
        <Text style={styles.cardSectionLabel}>5. VENUE & SCHEDULE DETAILS</Text>

        <Text style={styles.inputLabel}>Match Title / Fixture</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. City Cup Final 2026"
          placeholderTextColor="#64748B"
        />

        <View style={styles.dualRow}>
          <View style={{ flex: 1.5, marginRight: 8 }}>
            <Text style={styles.inputLabel}>Ground / Venue</Text>
            <TextInput
              style={styles.input}
              value={venue}
              onChangeText={setVenue}
              placeholder="e.g. Gymkhana Grounds"
              placeholderTextColor="#64748B"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>City</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="e.g. Mumbai"
              placeholderTextColor="#64748B"
            />
          </View>
        </View>

        <View style={styles.dualRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={matchDate}
              onChangeText={setMatchDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#64748B"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Match Time</Text>
            <TextInput
              style={styles.input}
              value={matchTime}
              onChangeText={setMatchTime}
              placeholder="e.g. 10:00 AM"
              placeholderTextColor="#64748B"
            />
          </View>
        </View>

        <View style={styles.dualRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.inputLabel}>Assigned Scorer</Text>
            <TextInput
              style={styles.input}
              value={scorerName}
              onChangeText={setScorerName}
              placeholder="Official Scorer"
              placeholderTextColor="#64748B"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Organizer</Text>
            <TextInput
              style={styles.input}
              value={organizerName}
              onChangeText={setOrganizerName}
              placeholder="Match Organizing Committee"
              placeholderTextColor="#64748B"
            />
          </View>
        </View>
      </View>

      {/* Toss & Opening Lineups (Required for Start Now; Deferred for Schedule) */}
      {matchMode === 'start_now' ? (
        <View style={styles.card}>
          <Text style={styles.cardSectionLabel}>6. TOSS & OPENING BATTERS</Text>

          <Text style={styles.inputLabel}>Toss Won By</Text>
          <View style={styles.tossChoiceRow}>
            <TouchableOpacity
              style={[styles.tossBtn, effectiveTossWinner === team1?.id && styles.tossBtnActive]}
              onPress={() => setTossWinnerId(team1?.id || '')}
            >
              <Text
                style={[
                  styles.tossBtnText,
                  effectiveTossWinner === team1?.id && styles.tossBtnTextActive,
                ]}
              >
                {team1?.name}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tossBtn, effectiveTossWinner === team2?.id && styles.tossBtnActive]}
              onPress={() => setTossWinnerId(team2?.id || '')}
            >
              <Text
                style={[
                  styles.tossBtnText,
                  effectiveTossWinner === team2?.id && styles.tossBtnTextActive,
                ]}
              >
                {team2?.name}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.inputLabel, { marginTop: 10 }]}>Elected To</Text>
          <View style={styles.tossChoiceRow}>
            <TouchableOpacity
              style={[styles.decisionBtn, tossDecision === 'bat' && styles.decisionBtnActive]}
              onPress={() => setTossDecision('bat')}
            >
              <Text style={[styles.decisionText, tossDecision === 'bat' && styles.decisionTextActive]}>
                🏏 BAT FIRST
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.decisionBtn, tossDecision === 'bowl' && styles.decisionBtnActive]}
              onPress={() => setTossDecision('bowl')}
            >
              <Text style={[styles.decisionText, tossDecision === 'bowl' && styles.decisionTextActive]}>
                ⚾ BOWL FIRST
              </Text>
            </TouchableOpacity>
          </View>

          {/* Batters Selection */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>
            Opening Batters ({battingTeam?.name})
          </Text>
          <View style={styles.openersRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.subInputLabel}>Striker</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {battingLineupPlayers.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.playerChip,
                      currentStriker === p.id && styles.playerChipActive,
                    ]}
                    onPress={() => setStrikerId(p.id)}
                  >
                    <Text
                      style={[
                        styles.playerChipText,
                        currentStriker === p.id && styles.playerChipTextActive,
                      ]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.subInputLabel}>Non-Striker</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {battingLineupPlayers.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.playerChip,
                      currentNonStriker === p.id && styles.playerChipActive,
                    ]}
                    onPress={() => setNonStrikerId(p.id)}
                  >
                    <Text
                      style={[
                        styles.playerChipText,
                        currentNonStriker === p.id && styles.playerChipTextActive,
                      ]}
                    >
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Bowler Selection */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>
            Opening Bowler ({bowlingTeam?.name})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {bowlingLineupPlayers.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.playerChip, currentBowler === p.id && styles.playerChipActive]}
                onPress={() => setBowlerId(p.id)}
              >
                <Text
                  style={[
                    styles.playerChipText,
                    currentBowler === p.id && styles.playerChipTextActive,
                  ]}
                >
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.scheduleInfoCard}>
          <Ionicons name="information-circle-outline" size={20} color="#FFB300" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.scheduleInfoTitle}>Toss & Openers Deferred</Text>
            <Text style={styles.scheduleInfoDesc}>
              Since this fixture is scheduled for a future date, toss and opening batters will be selected when match day begins.
            </Text>
          </View>
        </View>
      )}

      {/* Summary & Submit Button */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <Text style={styles.summaryTitle}>
            {matchMode === 'start_now' ? 'Match Ready to Start' : 'Fixture Ready to Schedule'}
          </Text>
          <Text style={styles.summarySub}>
            {squadSize}-a-side • {totalOvers} overs ({oversValidation.format?.toUpperCase() || 'CUSTOM'}) • {ballType} ball
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.startMatchBtn,
            (areTeamsIdentical || !oversValidation.valid) && { opacity: 0.5 },
          ]}
          onPress={handleFormSubmit}
          disabled={areTeamsIdentical || !oversValidation.valid}
        >
          <Text style={styles.startMatchBtnText}>
            {matchMode === 'start_now' ? 'START MATCH & SCORING' : 'SCHEDULE FIXTURE 📅'}
          </Text>
          <Ionicons
            name={matchMode === 'start_now' ? 'arrow-forward' : 'calendar'}
            size={18}
            color="#070D1E"
          />
        </TouchableOpacity>
      </View>

      {/* 3-Tab Team Picker Modal */}
      <Modal visible={teamPickerSlot !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select {teamPickerSlot === 'team1' ? 'Team A' : 'Team B'}
              </Text>
              <TouchableOpacity onPress={() => setTeamPickerSlot(null)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Modal Tabs: Your Teams | Opponents Directory | + Add Team */}
            <View style={styles.modalTabsRow}>
              <TouchableOpacity
                style={[
                  styles.modalTabBtn,
                  teamPickerTab === 'your' && styles.modalTabBtnActive,
                ]}
                onPress={() => setTeamPickerTab('your')}
              >
                <Text
                  style={[
                    styles.modalTabText,
                    teamPickerTab === 'your' && styles.modalTabTextActive,
                  ]}
                >
                  Your Teams
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalTabBtn,
                  teamPickerTab === 'opponents' && styles.modalTabBtnActive,
                ]}
                onPress={() => setTeamPickerTab('opponents')}
              >
                <Text
                  style={[
                    styles.modalTabText,
                    teamPickerTab === 'opponents' && styles.modalTabTextActive,
                  ]}
                >
                  Opponents Directory
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalTabBtnSpecial}
                onPress={() => {
                  setAddTeamSlot(teamPickerSlot || 'team1');
                  setAddTeamType(teamPickerSlot === 'team1' ? 'your' : 'opponent');
                  setTeamPickerSlot(null);
                  setIsAddTeamModalVisible(true);
                }}
              >
                <Ionicons name="add" size={14} color="#00E676" />
                <Text style={styles.modalTabBtnSpecialText}>+ Add Team</Text>
              </TouchableOpacity>
            </View>

            {/* Search */}
            <TextInput
              style={styles.modalSearchInput}
              value={teamPickerSearch}
              onChangeText={setTeamPickerSearch}
              placeholder="Search by team name or city..."
              placeholderTextColor="#64748B"
            />

            {/* Team List filtered by tab */}
            <FlatList
              data={teams.filter((t) => {
                if (teamPickerTab === 'your') {
                  // Teams managed by current user or default non-invited
                  if (userProfile?.id && t.managerUserId && t.managerUserId !== userProfile.id) {
                    return false;
                  }
                  if (t.captainStatus === 'invited') return false;
                }
                if (teamPickerSearch.trim()) {
                  const q = teamPickerSearch.toLowerCase().trim();
                  return (
                    t.name.toLowerCase().includes(q) ||
                    t.city?.toLowerCase().includes(q) ||
                    t.shortName.toLowerCase().includes(q)
                  );
                }
                return true;
              })}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 340 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerTeamRow}
                  onPress={() => handleSelectTeamFromPicker(item)}
                >
                  <View
                    style={[
                      styles.pickerBadge,
                      { backgroundColor: item.primaryColor || '#004BA0' },
                    ]}
                  >
                    <Text style={styles.pickerBadgeText}>{item.shortName}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerTeamName}>{item.name}</Text>
                    <Text style={styles.pickerTeamCity}>
                      {item.city || 'Club'} • {item.players.length} Players {item.captainStatus === 'invited' ? '• (Invited Opponent)' : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Inline Add Team Modal (Your Team vs Opponent Team) */}
      <Modal visible={isAddTeamModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {addTeamType === 'your' ? 'Create Your Team' : 'Add Opponent Team'}
              </Text>
              <TouchableOpacity onPress={() => setIsAddTeamModalVisible(false)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Team Type Switcher */}
            <View style={styles.teamTypeSwitchRow}>
              <TouchableOpacity
                style={[styles.teamTypeTab, addTeamType === 'your' && styles.teamTypeTabActive]}
                onPress={() => setAddTeamType('your')}
              >
                <Text
                  style={[
                    styles.teamTypeTabText,
                    addTeamType === 'your' && styles.teamTypeTabTextActive,
                  ]}
                >
                  Your Managed Team
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.teamTypeTab, addTeamType === 'opponent' && styles.teamTypeTabActive]}
                onPress={() => setAddTeamType('opponent')}
              >
                <Text
                  style={[
                    styles.teamTypeTabText,
                    addTeamType === 'opponent' && styles.teamTypeTabTextActive,
                  ]}
                >
                  Opponent Team
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Team Name *</Text>
            <TextInput
              style={styles.input}
              value={newTeamName}
              onChangeText={setNewTeamName}
              placeholder="e.g. Bandra Warriors"
              placeholderTextColor="#64748B"
            />

            <View style={styles.dualRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.inputLabel}>Short Name (Abbreviation)</Text>
                <TextInput
                  style={styles.input}
                  value={newTeamShortName}
                  onChangeText={setNewTeamShortName}
                  placeholder="e.g. BDW"
                  placeholderTextColor="#64748B"
                  maxLength={5}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                  style={styles.input}
                  value={newTeamCity}
                  onChangeText={setNewTeamCity}
                  placeholder="e.g. Mumbai"
                  placeholderTextColor="#64748B"
                />
              </View>
            </View>

            {/* Color Swatches */}
            <Text style={styles.inputLabel}>Team Color</Text>
            <View style={styles.colorSwatchesRow}>
              {COLOR_OPTIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    newTeamColor === c && styles.colorSwatchActive,
                  ]}
                  onPress={() => setNewTeamColor(c)}
                />
              ))}
            </View>

            {addTeamType === 'opponent' ? (
              <View style={styles.opponentInviteBox}>
                <Text style={styles.opponentInviteTitle}>Opponent Captain Contact (Optional)</Text>
                <Text style={styles.opponentInviteSub}>
                  Invite their captain by email. They will receive an invitation to accept team ownership.
                </Text>

                <Text style={styles.inputLabel}>Captain Name</Text>
                <TextInput
                  style={styles.input}
                  value={newTeamCaptainName}
                  onChangeText={setNewTeamCaptainName}
                  placeholder="e.g. Rahul Dravid"
                  placeholderTextColor="#64748B"
                />

                <Text style={styles.inputLabel}>Captain Email</Text>
                <TextInput
                  style={styles.input}
                  value={newTeamCaptainEmail}
                  onChangeText={setNewTeamCaptainEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="captain@example.com"
                  placeholderTextColor="#64748B"
                />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addSelfRow}
                onPress={() => setAddSelfToNewTeam(!addSelfToNewTeam)}
              >
                <Ionicons
                  name={addSelfToNewTeam ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={addSelfToNewTeam ? '#00E676' : '#94A3B8'}
                />
                <Text style={styles.addSelfText}>
                  Add yourself as captain and first player on this team
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.createTeamSubmitBtn}
              onPress={handleCreateNewTeamInline}
            >
              <Text style={styles.createTeamSubmitBtnText}>CONFIRM & ADD TEAM</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Search-First Add Player Modal */}
      <Modal visible={addPlayerSlot !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Add Player to {addPlayerSlot === 'team1' ? team1?.name : team2?.name}
              </Text>
              <TouchableOpacity onPress={() => setAddPlayerSlot(null)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {!showManualPlayerForm ? (
              <View>
                <Text style={styles.cardSub}>
                  Search registered profiles by email, phone, or name first to reuse existing stats.
                </Text>

                <TextInput
                  style={styles.modalSearchInput}
                  value={playerSearchQuery}
                  onChangeText={handleSearchPlayers}
                  placeholder="Search player by name, email, or phone..."
                  placeholderTextColor="#64748B"
                />

                {isSearchingPlayers && (
                  <ActivityIndicator size="small" color="#00E5FF" style={{ marginVertical: 10 }} />
                )}

                {playerSearchResults.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={styles.searchResultsLabel}>Matching Profiles Found</Text>
                    {playerSearchResults.map((p) => (
                      <View key={p.id} style={styles.playerSearchItem}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.playerSearchName}>{p.name}</Text>
                            {p.isClaimed && (
                              <View style={styles.verifiedBadge}>
                                <Ionicons name="checkmark-circle" size={12} color="#00E676" />
                                <Text style={styles.verifiedBadgeText}>Verified</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.playerSearchMeta}>
                            {p.role} • {p.city || 'Club'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.selectExistingPlayerBtn}
                          onPress={() => handleAddExistingPlayer(p)}
                        >
                          <Text style={styles.selectExistingPlayerBtnText}>Add</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.manualPlayerToggleBtn}
                  onPress={() => setShowManualPlayerForm(true)}
                >
                  <Ionicons name="person-add-outline" size={16} color="#00E5FF" />
                  <Text style={styles.manualPlayerToggleText}>
                    Player not found? Create new player profile
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <TouchableOpacity
                  style={styles.backToSearchBtn}
                  onPress={() => setShowManualPlayerForm(false)}
                >
                  <Ionicons name="arrow-back" size={14} color="#00E5FF" />
                  <Text style={styles.backToSearchBtnText}>Back to search</Text>
                </TouchableOpacity>

                <Text style={styles.inputLabel}>Player Name *</Text>
                <TextInput
                  style={styles.input}
                  value={newPlayerName}
                  onChangeText={setNewPlayerName}
                  placeholder="e.g. Virat Kohli"
                  placeholderTextColor="#64748B"
                />

                <Text style={styles.inputLabel}>Playing Role</Text>
                <View style={styles.presetsRow}>
                  {(['batter', 'bowler', 'all-rounder', 'wicketkeeper'] as PlayingRole[]).map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.presetBtn, newPlayerRole === r && styles.presetBtnActive]}
                      onPress={() => setNewPlayerRole(r)}
                    >
                      <Text style={[styles.presetText, newPlayerRole === r && styles.presetTextActive]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Contact Email (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={newPlayerEmail}
                  onChangeText={setNewPlayerEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="player@example.com"
                  placeholderTextColor="#64748B"
                />

                <Text style={styles.inputLabel}>Phone Number (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={newPlayerPhone}
                  onChangeText={setNewPlayerPhone}
                  keyboardType="phone-pad"
                  placeholder="+91 98765 43210"
                  placeholderTextColor="#64748B"
                />

                {/* Scope Toggle: Permanent Roster vs Match-only Guest */}
                <View style={styles.guestScopeCard}>
                  <TouchableOpacity
                    style={styles.guestScopeRow}
                    onPress={() => setIsMatchGuestOnly(!isMatchGuestOnly)}
                  >
                    <View style={[styles.scopeRadio, isMatchGuestOnly && styles.scopeRadioActive]}>
                      {isMatchGuestOnly && <View style={styles.scopeRadioDot} />}
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.scopeTitle}>Match-only Guest / Substitute</Text>
                      <Text style={styles.scopeDesc}>
                        {isMatchGuestOnly
                          ? 'Temporary player for this match only. Does NOT modify permanent team roster.'
                          : 'Permanent team member. Added to durable team roster.'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.createTeamSubmitBtn}
                  onPress={handleCreateNewPlayerSubmit}
                >
                  <Text style={styles.createTeamSubmitBtnText}>CONFIRM & ADD PLAYER</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.canvas,
    },
    content: {
      padding: 16,
      paddingBottom: 60,
    },
    modeCard: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modeCardLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.brand,
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    modeTabsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    modeTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.raised,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modeTabActive: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    modeTabText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    modeTabTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    contextCard: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardSectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    contextTabsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    contextTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.raised,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    contextTabActive: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    contextTabText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    contextTabTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    tournamentSelectorBox: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.borderSubdued,
    },
    noTournamentBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.raised,
      padding: 10,
      borderRadius: 8,
      marginTop: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    noTournamentText: {
      color: theme.textSecondary,
      fontSize: 12,
    },
    createTournamentBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.brand,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      gap: 4,
    },
    createTournamentBtnText: {
      color: theme.brandText,
      fontSize: 11,
      fontWeight: '700',
    },
    tournamentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.raised,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
    },
    tournamentChipActive: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    tournamentChipText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    tournamentChipTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardSub: {
      fontSize: 11,
      color: theme.textSecondary,
      marginBottom: 10,
      marginTop: -2,
    },
    zeroTeamsBox: {
      backgroundColor: theme.raised,
      borderRadius: 10,
      padding: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 10,
    },
    zeroTeamsTitle: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      marginTop: 6,
      marginBottom: 4,
    },
    zeroTeamsDesc: {
      color: theme.textSecondary,
      fontSize: 12,
      textAlign: 'center',
      marginBottom: 12,
    },
    zeroTeamsActionsRow: {
      flexDirection: 'row',
      gap: 10,
      width: '100%',
    },
    zeroTeamsBtnPrimary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.brand,
      paddingVertical: 10,
      borderRadius: 8,
      gap: 6,
    },
    zeroTeamsBtnPrimaryText: {
      color: theme.brandText,
      fontSize: 12,
      fontWeight: '700',
    },
    zeroTeamsBtnSecondary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.surface,
      paddingVertical: 10,
      borderRadius: 8,
      gap: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    zeroTeamsBtnSecondaryText: {
      color: theme.textPrimary,
      fontSize: 12,
      fontWeight: '700',
    },
    oneTeamHelperBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.statusWarningBg,
      borderRadius: 8,
      padding: 10,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.statusWarning,
    },
    oneTeamHelperTitle: {
      color: theme.statusWarning,
      fontSize: 12,
      fontWeight: '700',
    },
    oneTeamHelperDesc: {
      color: theme.textSecondary,
      fontSize: 11,
      marginTop: 1,
    },
    addOpponentBtn: {
      backgroundColor: theme.brand,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      gap: 4,
    },
    addOpponentBtnText: {
      color: theme.brandText,
      fontWeight: '700',
      fontSize: 11,
    },
    identicalWarningBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.statusErrorBg,
      borderWidth: 1,
      borderColor: theme.statusError,
      padding: 10,
      borderRadius: 8,
      marginBottom: 10,
    },
    identicalWarningText: {
      color: theme.statusError,
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
    teamSelectRow: {
      gap: 10,
    },
    teamSlotCard: {
      backgroundColor: theme.raised,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    slotLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textSecondary,
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    slotMain: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    slotBadge: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    slotBadgeText: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 13,
    },
    slotTeamName: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: '700',
    },
    slotTeamCity: {
      color: theme.textSecondary,
      fontSize: 11,
      marginTop: 1,
    },
    slotButtonsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    changeTeamBtn: {
      flex: 1,
      backgroundColor: theme.surface,
      paddingVertical: 7,
      borderRadius: 6,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    changeTeamBtnText: {
      color: theme.textPrimary,
      fontSize: 11,
      fontWeight: '600',
    },
    addPlayerMiniBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 6,
      gap: 4,
      borderWidth: 1,
      borderColor: theme.border,
    },
    addPlayerMiniBtnText: {
      color: theme.textPrimary,
      fontSize: 11,
      fontWeight: '600',
    },
    vsCircle: {
      alignSelf: 'center',
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.raised,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: -4,
      zIndex: 2,
    },
    vsText: {
      color: theme.textSecondary,
      fontWeight: '700',
      fontSize: 10,
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
      letterSpacing: 0.3,
      marginBottom: 6,
    },
    subInputLabel: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.textMuted,
      marginBottom: 4,
    },
    input: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 10,
    },
    dualRow: {
      flexDirection: 'row',
    },
    presetsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 8,
    },
    customSquadBox: {
      backgroundColor: theme.surface,
      padding: 10,
      borderRadius: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    oversBtn: {
      backgroundColor: theme.raised,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    oversBtnActive: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    oversBtnText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    oversBtnTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    oversInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    oversNumericInput: {
      width: 72,
      backgroundColor: theme.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    oversNumericInputError: {
      borderColor: theme.statusError,
      borderWidth: 1.5,
    },
    oversPresetsInline: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      flex: 1,
    },
    oversPresetPill: {
      backgroundColor: theme.raised,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    oversPresetPillActive: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    oversPresetPillText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    oversPresetPillTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    oversErrorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.statusErrorBg,
      borderWidth: 1,
      borderColor: theme.statusError,
      padding: 8,
      borderRadius: 6,
      marginTop: 6,
    },
    oversErrorText: {
      color: theme.statusError,
      fontSize: 11,
      fontWeight: '600',
      flex: 1,
    },
    presetBtn: {
      backgroundColor: theme.raised,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    presetBtnActive: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    presetText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    presetTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    lineupTeamHeader: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 6,
    },
    lineupChipsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 6,
    },
    lineupPlayerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.raised,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    lineupPlayerChipActive: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    lineupPlayerName: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
    lineupPlayerNameActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    scheduleInfoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    scheduleInfoTitle: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    scheduleInfoDesc: {
      color: theme.textSecondary,
      fontSize: 11,
      marginTop: 2,
    },
    tossChoiceRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    tossBtn: {
      flex: 1,
      backgroundColor: theme.raised,
      paddingVertical: 9,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    tossBtnActive: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    tossBtnText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    tossBtnTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    decisionBtn: {
      flex: 1,
      backgroundColor: theme.raised,
      paddingVertical: 9,
      borderRadius: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    decisionBtnActive: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    decisionText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    decisionTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    openersRow: {
      flexDirection: 'row',
    },
    playerChip: {
      backgroundColor: theme.raised,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      marginRight: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    playerChipActive: {
      backgroundColor: theme.brand,
      borderColor: theme.brand,
    },
    playerChipText: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
    playerChipTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    summaryCard: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    summaryTop: {
      marginBottom: 10,
    },
    summaryTitle: {
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
    summarySub: {
      color: theme.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    startMatchBtn: {
      backgroundColor: theme.brand,
      borderRadius: 8,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    startMatchBtnText: {
      color: theme.brandText,
      fontWeight: '700',
      fontSize: 14,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: theme.overlay,
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 18,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      maxHeight: '85%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    modalTabsRow: {
      flexDirection: 'row',
      backgroundColor: theme.raised,
      borderRadius: 8,
      padding: 3,
      marginBottom: 12,
    },
    modalTabBtn: {
      flex: 1,
      paddingVertical: 7,
      alignItems: 'center',
      borderRadius: 6,
    },
    modalTabBtnActive: {
      backgroundColor: theme.brand,
    },
    modalTabText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    modalTabTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    modalTabBtnSpecial: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 7,
      borderRadius: 6,
      backgroundColor: theme.brandTint,
      gap: 2,
    },
    modalTabBtnSpecialText: {
      color: theme.brand,
      fontSize: 11,
      fontWeight: '700',
    },
    modalSearchInput: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: theme.textPrimary,
      fontSize: 13,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pickerTeamRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderSubdued,
    },
    pickerBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    pickerBadgeText: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 12,
    },
    pickerTeamName: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    pickerTeamCity: {
      color: theme.textSecondary,
      fontSize: 11,
      marginTop: 1,
    },
    teamTypeSwitchRow: {
      flexDirection: 'row',
      backgroundColor: theme.raised,
      borderRadius: 8,
      padding: 3,
      marginBottom: 12,
    },
    teamTypeTab: {
      flex: 1,
      paddingVertical: 7,
      alignItems: 'center',
      borderRadius: 6,
    },
    teamTypeTabActive: {
      backgroundColor: theme.brand,
    },
    teamTypeTabText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
    },
    teamTypeTabTextActive: {
      color: theme.brandText,
      fontWeight: '700',
    },
    colorSwatchesRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    colorSwatch: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    colorSwatchActive: {
      borderColor: theme.textPrimary,
      transform: [{ scale: 1.15 }],
    },
    opponentInviteBox: {
      backgroundColor: theme.raised,
      borderRadius: 8,
      padding: 10,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    opponentInviteTitle: {
      color: theme.textPrimary,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 2,
    },
    opponentInviteSub: {
      color: theme.textSecondary,
      fontSize: 11,
      marginBottom: 8,
    },
    addSelfRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    addSelfText: {
      color: theme.textPrimary,
      fontSize: 12,
      fontWeight: '500',
      flex: 1,
    },
    createTeamSubmitBtn: {
      backgroundColor: theme.brand,
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 4,
    },
    createTeamSubmitBtnText: {
      color: theme.brandText,
      fontWeight: '700',
      fontSize: 13,
    },
    searchResultsLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    playerSearchItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.raised,
      padding: 10,
      borderRadius: 8,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    playerSearchName: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
    verifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.brandTint,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 6,
      gap: 2,
    },
    verifiedBadgeText: {
      color: theme.brand,
      fontSize: 10,
      fontWeight: '700',
    },
    playerSearchMeta: {
      color: theme.textSecondary,
      fontSize: 11,
      marginTop: 2,
    },
    selectExistingPlayerBtn: {
      backgroundColor: theme.brand,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    selectExistingPlayerBtnText: {
      color: theme.brandText,
      fontSize: 11,
      fontWeight: '700',
    },
    manualPlayerToggleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.raised,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
      marginTop: 6,
    },
    manualPlayerToggleText: {
      color: theme.textPrimary,
      fontSize: 12,
      fontWeight: '600',
    },
    backToSearchBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 10,
    },
    backToSearchBtnText: {
      color: theme.textPrimary,
      fontSize: 12,
      fontWeight: '600',
    },
    guestScopeCard: {
      backgroundColor: theme.raised,
      borderRadius: 8,
      padding: 10,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    guestScopeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    scopeRadio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scopeRadioActive: {
      borderColor: theme.brand,
    },
    scopeRadioDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.brand,
    },
    scopeTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    scopeDesc: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 1,
    },
  });
}
