import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCricket } from '../../context/CricketContext';
import { WagonWheelSVG } from '../../components/match/WagonWheelSVG';
import { PitchRadarSVG } from '../../components/match/PitchRadarSVG';
import { Colors } from '../../utils/colors';
import { Player, Delivery } from '../../types/cricket';
import { useTheme } from '../../theme';
import { ThemeColors } from '../../theme/tokens';

type Tab = 'batting' | 'bowling' | 'fielding' | 'wagon' | 'radar';

export default function PerformanceScreen() {
  const { theme, colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { userProfile, teams, matches } = useCricket();
  const [activeTab, setActiveTab] = useState<Tab>('batting');

  // Resolve authenticated player identity
  const currentPlayer: Player | undefined = useMemo(() => {
    if (!userProfile) return undefined;
    for (const team of teams) {
      const found = team.players.find(
        (p) => p.id === userProfile.id || p.claimedByUserId === userProfile.id
      );
      if (found) return found;
    }
    // Fallback: first player of first team if guest demo
    return teams[0]?.players[0];
  }, [userProfile, teams]);

  // Collect all deliveries involving current player to power Wagon Wheel & Pitch Radar
  const playerDeliveries: Delivery[] = useMemo(() => {
    if (!currentPlayer) return [];
    const deliveries: Delivery[] = [];
    for (const match of matches) {
      for (const inn of match.innings) {
        if (inn && inn.deliveries) {
          for (const d of inn.deliveries) {
            if (activeTab === 'wagon' && d.strikerId === currentPlayer.id) {
              deliveries.push(d);
            } else if (activeTab === 'radar' && d.bowlerId === currentPlayer.id) {
              deliveries.push(d);
            }
          }
        }
      }
    }
    return deliveries;
  }, [currentPlayer, matches, activeTab]);

  const stats = currentPlayer?.careerStats;

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Performance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Player Profile Header Card */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarBox}>
            <Ionicons name="person" size={28} color={theme.brand} />
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.playerName}>{currentPlayer?.name || userProfile?.name || 'Player'}</Text>
              {userProfile?.isVerified && (
                <Ionicons name="checkmark-circle" size={16} color={theme.brand} style={{ marginLeft: 4 }} />
              )}
            </View>
            <Text style={styles.playerRole}>
              {currentPlayer?.role ? currentPlayer.role.toUpperCase() : 'ALL-ROUNDER'} • {currentPlayer?.battingHand === 'left' ? 'LHB' : 'RHB'}
            </Text>
            <Text style={styles.identityStatus}>
              {currentPlayer?.isClaimed ? 'Canonical Linked Profile' : 'Local Verified Identity'}
            </Text>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabBar}>
          {(['batting', 'bowling', 'fielding', 'wagon', 'radar'] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.activeTabBtn]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabBtnText, activeTab === tab && styles.activeTabBtnText]}>
                {tab === 'wagon' ? 'WAGON' : tab === 'radar' ? 'RADAR' : tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab 1: BATTING */}
        {activeTab === 'batting' && (
          <View style={styles.statsCard}>
            <Text style={styles.cardSectionTitle}>CAREER BATTING FIGURES</Text>
            <View style={styles.statGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats?.matches || 0}</Text>
                <Text style={styles.statLbl}>MATCHES</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats?.inningsBatted || 0}</Text>
                <Text style={styles.statLbl}>INNINGS</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: '#00E676' }]}>{stats?.runs || 0}</Text>
                <Text style={styles.statLbl}>RUNS</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>
                  {stats?.highestScore || 0}{stats?.highestScoreNotOut ? '*' : ''}
                </Text>
                <Text style={styles.statLbl}>HIGHEST</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats?.average?.toFixed(1) || '0.0'}</Text>
                <Text style={styles.statLbl}>AVERAGE</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats?.strikeRate?.toFixed(1) || '0.0'}</Text>
                <Text style={styles.statLbl}>STRIKE RATE</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats?.fifties || 0}</Text>
                <Text style={styles.statLbl}>50s</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats?.hundreds || 0}</Text>
                <Text style={styles.statLbl}>100s</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats?.fours || 0}</Text>
                <Text style={styles.statLbl}>4s</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats?.sixes || 0}</Text>
                <Text style={styles.statLbl}>6s</Text>
              </View>
            </View>
          </View>
        )}

        {/* Tab 2: BOWLING */}
        {activeTab === 'bowling' && (
          <View style={styles.statsCard}>
            <Text style={styles.cardSectionTitle}>CAREER BOWLING FIGURES</Text>
            <View style={styles.statGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats?.oversBowled || '0.0'}</Text>
                <Text style={styles.statLbl}>OVERS</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats?.maidens || 0}</Text>
                <Text style={styles.statLbl}>MAIDENS</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: '#00E676' }]}>{stats?.wickets || 0}</Text>
                <Text style={styles.statLbl}>WICKETS</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats?.runsConceded || 0}</Text>
                <Text style={styles.statLbl}>RUNS</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats?.bowlingEconomy?.toFixed(2) || '0.00'}</Text>
                <Text style={styles.statLbl}>ECONOMY</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats?.bowlingAverage?.toFixed(2) || '0.00'}</Text>
                <Text style={styles.statLbl}>AVERAGE</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats?.bestBowling || '0/0'}</Text>
                <Text style={styles.statLbl}>BEST BOWLING</Text>
              </View>
            </View>
          </View>
        )}

        {/* Tab 3: FIELDING */}
        {activeTab === 'fielding' && (
          <View style={styles.statsCard}>
            <Text style={styles.cardSectionTitle}>CAREER FIELDING FIGURES</Text>
            <View style={styles.statGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats?.catches || 0}</Text>
                <Text style={styles.statLbl}>CATCHES</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats?.stumpings || 0}</Text>
                <Text style={styles.statLbl}>STUMPINGS</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats?.runOuts || 0}</Text>
                <Text style={styles.statLbl}>RUN OUTS</Text>
              </View>
            </View>
          </View>
        )}

        {/* Tab 4: WAGON WHEEL VISUAL */}
        {activeTab === 'wagon' && (
          <View style={styles.visualCard}>
            <Text style={styles.cardSectionTitle}>WAGON WHEEL SHOT COVERAGE</Text>
            <Text style={styles.visualSubText}>
              Ground sectors mapped directly from recorded boundary and shot directions.
            </Text>
            <View style={styles.svgWrapper}>
              <WagonWheelSVG deliveries={playerDeliveries} batterName={currentPlayer?.name} />
            </View>
            <Text style={styles.coverageNote}>
              Observed shot coverage: {playerDeliveries.length} balls recorded
            </Text>
          </View>
        )}

        {/* Tab 5: PITCH RADAR VISUAL */}
        {activeTab === 'radar' && (
          <View style={styles.visualCard}>
            <Text style={styles.cardSectionTitle}>PITCH RADAR & BOWLING LENGTHS</Text>
            <Text style={styles.visualSubText}>
              Length and line map of deliveries bowled across official spells.
            </Text>
            <View style={styles.svgWrapper}>
              <PitchRadarSVG deliveries={playerDeliveries} bowlerName={currentPlayer?.name} />
            </View>
            <Text style={styles.coverageNote}>
              Observed bowling pitch deliveries: {playerDeliveries.length} balls
            </Text>
          </View>
        )}
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
    profileHeaderCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    avatarBox: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1.5,
      borderColor: theme.brand,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    profileInfo: {
      flex: 1,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    playerName: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    playerRole: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.textSecondary,
      marginTop: 2,
    },
    identityStatus: {
      fontSize: 11,
      color: theme.brand,
      fontWeight: '600',
      marginTop: 2,
    },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: theme.surface,
      borderRadius: 8,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 6,
    },
    activeTabBtn: {
      backgroundColor: theme.primarySubtle,
    },
    tabBtnText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
    },
    activeTabBtnText: {
      color: theme.brand,
    },
    statsCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    cardSectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.textSecondary,
      letterSpacing: 0.8,
      marginBottom: 14,
    },
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -6,
    },
    statBox: {
      width: '33.33%',
      paddingHorizontal: 6,
      paddingVertical: 10,
      alignItems: 'center',
    },
    statVal: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    statLbl: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textSecondary,
      marginTop: 2,
    },
    visualCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      marginBottom: 16,
    },
    visualSubText: {
      fontSize: 12,
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: 14,
    },
    svgWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 10,
    },
    coverageNote: {
      fontSize: 11,
      color: theme.textSecondary,
      fontStyle: 'italic',
      marginTop: 8,
    },
  });
