import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { MatchFormat, BallType, Team } from '../../types/cricket';
import { Colors } from '../../utils/colors';
import { CricketHaptics } from '../../services/haptics';

const FORMATS: { key: MatchFormat; label: string; defaultOvers: number }[] = [
  { key: 't20', label: 'T20 (20 ov)', defaultOvers: 20 },
  { key: 't10', label: 'T10 (10 ov)', defaultOvers: 10 },
  { key: 'odi', label: 'ODI (50 ov)', defaultOvers: 50 },
  { key: 'custom', label: 'Custom Overs', defaultOvers: 15 },
];

const BALL_TYPES: { key: BallType; label: string; icon: string }[] = [
  { key: 'leather', label: 'Red/White Leather', icon: 'baseball' },
  { key: 'tennis', label: 'Tennis Ball', icon: 'tennis-ball' },
  { key: 'tape', label: 'Tape Ball', icon: 'tape-measure' },
];

export default function CreateTournamentScreen() {
  const { teams, createTournament, userProfile } = useCricket();

  const [name, setName] = useState('');
  const [format, setFormat] = useState<MatchFormat>('t20');
  const [totalOvers, setTotalOvers] = useState('20');
  const [ballType, setBallType] = useState<BallType>('leather');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isVerifiedUser = userProfile && userProfile.isVerified && !userProfile.isGuest;

  const handleFormatChange = (newFormat: MatchFormat) => {
    CricketHaptics.toggle();
    setFormat(newFormat);
    const found = FORMATS.find((f) => f.key === newFormat);
    if (found) {
      setTotalOvers(found.defaultOvers.toString());
    }
  };

  const handleToggleTeam = (teamId: string) => {
    CricketHaptics.toggle();
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  };

  const handleSelectAllTeams = () => {
    CricketHaptics.toggle();
    if (selectedTeamIds.length === teams.length) {
      setSelectedTeamIds([]);
    } else {
      setSelectedTeamIds(teams.map((t) => t.id));
    }
  };

  const handleCreate = async () => {
    if (!isVerifiedUser) {
      CricketHaptics.wicket();
      Alert.alert(
        'Verification Required',
        'Organizing tournaments requires phone verification to ensure legitimate grassroots leagues and scoring governance.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Verify Now', onPress: () => router.push('/auth/login') },
        ]
      );
      return;
    }

    if (!name.trim()) {
      Alert.alert('Missing Field', 'Please enter a name for the tournament.');
      return;
    }

    const oversNum = parseInt(totalOvers, 10);
    if (isNaN(oversNum) || oversNum < 1 || oversNum > 100) {
      Alert.alert('Invalid Overs', 'Please specify between 1 and 100 overs per innings.');
      return;
    }

    if (selectedTeamIds.length < 2) {
      Alert.alert('Teams Required', 'Please select at least 2 participating teams for the tournament standings.');
      return;
    }

    const selectedTeams = teams.filter((t) => selectedTeamIds.includes(t.id));

    try {
      setIsSubmitting(true);
      CricketHaptics.milestone();
      const newTournament = await createTournament({
        name: name.trim(),
        format,
        totalOvers: oversNum,
        ballType,
        teams: selectedTeams,
      });

      Alert.alert(
        'Tournament Created! 🏆',
        `"${newTournament.name}" has been initialized with ${selectedTeams.length} teams. You can now schedule fixtures and track the live points table.`,
        [
          {
            text: 'Open Tournament Centre',
            onPress: () => router.replace(`/tournament/${newTournament.id}`),
          },
        ]
      );
    } catch (err: any) {
      CricketHaptics.wicket();
      Alert.alert('Error', err.message || 'Failed to create tournament.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Verification Alert Banner */}
        {!isVerifiedUser && (
          <View style={styles.warnBanner}>
            <View style={styles.warnRow}>
              <Ionicons name="shield-half" size={24} color="#D97706" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.warnTitle}>Phone Verification Required</Text>
                <Text style={styles.warnSub}>
                  You are currently logged in as {userProfile?.name || 'Guest'}. Organizing tournaments and scheduling fixtures requires a verified phone number.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.verifyBtn}
              onPress={() => router.push('/auth/login')}
            >
              <Text style={styles.verifyBtnText}>Verify Mobile Number Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Section: Tournament Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tournament Details</Text>
          <Text style={styles.label}>Tournament Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Grassroots Champions Trophy 2026"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
          />

          {/* Format Chips */}
          <Text style={[styles.label, { marginTop: 16 }]}>Match Format</Text>
          <View style={styles.chipRow}>
            {FORMATS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, format === f.key && styles.chipActive]}
                onPress={() => handleFormatChange(f.key)}
              >
                <Text style={[styles.chipText, format === f.key && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Overs Input */}
          <Text style={[styles.label, { marginTop: 16 }]}>Total Overs Per Innings</Text>
          <TextInput
            style={[styles.input, { width: 120 }]}
            keyboardType="number-pad"
            value={totalOvers}
            onChangeText={setTotalOvers}
            maxLength={3}
          />

          {/* Ball Type Chips */}
          <Text style={[styles.label, { marginTop: 16 }]}>Ball Type</Text>
          <View style={styles.chipRow}>
            {BALL_TYPES.map((b) => (
              <TouchableOpacity
                key={b.key}
                style={[styles.chip, ballType === b.key && styles.chipActive]}
                onPress={() => {
                  CricketHaptics.toggle();
                  setBallType(b.key);
                }}
              >
                <Text style={[styles.chipText, ballType === b.key && styles.chipTextActive]}>
                  {b.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Section: Team Selection */}
        <View style={styles.card}>
          <View style={styles.teamHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Select Enrolled Teams</Text>
              <Text style={styles.teamSub}>
                Selected: {selectedTeamIds.length} of {teams.length} teams (Min 2 required)
              </Text>
            </View>
            {teams.length > 0 && (
              <TouchableOpacity style={styles.selectAllBtn} onPress={handleSelectAllTeams}>
                <Text style={styles.selectAllText}>
                  {selectedTeamIds.length === teams.length ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {teams.length === 0 ? (
            <View style={styles.emptyTeams}>
              <Ionicons name="people-outline" size={36} color="#94A3B8" />
              <Text style={styles.emptyTeamsText}>No teams registered yet.</Text>
              <TouchableOpacity
                style={styles.createTeamBtn}
                onPress={() => router.push('/(tabs)/teams')}
              >
                <Text style={styles.createTeamText}>Go to Teams & Register</Text>
              </TouchableOpacity>
            </View>
          ) : (
            teams.map((team) => {
              const isSelected = selectedTeamIds.includes(team.id);
              return (
                <TouchableOpacity
                  key={team.id}
                  style={[styles.teamItem, isSelected && styles.teamItemSelected]}
                  onPress={() => handleToggleTeam(team.id)}
                >
                  <View
                    style={[
                      styles.teamCheckbox,
                      isSelected && styles.teamCheckboxSelected,
                    ]}
                  >
                    {isSelected && <Ionicons name="checkmark" size={16} color="#FFF" />}
                  </View>
                  <View
                    style={[
                      styles.teamColorIndicator,
                      { backgroundColor: team.primaryColor || Colors.pitchGreen },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teamItemName}>{team.name}</Text>
                    <Text style={styles.teamItemMeta}>
                      Code: {team.shortName} • {team.players.length} Players
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!isVerifiedUser || isSubmitting) && styles.submitBtnDisabled,
          ]}
          disabled={isSubmitting}
          onPress={handleCreate}
        >
          <MaterialCommunityIcons name="trophy-outline" size={20} color="#0F172A" />
          <Text style={styles.submitBtnText}>
            {isSubmitting ? 'Creating Tournament...' : 'Launch Tournament'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  warnBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warnTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  warnSub: {
    fontSize: 12,
    color: '#78350F',
    marginTop: 4,
    lineHeight: 17,
  },
  verifyBtn: {
    backgroundColor: '#D97706',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  teamHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  teamSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  selectAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  selectAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  emptyTeams: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTeamsText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
  },
  createTeamBtn: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.pitchGreen,
  },
  createTeamText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  teamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
  },
  teamItemSelected: {
    borderColor: Colors.pitchGreen,
    backgroundColor: '#ECFDF5',
  },
  teamCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  teamCheckboxSelected: {
    backgroundColor: Colors.pitchGreen,
    borderColor: Colors.pitchGreen,
  },
  teamColorIndicator: {
    width: 6,
    height: 28,
    borderRadius: 3,
    marginRight: 10,
  },
  teamItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  teamItemMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00E676',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});
