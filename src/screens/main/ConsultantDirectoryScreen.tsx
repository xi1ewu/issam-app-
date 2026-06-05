import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../../hooks/useAppTheme';
import { expertsAPI } from '../../services/api';
import { Expert } from '../../types';

const TEAL = '#00D598';
const TEXT_DARK = '#1A2332';
const TEXT_MID = '#6B7A8D';
const TEXT_GREY = '#4A5568';
const SURFACE = '#F8FAFC';
const BORDER = '#E8EDF2';

const FILTERS = ['All', 'Strategy', 'Finance', 'Legal', 'Tech', 'Energy'];

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/* ── Skeleton placeholder card ── */
function SkeletonCard() {
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.avatarBox} />
      <View style={skeletonStyles.lines}>
        <View style={[skeletonStyles.line, { width: '60%' }]} />
        <View style={[skeletonStyles.line, { width: '40%', marginTop: 6 }]} />
        <View style={[skeletonStyles.line, { width: '50%', marginTop: 6 }]} />
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  avatarBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E2E8F0',
    marginRight: 14,
  },
  lines: {
    flex: 1,
  },
  line: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
});

/* ── Expert card ── */
interface ExpertCardProps {
  expert: Expert;
  onPress: (id: string) => void;
  isDark: boolean;
}

function ExpertCard({ expert, onPress, isDark }: ExpertCardProps) {
  const isAvailable = expert.availability?.toLowerCase() === 'available' || expert.isOnline;
  const cardBg = isDark ? '#1E293B' : '#fff';

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      {/* Row 1: Avatar + Name/Title + Badge */}
      <View style={styles.cardRow1}>
        <View style={[styles.avatarCircle, expert.avatar && { backgroundColor: 'transparent' }]}>
          {expert.avatar ? (
            <Image source={{ uri: expert.avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{getInitials(expert.name)}</Text>
          )}
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, { color: isDark ? '#F1F5F9' : TEXT_DARK }]} numberOfLines={1}>
            {expert.name}
          </Text>
          <Text style={[styles.cardTitle, { color: TEXT_MID }]} numberOfLines={1}>
            {expert.title}
          </Text>
        </View>
        <View style={[
          styles.availBadge,
          { backgroundColor: isAvailable ? TEAL + '18' : '#F5F5F5' },
        ]}>
          <Text style={[styles.availBadgeText, { color: isAvailable ? TEAL : '#9CA3AF' }]}>
            {isAvailable ? 'Available' : 'Busy'}
          </Text>
        </View>
      </View>

      {/* Row 2: Rating */}
      <View style={styles.cardRow2}>
        <Ionicons name="star" size={13} color="#F59E0B" />
        <Text style={styles.ratingText}>
          {expert.rating.toFixed(1)}
        </Text>
        <Text style={[styles.reviewsText, { color: TEXT_MID }]}>
          ({expert.reviewCount} reviews)
        </Text>
      </View>

      {/* Row 3: Expertise chips */}
      {expert.expertise.length > 0 && (
        <View style={styles.cardRow3}>
          {expert.expertise.slice(0, 3).map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagChipText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Row 4: Contact button */}
      <TouchableOpacity
        style={styles.contactBtn}
        onPress={() => onPress(expert.id)}
        activeOpacity={0.85}
      >
        <Text style={styles.contactBtnText}>Contact Now</Text>
      </TouchableOpacity>
    </View>
  );
}

interface Props {
  onExpertPress: (expertId: string) => void;
  onBack: () => void;
}

export const ConsultantDirectoryScreen: React.FC<Props> = ({ onExpertPress, onBack }) => {
  const { isDark, colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [experts, setExperts] = useState<Expert[]>([]);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    expertsAPI
      .getAll()
      .then(setExperts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filteredExperts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return experts.filter((e) => {
      const filterMatch =
        activeFilter === 'All' ||
        e.category?.toLowerCase() === activeFilter.toLowerCase() ||
        e.expertise.some((t) => t.toLowerCase() === activeFilter.toLowerCase());

      const searchMatch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.expertise.some((t) => t.toLowerCase().includes(q));

      return filterMatch && searchMatch;
    });
  }, [experts, activeFilter, search]);

  const bgColor = isDark ? colors.background : SURFACE;

  return (
    <View style={[styles.root, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={isDark ? '#F1F5F9' : TEXT_DARK} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: isDark ? '#F1F5F9' : TEXT_DARK }]}>
          Elite Experts
        </Text>

        <TouchableOpacity style={styles.filterIconBtn} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={22} color={TEAL} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: isDark ? '#1E293B' : '#fff',
            borderColor: searchFocused ? TEAL : 'transparent',
          },
        ]}
      >
        <Ionicons name="search-outline" size={18} color={TEXT_MID} />
        <TextInput
          style={[styles.searchInput, { color: isDark ? '#F1F5F9' : TEXT_DARK }]}
          placeholder="Search experts, skills..."
          placeholderTextColor={TEXT_MID}
          value={search}
          onChangeText={setSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={18} color={TEXT_MID} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips — plain View avoids RTL+horizontal-ScrollView text corruption on iOS */}
      <View style={styles.chipsContainer}>
        {FILTERS.map((f) => {
          const active = f === activeFilter;
          return (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? TEAL : isDark ? '#1E293B' : '#fff',
                  borderColor: active ? TEAL : BORDER,
                },
              ]}
              onPress={() => setActiveFilter(f)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: active ? '#fff' : isDark ? '#94A3B8' : TEXT_GREY },
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Expert list */}
      {loading ? (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      ) : (
        <FlatList
          data={filteredExperts}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => (
            <ExpertCard expert={item} onPress={onExpertPress} isDark={isDark} />
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={40} color={TEXT_MID} />
              <Text style={[styles.emptyText, { color: TEXT_MID }]}>
                No experts found. Try a different filter or search term.
              </Text>
            </View>
          }
          ListFooterComponent={
            filteredExperts.length > 0 ? (
              <Text style={[styles.footerText, { color: TEXT_MID }]}>
                Showing {filteredExperts.length} of {experts.length}+ experts
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  filterIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 8,
    rowGap: 8,
    columnGap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: TEAL,
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  cardInfo: {
    flex: 1,
    marginRight: 8,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 13,
    marginTop: 2,
  },
  availBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  availBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_DARK,
    marginLeft: 2,
  },
  reviewsText: {
    fontSize: 13,
  },
  cardRow3: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tagChip: {
    backgroundColor: TEAL + '18',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagChipText: {
    fontSize: 12,
    color: TEAL,
    fontWeight: '600',
  },
  contactBtn: {
    backgroundColor: TEAL,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  contactBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 16,
  },
});
