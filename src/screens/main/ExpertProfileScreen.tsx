import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../../hooks/useAppTheme';
import { expertsAPI, savedExpertsAPI } from '../../services/api';
import { Expert } from '../../types';

const TEAL = '#00D598';
const DARK_NAVY = '#0A1628';
const TEXT_DARK = '#1A2332';
const TEXT_GREY = '#4A5568';
const TEXT_MID = '#6B7A8D';
const SURFACE = '#F8FAFC';
const BORDER = '#E8EDF2';

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

interface SimilarExpertCardProps {
  expert: Expert;
}

function SimilarExpertCard({ expert }: SimilarExpertCardProps) {
  const isAvailable = expert.availability?.toLowerCase() === 'available' || expert.isOnline;
  return (
    <View style={simStyles.card}>
      <View style={simStyles.avatar}>
        {expert.avatar ? (
          <Image source={{ uri: expert.avatar }} style={simStyles.avatarImage} />
        ) : (
          <Text style={simStyles.avatarText}>{getInitials(expert.name)}</Text>
        )}
      </View>
      <View style={simStyles.info}>
        <Text style={simStyles.name} numberOfLines={1}>{expert.name}</Text>
        <Text style={simStyles.title} numberOfLines={1}>{expert.title}</Text>
        <View style={simStyles.ratingRow}>
          <Ionicons name="star" size={12} color="#F59E0B" />
          <Text style={simStyles.ratingText}>
            {expert.rating.toFixed(1)} ({expert.reviewCount})
          </Text>
        </View>
      </View>
      <View style={[simStyles.badge, { backgroundColor: isAvailable ? TEAL + '18' : '#F5F5F5' }]}>
        <Text style={[simStyles.badgeText, { color: isAvailable ? TEAL : '#9CA3AF' }]}>
          {isAvailable ? 'Available' : 'Busy'}
        </Text>
      </View>
    </View>
  );
}

interface Props {
  expertId: string;
  onBack: () => void;
  onSchedule: (id: string) => void;
  onChat: (id: string) => void;
}

export const ExpertProfileScreen: React.FC<Props> = ({
  expertId,
  onBack,
  onSchedule,
  onChat,
}) => {
  const { isDark, colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [expert, setExpert] = useState<Expert | null>(null);
  const [similar, setSimilar] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      expertsAPI.getById(expertId),
      expertsAPI.getAll(),
      savedExpertsAPI.getSavedStatus(expertId).catch(() => ({ saved: false })),
    ])
      .then(([detail, all, savedStatus]) => {
        if (cancelled) return;
        setExpert(detail);
        setSimilar(all.filter((e) => e.id !== expertId).slice(0, 3));
        setIsSaved(savedStatus.saved);
        savedExpertsAPI.recordView(expertId).catch(() => {});
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [expertId]);

  if (loading || !expert) {
    return (
      <View style={[styles.loadingRoot, { backgroundColor: isDark ? colors.background : '#fff' }]}>
        <View style={[styles.heroHeader, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.ghostBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </View>
    );
  }

  const isAvailable = expert.availability?.toLowerCase() === 'available' || expert.isOnline;
  const priceInDZD = expert.hourlyRate > 0
    ? `${(expert.hourlyRate * 85).toLocaleString('fr-DZ')} DA / session`
    : 'From 4,500 DA';

  return (
    <View style={[styles.root, { backgroundColor: isDark ? colors.background : SURFACE }]}>
      {/* Fixed bottom bar rendered first so it sits on top */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.messageBtn}
          onPress={() => onChat(expertId)}
          activeOpacity={0.8}
        >
          <Text style={styles.messageBtnText}>Message Expert</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bookBtn}
          onPress={() => onSchedule(expertId)}
          activeOpacity={0.85}
        >
          <Text style={styles.bookBtnText}>Book Consultation</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ── Hero Header ── */}
        <View style={[styles.heroHeader, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.ghostBtn} onPress={onBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.ghostBtn}
              activeOpacity={0.7}
              disabled={savingToggle}
              onPress={async () => {
                setSavingToggle(true);
                try {
                  const result = await savedExpertsAPI.toggleSave(expert!.id);
                  setIsSaved(result.saved);
                } finally {
                  setSavingToggle(false);
                }
              }}
            >
              <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color={isSaved ? '#00D598' : '#fff'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.7}>
              <Ionicons name="share-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Avatar centered at bottom of hero */}
        <View style={styles.avatarWrapper}>
          <View style={[styles.avatarCircle, expert.avatar && { backgroundColor: 'transparent' }]}>
            {expert.avatar ? (
              <Image source={{ uri: expert.avatar }} style={styles.avatarImageLarge} />
            ) : (
              <Text style={styles.avatarInitials}>{getInitials(expert.name)}</Text>
            )}
          </View>
          {/* Available dot */}
          <View style={[styles.availDot, { backgroundColor: isAvailable ? '#22C55E' : '#9CA3AF' }]} />
        </View>

        {/* ── Profile Info Card ── */}
        <View style={[styles.profileCard, { backgroundColor: isDark ? colors.card : '#fff' }]}>
          <Text style={styles.expertName}>{expert.name}</Text>
          <Text style={styles.expertTitle}>{expert.title}</Text>

          {/* Rating row */}
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= Math.round(expert.rating) ? 'star' : 'star-outline'}
                size={16}
                color="#F59E0B"
              />
            ))}
            <Text style={styles.ratingNumber}>{expert.rating.toFixed(1)}</Text>
            <Text style={styles.ratingReviews}>({expert.reviewCount} reviews)</Text>
          </View>

          {/* Availability chip */}
          <View style={[styles.availChip, { backgroundColor: isAvailable ? TEAL + '18' : '#F5F5F5' }]}>
            <Text style={[styles.availChipText, { color: isAvailable ? TEAL : '#9CA3AF' }]}>
              {isAvailable ? 'Available Now' : 'Busy'}
            </Text>
          </View>

          {/* Stats strip */}
          <View style={styles.statsStrip}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{expert.consultations}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{expert.yearsExperience}y</Text>
              <Text style={styles.statLabel}>Experience</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{expert.rating.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>
        </View>

        {/* ── About ── */}
        <View style={[styles.section, { backgroundColor: isDark ? colors.card : '#fff' }]}>
          <Text style={styles.sectionTitle}>About</Text>
          {expert.bio ? (
            <>
              <Text
                style={styles.bioText}
                numberOfLines={bioExpanded ? undefined : 3}
              >
                {expert.bio}
              </Text>
              {expert.bio.length > 120 && (
                <TouchableOpacity onPress={() => setBioExpanded(!bioExpanded)} activeOpacity={0.7}>
                  <Text style={styles.showMoreLink}>
                    {bioExpanded ? 'Show less' : 'Show more'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text style={styles.bioText}>
              Consultant on the WHEELWORLD network. Book a session for tailored advice.
            </Text>
          )}
        </View>

        {/* ── Expertise Tags ── */}
        {expert.expertise.length > 0 && (
          <View style={[styles.section, { backgroundColor: isDark ? colors.card : '#fff' }]}>
            <Text style={styles.sectionTitle}>Expertise</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll}>
              {expert.expertise.map((tag) => (
                <View key={tag} style={styles.expertiseTag}>
                  <Text style={styles.expertiseTagText}>{tag}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Pricing ── */}
        <View style={[styles.section, styles.pricingCard, { backgroundColor: isDark ? colors.card : '#fff' }]}>
          <Text style={styles.pricingLabel}>Session Price</Text>
          <Text style={styles.pricingValue}>{priceInDZD}</Text>
          <View style={styles.pricingMeta}>
            <Ionicons name="time-outline" size={14} color={TEXT_MID} />
            <Text style={styles.pricingMetaText}>60 min session</Text>
          </View>
        </View>

        {/* ── Similar Experts ── */}
        {similar.length > 0 && (
          <View style={[styles.section, { backgroundColor: isDark ? colors.card : '#fff' }]}>
            <Text style={styles.sectionTitle}>Similar Experts</Text>
            {similar.map((exp) => (
              <SimilarExpertCard key={exp.id} expert={exp} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

/* ── Similar Expert Card Styles ── */
const simStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  title: {
    fontSize: 12,
    color: TEXT_MID,
    marginTop: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  ratingText: {
    fontSize: 12,
    color: TEXT_MID,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

/* ── Main Styles ── */
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingRoot: {
    flex: 1,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHeader: {
    backgroundColor: DARK_NAVY,
    height: 240,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },
  ghostBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActions: {
    flexDirection: 'row',
    gap: 8,
  },
  avatarWrapper: {
    alignItems: 'center',
    marginTop: -40,
    marginBottom: -12,
    zIndex: 10,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  avatarImageLarge: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  availDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
    position: 'absolute',
    bottom: 2,
    right: '47%',
    marginRight: -22,
  },
  profileCard: {
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  expertName: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_DARK,
    textAlign: 'center',
    marginBottom: 4,
  },
  expertTitle: {
    fontSize: 14,
    color: TEXT_MID,
    textAlign: 'center',
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  ratingNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_DARK,
    marginLeft: 4,
  },
  ratingReviews: {
    fontSize: 13,
    color: TEXT_MID,
  },
  availChip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 16,
  },
  availChipText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  statsStrip: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderRadius: 14,
    width: '100%',
    paddingVertical: 14,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  statLabel: {
    fontSize: 12,
    color: TEXT_MID,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: BORDER,
    marginVertical: 4,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_DARK,
    marginBottom: 10,
  },
  bioText: {
    fontSize: 14,
    color: TEXT_GREY,
    lineHeight: 22,
  },
  showMoreLink: {
    fontSize: 14,
    color: TEAL,
    fontWeight: '600',
    marginTop: 6,
  },
  tagsScroll: {
    marginTop: 4,
  },
  expertiseTag: {
    backgroundColor: TEAL + '18',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  expertiseTagText: {
    fontSize: 13,
    color: TEAL,
    fontWeight: '600',
  },
  pricingCard: {
    borderLeftWidth: 4,
    borderLeftColor: TEAL,
    borderRadius: 20,
  },
  pricingLabel: {
    fontSize: 13,
    color: TEXT_MID,
    fontWeight: '500',
    marginBottom: 4,
  },
  pricingValue: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT_DARK,
    marginBottom: 6,
  },
  pricingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pricingMetaText: {
    fontSize: 13,
    color: TEXT_MID,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    zIndex: 100,
  },
  messageBtn: {
    flex: 0,
    width: '45%',
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: TEAL,
  },
  bookBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  bookBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
