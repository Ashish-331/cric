export interface ThemeColors {
  // Canvases & Surfaces
  canvas: string;
  surface: string;
  raised: string;
  overlay: string;

  // Borders
  border: string;
  borderSubdued: string;

  // Typography
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Brand / Field Green
  brand: string;
  brandTint: string;
  brandPressed: string;
  brandText: string;

  // Semantic Status
  statusLive: string;
  statusLiveBg: string;
  statusBreak: string;
  statusBreakBg: string;
  statusCompleted: string;
  statusCompletedBg: string;
  statusSynced: string;
  statusSyncedBg: string;
  statusLocal: string;
  statusLocalBg: string;
  statusError: string;
  statusErrorBg: string;
  statusWarning: string;
  statusWarningBg: string;

  // Ball-by-ball Scorebook Badges
  ballDot: string;
  ballDotText: string;
  ballRun: string;
  ballRunText: string;
  ballFour: string;
  ballFourText: string;
  ballSix: string;
  ballSixText: string;
  ballWicket: string;
  ballWicketText: string;
  ballExtra: string;
  ballExtraText: string;

  // Keypad & Controls
  keypadBtnBg: string;
  keypadBtnBorder: string;
  keypadBtnText: string;
  keypadDotBg: string;
  keypadDotText: string;
  keypadFourBg: string;
  keypadFourBorder: string;
  keypadFourText: string;
  keypadSixBg: string;
  keypadSixBorder: string;
  keypadSixText: string;
  keypadWicketBg: string;
  keypadWicketText: string;
  keypadSwapBg: string;
  keypadSwapText: string;
  keypadUndoBg: string;
  keypadUndoText: string;
  keypadExtraActiveBg: string;
  keypadExtraActiveBorder: string;
  keypadExtraActiveText: string;

  // Ergonomic Aliases
  background: string;
  surfaceAlt: string;
  primary: string;
  primarySubtle: string;
  accent: string;
  text: string;
  textTertiary: string;
  danger: string;
  warning: string;
}

export const LightColors: ThemeColors = {
  // Canvases & Surfaces
  canvas: '#F6F7F4', // Quiet light field paper
  surface: '#FFFFFF',
  raised: '#EDF1ED',
  overlay: 'rgba(23, 32, 27, 0.45)',

  // Borders
  border: '#D9E1DB',
  borderSubdued: '#E7ECE8',

  // Typography
  textPrimary: '#17201B',
  textSecondary: '#536057',
  textMuted: '#66716A',
  textInverse: '#FFFFFF',

  // Brand / Field Green (restrained cricket green)
  brand: '#286B4D',
  brandTint: '#E7F1E8',
  brandPressed: '#1F543C',
  brandText: '#FFFFFF',

  // Semantic Status
  statusLive: '#BA1A1A',
  statusLiveBg: '#FFEDEA',
  statusBreak: '#825500',
  statusBreakBg: '#FFF0D4',
  statusCompleted: '#286B4D',
  statusCompletedBg: '#E7F1E8',
  statusSynced: '#00639B',
  statusSyncedBg: '#E0F2FE',
  statusLocal: '#66716A',
  statusLocalBg: '#EDF1ED',
  statusError: '#BA1A1A',
  statusErrorBg: '#FFEDEA',
  statusWarning: '#825500',
  statusWarningBg: '#FFF0D4',

  // Ball-by-ball Scorebook Badges
  ballDot: '#536057',
  ballDotText: '#FFFFFF',
  ballRun: '#00639B',
  ballRunText: '#FFFFFF',
  ballFour: '#286B4D',
  ballFourText: '#FFFFFF',
  ballSix: '#5E418C',
  ballSixText: '#FFFFFF',
  ballWicket: '#BA1A1A',
  ballWicketText: '#FFFFFF',
  ballExtra: '#825500',
  ballExtraText: '#FFFFFF',

  // Keypad & Controls
  keypadBtnBg: '#FFFFFF',
  keypadBtnBorder: '#D9E1DB',
  keypadBtnText: '#17201B',
  keypadDotBg: '#EDF1ED',
  keypadDotText: '#17201B',
  keypadFourBg: '#E7F1E8',
  keypadFourBorder: '#A3D4B6',
  keypadFourText: '#1F543C',
  keypadSixBg: '#F3ECFA',
  keypadSixBorder: '#D5C2E8',
  keypadSixText: '#4A3073',
  keypadWicketBg: '#BA1A1A',
  keypadWicketText: '#FFFFFF',
  keypadSwapBg: '#EDF1ED',
  keypadSwapText: '#17201B',
  keypadUndoBg: '#17201B',
  keypadUndoText: '#FFFFFF',
  keypadExtraActiveBg: '#FFF0D4',
  keypadExtraActiveBorder: '#825500',
  keypadExtraActiveText: '#825500',

  // Ergonomic Aliases
  background: '#F6F7F4',
  surfaceAlt: '#EDF1ED',
  primary: '#286B4D',
  primarySubtle: '#E7F1E8',
  accent: '#1F543C',
  text: '#17201B',
  textTertiary: '#66716A',
  danger: '#BA1A1A',
  warning: '#825500',
};

export const DarkColors: ThemeColors = {
  // Canvases & Surfaces
  canvas: '#101713', // Deep turf charcoal
  surface: '#18211B',
  raised: '#222D26',
  overlay: 'rgba(0, 0, 0, 0.70)',

  // Borders
  border: '#303A34',
  borderSubdued: '#232E27',

  // Typography
  textPrimary: '#F2F5F0',
  textSecondary: '#C0CBC3',
  textMuted: '#9EA9A1',
  textInverse: '#101713',

  // Brand / Field Green (high-contrast readable green on dark, not neon)
  brand: '#70C58A',
  brandTint: '#1D3427',
  brandPressed: '#58B073',
  brandText: '#101713',

  // Semantic Status
  statusLive: '#FFB4AB',
  statusLiveBg: '#3B1313',
  statusBreak: '#FFBA2F',
  statusBreakBg: '#382600',
  statusCompleted: '#70C58A',
  statusCompletedBg: '#1D3427',
  statusSynced: '#92CCFF',
  statusSyncedBg: '#003453',
  statusLocal: '#9EA9A1',
  statusLocalBg: '#222D26',
  statusError: '#FFB4AB',
  statusErrorBg: '#3B1313',
  statusWarning: '#FFBA2F',
  statusWarningBg: '#382600',

  // Ball-by-ball Scorebook Badges
  ballDot: '#303A34',
  ballDotText: '#F2F5F0',
  ballRun: '#18476B',
  ballRunText: '#92CCFF',
  ballFour: '#1D3427',
  ballFourText: '#70C58A',
  ballSix: '#3C2859',
  ballSixText: '#D0BCFF',
  ballWicket: '#4C1A1A',
  ballWicketText: '#FFB4AB',
  ballExtra: '#422D00',
  ballExtraText: '#FFBA2F',

  // Keypad & Controls
  keypadBtnBg: '#18211B',
  keypadBtnBorder: '#303A34',
  keypadBtnText: '#F2F5F0',
  keypadDotBg: '#222D26',
  keypadDotText: '#F2F5F0',
  keypadFourBg: '#1D3427',
  keypadFourBorder: '#286B4D',
  keypadFourText: '#70C58A',
  keypadSixBg: '#2C1D42',
  keypadSixBorder: '#5E418C',
  keypadSixText: '#D0BCFF',
  keypadWicketBg: '#BA1A1A',
  keypadWicketText: '#FFFFFF',
  keypadSwapBg: '#222D26',
  keypadSwapText: '#F2F5F0',
  keypadUndoBg: '#303A34',
  keypadUndoText: '#F2F5F0',
  keypadExtraActiveBg: '#382600',
  keypadExtraActiveBorder: '#FFBA2F',
  keypadExtraActiveText: '#FFBA2F',

  // Ergonomic Aliases
  background: '#101713',
  surfaceAlt: '#222D26',
  primary: '#70C58A',
  primarySubtle: '#1D3427',
  accent: '#85D59C',
  text: '#F2F5F0',
  textTertiary: '#9EA9A1',
  danger: '#FFB4AB',
  warning: '#FFBA2F',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  round: 9999,
} as const;

export const Typography = {
  tabularNums: {
    fontVariant: ['tabular-nums' as const],
  },
} as const;
