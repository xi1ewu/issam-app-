import { Platform, StyleSheet } from 'react-native';
import { Colors } from './colors';

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
}) as { sans: string; serif: string; rounded: string; mono: string };

export const FontFamily = {
  jakartaBold: 'PlusJakartaSans_700Bold',
  jakartaSemiBold: 'PlusJakartaSans_600SemiBold',
  jakartaMedium: 'PlusJakartaSans_500Medium',
  jakartaRegular: 'PlusJakartaSans_400Regular',
  jostBold: 'Jost_700Bold',
  jostMedium: 'Jost_500Medium',
  jostRegular: 'Jost_400Regular',
};

export const Typography = StyleSheet.create({
  // Headings
  h1: {
    fontSize: 32,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.textPrimary,
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.textPrimary,
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.textPrimary,
    lineHeight: 28,
  },
  h4: {
    fontSize: 18,
    fontFamily: FontFamily.jakartaBold,
    color: Colors.textPrimary,
    lineHeight: 28,
  },
  h5: {
    fontSize: 16,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.textPrimary,
    lineHeight: 24,
  },

  // Body
  bodyLarge: {
    fontSize: 16,
    fontFamily: FontFamily.jakartaRegular,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 14,
    fontFamily: FontFamily.jakartaRegular,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  bodySmall: {
    fontSize: 12,
    fontFamily: FontFamily.jakartaRegular,
    color: Colors.textTertiary,
    lineHeight: 18,
  },

  // Labels
  labelLarge: {
    fontSize: 14,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  labelMedium: {
    fontSize: 12,
    fontFamily: FontFamily.jakartaSemiBold,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  labelSmall: {
    fontSize: 10,
    fontFamily: FontFamily.jakartaMedium,
    color: Colors.textTertiary,
    lineHeight: 16,
  },

  // Button
  buttonLarge: {
    fontSize: 16,
    fontFamily: FontFamily.jakartaSemiBold,
    lineHeight: 24,
  },
  buttonMedium: {
    fontSize: 14,
    fontFamily: FontFamily.jakartaSemiBold,
    lineHeight: 20,
  },

  // Caption
  caption: {
    fontSize: 11,
    fontFamily: FontFamily.jakartaRegular,
    color: Colors.textTertiary,
    lineHeight: 16,
  },
});
