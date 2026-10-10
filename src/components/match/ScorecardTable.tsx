import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Innings, Player, Team, BatterStats } from '../../types/cricket';
import { Colors } from '../../utils/colors';
import { calculateRunRate } from '../../engine/cricketEngine';

interface ScorecardTableProps {
  innings: Innings;
  battingTeam: Team;
  bowlingTeam: Team;
  allPlayers: Player[];
}

export const ScorecardTable: React.FC<ScorecardTableProps> = ({
  innings,
  battingTeam,
  bowlingTeam,
  allPlayers,
}) => {
  const getPlayer = (id: string) => allPlayers.find((p) => p.id === id);

  const batterList = Object.values(innings.batterStats).sort(
    (a, b) => a.battingOrder - b.battingOrder
  );
  const bowlerList = Object.values(innings.bowlerStats);

  const formatDismissal = (stat: BatterStats) => {
    if (!stat.isOut) return 'not out';

    const bowler = stat.bowlerId ? getPlayer(stat.bowlerId) : undefined;
    const fielder = stat.fielderId ? getPlayer(stat.fielderId) : undefined;

    const wicketDelivery = innings.deliveries.find(
      (d) => d.isWicket && d.wicketDetails?.playerDismissedId === stat.playerId
    );

    if (wicketDelivery?.wicketDetails) {
      const type = wicketDelivery.wicketDetails.dismissalType;
      const fName = fielder?.name;
      const bName = bowler?.name;
      switch (type) {
        case 'bowled':
          return bName ? `b ${bName}` : 'b Bowler';
        case 'caught':
          return fName && bName
            ? `c ${fName} b ${bName}`
            : fName
            ? `c ${fName}`
            : bName
            ? `c & b ${bName}`
            : 'c & b Bowler';
        case 'caught_and_bowled':
          return bName ? `c & b ${bName}` : 'c & b Bowler';
        case 'lbw':
          return bName ? `lbw b ${bName}` : 'lbw';
        case 'run_out':
          return fName ? `run out (${fName})` : 'run out';
        case 'stumped':
          return fName && bName
            ? `st ${fName} b ${bName}`
            : bName
            ? `st b ${bName}`
            : 'stumped';
        case 'hit_wicket':
          return bName ? `hit wicket b ${bName}` : 'hit wicket';
        case 'retired_hurt':
          return 'retired hurt';
        case 'retired_out':
          return 'retired out';
        default:
          return bName ? `b ${bName}` : 'out';
      }
    }

    if (stat.dismissalText && !stat.dismissalText.includes('Bowler') && !stat.dismissalText.includes('Fielder')) {
      return stat.dismissalText;
    }

    return bowler?.name ? `b ${bowler.name}` : stat.dismissalText || 'out';
  };

  const currentRunRate = calculateRunRate(innings.totalRuns, innings.legalBallsBowled);

  return (
    <View style={styles.container}>
      {/* Batting Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Batting — {battingTeam.name}</Text>
      </View>

      {/* Batting Table Header */}
      <View style={[styles.row, styles.tableHeader]}>
        <Text style={[styles.colBatter, styles.headerText]}>Batter</Text>
        <Text style={[styles.colNum, styles.headerText]}>R</Text>
        <Text style={[styles.colNum, styles.headerText]}>B</Text>
        <Text style={[styles.colNum, styles.headerText]}>4s</Text>
        <Text style={[styles.colNum, styles.headerText]}>6s</Text>
        <Text style={[styles.colSR, styles.headerText]}>SR</Text>
      </View>

      {batterList.map((stat) => {
        const player = getPlayer(stat.playerId);
        return (
          <View key={stat.playerId} style={[styles.row, styles.itemRow]}>
            <TouchableOpacity
              style={styles.colBatter}
              onPress={() => router.push(`/player/${stat.playerId}`)}
            >
              <Text style={styles.batterName}>{player ? player.name : 'Unknown Player'}</Text>
              <Text style={styles.dismissalText}>{formatDismissal(stat)}</Text>
            </TouchableOpacity>
            <Text style={[styles.colNum, styles.runsText]}>{stat.runs}</Text>
            <Text style={styles.colNum}>{stat.ballsFaced}</Text>
            <Text style={styles.colNum}>{stat.fours}</Text>
            <Text style={styles.colNum}>{stat.sixes}</Text>
            <Text style={styles.colSR}>{stat.strikeRate}</Text>
          </View>
        );
      })}

      {/* Extras Row */}
      <View style={[styles.row, styles.extrasRow]}>
        <View style={styles.colBatter}>
          <Text style={styles.extrasLabel}>
            Extras (w {innings.extras.wides}, nb {innings.extras.noBalls}, b {innings.extras.byes}, lb {innings.extras.legByes})
          </Text>
        </View>
        <Text style={[styles.colNum, styles.runsText]}>{innings.extras.total}</Text>
      </View>

      {/* Total Score Row */}
      <View style={[styles.row, styles.totalRow]}>
        <View style={styles.colBatter}>
          <Text style={styles.totalLabel}>
            Total ({innings.oversFormatted} Overs, RR {currentRunRate.toFixed(2)})
          </Text>
        </View>
        <Text style={styles.totalScore}>
          {innings.totalRuns}/{innings.totalWickets}
        </Text>
      </View>

      {/* Fall of Wickets */}
      {innings.fallOfWickets.length > 0 && (
        <View style={styles.fowContainer}>
          <Text style={styles.fowTitle}>Fall of Wickets:</Text>
          <Text style={styles.fowContent}>
            {innings.fallOfWickets
              .map((fow) => {
                const player = getPlayer(fow.playerDismissedId);
                return `${fow.score}-${fow.wicketNumber} (${player?.name || 'Batsman'}, ${fow.oversFormatted} ov)`;
              })
              .join(', ')}
          </Text>
        </View>
      )}

      {/* Bowling Section */}
      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>Bowling — {bowlingTeam.name}</Text>
      </View>

      {/* Bowling Table Header */}
      <View style={[styles.row, styles.tableHeader]}>
        <Text style={[styles.colBowler, styles.headerText]}>Bowler</Text>
        <Text style={[styles.colNum, styles.headerText]}>O</Text>
        <Text style={[styles.colNum, styles.headerText]}>M</Text>
        <Text style={[styles.colNum, styles.headerText]}>R</Text>
        <Text style={[styles.colNum, styles.headerText]}>W</Text>
        <Text style={[styles.colSR, styles.headerText]}>ECON</Text>
      </View>

      {bowlerList.map((stat) => {
        const player = getPlayer(stat.playerId);
        return (
          <View key={stat.playerId} style={[styles.row, styles.itemRow]}>
            <TouchableOpacity
              style={styles.colBowler}
              onPress={() => router.push(`/player/${stat.playerId}`)}
            >
              <Text style={styles.batterName}>{player ? player.name : 'Unknown Bowler'}</Text>
              <Text style={styles.dismissalText}>Dots: {stat.dots}</Text>
            </TouchableOpacity>
            <Text style={styles.colNum}>{stat.oversFormatted}</Text>
            <Text style={styles.colNum}>{stat.maidens}</Text>
            <Text style={styles.colNum}>{stat.runsConceded}</Text>
            <Text style={[styles.colNum, styles.wicketsText]}>{stat.wickets}</Text>
            <Text style={styles.colSR}>{stat.economy}</Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  tableHeader: {
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 4,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  itemRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  colBatter: {
    flex: 3.5,
  },
  colBowler: {
    flex: 3.5,
  },
  colNum: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    fontVariant: ['tabular-nums'],
  },
  colSR: {
    flex: 1.5,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    fontVariant: ['tabular-nums'],
  },
  batterName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  dismissalText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  runsText: {
    fontWeight: '800',
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },
  wicketsText: {
    fontWeight: '800',
    color: Colors.accentRed,
    fontVariant: ['tabular-nums'],
  },
  extrasRow: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
  },
  extrasLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  totalRow: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderBottomWidth: 0,
    borderRadius: 8,
    marginTop: 4,
    paddingHorizontal: 8,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  totalScore: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.pitchGreen,
    fontVariant: ['tabular-nums'],
  },
  fowContainer: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fowTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  fowContent: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
});
