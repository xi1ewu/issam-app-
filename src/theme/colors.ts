const tint = "#00D599";

export const Colors = {
  // Primary brand
  primary: '#00D598',
  primaryDark: '#00B87C',
  primaryLight: '#E0FBF2',
  primaryBg: '#ECF9F2',

  // Background
  background: '#F8F9FA',
  backgroundAlt: '#F8F9FC',
  backgroundWhite: '#FFFFFF',
  backgroundDark: '#121212',
  backgroundDarkAlt: '#282828',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textMuted: '#6B7280',
  textWhite: '#FFFFFF',
  textDark: '#111827',
  textLabel: '#64748B',

  // Border
  border: '#E2E8F0',
  borderLight: '#F3F4F6',
  borderMedium: '#E5E7EB',

  // Status
  success: '#10B981',
  successBg: '#ECFDF5',
  warning: '#F59E0B',
  warningBg: '#FFFBEB',
  error: '#EF4444',
  errorBg: '#FEF2F2',
  info: '#3B82F6',
  infoBg: '#EFF6FF',

  // Card
  cardBg: '#FFFFFF',
  cardBorder: '#F1F5F9',
  cardShadow: 'rgba(0,0,0,0.06)',

  // Input
  inputBg: '#F9FAFB',
  inputBorder: '#E5E7EB',
  inputPlaceholder: '#9CA3AF',

  // Chat
  chatBubbleSent: '#00D695',
  chatBubbleReceived: '#FFFFFF',

  // Rating
  ratingGold: '#F59E0B',

  // Overlay
  overlay: 'rgba(0,0,0,0.5)',
  overlayLight: 'rgba(255,255,255,0.95)',

  // WheelWorld theme tokens
  light: {
    text: "#11181C",
    textSecondary: "#666",
    background: "#FFFFFF",
    surface: "#F5F6F8",
    card: "#FFFFFF",
    tint,
    icon: "#687076",
    border: "#E5E7EB",
    tabIconDefault: "#687076",
    tabIconSelected: tint,
  },
  dark: {
    text: "#ECEDEE",
    textSecondary: "#9BA1A6",
    background: "#151718",
    surface: "#1E2022",
    card: "#1E2022",
    tint,
    icon: "#9BA1A6",
    border: "rgba(255,255,255,0.1)",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tint,
  },
};

export type ColorKeys = keyof typeof Colors;
