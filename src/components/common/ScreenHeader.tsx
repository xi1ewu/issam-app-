import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Shadow } from '../../theme';

interface ScreenHeaderProps {
  title?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  transparent?: boolean;
  darkMode?: boolean;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  onBack,
  rightElement,
  transparent = false,
  darkMode = false,
}) => {
  const insets = useSafeAreaInsets();
  const textColor = darkMode ? Colors.textWhite : Colors.textPrimary;
  const iconColor = darkMode ? Colors.textWhite : Colors.textPrimary;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 8 },
        !transparent && styles.solid,
      ]}
    >
      <StatusBar
        barStyle={darkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <View style={styles.inner}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
            <View style={[styles.backCircle, darkMode && styles.backCircleDark]}>
              <Ionicons name="chevron-back" size={20} color={iconColor} />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}

        {title && (
          <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
            {title}
          </Text>
        )}

        <View style={styles.rightContainer}>
          {rightElement || <View style={styles.placeholder} />}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 10,
  },
  solid: {
    backgroundColor: Colors.backgroundWhite,
    ...Shadow.sm,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  backButton: {},
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundWhite,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  backCircleDark: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  rightContainer: {
    alignItems: 'flex-end',
  },
  placeholder: {
    width: 40,
  },
});
