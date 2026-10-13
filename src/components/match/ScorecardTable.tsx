import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Innings, Player, Team, BatterStats } from '../../types/cricket';
import { calculateRunRate } from '../../engine/cricketEngine';
import { useTheme, ThemeColors } from '../../theme/useTheme';

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
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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

      {/* Batting Table Rows */}
      {batterList.map((stat) => {
        const player = getPlayer(stat.playerId);
        return (
          <TouchableOpacity
            key={stat.playerId}
            activeOpacity={0.7}
            onPress={() => router.push(`/player/${stat.playerId}`)}
            style={[styles.row, styles.itemRow]}
          >
            <View style={styles.colBatter}>
              <Text style={styles.batterName} numberOfLines={1}>
                {player ? player.name : 'Unknown Player'}
              </Text>
              <Text style={styles.dismissalText} numberOfLines={1}>
                {formatDismissal(stat)}
              </Text>
            </View>
            <Text style={[styles.colNum, styles.runsText]}>{stat.runs}</Text>
            <Text style={styles.colNum}>{stat.ballsFaced}</Text>
            <Text style={styles.colNum}>{stat.fours}</Text>
            <Text style={styles.colNum}>{stat.sixes}</Text>
            <Text style={styles.colSR}>{stat.strikeRate.toFixed(1)}</Text>
          </TouchableOpacity>
        );
      })}

      {/* Extras Row */}
      <View style={[styles.row, styles.extrasRow]}>
        <Text style={[styles.colBatter, styles.extrasLabel]}>
          Extras (w {innings.extras.wides}, nb {innings.extras.noBalls}, b {innings.extras.byes}, lb {innings.extras.legByes})
        </Text>
        <Text style={[styles.colNum, styles.runsText]}>{innings.extras.total}</Text>
        <Text style={styles.colNum} />
        <Text style={styles.colNum} />
        <Text style={styles.colNum} />
        <Text style={styles.colSR} />
      </View>

      {/* Total Score Row */}
      <View style={[styles.row, styles.totalRow]}>
        <Text style={[styles.colBatter, styles.totalLabel]}>
          Total ({innings.oversFormatted} ov, RR {currentRunRate})
        </Text>
        <Text style={[styles.colNum, styles.totalScore]}>
          {innings.totalRuns}/{innings.totalWickets}
        </Text>
        <Text style={styles.colNum} />
        <Text style={styles.colNum} />
        <Text style={styles.colNum} />
        <Text style={styles.colSR} />
      </View>

      {/* Fall of Wickets */}
      {innings.fallOfWickets.length > 0 && (
        <View style={styles.fowContainer}>
          <Text style={styles.fowTitle}>Fall of Wickets</Text>
          <Text style={styles.fowContent}>
            {innings.fallOfWickets
              .map((fow) => {
                const player = getPlayer(fow.playerDismissedId);
                const pName = player ? player.name.split(' ')[0] : 'Wkt';
                return `${fow.score}-${fow.wicketNumber} (${pName}, ${fow.oversFormatted} ov)`;
              })
              .join('  •  ')}
          </Text>
        </View>
      )}

      {/* Bowling Section Header */}
      <View style={[styles.sectionHeader, { marginTop: 20 }]}>
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

      {/* Bowling Table Rows */}
      {bowlerList.map((stat) => {
        const player = getPlayer(stat.playerId);
        return (
          <TouchableOpacity
            key={stat.playerId}
            activeOpacity={0.7}
            onPress={() => router.push(`/player/${stat.playerId}`)}
            style={[styles.row, styles.itemRow]}
          >
            <View style={styles.colBowler}>
              <Text style={styles.batterName} numberOfLines={1}>
                {player ? player.name : 'Unknown Player'}
              </Text>
            </View>
            <Text style={styles.colNum}>{stat.oversFormatted}</Text>
            <Text style={styles.colNum}>{stat.maidens}</Text>
            <Text style={styles.colNum}>{stat.runsConceded}</Text>
            <Text style={[styles.colNum, styles.wicketsText]}>{stat.wickets}</Text>
            <Text style={styles.colSR}>{stat.economy.toFixed(1)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 14,
    },
    sectionHeader: {
      marginBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderSubdued,
      paddingBottom: 6,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7,
    },
    tableHeader: {
      backgroundColor: theme.raised,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderSubdued,
      paddingVertical: 5,
      borderRadius: 6,
      marginBottom: 2,
    },
    headerText: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
    },
    itemRow: {
      borderBottomWidth: 1,
      borderBottomColor: theme.borderSubdued,
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
      fontWeight: '500',
      color: theme.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    colSR: {
      flex: 1.5,
      textAlign: 'right',
      fontSize: 13,
      fontWeight: '500',
      color: theme.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    batterName: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.textPrimary,
    },
    dismissalText: {
      fontSize: 11,
      color: theme.textSecondary,
      marginTop: 1,
    },
    runsText: {
      fontWeight: '700',
      color: theme.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    wicketsText: {
      fontWeight: '700',
      color: theme.statusError,
      fontVariant: ['tabular-nums'],
    },
    extrasRow: {
      backgroundColor: theme.raised,
      paddingVertical: 6,
      paddingHorizontal: 6,
      borderRadius: 6,
      marginTop: 4,
    },
    extrasLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: theme.textSecondary,
    },
    totalRow: {
      backgroundColor: theme.raised,
      paddingVertical: 8,
      borderBottomWidth: 0,
      borderRadius: 6,
      marginTop: 4,
      paddingHorizontal: 6,
    },
    totalLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    totalScore: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.brand,
      fontVariant: ['tabular-nums'],
    },
    fowContainer: {
      marginTop: 10,
      padding: 8,
      backgroundColor: theme.raised,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    fowTitle: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 3,
    },
    fowContent: {
      fontSize: 11,
      color: theme.textSecondary,
      lineHeight: 16,
      fontVariant: ['tabular-nums'],
    },
  });
}
