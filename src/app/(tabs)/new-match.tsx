import React, { useState, useMemo } from 'react';
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
} from '../../types/cricket';
import { Colors } from '../../utils/colors';
import { CricketHaptics } from '../../services/haptics';
import { StatsRollupEngine } from '../../engine/statsRollupEngine';

export default function NewMatchScreen() {
  const {
    teams,
    tournaments,
    createNewMatch,
    saveTeam,
    userProfile,
  } = useCricket();

  // Match Context: Standalone Match vs Tournament Match (Flow B1)
  const [matchContext, setMatchContext] = useState<'standalone' | 'tournament'>('standalone');
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(
    tournaments[0]?.id || ''
  );

  // Match Details (Flow B4)
  const [title, setTitle] = useState('Premier Grassroots Clash');
  const [venue, setVenue] = useState('Gymkhana Ground, Pitch 1');
  const [city, setCity] = useState('Mumbai');
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalOvers, setTotalOvers] = useState('20');
  const [format, setFormat] = useState<MatchFormat>('t20');
  const [ballType, setBallType] = useState<BallType>('leather');
  const [squadSize, setSquadSize] = useState<number>(11);
  const [scorerName, setScorerName] = useState(
    userProfile?.name || 'Assigned Scorer'
  );
  const [organizerName, setOrganizerName] = useState(
    userProfile?.name || 'Match Organizing Committee'
  );

  // Selected Competing Teams (Flow B2)
  const [team1Id, setTeam1Id] = useState<string>(teams[0]?.id || '');
  const [team2Id, setTeam2Id] = useState<string>(teams[1]?.id || '');

  // Team Picker Modal State
  const [teamPickerSlot, setTeamPickerSlot] = useState<'team1' | 'team2' | null>(null);
  const [teamPickerTab, setTeamPickerTab] = useState<'your' | 'opponents'>('your');
  const [teamPickerSearch, setTeamPickerSearch] = useState('');

  // Captain Overrides for this match (Flow B3)
  const [team1CaptainId, setTeam1CaptainId] = useState<string>('');
  const [team2CaptainId, setTeam2CaptainId] = useState<string>('');

  // Toss State
  const [tossWinnerId, setTossWinnerId] = useState<string>('');
  const [tossDecision, setTossDecision] = useState<TossDecision>('bat');

  // Openers State
  const [strikerId, setStrikerId] = useState<string>('');
  const [nonStrikerId, setNonStrikerId] = useState<string>('');
  const [bowlerId, setBowlerId] = useState<string>('');

  // Add Match Player Modal (Guest vs Permanent)
  const [addPlayerSlot, setAddPlayerSlot] = useState<'team1' | 'team2' | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerRole, setNewPlayerRole] = useState<PlayingRole>('all-rounder');
  const [isMatchGuestOnly, setIsMatchGuestOnly] = useState(false);

  // Resolve team entities
  const team1 = useMemo(() => teams.find((t) => t.id === team1Id) || teams[0], [teams, team1Id]);
  const team2 = useMemo(() => teams.find((t) => t.id === team2Id) || teams[1], [teams, team2Id]);

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

  const currentStriker = strikerId || battingTeam?.players[0]?.id || '';
  const currentNonStriker = nonStrikerId || battingTeam?.players[1]?.id || '';
  const currentBowler = bowlerId || bowlingTeam?.players[0]?.id || '';

  // Duplicate player validation across sides
  const duplicatePlayersWarning = useMemo(() => {
    if (!team1 || !team2) return null;
    const team1Ids = new Set(team1.players.map((p) => p.id));
    const shared = team2.players.filter((p) => team1Ids.has(p.id));
    if (shared.length > 0) {
      return `Warning: Player "${shared[0].name}" is listed on both teams. Please ensure each side has distinct participants.`;
    }
    return null;
  }, [team1, team2]);

  // Handle Team Picker selection
  const handleSelectTeamFromPicker = (selected: Team) => {
    CricketHaptics.toggle();
    if (teamPickerSlot === 'team1') {
      setTeam1Id(selected.id);
      setTeam1CaptainId(selected.captainPlayerId || '');
      setStrikerId('');
      setNonStrikerId('');
      setBowlerId('');
    } else if (teamPickerSlot === 'team2') {
      setTeam2Id(selected.id);
      setTeam2CaptainId(selected.captainPlayerId || '');
      setStrikerId('');
      setNonStrikerId('');
      setBowlerId('');
    }
    setTeamPickerSlot(null);
  };

  // Handle adding player to team during match setup (guest vs permanent)
  const handleAddPlayerToTeam = async () => {
    if (!newPlayerName.trim()) {
      Alert.alert('Name Required', 'Please enter player name.');
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
        isGuest: true,
        isMatchGuest: isMatchGuestOnly,
        careerStats: StatsRollupEngine.createEmptyCareerStats(),
        recentScores: [],
      };

      const updatedTeam: Team = {
        ...targetTeam,
        players: [...targetTeam.players, newPlayer],
      };

      await saveTeam(updatedTeam);

      setNewPlayerName('');
      setIsMatchGuestOnly(false);
      setAddPlayerSlot(null);

      Alert.alert(
        'Player Added! 🏏',
        `${newPlayer.name} has been added to ${targetTeam.name} as a ${isMatchGuestOnly ? 'match-only guest' : 'permanent roster player'}.`
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not add player.');
    }
  };

  const handleStartMatch = async () => {
    if (!team1 || !team2 || areTeamsIdentical) {
      Alert.alert('Invalid Teams', 'Team A and Team B must be two distinct canonical teams.');
      return;
    }

    const oversNum = parseInt(totalOvers, 10);
    if (isNaN(oversNum) || oversNum <= 0) {
      Alert.alert('Invalid Overs', 'Please specify a valid number of overs.');
      return;
    }

    if (!currentStriker || !currentNonStriker || currentStriker === currentNonStriker) {
      Alert.alert('Batters Required', 'Please select two different opening batters.');
      return;
    }

    if (!currentBowler) {
      Alert.alert('Bowler Required', 'Please select an opening bowler.');
      return;
    }

    try {
      CricketHaptics.milestone();

      const match = await createNewMatch({
        title: title.trim() || 'Premier Grassroots Clash',
        format,
        venue: `${venue.trim()}, ${city.trim()}`,
        team1,
        team2,
        tossWinnerId: effectiveTossWinner,
        tossDecision,
        totalOvers: oversNum,
        playersPerTeam: squadSize,
        strikerId: currentStriker,
        nonStrikerId: currentNonStriker,
        openingBowlerId: currentBowler,
        ballType,
        scorerName: scorerName.trim() || 'Official Scorer',
        organizerName: organizerName.trim() || 'Match Organizing Committee',
        tournamentId: matchContext === 'tournament' ? selectedTournamentId : undefined,
      });

      router.push(`/match/${match.id}/scorer`);
    } catch (err: any) {
      CricketHaptics.wicket();
      Alert.alert('Error', err.message || 'Failed to start match.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Flow B1: Match Context Switcher */}
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

      {/* Flow B2: Select Team A and Team B */}
      <View style={styles.card}>
        <Text style={styles.cardSectionLabel}>2. SELECT COMPETING TEAMS</Text>
        <Text style={styles.cardSub}>
          Select two distinct canonical teams from your managed teams or the opponent directory.
        </Text>

        {areTeamsIdentical && (
          <View style={styles.identicalWarningBox}>
            <Ionicons name="warning-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
            <Text style={styles.identicalWarningText}>
              Team A and Team B cannot be the same team. Please choose a different opponent.
            </Text>
          </View>
        )}

        {duplicatePlayersWarning && (
          <View style={styles.duplicateWarningBox}>
            <Ionicons name="alert-circle-outline" size={18} color="#FFB300" style={{ marginRight: 8 }} />
            <Text style={styles.duplicateWarningText}>{duplicatePlayersWarning}</Text>
          </View>
        )}

        {/* Team 1 Card */}
        <View style={styles.teamSelectRow}>
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
                <Text style={styles.slotTeamCity}>{team1?.city || 'Club'} • {team1?.players.length} Players</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.changeTeamBtn}
              onPress={() => {
                setTeamPickerSlot('team1');
                setTeamPickerTab('your');
              }}
            >
              <Text style={styles.changeTeamBtnText}>CHANGE TEAM A</Text>
            </TouchableOpacity>
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
                <Text style={styles.slotTeamCity}>{team2?.city || 'Club'} • {team2?.players.length} Players</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.changeTeamBtn}
              onPress={() => {
                setTeamPickerSlot('team2');
                setTeamPickerTab('opponents');
              }}
            >
              <Text style={styles.changeTeamBtnText}>CHANGE TEAM B</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Add Player to Match Buttons */}
        <View style={styles.addPlayerRow}>
          <TouchableOpacity
            style={styles.addPlayerSlotBtn}
            onPress={() => setAddPlayerSlot('team1')}
          >
            <Ionicons name="person-add" size={13} color="#00E5FF" />
            <Text style={styles.addPlayerSlotText}>Add Player to Team A</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addPlayerSlotBtn}
            onPress={() => setAddPlayerSlot('team2')}
          >
            <Ionicons name="person-add" size={13} color="#00E5FF" />
            <Text style={styles.addPlayerSlotText}>Add Player to Team B</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Flow B3: Playing Conditions & Configurable Squad Size */}
      <View style={styles.card}>
        <Text style={styles.cardSectionLabel}>3. RULES & SQUAD SIZE</Text>

        {/* Squad Size Selector (Configurable short-sided or standard) */}
        <Text style={styles.inputLabel}>Players Per Side (Configurable Squad)</Text>
        <View style={styles.presetsRow}>
          {[6, 7, 8, 11].map((size) => (
            <TouchableOpacity
              key={size}
              style={[styles.oversBtn, squadSize === size && styles.oversBtnActive]}
              onPress={() => {
                CricketHaptics.toggle();
                setSquadSize(size);
              }}
            >
              <Text style={[styles.oversBtnText, squadSize === size && styles.oversBtnTextActive]}>
                {size}-a-side
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Overs Presets */}
        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Overs Per Innings</Text>
        <View style={styles.presetsRow}>
          {['5', '10', '15', '20', '50'].map((ov) => (
            <TouchableOpacity
              key={ov}
              style={[styles.oversBtn, totalOvers === ov && styles.oversBtnActive]}
              onPress={() => {
                CricketHaptics.toggle();
                setTotalOvers(ov);
                setFormat(ov === '20' ? 't20' : ov === '10' ? 't10' : ov === '50' ? 'odi' : 'custom');
              }}
            >
              <Text style={[styles.oversBtnText, totalOvers === ov && styles.oversBtnTextActive]}>
                {ov} Ov
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ball Type */}
        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Ball Type</Text>
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

      {/* Match Details & Venue */}
      <View style={styles.card}>
        <Text style={styles.cardSectionLabel}>4. MATCH DETAILS & VENUE</Text>

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
            <Text style={styles.inputLabel}>Date</Text>
            <TextInput
              style={styles.input}
              value={matchDate}
              onChangeText={setMatchDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#64748B"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Assigned Scorer</Text>
            <TextInput
              style={styles.input}
              value={scorerName}
              onChangeText={setScorerName}
              placeholder="e.g. Official Scorer"
              placeholderTextColor="#64748B"
            />
          </View>
        </View>
      </View>

      {/* Toss Winner & Decision */}
      <View style={styles.card}>
        <Text style={styles.cardSectionLabel}>5. TOSS & OPENING LINEUPS</Text>

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
              {battingTeam?.players.map((p) => (
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
              {battingTeam?.players.map((p) => (
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
          {bowlingTeam?.players.map((p) => (
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

      {/* Flow B5: Summary & Start Button */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <Text style={styles.summaryTitle}>Match Ready</Text>
          <Text style={styles.summarySub}>
            {squadSize}-a-side • {totalOvers} overs • {ballType} ball
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.startMatchBtn, areTeamsIdentical && { opacity: 0.5 }]}
          onPress={handleStartMatch}
          disabled={areTeamsIdentical}
        >
          <Text style={styles.startMatchBtnText}>START MATCH & SCORING</Text>
          <Ionicons name="arrow-forward" size={18} color="#070D1E" />
        </TouchableOpacity>
      </View>

      {/* Team Picker Modal */}
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

            {/* Modal Tabs */}
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
            </View>

            {/* Search */}
            <TextInput
              style={styles.modalSearchInput}
              value={teamPickerSearch}
              onChangeText={setTeamPickerSearch}
              placeholder="Search by team name or city..."
              placeholderTextColor="#64748B"
            />

            {/* Team List */}
            <FlatList
              data={teams.filter((t) => {
                if (teamPickerSearch.trim()) {
                  const q = teamPickerSearch.toLowerCase().trim();
                  return (
                    t.name.toLowerCase().includes(q) ||
                    t.city?.toLowerCase().includes(q)
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
                      {item.city || 'Club'} • {item.players.length} Players
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Add Player to Team Modal (Guest vs Permanent) */}
      <Modal visible={addPlayerSlot !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Add Player to {addPlayerSlot === 'team1' ? team1?.name : team2?.name}
              </Text>
              <TouchableOpacity onPress={() => setAddPlayerSlot(null)}>
                <Ionicons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Player Name *</Text>
            <TextInput
              style={styles.input}
              value={newPlayerName}
              onChangeText={setNewPlayerName}
              placeholder="e.g. Jasprit Bumrah"
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
                      ? 'Temporary player for this match only. Does NOT permanently modify team roster.'
                      : 'Permanent team member. Added to durable team roster.'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.addPlayerModalBtn} onPress={handleAddPlayerToTeam}>
              <Text style={styles.addPlayerModalBtnText}>CONFIRM & ADD TO LINEUP</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D1E',
  },
  content: {
    padding: 16,
    paddingBottom: 60,
  },
  contextCard: {
    backgroundColor: '#0C142B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  cardSectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#00E5FF',
    letterSpacing: 1,
    marginBottom: 10,
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
    backgroundColor: '#121C38',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  contextTabActive: {
    backgroundColor: '#00E676',
    borderColor: '#00E676',
  },
  contextTabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
  },
  contextTabTextActive: {
    color: '#070D1E',
  },
  tournamentSelectorBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E2C4F',
  },
  noTournamentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121C38',
    padding: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  noTournamentText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  createTournamentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E676',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  createTournamentBtnText: {
    color: '#070D1E',
    fontSize: 11,
    fontWeight: '800',
  },
  tournamentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121C38',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    gap: 6,
  },
  tournamentChipActive: {
    backgroundColor: '#FFB300',
    borderColor: '#FFB300',
  },
  tournamentChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tournamentChipTextActive: {
    color: '#070D1E',
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#0C142B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  cardSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 12,
    marginTop: -4,
  },
  identicalWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#EF4444',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  identicalWarningText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  duplicateWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 179, 0, 0.12)',
    borderWidth: 1,
    borderColor: '#FFB300',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  duplicateWarningText: {
    color: '#FFB300',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  teamSelectRow: {
    gap: 12,
  },
  teamSlotCard: {
    backgroundColor: '#121C38',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  slotLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  slotMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  slotBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  slotBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  slotTeamName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  slotTeamCity: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  changeTeamBtn: {
    backgroundColor: '#1E2C4F',
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  changeTeamBtnText: {
    color: '#00E5FF',
    fontSize: 11,
    fontWeight: '800',
  },
  vsCircle: {
    alignSelf: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E2C4F',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -4,
    zIndex: 2,
  },
  vsText: {
    color: '#FFB300',
    fontWeight: '900',
    fontSize: 11,
  },
  addPlayerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  addPlayerSlotBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121C38',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    gap: 6,
  },
  addPlayerSlotText: {
    color: '#00E5FF',
    fontSize: 11,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subInputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#121C38',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  dualRow: {
    flexDirection: 'row',
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  oversBtn: {
    backgroundColor: '#121C38',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  oversBtnActive: {
    backgroundColor: '#00E676',
    borderColor: '#00E676',
  },
  oversBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
  },
  oversBtnTextActive: {
    color: '#070D1E',
  },
  presetBtn: {
    backgroundColor: '#121C38',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  presetBtnActive: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  presetText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  presetTextActive: {
    color: '#070D1E',
    fontWeight: '800',
  },
  tossChoiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  tossBtn: {
    flex: 1,
    backgroundColor: '#121C38',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  tossBtnActive: {
    backgroundColor: '#FFB300',
    borderColor: '#FFB300',
  },
  tossBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '800',
  },
  tossBtnTextActive: {
    color: '#070D1E',
  },
  decisionBtn: {
    flex: 1,
    backgroundColor: '#121C38',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  decisionBtnActive: {
    backgroundColor: '#00E676',
    borderColor: '#00E676',
  },
  decisionText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '800',
  },
  decisionTextActive: {
    color: '#070D1E',
  },
  openersRow: {
    flexDirection: 'row',
  },
  playerChip: {
    backgroundColor: '#121C38',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  playerChipActive: {
    backgroundColor: '#00E676',
    borderColor: '#00E676',
  },
  playerChipText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  playerChipTextActive: {
    color: '#070D1E',
    fontWeight: '900',
  },
  summaryCard: {
    backgroundColor: '#0C142B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#00E676',
  },
  summaryTop: {
    marginBottom: 12,
  },
  summaryTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  summarySub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  startMatchBtn: {
    backgroundColor: '#00E676',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startMatchBtnText: {
    color: '#070D1E',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 13, 30, 0.85)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0C142B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1.5,
    borderTopColor: '#1E2C4F',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  modalTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#121C38',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
  },
  modalTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  modalTabBtnActive: {
    backgroundColor: '#00E676',
  },
  modalTabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
  },
  modalTabTextActive: {
    color: '#070D1E',
  },
  modalSearchInput: {
    backgroundColor: '#121C38',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  pickerTeamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2C4F',
  },
  pickerBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pickerBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  pickerTeamName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  pickerTeamCity: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  guestScopeCard: {
    backgroundColor: '#121C38',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  guestScopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scopeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeRadioActive: {
    borderColor: '#00E676',
  },
  scopeRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00E676',
  },
  scopeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scopeDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  addPlayerModalBtn: {
    backgroundColor: '#00E676',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addPlayerModalBtnText: {
    color: '#070D1E',
    fontWeight: '900',
    fontSize: 13,
  },
});
