import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { Team, MatchFormat, TossDecision, BallType } from '../../types/cricket';
import { Colors } from '../../utils/colors';
import { InteractiveCoinTossModal } from '../../components/match/InteractiveCoinTossModal';

export default function NewMatchScreen() {
  const { teams, createNewMatch, userProfile } = useCricket();

  const [coinTossModalVisible, setCoinTossModalVisible] = useState(false);
  const [title, setTitle] = useState('Premier Grassroots League Clash');
  const [venue, setVenue] = useState('Gymkhana Ground, Pitch 1');
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalOvers, setTotalOvers] = useState('20');
  const [format, setFormat] = useState<MatchFormat>('t20');
  const [ballType, setBallType] = useState<BallType>('leather');
  const [scorerName, setScorerName] = useState(
    userProfile?.role === 'organizer' ? 'Official Scorer (Appointed)' : userProfile?.name || 'Scorer'
  );
  const [organizerName, setOrganizerName] = useState(
    userProfile?.name || 'Local League Organizing Committee'
  );

  // Competing Teams selection
  const [team1Index, setTeam1Index] = useState(0);
  const [team2Index, setTeam2Index] = useState(1);

  const team1: Team = teams[team1Index] || teams[0];
  const team2: Team = teams[team2Index] || teams[1] || teams[0];

  // Toss
  const [tossWinnerId, setTossWinnerId] = useState<string>(team1?.id || '');
  const [tossDecision, setTossDecision] = useState<TossDecision>('bat');

  // Batting and Bowling teams based on toss
  const team1BattingFirst =
    (tossWinnerId === team1?.id && tossDecision === 'bat') ||
    (tossWinnerId === team2?.id && tossDecision === 'bowl');

  const battingTeam = team1BattingFirst ? team1 : team2;
  const bowlingTeam = team1BattingFirst ? team2 : team1;

  // Openers
  const [strikerId, setStrikerId] = useState<string>('');
  const [nonStrikerId, setNonStrikerId] = useState<string>('');
  const [bowlerId, setBowlerId] = useState<string>('');

  const currentStriker = strikerId || battingTeam?.players[0]?.id || '';
  const currentNonStriker = nonStrikerId || battingTeam?.players[1]?.id || '';
  const currentBowler = bowlerId || bowlingTeam?.players[0]?.id || '';

  const handleStartMatch = async () => {
    if (!team1 || !team2 || team1.id === team2.id) {
      Alert.alert('Invalid Teams', 'Please select two different competing teams.');
      return;
    }

    const oversNum = parseInt(totalOvers, 10);
    if (isNaN(oversNum) || oversNum <= 0) {
      Alert.alert('Invalid Overs', 'Please enter a valid number of overs.');
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
      const match = await createNewMatch({
        title,
        format,
        venue,
        team1,
        team2,
        tossWinnerId: tossWinnerId || team1.id,
        tossDecision,
        totalOvers: oversNum,
        strikerId: currentStriker,
        nonStrikerId: currentNonStriker,
        openingBowlerId: currentBowler,
        ballType,
        scorerName,
        organizerName,
      });

      router.push(`/match/${match.id}/scorer`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start match');
    }
  };

  if (teams.length < 2 || !team1 || !team2 || !battingTeam || !bowlingTeam) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading Teams & Match Setup...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Organizer & Match Details */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="trophy-outline" size={20} color={Colors.primary} />
          <Text style={styles.sectionHeading}>1. Organizer & Match Configuration</Text>
        </View>

        <Text style={styles.inputLabel}>Match Title / Tournament</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. City Cup Final 2026"
        />

        <Text style={styles.inputLabel}>Venue & Ground</Text>
        <TextInput
          style={styles.input}
          value={venue}
          onChangeText={setVenue}
          placeholder="e.g. Gymkhana Grounds"
        />

        <View style={styles.dualRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Date</Text>
            <TextInput
              style={styles.input}
              value={matchDate}
              onChangeText={setMatchDate}
              placeholder="YYYY-MM-DD"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Assigned Scorer</Text>
            <TextInput
              style={styles.input}
              value={scorerName}
              onChangeText={setScorerName}
              placeholder="e.g. Rahul V."
            />
          </View>
        </View>

        {/* Ball Type Selector */}
        <Text style={styles.inputLabel}>Ball Type</Text>
        <View style={styles.presetsRow}>
          {(
            [
              { type: 'leather', label: '🏏 Leather (Red/White)' },
              { type: 'tennis', label: '🎾 Tennis (Heavy)' },
              { type: 'tape', label: '⚾ Tape Ball' },
            ] as { type: BallType; label: string }[]
          ).map((item) => (
            <TouchableOpacity
              key={item.type}
              style={[styles.presetBtn, ballType === item.type && styles.presetBtnActive]}
              onPress={() => setBallType(item.type)}
            >
              <Text style={[styles.presetText, ballType === item.type && styles.presetTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Overs Presets */}
        <Text style={styles.inputLabel}>Overs Per Side</Text>
        <View style={styles.presetsRow}>
          {['5', '10', '15', '20', '50'].map((ov) => (
            <TouchableOpacity
              key={ov}
              style={[styles.oversBtn, totalOvers === ov && styles.oversBtnActive]}
              onPress={() => {
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
      </View>

      {/* 2. Select Competing Teams from Registry */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="people-outline" size={20} color={Colors.primary} />
          <Text style={styles.sectionHeading}>2. Select Competing Teams</Text>
        </View>

        <Text style={styles.inputLabel}>Team 1 (Host)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teamScroll}>
          {teams.map((t, idx) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.teamChip, team1Index === idx && styles.teamChipActive]}
              onPress={() => {
                setTeam1Index(idx);
                setTossWinnerId(t.id);
                setStrikerId('');
                setNonStrikerId('');
                setBowlerId('');
              }}
            >
              <View style={[styles.colorDot, { backgroundColor: t.primaryColor }]} />
              <Text style={[styles.teamChipText, team1Index === idx && styles.teamChipTextActive]}>
                {t.name} ({t.shortName})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Team 2 (Challenger)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.teamScroll}>
          {teams.map((t, idx) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.teamChip, team2Index === idx && styles.teamChipActive]}
              onPress={() => {
                setTeam2Index(idx);
                setStrikerId('');
                setNonStrikerId('');
                setBowlerId('');
              }}
            >
              <View style={[styles.colorDot, { backgroundColor: t.primaryColor }]} />
              <Text style={[styles.teamChipText, team2Index === idx && styles.teamChipTextActive]}>
                {t.name} ({t.shortName})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 3. Toss Result */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="disc-outline" size={20} color={Colors.accentAmber} />
          <Text style={styles.sectionHeading}>3. Toss Winner & Decision</Text>
        </View>

        <Text style={styles.inputLabel}>Toss Won By</Text>
        <View style={styles.tossChoiceRow}>
          <TouchableOpacity
            style={[styles.tossBtn, tossWinnerId === team1.id && styles.tossBtnActive]}
            onPress={() => setTossWinnerId(team1.id)}
          >
            <Text style={[styles.tossBtnText, tossWinnerId === team1.id && styles.tossBtnTextActive]}>
              {team1.name}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tossBtn, tossWinnerId === team2.id && styles.tossBtnActive]}
            onPress={() => setTossWinnerId(team2.id)}
          >
            <Text style={[styles.tossBtnText, tossWinnerId === team2.id && styles.tossBtnTextActive]}>
              {team2.name}
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

        {/* Launch Interactive Coin Toss Button */}
        <TouchableOpacity
          style={styles.interactiveTossBtn}
          onPress={() => setCoinTossModalVisible(true)}
        >
          <MaterialCommunityIcons name="circle-multiple-outline" size={18} color="#FFB300" />
          <Text style={styles.interactiveTossBtnText}>Launch Interactive 3D Coin Toss Flip</Text>
        </TouchableOpacity>

        <View style={styles.battingNotice}>
          <Text style={styles.battingNoticeText}>
            First Innings: <Text style={{ fontWeight: '800' }}>{battingTeam.name}</Text> will bat,{' '}
            <Text style={{ fontWeight: '800' }}>{bowlingTeam.name}</Text> will bowl.
          </Text>
        </View>
      </View>

      <InteractiveCoinTossModal
        visible={coinTossModalVisible}
        team1Name={team1.name}
        team2Name={team2.name}
        team1Id={team1.id}
        team2Id={team2.id}
        onConfirmToss={(winnerId, dec) => {
          setTossWinnerId(winnerId);
          setTossDecision(dec);
        }}
        onClose={() => setCoinTossModalVisible(false)}
      />

      {/* 4. Opening Batters & Bowler */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="flash-outline" size={20} color={Colors.pitchGreen} />
          <Text style={styles.sectionHeading}>4. Opening Lineup</Text>
        </View>

        <Text style={styles.inputLabel}>Opening Striker ({battingTeam.shortName})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.playerScroll}>
          {battingTeam.players.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.playerChip, currentStriker === p.id && styles.playerChipActive]}
              onPress={() => setStrikerId(p.id)}
            >
              <Text style={[styles.playerChipText, currentStriker === p.id && styles.playerChipTextActive]}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.inputLabel, { marginTop: 10 }]}>Opening Non-Striker ({battingTeam.shortName})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.playerScroll}>
          {battingTeam.players
            .filter((p) => p.id !== currentStriker)
            .map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.playerChip, currentNonStriker === p.id && styles.playerChipActive]}
                onPress={() => setNonStrikerId(p.id)}
              >
                <Text style={[styles.playerChipText, currentNonStriker === p.id && styles.playerChipTextActive]}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            ))}
        </ScrollView>

        <Text style={[styles.inputLabel, { marginTop: 10 }]}>Opening Bowler ({bowlingTeam.shortName})</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.playerScroll}>
          {bowlingTeam.players.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.playerChip, currentBowler === p.id && styles.playerChipActive]}
              onPress={() => setBowlerId(p.id)}
            >
              <Text style={[styles.playerChipText, currentBowler === p.id && styles.playerChipTextActive]}>
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Start Match CTA */}
      <TouchableOpacity style={styles.startMatchBtn} onPress={handleStartMatch}>
        <Ionicons name="play" size={20} color="#FFF" />
        <Text style={styles.startMatchText}>START MATCH & OPEN SCORER</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 12,
  },
  dualRow: {
    flexDirection: 'row',
    gap: 10,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  presetBtnActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  presetText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  presetTextActive: {
    color: '#FFF',
  },
  oversBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  oversBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  oversBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  oversBtnTextActive: {
    color: '#FFF',
  },
  teamScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  teamChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 8,
    gap: 6,
  },
  teamChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: Colors.primary,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  teamChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  teamChipTextActive: {
    color: Colors.primary,
  },
  tossChoiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tossBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  tossBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tossBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  tossBtnTextActive: {
    color: '#FFF',
  },
  decisionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  decisionBtnActive: {
    backgroundColor: Colors.pitchGreen,
    borderColor: Colors.pitchGreen,
  },
  decisionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  decisionTextActive: {
    color: '#FFF',
  },
  battingNotice: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  battingNoticeText: {
    fontSize: 12,
    color: '#475569',
  },
  playerScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  playerChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 8,
  },
  playerChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  playerChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  playerChipTextActive: {
    color: '#FFF',
  },
  interactiveTossBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0C142B',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FFB300',
  },
  interactiveTossBtnText: {
    color: '#FFB300',
    fontSize: 13,
    fontWeight: '800',
  },
  startMatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.pitchGreen,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 6,
    marginBottom: 20,
  },
  startMatchText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
});
