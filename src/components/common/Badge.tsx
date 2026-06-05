import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius } from '../../theme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral' | 'info';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  size = 'md',
  style,
}) => {
  return (
    <View style={[styles.badge, styles[variant], styles[`size_${size}`], style]}>
      <Text style={[styles.text, styles[`text_${variant}`], size === 'sm' && styles.textSm]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  size_sm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  size_md: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  primary: { backgroundColor: Colors.primaryLight },
  success: { backgroundColor: Colors.successBg },
  warning: { backgroundColor: Colors.warningBg },
  error: { backgroundColor: Colors.errorBg },
  neutral: { backgroundColor: Colors.borderLight },
  info: { backgroundColor: Colors.infoBg },

  text: { fontSize: 12, fontWeight: '600' },
  textSm: { fontSize: 10 },
  text_primary: { color: Colors.primary },
  text_success: { color: Colors.success },
  text_warning: { color: Colors.warning },
  text_error: { color: Colors.error },
  text_neutral: { color: Colors.textMuted },
  text_info: { color: Colors.info },
});
