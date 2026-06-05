import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../hooks/useAppTheme';
import { savedExpertsAPI } from '../../services/api';
import { Radius, Shadow } from '../../theme';
import { Expert } from '../../types';

const TEAL = '#00D598';

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

interface Props {
  onBack: () => void;
  onExpertPress: (id: string) => void;
}

export const SavedExpertsScreen: React.FC<Props> = ({ onBack, onExpertPress }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [compareVisible, setCompareVisible] = useState(false);

  const loadSaved = useCallback(async () => {
    try {
      const data = await savedExpertsAPI.getSaved();
      setExperts(data);
    } catch {
      Alert.alert('Error', 'Could not load saved experts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  const handleRemove = async (expertId: string) => {
    await savedExpertsAPI.toggleSave(expertId);
    setExperts(prev => prev.filter(e => e.id !== expertId));
    setSelectedForCompare(prev => prev.filter(id => id !== expertId));
  };

  const toggleCompareSelect = (id: string) => {
    setSelectedForCompare(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) {
        Alert.alert('Compare limit', 'You can compare up to 2 experts at a time.');
        return prev;
      }
      return [...prev, id];
    });
  };

  const compareExperts = experts.filter(e => selectedForCompare.includes(e.id));

  const CompareModal = () => {
    if (compareExperts.length < 2) return null;
    const [a, b] = compareExperts;

    const Row = ({ label, va, vb }: { label: string; va: string; vb: string }) => (
      <View style={cmp.row}>
        <Text style={[cmp.label, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[cmp.val, { color: colors.text }]}>{va}</Text>
        <Text style={[cmp.val, { color: colors.text }]}>{vb}</Text>
      </View>
    );

    return (
      <Modal visible={compareVisible} animationType="slide" transparent>
        <View style={cmp.overlay}>
          <View style={[cmp.sheet, { backgroundColor: colors.card }]}>
            <View style={cmp.header}>
              <Text style={[cmp.title, { color: colors.text }]}>Compare Experts</Text>
              <TouchableOpacity onPress={() => setCompareVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Expert headers */}
            <View style={cmp.expertHeaders}>
              <View style={cmp.expertHeaderSpacer} />
              {[a, b].map(e => (
                <View key={e.id} style={cmp.expertCol}>
                  <View style={[cmp.avatar, { backgroundColor: TEAL + '30' }]}>
                    {e.avatar
                      ? <Image source={{ uri: e.avatar }} style={cmp.avatarImg} />
                      : <Text style={cmp.avatarText}>{getInitials(e.name)}</Text>}
                  </View>
                  <Text style={[cmp.expertName, { color: colors.text }]} numberOfLines={1}>{e.name}</Text>
                </View>
              ))}
            </View>

            <ScrollView>
              <Row label="Title"      va={a.title}                           vb={b.title} />
              <Row label="Category"   va={a.category}                        vb={b.category} />
              <Row label="Rating"     va={`${a.rating.toFixed(1)} ★`}        vb={`${b.rating.toFixed(1)} ★`} />
              <Row label="Reviews"    va={`${a.reviewCount}`}                vb={`${b.reviewCount}`} />
              <Row label="Rate"       va={`$${a.hourlyRate}/hr`}             vb={`$${b.hourlyRate}/hr`} />
              <Row label="Exp"        va={`${a.yearsExperience ?? 0} yrs`}   vb={`${b.yearsExperience ?? 0} yrs`} />
              <Row label="Available"  va={a.isOnline ? 'Now' : 'Unavailable'} vb={b.isOnline ? 'Now' : 'Unavailable'} />
              <Row label="Skills"     va={(a.expertise ?? []).slice(0, 3).join(', ') || '—'} vb={(b.expertise ?? []).slice(0, 3).join(', ') || '—'} />
            </ScrollView>

            <View style={cmp.actions}>
              <TouchableOpacity style={[cmp.bookBtn, { backgroundColor: TEAL }]} onPress={() => { setCompareVisible(false); onExpertPress(a.id); }}>
                <Text style={cmp.bookBtnText}>Book {a.name.split(' ')[0]}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[cmp.bookBtn, { backgroundColor: TEAL }]} onPress={() => { setCompareVisible(false); onExpertPress(b.id); }}>
                <Text style={cmp.bookBtnText}>Book {b.name.split(' ')[0]}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderExpert = ({ item: expert }: { item: Expert }) => {
    const isSelected = selectedForCompare.includes(expert.id);
    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: isSelected ? TEAL : colors.border },
          isSelected && { borderWidth: 2 },
        ]}
        onPress={() => onExpertPress(expert.id)}
        activeOpacity={0.85}
      >
        {/* Compare checkbox */}
        <TouchableOpacity
          style={[styles.compareChk, { borderColor: isSelected ? TEAL : colors.border, backgroundColor: isSelected ? TEAL : 'transparent' }]}
          onPress={() => toggleCompareSelect(expert.id)}
        >
          {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
        </TouchableOpacity>

        <View style={styles.cardTop}>
          <View style={[styles.avatarWrap]}>
            {expert.avatar
              ? <Image source={{ uri: expert.avatar }} style={styles.avatar} />
              : (
                <View style={[styles.avatarFallback, { backgroundColor: TEAL + '20' }]}>
                  <Text style={[styles.avatarInitials, { color: TEAL }]}>{getInitials(expert.name)}</Text>
                </View>
              )}
            <View style={[styles.statusDot, { backgroundColor: expert.isOnline ? '#22C55E' : '#9CA3AF' }]} />
          </View>

          <View style={styles.info}>
            <Text style={[styles.name, { color: colors.text }]}>{expert.name}</Text>
            <Text style={[styles.title, { color: colors.textSecondary }]} numberOfLines={1}>{expert.title}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                {expert.rating.toFixed(1)} ({expert.reviewCount} reviews)
              </Text>
            </View>
          </View>

          {/* Remove bookmark */}
          <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(expert.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="bookmark" size={20} color={TEAL} />
          </TouchableOpacity>
        </View>

        <View style={[styles.separator, { borderTopColor: colors.border }]} />

        <View style={styles.cardBottom}>
          <View style={styles.stat}>
            <Ionicons name="cash-outline" size={13} color={colors.icon} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>${expert.hourlyRate}/hr</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="briefcase-outline" size={13} color={colors.icon} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>{expert.yearsExperience ?? 0} yrs exp</Text>
          </View>
          <TouchableOpacity style={[styles.bookBtn, { backgroundColor: TEAL + '15' }]} onPress={() => onExpertPress(expert.id)}>
            <Text style={[styles.bookBtnText, { color: TEAL }]}>View</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Saved Experts</Text>
        {selectedForCompare.length === 2 && (
          <TouchableOpacity style={[styles.compareBtn, { backgroundColor: TEAL }]} onPress={() => setCompareVisible(true)}>
            <Ionicons name="git-compare-outline" size={16} color="#0A1628" />
            <Text style={styles.compareBtnText}>Compare</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : experts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bookmark-outline" size={56} color={colors.icon} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No saved experts</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Bookmark experts from their profile to save them here for quick access.
          </Text>
        </View>
      ) : (
        <>
          {selectedForCompare.length > 0 && (
            <View style={[styles.compareBanner, { backgroundColor: TEAL + '15', borderColor: TEAL }]}>
              <Ionicons name="git-compare-outline" size={16} color={TEAL} />
              <Text style={[styles.compareBannerText, { color: TEAL }]}>
                {selectedForCompare.length === 1
                  ? 'Select 1 more expert to compare'
                  : 'Tap "Compare" to see side-by-side'}
              </Text>
              <TouchableOpacity onPress={() => setSelectedForCompare([])}>
                <Ionicons name="close-circle" size={18} color={TEAL} />
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={experts}
            keyExtractor={e => e.id}
            renderItem={renderExpert}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      <CompareModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
  compareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  compareBtnText: { fontSize: 13, fontWeight: '700', color: '#0A1628' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  compareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  compareBannerText: { flex: 1, fontSize: 13, fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  card: {
    borderRadius: Radius.xl,
    padding: 14,
    borderWidth: 1,
    ...Shadow.sm,
  },
  compareChk: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 28 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 18, fontWeight: '700' },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  title: { fontSize: 12, marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12 },
  removeBtn: { padding: 6 },
  separator: { borderTopWidth: 1, marginVertical: 10 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12 },
  bookBtn: { marginLeft: 'auto', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  bookBtnText: { fontSize: 13, fontWeight: '700' },
});

const cmp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '700' },
  expertHeaders: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  expertHeaderSpacer: { width: 90 },
  expertCol: { flex: 1, alignItems: 'center', gap: 6 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { fontSize: 16, fontWeight: '700', color: TEAL },
  expertName: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)', gap: 8 },
  label: { width: 82, fontSize: 12, fontWeight: '600' },
  val: { flex: 1, fontSize: 12, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  bookBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bookBtnText: { fontSize: 14, fontWeight: '700', color: '#0A1628' },
});
