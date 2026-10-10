import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Circle, Line, Rect, G } from 'react-native-svg';
import { Delivery, ShotSector } from '../../types/cricket';
import { Colors } from '../../utils/colors';

interface WagonWheelSVGProps {
  deliveries: Delivery[];
  batterId?: string;
  batterName?: string;
}

const SECTOR_ANGLES: Record<ShotSector, number> = {
  'Behind Keeper': 0,
  'Third Man': 40,
  'Point': 85,
  'Cover': 130,
  'Mid-Off': 165,
  'Long-Off': 185,
  'Long-On': 200,
  'Mid-Wicket': 240,
  'Square Leg': 280,
  'Fine Leg': 320,
};

export const WagonWheelSVG: React.FC<WagonWheelSVGProps> = ({
  deliveries,
  batterId,
  batterName,
}) => {
  const [filter, setFilter] = useState<'all' | 'boundaries' | 'runs' | 'wickets'>('all');

  // Filter deliveries with defensive null fallback
  const safeDeliveries = deliveries || [];
  const filtered = safeDeliveries.filter((d) => {
    if (batterId && d.strikerId !== batterId) return false;
    if (d.extraType === 'wide') return false; // wides don't have bat trajectories
    if (filter === 'boundaries') return d.isBoundary || d.isSix;
    if (filter === 'runs') return d.runsBat > 0 && !d.isBoundary && !d.isSix;
    if (filter === 'wickets') return d.isWicket;
    return true;
  });

  const size = 300;
  const center = size / 2;
  const boundaryRadius = 135;
  const thirtyYardRadius = 75;

  // Render shot lines
  const shotLines = filtered.map((d, index) => {
    const sector: ShotSector = d.shotArea || (d.isBoundary ? 'Cover' : d.isSix ? 'Long-On' : 'Mid-Wicket');
    const baseAngle = SECTOR_ANGLES[sector] ?? 135;
    // Add small deterministic jitter so overlapping shots are distinctly visible
    const jitter = ((index * 13) % 20) - 10;
    const angleRad = ((baseAngle + jitter - 90) * Math.PI) / 180;

    let dist = 60;
    let strokeColor = Colors.singleRun;
    let strokeWidth = 1.5;

    if (d.isSix) {
      dist = boundaryRadius + 6;
      strokeColor = '#D500F9';
      strokeWidth = 2.5;
    } else if (d.isBoundary) {
      dist = boundaryRadius;
      strokeColor = '#00E676';
      strokeWidth = 2.2;
    } else if (d.isWicket) {
      dist = (thirtyYardRadius + boundaryRadius) / 2;
      strokeColor = '#FF1744';
      strokeWidth = 2.0;
    } else if (d.runsBat >= 2) {
      dist = thirtyYardRadius + 30;
      strokeColor = '#00E5FF';
      strokeWidth = 1.8;
    } else if (d.runsBat === 1) {
      dist = thirtyYardRadius + 10;
      strokeColor = '#3B82F6';
      strokeWidth = 1.4;
    } else {
      dist = thirtyYardRadius - 20;
      strokeColor = '#64748B';
      strokeWidth = 1.0;
    }

    const x2 = center + dist * Math.cos(angleRad);
    const y2 = center + dist * Math.sin(angleRad);

    return (
      <Line
        key={d.id || index}
        x1={center}
        y1={center}
        x2={x2}
        y2={y2}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={0.85}
      />
    );
  });

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Radial Wagon Wheel</Text>
          <Text style={styles.subtitle}>
            {batterName ? `${batterName} • ` : ''}
            {filtered.length} Shots Plotted
          </Text>
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#00E676' }]} />
            <Text style={styles.legendText}>4s</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#D500F9' }]} />
            <Text style={styles.legendText}>6s</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
            <Text style={styles.legendText}>1-3s</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#FF1744' }]} />
            <Text style={styles.legendText}>W</Text>
          </View>
        </View>
      </View>

      {/* SVG Canvas */}
      <View style={styles.svgWrapper}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Outer Boundary Circle */}
          <Circle
            cx={center}
            cy={center}
            r={boundaryRadius}
            fill="#09141F"
            stroke="#1E4D36"
            strokeWidth={2}
          />

          {/* 30-Yard Circle */}
          <Circle
            cx={center}
            cy={center}
            r={thirtyYardRadius}
            fill="none"
            stroke="#163A29"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />

          {/* Center Pitch */}
          <Rect
            x={center - 5}
            y={center - 16}
            width={10}
            height={32}
            fill="#8D6E63"
            rx={2}
          />

          {/* Sector divider spokes */}
          {Object.entries(SECTOR_ANGLES).map(([sec, deg]) => {
            const rad = ((deg - 90) * Math.PI) / 180;
            const x = center + boundaryRadius * Math.cos(rad);
            const y = center + boundaryRadius * Math.sin(rad);
            return (
              <Line
                key={sec}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="#122533"
                strokeWidth={1}
              />
            );
          })}

          {/* Shot Trajectory Lines */}
          <G>{shotLines}</G>

          {/* Center Batting Stumps Point */}
          <Circle cx={center} cy={center} r={3} fill="#FFB300" />
        </Svg>
      </View>

      {/* Trajectory Filters */}
      <View style={styles.filterBar}>
        {(['all', 'boundaries', 'runs', 'wickets'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all'
                ? 'All Shots'
                : f === 'boundaries'
                ? 'Boundaries (4/6)'
                : f === 'runs'
                ? '1s & 2s'
                : 'Wickets'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0C142B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E2C4F',
    marginVertical: 10,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12,
    color: '#00E5FF',
    fontWeight: '700',
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  svgWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  filterBar: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#121C38',
    borderWidth: 1,
    borderColor: '#1E2C4F',
  },
  filterChipActive: {
    backgroundColor: '#00E676',
    borderColor: '#00E676',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  filterChipTextActive: {
    color: '#070D1E',
    fontWeight: '900',
  },
});
