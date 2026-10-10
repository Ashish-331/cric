import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Rect, Line, Circle, Text as SvgText, G } from 'react-native-svg';
import { Delivery, Player } from '../../types/cricket';
import { derivePitchMapping } from '../../engine/cricketEngine';
import { Colors } from '../../utils/colors';

interface PitchRadarSVGProps {
  deliveries: Delivery[];
  bowlerName?: string;
  batterName?: string;
  players?: Player[];
}

export const PitchRadarSVG: React.FC<PitchRadarSVGProps> = ({
  deliveries,
  bowlerName,
  batterName,
  players = [],
}) => {
  const [viewMode, setViewMode] = useState<'bowler' | 'batter'>('bowler');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>(undefined);
  const [inspectedBall, setInspectedBall] = useState<Delivery | null>(null);

  // Proportional 22-yard pitch geometry
  const width = 290;
  const height = 340;
  const pitchX = 90;
  const pitchY = 25;
  const pitchW = 110;
  const pitchH = 280;

  // Extract unique bowlers and batters from deliveries
  const uniqueBowlerIds = Array.from(new Set((deliveries || []).map((d) => d.bowlerId)));
  const uniqueBatterIds = Array.from(new Set((deliveries || []).map((d) => d.strikerId)));

  const getPlayerName = (id: string) => {
    const found = players.find((p) => p.id === id);
    if (found) return found.name;
    if (id === deliveries[0]?.bowlerId && bowlerName) return bowlerName;
    if (id === deliveries[0]?.strikerId && batterName) return batterName;
    return 'Player';
  };

  // Filter deliveries based on active mode
  let filteredBalls = (deliveries || []).filter((d) => d.extraType !== 'penalty');

  if (viewMode === 'bowler') {
    if (selectedPlayerId) {
      filteredBalls = filteredBalls.filter((d) => d.bowlerId === selectedPlayerId);
    }
  } else {
    // batter mode
    if (selectedPlayerId) {
      filteredBalls = filteredBalls.filter((d) => d.strikerId === selectedPlayerId);
    }
  }

  // Length zones coordinates (from top bowling crease to bottom popping crease)
  // pitchY = 25 to 305
  // Short: 25 to 110 (Y=25, height 85)
  // Good Length: 110 to 200 (Y=110, height 90)
  // Full: 200 to 265 (Y=200, height 65)
  // Yorker: 265 to 305 (Y=265, height 40)

  return (
    <View style={styles.container}>
      {/* Header and Mode Toggle: By Bowler vs By Batter */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>22-Yard Pitch Radar</Text>
          <Text style={styles.subtitle}>
            {viewMode === 'bowler' ? 'Deliveries Bowled' : 'Deliveries Faced'} • {filteredBalls.length} Balls Plotted
          </Text>
        </View>

        <View style={styles.modeToggleWrap}>
          <TouchableOpacity
            style={[styles.modeToggleBtn, viewMode === 'bowler' && styles.modeToggleBtnActive]}
            onPress={() => {
              setViewMode('bowler');
              setSelectedPlayerId(undefined);
              setInspectedBall(null);
            }}
          >
            <Text style={[styles.modeToggleText, viewMode === 'bowler' && styles.modeToggleTextActive]}>
              By Bowler
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeToggleBtn, viewMode === 'batter' && styles.modeToggleBtnActive]}
            onPress={() => {
              setViewMode('batter');
              setSelectedPlayerId(undefined);
              setInspectedBall(null);
            }}
          >
            <Text style={[styles.modeToggleText, viewMode === 'batter' && styles.modeToggleTextActive]}>
              By Batter
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Player Filter Selector Scroll */}
      <View style={styles.filterScrollWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, !selectedPlayerId && styles.filterChipActive]}
            onPress={() => setSelectedPlayerId(undefined)}
          >
            <Text style={[styles.filterChipText, !selectedPlayerId && styles.filterChipTextActive]}>
              All {viewMode === 'bowler' ? 'Bowlers' : 'Batters'}
            </Text>
          </TouchableOpacity>

          {(viewMode === 'bowler' ? uniqueBowlerIds : uniqueBatterIds).map((pId) => (
            <TouchableOpacity
              key={pId}
              style={[styles.filterChip, selectedPlayerId === pId && styles.filterChipActive]}
              onPress={() => setSelectedPlayerId(pId)}
            >
              <Text style={[styles.filterChipText, selectedPlayerId === pId && styles.filterChipTextActive]}>
                {getPlayerName(pId)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Pitch Diagram */}
      <View style={styles.radarWrapper}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {/* Pitch Turf Surface */}
          <Rect
            x={pitchX}
            y={pitchY}
            width={pitchW}
            height={pitchH}
            fill="#B48B57"
            rx={4}
            stroke="#5D4037"
            strokeWidth={2}
          />

          {/* 4 Length Zones Divider Lines & Labels */}
          {/* Zone 1: Short Length */}
          <Rect
            x={pitchX}
            y={pitchY}
            width={pitchW}
            height={85}
            fill="rgba(255, 255, 255, 0.05)"
          />
          <Line
            x1={pitchX}
            y1={pitchY + 85}
            x2={pitchX + pitchW}
            y2={pitchY + 85}
            stroke="#D7CCC8"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <SvgText x={pitchX - 10} y={pitchY + 48} fill="#94A3B8" fontSize="10" fontWeight="bold" textAnchor="end">
            SHORT
          </SvgText>

          {/* Zone 2: Good Length */}
          <Rect
            x={pitchX}
            y={pitchY + 85}
            width={pitchW}
            height={90}
            fill="rgba(0, 230, 118, 0.06)"
          />
          <Line
            x1={pitchX}
            y1={pitchY + 175}
            x2={pitchX + pitchW}
            y2={pitchY + 175}
            stroke="#D7CCC8"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <SvgText x={pitchX - 10} y={pitchY + 135} fill="#00E676" fontSize="10" fontWeight="bold" textAnchor="end">
            GOOD
          </SvgText>

          {/* Zone 3: Full Length */}
          <Rect
            x={pitchX}
            y={pitchY + 175}
            width={pitchW}
            height={65}
            fill="rgba(0, 229, 255, 0.06)"
          />
          <Line
            x1={pitchX}
            y1={pitchY + 240}
            x2={pitchX + pitchW}
            y2={pitchY + 240}
            stroke="#D7CCC8"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <SvgText x={pitchX - 10} y={pitchY + 212} fill="#00E5FF" fontSize="10" fontWeight="bold" textAnchor="end">
            FULL
          </SvgText>

          {/* Zone 4: Yorker Length */}
          <Rect
            x={pitchX}
            y={pitchY + 240}
            width={pitchW}
            height={40}
            fill="rgba(255, 23, 68, 0.08)"
          />
          <SvgText x={pitchX - 10} y={pitchY + 265} fill="#FF1744" fontSize="10" fontWeight="bold" textAnchor="end">
            YORKER
          </SvgText>

          {/* Stumps / Line Labels on Right Side */}
          <SvgText x={pitchX + pitchW + 8} y={pitchY + 295} fill="#CBD5E1" fontSize="9" fontWeight="bold">
            ← STUMPS
          </SvgText>

          {/* Line Markers (Outside Off, Stumps, Down Leg) */}
          <Line
            x1={pitchX + 35}
            y1={pitchY}
            x2={pitchX + 35}
            y2={pitchY + pitchH}
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth={0.8}
            strokeDasharray="3 3"
          />
          <Line
            x1={pitchX + 75}
            y1={pitchY}
            x2={pitchX + 75}
            y2={pitchY + pitchH}
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth={0.8}
            strokeDasharray="3 3"
          />

          {/* Bowling Crease (Top) */}
          <Line
            x1={pitchX + 20}
            y1={pitchY + 10}
            x2={pitchX + pitchW - 20}
            y2={pitchY + 10}
            stroke="#FFFFFF"
            strokeWidth={2}
          />
          {/* Top Stumps */}
          <Circle cx={pitchX + 50} cy={pitchY + 6} r={2} fill="#FFFFFF" />
          <Circle cx={pitchX + 55} cy={pitchY + 6} r={2} fill="#FFFFFF" />
          <Circle cx={pitchX + 60} cy={pitchY + 6} r={2} fill="#FFFFFF" />

          {/* Popping / Batting Crease (Bottom) */}
          <Line
            x1={pitchX + 10}
            y1={pitchY + pitchH - 15}
            x2={pitchX + pitchW - 10}
            y2={pitchY + pitchH - 15}
            stroke="#FFFFFF"
            strokeWidth={2}
          />
          {/* Bottom Stumps */}
          <Circle cx={pitchX + 50} cy={pitchY + pitchH - 8} r={2.5} fill="#FFFFFF" />
          <Circle cx={pitchX + 55} cy={pitchY + pitchH - 8} r={2.5} fill="#FFFFFF" />
          <Circle cx={pitchX + 60} cy={pitchY + pitchH - 8} r={2.5} fill="#FFFFFF" />

          {/* Channel Header Indicators */}
          <SvgText x={pitchX + 18} y={pitchY - 8} fill="#94A3B8" fontSize="8" textAnchor="middle">
            OFF
          </SvgText>
          <SvgText x={pitchX + 55} y={pitchY - 8} fill="#CBD5E1" fontSize="8" fontWeight="bold" textAnchor="middle">
            STUMPS
          </SvgText>
          <SvgText x={pitchX + 92} y={pitchY - 8} fill="#94A3B8" fontSize="8" textAnchor="middle">
            LEG
          </SvgText>

          {/* Delivery Dots - Plotted according to actual recorded or derived pitch mapping */}
          {filteredBalls.map((d, i) => {
            let xPos = pitchX + 55;
            let yPos = pitchY + 140;

            if (
              d.pitchCoord &&
              typeof d.pitchCoord.x === 'number' &&
              isFinite(d.pitchCoord.x) &&
              typeof d.pitchCoord.y === 'number' &&
              isFinite(d.pitchCoord.y)
            ) {
              xPos = pitchX + (d.pitchCoord.x / 100) * pitchW;
              yPos = pitchY + (d.pitchCoord.y / 100) * pitchH;
            } else if (d.pitchLength) {
              // Map length to Y
              if (d.pitchLength === 'yorker') yPos = pitchY + 265;
              else if (d.pitchLength === 'full') yPos = pitchY + 215;
              else if (d.pitchLength === 'good_length') yPos = pitchY + 145;
              else if (d.pitchLength === 'short') yPos = pitchY + 55;

              // Map line to X
              if (d.pitchLine === 'outside_off') xPos = pitchX + 25;
              else if (d.pitchLine === 'on_stumps') xPos = pitchX + 55;
              else if (d.pitchLine === 'down_leg') xPos = pitchX + 85;
            } else {
              // Auto-derived fallback
              const auto = derivePitchMapping(d.shotArea, d.runsBat, d.isBoundary, d.isSix);
              xPos = pitchX + (auto.pitchCoord.x / 100) * pitchW;
              yPos = pitchY + (auto.pitchCoord.y / 100) * pitchH;
            }

            // Slight organic jitter to avoid identical overlaps
            const jitterX = ((i * 3) % 7) - 3;
            const jitterY = ((i * 5) % 7) - 3;
            const rawX = xPos + jitterX;
            const rawY = yPos + jitterY;
            const boundedX = Math.min(pitchX + pitchW - 4, Math.max(pitchX + 4, isFinite(rawX) ? rawX : pitchX + 55));
            const boundedY = Math.min(pitchY + pitchH - 4, Math.max(pitchY + 4, isFinite(rawY) ? rawY : pitchY + 140));

            let fillColor = '#00E5FF'; // cyan (1-3 runs)
            if (d.isWicket) fillColor = '#FF1744'; // red
            else if (d.isSix) fillColor = '#D500F9'; // purple
            else if (d.isBoundary) fillColor = '#00E676'; // green
            else if (d.runsBat === 0 && d.extraType === 'none') fillColor = '#64748B'; // slate

            const isInspected = inspectedBall?.id === d.id;

            return (
              <G key={d.id || i} onPress={() => setInspectedBall(d)}>
                <Circle
                  cx={boundedX}
                  cy={boundedY}
                  r={isInspected ? 7 : 5}
                  fill={fillColor}
                  stroke={isInspected ? '#FFD700' : '#FFFFFF'}
                  strokeWidth={isInspected ? 2.5 : 1}
                  opacity={0.92}
                />
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Selected Ball Inspector Card */}
      {inspectedBall && (
        <View style={styles.inspectorCard}>
          <View style={styles.inspectorRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inspectorTitle}>
                Ball {inspectedBall.overIndex}.{inspectedBall.ballInOver} •{' '}
                {inspectedBall.isWicket
                  ? 'WICKET'
                  : inspectedBall.isSix
                  ? 'SIX'
                  : inspectedBall.isBoundary
                  ? 'FOUR'
                  : `${inspectedBall.runsBat} run(s)`}
              </Text>
              <Text style={styles.inspectorDesc}>
                {inspectedBall.shotArea ? `Shot: ${inspectedBall.shotArea} • ` : ''}
                {inspectedBall.pitchLength ? `Length: ${inspectedBall.pitchLength.replace('_', ' ')} • ` : ''}
                {inspectedBall.pitchLine ? `Line: ${inspectedBall.pitchLine.replace('_', ' ')}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setInspectedBall(null)}>
              <Text style={styles.inspectorClose}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Visual Color Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#64748B' }]} />
          <Text style={styles.legendText}>Dot</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#00E5FF' }]} />
          <Text style={styles.legendText}>1-3 Runs</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#00E676' }]} />
          <Text style={styles.legendText}>Four 4</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#D500F9' }]} />
          <Text style={styles.legendText}>Six 6</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF1744' }]} />
          <Text style={styles.legendText}>Wicket</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  modeToggleWrap: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modeToggleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  modeToggleBtnActive: {
    backgroundColor: Colors.pitchGreen,
  },
  modeToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  modeToggleTextActive: {
    color: '#070D1E',
    fontWeight: '800',
  },
  filterScrollWrap: {
    width: '100%',
    marginBottom: 8,
  },
  filterScroll: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  filterChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: Colors.accentCyan,
    borderColor: Colors.accentCyan,
  },
  filterChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  filterChipTextActive: {
    color: '#070D1E',
    fontWeight: '900',
  },
  radarWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A1329',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  inspectorCard: {
    marginTop: 8,
    width: '92%',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inspectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inspectorTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00E676',
  },
  inspectorDesc: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 2,
  },
  inspectorClose: {
    color: '#94A3B8',
    fontSize: 16,
    paddingHorizontal: 6,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
});
