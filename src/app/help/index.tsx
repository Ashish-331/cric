import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { ThemeColors } from '../../theme/tokens';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: 'How do I start scoring a match?',
    answer: 'Tap the "+ Start Match" tab or menu action. Configure teams, overs, toss result, and opening batters/bowlers to begin ball-by-ball scoring.',
  },
  {
    question: 'Does scoring work when I am offline?',
    answer: 'Yes! All scoring actions are durably persisted to local SQLite first. When network reconnects, actions sync to the cloud automatically without duplicate balls.',
  },
  {
    question: 'Can other players view live scores on their phones?',
    answer: 'Yes. Once connected, authorized scorers push updates to the cloud. Other players and spectators can follow live scores in real time without scoring permissions.',
  },
  {
    question: 'How do I claim my player profile?',
    answer: 'Captains can add players by name and verified contact details. When you sign in, confirm your registered email address to claim your canonical match records and career statistics.',
  },
  {
    question: 'How do I correct an incorrect score?',
    answer: 'Use the 1-Tap Undo button during live scoring. If a completed match requires review, tournament organizers can reopen or correct match contributions.',
  },
];

export default function HelpScreen() {
  const { theme, colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [reportText, setReportText] = useState('');
  const [reportType, setReportType] = useState<'score' | 'profile' | 'bug'>('score');

  const handleSubmitReport = () => {
    if (!reportText.trim()) {
      Alert.alert('Empty Report', 'Please enter details describing the issue.');
      return;
    }
    Alert.alert(
      'Report Submitted',
      'Thank you! Your audit request has been logged. Tournament administrators and review moderators will verify the record.',
      [{ text: 'OK', onPress: () => setReportText('') }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Community FAQ Section */}
        <Text style={styles.sectionTitle}>FREQUENTLY ASKED QUESTIONS</Text>

        {FAQS.map((faq, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.faqCard}
            onPress={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
            activeOpacity={0.8}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>{faq.question}</Text>
              <Ionicons
                name={expandedFaq === idx ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.brand}
              />
            </View>
            {expandedFaq === idx && (
              <Text style={styles.faqAnswer}>{faq.answer}</Text>
            )}
          </TouchableOpacity>
        ))}

        {/* Report Incorrect Data or Bug */}
        <View style={styles.reportSection}>
          <Text style={styles.sectionTitle}>REPORT INCORRECT SCORE OR PROFILE</Text>
          <Text style={styles.reportSub}>
            Notice an error in match scores, standings, or player statistics? Submit an auditable review ticket:
          </Text>

          <View style={styles.typeRow}>
            {(['score', 'profile', 'bug'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, reportType === t && styles.activeTypeBtn]}
                onPress={() => setReportType(t)}
              >
                <Text style={[styles.typeBtnText, reportType === t && styles.activeTypeBtnText]}>
                  {t === 'score' ? 'Score Dispute' : t === 'profile' ? 'Profile Merge' : 'Technical Bug'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={4}
            placeholder="Describe the match, over, or profile detail to review..."
            placeholderTextColor={theme.textTertiary}
            value={reportText}
            onChangeText={setReportText}
          />

          <TouchableOpacity style={styles.submitReportBtn} onPress={handleSubmitReport}>
            <Text style={styles.submitReportBtnText}>Submit Audit Request</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.canvas,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      backgroundColor: theme.canvas,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    backBtn: {
      padding: 6,
      minHeight: 44,
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
      letterSpacing: 0.8,
      marginBottom: 10,
      marginTop: 8,
    },
    faqCard: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    faqHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    faqQuestion: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.textPrimary,
      flex: 1,
      marginRight: 8,
    },
    faqAnswer: {
      fontSize: 13,
      color: theme.textSecondary,
      marginTop: 10,
      lineHeight: 18,
    },
    reportSection: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginTop: 16,
      marginBottom: 32,
    },
    reportSub: {
      fontSize: 12,
      color: theme.textSecondary,
      lineHeight: 18,
      marginBottom: 12,
    },
    typeRow: {
      flexDirection: 'row',
      backgroundColor: theme.surfaceAlt,
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
      backgroundColor: theme.primarySubtle,
    },
    typeBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    activeTypeBtnText: {
      color: theme.brand,
    },
    textInput: {
      backgroundColor: theme.surfaceAlt,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 12,
      color: theme.textPrimary,
      fontSize: 13,
      minHeight: 80,
      textAlignVertical: 'top',
      marginBottom: 12,
    },
    submitReportBtn: {
      backgroundColor: theme.brand,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
    submitReportBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
