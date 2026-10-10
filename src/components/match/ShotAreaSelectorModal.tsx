import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Svg, {
  Path,
  Circle,
  Rect,
  Text as SvgText,
  G,
  Line,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import {
  ShotSector,
  PitchLength,
  PitchLine,
  PitchCoordinate,
} from '../../types/cricket';
import { derivePitchMapping } from '../../engine/cricketEngine';
import { Colors } from '../../utils/colors';

interface ShotAreaSelectorModalProps {
  visible: boolean;
  runs: number;
  isBoundary: boolean;
  isSix: boolean;
  isWicket: boolean;
  strikerName?: string;
  onSelectSector: (
    sector: ShotSector,
    pitchLength?: PitchLength,
    pitchLine?: PitchLine,
    pitchCoord?: PitchCoordinate
  ) => void;
  onSkip: () => void;
  onEnableQuickScoring: () => void;
}

export interface SectorDefinition {
  sector: ShotSector;
  startAngle: number;
  endAngle: number;
  centerAngle: number;
  shortLabel: string;
}

export const SECTOR_DEFINITIONS: SectorDefinition[] = [
  { sector: 'Behind Keeper', startAngle: 342, endAngle: 18, centerAngle: 0, shortLabel: 'BHK' },
  { sector: 'Third Man', startAngle: 18, endAngle: 54, centerAngle: 36, shortLabel: '3RD' },
  { sector: 'Point', startAngle: 54, endAngle: 90, centerAngle: 72, shortLabel: 'PNT' },
  { sector: 'Cover', startAngle: 90, endAngle: 126, centerAngle: 108, shortLabel: 'COV' },
  { sector: 'Mid-Off', startAngle: 126, endAngle: 162, centerAngle: 144, shortLabel: 'MOF' },
  { sector: 'Long-Off', startAngle: 162, endAngle: 198, centerAngle: 180, shortLabel: 'LOF' },
  { sector: 'Long-On', startAngle: 198, endAngle: 234, centerAngle: 216, shortLabel: 'LON' },
  { sector: 'Mid-Wicket', startAngle: 234, endAngle: 270, centerAngle: 252, shortLabel: 'MID' },
  { sector: 'Square Leg', startAngle: 270, endAngle: 306, centerAngle: 288, shortLabel: 'SQL' },
  { sector: 'Fine Leg', startAngle: 306, endAngle: 342, centerAngle: 324, shortLabel: 'FNL' },
];

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function makeWedgePath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startDeg: number,
  endDeg: number
): string {
  // Normalize angles
  let a1 = startDeg;
  let a2 = endDeg;
  if (a2 <= a1) a2 += 360;

  const a1Rad = degToRad(a1);
  const a2Rad = degToRad(a2);

  const xOut1 = cx + rOuter * Math.sin(a1Rad);
  const yOut1 = cy - rOuter * Math.cos(a1Rad);

  const xOut2 = cx + rOuter * Math.sin(a2Rad);
  const yOut2 = cy - rOuter * Math.cos(a2Rad);

  const xIn2 = cx + rInner * Math.sin(a2Rad);
  const yIn2 = cy - rInner * Math.cos(a2Rad);

  const xIn1 = cx + rInner * Math.sin(a1Rad);
  const yIn1 = cy - rInner * Math.cos(a1Rad);

  const largeArc = a2 - a1 > 180 ? 1 : 0;

  return `M ${xIn1} ${yIn1} L ${xOut1} ${yOut1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${xOut2} ${yOut2} L ${xIn2} ${yIn2} A ${rInner} ${rInner} 0 ${largeArc} 0 ${xIn1} ${yIn1} Z`;
}

export const ShotAreaSelectorModal: React.FC<ShotAreaSelectorModalProps> = ({
  visible,
  runs,
  isBoundary,
  isSix,
  isWicket,
  strikerName,
  onSelectSector,
  onSkip,
  onEnableQuickScoring,
}) => {
  const [selectedSector, setSelectedSector] = useState<ShotSector>('Cover');
  const [mappingMode, setMappingMode] = useState<'auto' | 'touch' | 'off'>('auto');

  // Manual pitch mapping states (when in 'touch' mode)
  const [manualLength, setManualLength] = useState<PitchLength>('good_length');
  const [manualLine, setManualLine] = useState<PitchLine>('on_stumps');

  const autoMapping = derivePitchMapping(selectedSector, runs, isBoundary, isSix);

  const handleConfirm = (sectorToCommit: ShotSector = selectedSector) => {
    if (mappingMode === 'off') {
      onSelectSector(sectorToCommit);
    } else if (mappingMode === 'touch') {
      const yMap: Record<PitchLength, number> = {
        yorker: 92,
        full: 78,
        good_length: 58,
        short: 35,
      };
      const xMap: Record<PitchLine, number> = {
        outside_off: 35,
        on_stumps: 50,
        down_leg: 65,
      };
      const touchCoord: PitchCoordinate = {
        x: xMap[manualLine] ?? 50,
        y: yMap[manualLength] ?? 58,
      };
      onSelectSector(sectorToCommit, manualLength, manualLine, touchCoord);
    } else {
      // auto mode
      const derived = derivePitchMapping(sectorToCommit, runs, isBoundary, isSix);
      onSelectSector(sectorToCommit, derived.pitchLength, derived.pitchLine, derived.pitchCoord);
    }
  };

  const handleSectorPress = (sector: ShotSector) => {
    setSelectedSector(sector);
    // If in auto mode, update immediately
  };

  // SVG dimensions
  const svgSize = 280;
  const center = svgSize / 2;
  const rInner = 28; // around pitch
  const rOuter = 130; // boundary rope

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Touch Ground Sector</Text>
              <Text style={styles.subtitle}>
                {strikerName ? `${strikerName} • ` : ''}
                {isWicket
                  ? 'Wicket / Chance'
                  : isSix
                  ? '6 Runs (Maximum)'
                  : isBoundary
                  ? '4 Runs (Boundary)'
                  : `${runs} Run${runs === 1 ? '' : 's'}`}
              </Text>
            </View>

            <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </View>

          {/* 3-Way Pitch Mapping Selector Mode */}
          <View style={styles.modeTabBar}>
            <TouchableOpacity
              style={[styles.modeTab, mappingMode === 'auto' && styles.modeTabActive]}
              onPress={() => setMappingMode('auto')}
            >
              <Ionicons
                name="sparkles"
                size={13}
                color={mappingMode === 'auto' ? '#070D1E' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.modeTabText,
                  mappingMode === 'auto' && styles.modeTabTextActive,
                ]}
              >
                Auto Mode
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, mappingMode === 'touch' && styles.modeTabActive]}
              onPress={() => setMappingMode('touch')}
            >
              <Ionicons
                name="locate"
                size={13}
                color={mappingMode === 'touch' ? '#070D1E' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.modeTabText,
                  mappingMode === 'touch' && styles.modeTabTextActive,
                ]}
              >
                Touch Pitch
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, mappingMode === 'off' && styles.modeTabActive]}
              onPress={() => setMappingMode('off')}
            >
              <Ionicons
                name="close-circle-outline"
                size={13}
                color={mappingMode === 'off' ? '#070D1E' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.modeTabText,
                  mappingMode === 'off' && styles.modeTabTextActive,
                ]}
              >
                Off
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollArea}
            showsVerticalScrollIndicator={false}
          >
            {/* Interactive SVG Wagon Wheel */}
            <View style={styles.wheelWrapper}>
              <Svg width={svgSize} height={svgSize}>
                {/* Outfield Grass */}
                <Circle
                  cx={center}
                  cy={center}
                  r={rOuter}
                  fill="#062117"
                  stroke="#00E676"
                  strokeWidth="2.5"
                />

                {/* 30-Yard Circle */}
                <Circle
                  cx={center}
                  cy={center}
                  r={65}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />

                {/* 10 Touchable Sector Wedges */}
                {SECTOR_DEFINITIONS.map((s) => {
                  const isSelected = selectedSector === s.sector;
                  const wedgeD = makeWedgePath(
                    center,
                    center,
                    rInner,
                    rOuter - 2,
                    s.startAngle,
                    s.endAngle
                  );

                  // Label position at 70% radius
                  const lblR = 88;
                  const lblRad = degToRad(s.centerAngle);
                  const lblX = center + lblR * Math.sin(lblRad);
                  const lblY = center - lblR * Math.cos(lblRad);

                  return (
                    <G key={s.sector} onPress={() => handleSectorPress(s.sector)}>
                      <Path
                        d={wedgeD}
                        fill={
                          isSelected
                            ? 'rgba(0, 230, 118, 0.35)'
                            : 'rgba(255, 255, 255, 0.04)'
                        }
                        stroke={isSelected ? '#00E676' : 'rgba(255, 255, 255, 0.15)'}
                        strokeWidth={isSelected ? '2' : '0.8'}
                      />
                      <SvgText
                        x={lblX}
                        y={lblY + 4}
                        fill={isSelected ? '#00E676' : '#94A3B8'}
                        fontSize="9"
                        fontWeight={isSelected ? 'bold' : 'normal'}
                        textAnchor="middle"
                      >
                        {s.shortLabel}
                      </SvgText>
                    </G>
                  );
                })}

                {/* Center Pitch */}
                <Rect
                  x={center - 8}
                  y={center - 18}
                  width="16"
                  height="36"
                  fill="#E2C17D"
                  rx="2"
                  stroke="#8B6914"
                  strokeWidth="1"
                />

                {/* Bowling Crease & Stumps */}
                <Line
                  x1={center - 6}
                  y1={center - 15}
                  x2={center + 6}
                  y2={center - 15}
                  stroke="#FFF"
                  strokeWidth="1.5"
                />
                <Line
                  x1={center - 6}
                  y1={center + 15}
                  x2={center + 6}
                  y2={center + 15}
                  stroke="#FFF"
                  strokeWidth="1.5"
                />
              </Svg>
            </View>

            {/* Selected Sector Indicator Pill */}
            <View style={styles.selectedBanner}>
              <Text style={styles.selectedLabel}>SELECTED GROUND SECTOR:</Text>
              <Text style={styles.selectedName}>{selectedSector.toUpperCase()}</Text>
            </View>

            {/* Mode Content: Auto Mode Preview */}
            {mappingMode === 'auto' && (
              <View style={styles.autoPreviewCard}>
                <Ionicons name="sparkles" size={14} color="#00E676" />
                <Text style={styles.autoPreviewText}>
                  Auto Pitch: <Text style={styles.autoPreviewBold}>{autoMapping.pitchLength.replace('_', ' ').toUpperCase()}</Text> • <Text style={styles.autoPreviewBold}>{autoMapping.pitchLine.replace('_', ' ').toUpperCase()}</Text>
                </Text>
              </View>
            )}

            {/* Mode Content: Touch Pitch Manual Diagram */}
            {mappingMode === 'touch' && (
              <View style={styles.touchPitchCard}>
                <Text style={styles.pitchCardHeading}>TAP DELIVERY LENGTH & LINE</Text>

                {/* Length Selector */}
                <Text style={styles.subHeading}>LENGTH:</Text>
                <View style={styles.pillRow}>
                  {(['yorker', 'full', 'good_length', 'short'] as PitchLength[]).map((len) => (
                    <TouchableOpacity
                      key={len}
                      style={[
                        styles.pitchPill,
                        manualLength === len && styles.pitchPillActive,
                      ]}
                      onPress={() => setManualLength(len)}
                    >
                      <Text
                        style={[
                          styles.pitchPillText,
                          manualLength === len && styles.pitchPillTextActive,
                        ]}
                      >
                        {len.replace('_', ' ').toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Line Selector */}
                <Text style={styles.subHeading}>LINE:</Text>
                <View style={styles.pillRow}>
                  {(['outside_off', 'on_stumps', 'down_leg'] as PitchLine[]).map((line) => (
                    <TouchableOpacity
                      key={line}
                      style={[
                        styles.pitchPill,
                        manualLine === line && styles.pitchPillActive,
                      ]}
                      onPress={() => setManualLine(line)}
                    >
                      <Text
                        style={[
                          styles.pitchPillText,
                          manualLine === line && styles.pitchPillTextActive,
                        ]}
                      >
                        {line.replace('_', ' ').toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.confirmBtn} onPress={() => handleConfirm()}>
              <Text style={styles.confirmBtnText}>
                Confirm Shot & Pitch ({selectedSector})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickToggleBtn}
              onPress={onEnableQuickScoring}
            >
              <Ionicons name="flash-outline" size={13} color="#94A3B8" />
              <Text style={styles.quickToggleText}>Skip modal next time</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#070D1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    fontSize: 13,
    color: Colors.pitchGreen,
    fontWeight: '700',
    marginTop: 2,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1E293B',
    borderRadius: 8,
  },
  skipText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 12,
  },
  modeTabBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
  },
  modeTabActive: {
    backgroundColor: Colors.pitchGreen,
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  modeTabTextActive: {
    color: '#070D1E',
    fontWeight: '800',
  },
  scrollArea: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  wheelWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  selectedBanner: {
    backgroundColor: '#0F172A',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 4,
    marginBottom: 8,
  },
  selectedLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  selectedName: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.pitchGreen,
    marginTop: 1,
  },
  autoPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 8,
  },
  autoPreviewText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  autoPreviewBold: {
    color: '#F8FAFC',
    fontWeight: '800',
  },
  touchPitchCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 8,
  },
  pitchCardHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 4,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  pitchPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  pitchPillActive: {
    backgroundColor: Colors.accentCyan,
    borderColor: Colors.accentCyan,
  },
  pitchPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  pitchPillTextActive: {
    color: '#070D1E',
    fontWeight: '900',
  },
  footerRow: {
    marginTop: 8,
    gap: 6,
  },
  confirmBtn: {
    backgroundColor: Colors.pitchGreen,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#070D1E',
    fontWeight: '900',
    fontSize: 13,
  },
  quickToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  quickToggleText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
});
