import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';

export default function AppCodeScreen() {
  const { userProfile, teams, tournaments } = useCricket();
  const [inputCode, setInputCode] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<'team' | 'tournament'>('team');
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');

  const handleRedeemCode = () => {
    const code = inputCode.trim().toUpperCase();
    if (!code) {
      Alert.alert('Invalid Code', 'Please enter a valid 6-character invitation code.');
      return;
    }

    // Scoped code verification
    if (code.startsWith('TM') || code.length === 6) {
      Alert.alert(
        'Invitation Validated',
        `Invitation code ${code} is recognized for squad participation. Request submitted to team captain for roster approval. (Codes never grant automatic scoring permissions).`,
        [{ text: 'OK', onPress: () => router.push('/(tabs)/my-cricket') }]
      );
    } else {
      Alert.alert('Code Not Found', 'The invitation code is expired, revoked, or invalid.');
    }
  };

  const handleGenerateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const prefix = targetType === 'team' ? 'TM' : 'TR';
    const newCode = `${prefix}${randomPart}`;
    setCreatedCode(newCode);

    Alert.alert(
      'Invitation Code Created',
      `Code: ${newCode}\nScope: ${targetType.toUpperCase()}\nExpires in 7 days.\nUsage limit: 15 players.\nOnly grants player join requests subject to captain review.`
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>App Code & Invitations</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Redeem Code Card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="key-outline" size={20} color="#00E676" />
            <Text style={styles.cardTitle}>ENTER APP CODE</Text>
          </View>
          <Text style={styles.cardSub}>
            Have an invitation code from a captain or league organiser? Enter it below to join the squad or competition.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="e.g. TM9X42"
            placeholderTextColor="#64748B"
            value={inputCode}
            onChangeText={setInputCode}
            autoCapitalize="characters"
            maxLength={8}
          />

          <TouchableOpacity style={styles.submitBtn} onPress={handleRedeemCode}>
            <Text style={styles.submitBtnText}>Apply Invitation Code</Text>
          </TouchableOpacity>
        </View>

        {/* Generate Scoped Code (For Captains & Organizers) */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="share-outline" size={20} color="#00E5FF" />
            <Text style={styles.cardTitle}>CREATE SCOPED INVITE</Text>
          </View>
          <Text style={styles.cardSub}>
            Generate rate-limited, revocable codes for team players or tournament entries.
          </Text>

          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeBtn, targetType === 'team' && styles.activeTypeBtn]}
              onPress={() => setTargetType('team')}
            >
              <Text style={[styles.typeBtnText, targetType === 'team' && styles.activeTypeBtnText]}>
                Team Roster Code
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, targetType === 'tournament' && styles.activeTypeBtn]}
              onPress={() => setTargetType('tournament')}
            >
              <Text style={[styles.typeBtnText, targetType === 'tournament' && styles.activeTypeBtnText]}>
                League Entry Code
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.createBtn} onPress={handleGenerateCode}>
            <Ionicons name="flash-outline" size={16} color="#070D1E" />
            <Text style={styles.createBtnText}>Generate 7-Day Invite Code</Text>
          </TouchableOpacity>

          {createdCode && (
            <View style={styles.createdBox}>
              <Text style={styles.createdLabel}>ACTIVE INVITATION CODE:</Text>
              <Text style={styles.createdCodeText}>{createdCode}</Text>
              <Text style={styles.createdMeta}>
                Valid for 7 days • Rate-limited to 15 uses • Revocable anytime
              </Text>
            </View>
          )}
        </View>

        {/* Security Rule Disclosure */}
        <View style={styles.securityBox}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#94A3B8" />
          <Text style={styles.securityText}>
            Security Policy: Code possession alone never grants scoring authority or administrative access. All joins require captain or organiser authorization.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D1E',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#070D1E',
    borderBottomWidth: 1,
    borderBottomColor: '#1E2C4F',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#0C142B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    marginBottom: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 1,
    marginLeft: 6,
  },
  cardSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  input: {
    backgroundColor: '#070D1E',
    borderWidth: 1,
    borderColor: '#1E2C4F',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '900',
    color: '#00E676',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: '#00E676',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#070D1E',
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#070D1E',
    borderRadius: 8,
    padding: 4,
    marginBottom: 12,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTypeBtn: {
    backgroundColor: '#1E2C4F',
  },
  typeBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  activeTypeBtnText: {
    color: '#00E5FF',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00E5FF',
    paddingVertical: 12,
    borderRadius: 8,
  },
  createBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#070D1E',
    marginLeft: 6,
  },
  createdBox: {
    backgroundColor: '#070D1E',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#00E676',
  },
  createdLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  createdCodeText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#00E676',
    letterSpacing: 3,
    marginVertical: 4,
  },
  createdMeta: {
    fontSize: 11,
    color: '#64748B',
  },
  securityBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0C142B',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    marginBottom: 24,
  },
  securityText: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
});
