import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useAppStore } from '../../store/useAppStore';
import { authAPI } from '../../services/api';

const TEAL = '#00D598';
const NAVY = '#0A1628';
const BG_COLOR = '#FFFFFF';
const CARD_BG = '#F8FAFC';

interface Props {
  onSignOut: () => void;
  onPremiumPress: () => void;
  onEditProfile: () => void;
  onMyConsultations: () => void;
  onSettings: () => void;
  onConsultantChat: () => void;
  onMyReports: () => void;
  onExpertHub?: () => void;
  onSecurity?: () => void;
  onSavedExperts?: () => void;
}

export const ProfileScreen: React.FC<Props> = ({
  onSignOut,
  onPremiumPress,
  onEditProfile,
  onMyConsultations,
  onSettings,
  onConsultantChat,
  onMyReports,
  onExpertHub,
  onSecurity,
  onSavedExperts,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useAppTheme();
  const user = useAppStore(s => s.user);
  const reset = useAppStore(s => s.reset);
  const unreadMessages = useAppStore(s => s.unreadMessages);

  const isPremium = user?.plan === 'premium';

  const handleSignOut = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await authAPI.signOut();
          } catch {}
          reset();
          onSignOut();
        },
      },
    ]);
  };

  const textPrimary = isDark ? '#E8ECF0' : NAVY;
  const textSecondary = isDark ? '#9BA8B4' : '#64748B';
  const screenBg = isDark ? '#0D1B2A' : BG_COLOR;
  const cardBg = isDark ? '#1E2A3A' : CARD_BG;

  return (
    <View style={[styles.container, { backgroundColor: screenBg, paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textPrimary }]}>Client Profile</Text>
        <TouchableOpacity style={styles.headerIcon} activeOpacity={0.7}>
          <Ionicons name="ellipsis-vertical" size={20} color={textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ── Avatar Section ── */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: '#E2E8F0', borderColor: TEAL + '40', borderWidth: 2 }]} />
            )}
            <View style={[styles.verifiedBadge, { backgroundColor: TEAL }]}>
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
            </View>
          </View>
          
          <Text style={[styles.nameText, { color: textPrimary }]}>{user?.name || 'Amine K.'}</Text>
          <Text style={styles.jobTitle}>{user?.company || 'CEO'}</Text>
          
          <TouchableOpacity
            style={[styles.planBadge, { backgroundColor: isPremium ? TEAL + '15' : '#F1F5F9' }]}
            onPress={isPremium ? undefined : onPremiumPress}
            activeOpacity={0.8}
          >
            <View style={[styles.planDot, { backgroundColor: isPremium ? TEAL : '#94A3B8' }]} />
            <Text style={[styles.planBadgeText, { color: isPremium ? TEAL : '#64748B' }]}>
              {isPremium ? 'PRO PLAN ACTIVE' : 'FREE PLAN'}
            </Text>
          </TouchableOpacity>

          {/* Edit Profile button */}
          <TouchableOpacity
            style={[styles.editProfileBtn, { borderColor: TEAL }]}
            onPress={onEditProfile}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil-outline" size={15} color={TEAL} />
            <Text style={[styles.editProfileBtnText, { color: TEAL }]}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* ── Menu Section ── */}
        <View style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: textSecondary }]}>ACCOUNT MANAGEMENT</Text>

          <MenuCard
            icon="create-outline"
            label="Edit Profile"
            onPress={onEditProfile}
            cardBg={cardBg}
            textPrimary={textPrimary}
          />

          <MenuCard
            icon="person-outline"
            label="Account Settings"
            onPress={onSettings}
            cardBg={cardBg}
            textPrimary={textPrimary}
          />

          {user?.role === 'expert' && onExpertHub && (
            <MenuCard
              icon="stats-chart-outline"
              label="Expert Hub / Earnings"
              subtitle="View your stats and earnings"
              subtitleColor={TEAL}
              onPress={onExpertHub}
              cardBg={cardBg}
              textPrimary={textPrimary}
            />
          )}

          <MenuCard
            icon="calendar-outline"
            label="My Consultations"
            onPress={onMyConsultations}
            cardBg={cardBg}
            textPrimary={textPrimary}
          />

          <MenuCard
            icon="bookmark-outline"
            label="Saved Experts"
            subtitle="Your bookmarked experts"
            onPress={onSavedExperts || (() => {})}
            cardBg={cardBg}
            textPrimary={textPrimary}
          />

          <MenuCard
            icon="shield-checkmark-outline"
            label="Security & 2FA"
            onPress={onSecurity || (() => {})}
            cardBg={cardBg}
            textPrimary={textPrimary}
          />

          <MenuCard
            icon="desktop-outline"
            label="Subscription"
            subtitle={isPremium ? 'Pro Plan Active' : 'Upgrade'}
            subtitleColor={isPremium ? TEAL : '#64748B'}
            onPress={onPremiumPress}
            cardBg={cardBg}
            textPrimary={textPrimary}
          />

          <MenuCard
            icon="chatbubble-outline"
            label="Consultant Chat"
            onPress={onConsultantChat}
            cardBg={cardBg}
            textPrimary={textPrimary}
            badgeCount={unreadMessages}
          />
        </View>

        {/* ── Log Out Button ── */}
        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' }]}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
};

const MenuCard: React.FC<{
  icon: any;
  label: string;
  subtitle?: string;
  subtitleColor?: string;
  badgeCount?: number;
  onPress: () => void;
  cardBg: string;
  textPrimary: string;
}> = ({ icon, label, subtitle, subtitleColor, badgeCount, onPress, cardBg, textPrimary }) => {
  const hasBadge = !!badgeCount && badgeCount > 0;
  return (
  <TouchableOpacity
    style={[styles.menuCard, { backgroundColor: cardBg }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[
      styles.menuIconContainer,
      hasBadge && { backgroundColor: TEAL + '18' },
    ]}>
      <Ionicons name={icon} size={22} color={hasBadge ? TEAL : textPrimary} />
      {hasBadge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount! > 99 ? '99+' : String(badgeCount)}</Text>
        </View>
      )}
    </View>
    <View style={styles.menuTextContainer}>
      <Text style={[styles.menuLabel, { color: textPrimary }]}>{label}</Text>
      {!!subtitle && (
        <Text style={[styles.menuSubtitle, { color: subtitleColor }]}>{subtitle}</Text>
      )}
    </View>
    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
  </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 30,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  nameText: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  jobTitle: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  planDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  editProfileBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuSection: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  menuSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 10,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '800',
  },
});
