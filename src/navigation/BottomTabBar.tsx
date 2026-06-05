import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useAppTheme } from '../hooks/useAppTheme';
import { useTranslation } from '../constants/i18n';
import { useRTL } from '../hooks/useRTL';
import { useAppStore } from '../store/useAppStore';

export type TabName = 'Home' | 'Experts' | 'Reports' | 'Profile';

const TABS: {
  name: TabName;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  labelKey: 'home' | 'experts' | 'reports' | 'profile';
}[] = [
  { name: 'Home', icon: 'home-outline', activeIcon: 'home', labelKey: 'home' },
  { name: 'Experts', icon: 'people-outline', activeIcon: 'people', labelKey: 'experts' },
  { name: 'Reports', icon: 'document-text-outline', activeIcon: 'document-text', labelKey: 'reports' },
  { name: 'Profile', icon: 'person-outline', activeIcon: 'person', labelKey: 'profile' },
];

function TabItem({
  tab,
  isActive,
  badgeCount,
  onPress,
}: {
  tab: typeof TABS[0];
  isActive: boolean;
  badgeCount?: number;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const { row } = useRTL();

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isActive ? 1 : 0.92, { damping: 15 }) }],
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.tab}>
      <Animated.View
        style={[
          styles.pill,
          isActive && { backgroundColor: colors.tint + '18' },
          { flexDirection: row },
          animStyle,
        ]}
      >
        {/* Icon + optional badge */}
        <View style={styles.iconWrap}>
          <Ionicons
            name={isActive ? tab.activeIcon : tab.icon}
            size={22}
            color={isActive ? colors.tint : colors.tabIconDefault}
          />
          {!!badgeCount && badgeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {badgeCount > 99 ? '99+' : String(badgeCount)}
              </Text>
            </View>
          )}
        </View>

        {/* Label — only when active */}
        {isActive && (
          <Text style={[styles.label, { color: colors.tint }]} numberOfLines={1}>
            {t(tab.labelKey)}
          </Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

interface BottomTabBarProps {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onTabPress }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const unreadMessages      = useAppStore(s => s.unreadMessages);
  const unreadNotifications = useAppStore(s => s.unreadNotifications);
  const totalBadge = unreadMessages + unreadNotifications;

  return (
    <View
      style={[
        styles.wrapper,
        { paddingBottom: Math.max(insets.bottom, 8), paddingHorizontal: 12 },
      ]}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: isDark ? 'rgba(24,26,28,0.97)' : 'rgba(255,255,255,0.97)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: isDark ? 0.4 : 0.1,
                shadowRadius: 16,
              },
              android: { elevation: 20 },
            }),
          },
        ]}
      >
        {TABS.map((tab) => (
          <TabItem
            key={tab.name}
            tab={tab}
            isActive={activeTab === tab.name}
            badgeCount={tab.name === 'Profile' ? totalBadge : 0}
            onPress={() => onTabPress(tab.name)}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  bar: {
    flexDirection: 'row',
    borderRadius: 28,
    borderWidth: 1,
    height: 64,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  // Each tab takes equal width
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  // Active pill expands to show label; inactive stays icon-only
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 40,
    // No fixed paddingHorizontal — let flex handle it
    paddingHorizontal: 10,
    borderRadius: 20,
    maxWidth: '100%',
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 11,
  },
});
