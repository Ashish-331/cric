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

type Tab = 'batting' | 'bowling' | 'fielding' | 'wagon' | 'radar';

export default function PerformanceScreen() {
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
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Performance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Player Profile Header Card */}
        <View style={styles.profileHeaderCard}>
          <View style={styles.avatarBox}>
            <Ionicons name="person" size={32} color="#00E676" />
          </View>
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.playerName}>{currentPlayer?.name || userProfile?.name || 'Player'}</Text>
              {userProfile?.isVerified && (
                <Ionicons name="checkmark-circle" size={16} color="#00E676" style={{ marginLeft: 4 }} />
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
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C142B',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    marginBottom: 16,
  },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#070D1E',
    borderWidth: 2,
    borderColor: '#00E676',
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
    fontWeight: '900',
    color: '#FFFFFF',
  },
  playerRole: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
  },
  identityStatus: {
    fontSize: 11,
    color: '#00E676',
    fontWeight: '600',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0C142B',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTabBtn: {
    backgroundColor: '#1E2C4F',
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
  },
  activeTabBtnText: {
    color: '#00E676',
  },
  statsCard: {
    backgroundColor: '#0C142B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    marginBottom: 16,
  },
  cardSectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1,
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
    fontWeight: '900',
    color: '#FFFFFF',
  },
  statLbl: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
  },
  visualCard: {
    backgroundColor: '#0C142B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    alignItems: 'center',
    marginBottom: 16,
  },
  visualSubText: {
    fontSize: 12,
    color: '#94A3B8',
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
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 8,
  },
});
