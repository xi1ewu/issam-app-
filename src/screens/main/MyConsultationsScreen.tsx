import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useAppStore } from '../../store/useAppStore';
import { consultationsAPI } from '../../services/api';

const TEAL   = '#00D598';
const AMBER  = '#F59E0B';
const RED    = '#EF4444';
const GREEN  = '#10B981';
const BLUE   = '#3B82F6';
const BORDER = '#E2E8F0';

// ─── Status helpers ────────────────────────────────────────────────────────

type StatusKey = 'pending_payment' | 'awaiting_confirmation' | 'upcoming' | 'completed' | 'cancelled';

const STATUS_META: Record<StatusKey, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending_payment:       { label: 'Awaiting Payment',    color: AMBER,  icon: 'card-outline' },
  awaiting_confirmation: { label: 'Awaiting Confirmation', color: BLUE, icon: 'hourglass-outline' },
  upcoming:              { label: 'Confirmed',            color: GREEN,  icon: 'checkmark-circle-outline' },
  completed:             { label: 'Completed',            color: '#6B7280', icon: 'checkmark-done-outline' },
  cancelled:             { label: 'Cancelled',            color: RED,    icon: 'close-circle-outline' },
};

type Tab = 'upcoming' | 'completed' | 'cancelled';

const STATUS_TABS: { key: Tab; label: string }[] = [
  { key: 'upcoming',  label: 'Upcoming'  },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  video: 'videocam-outline',
  audio: 'call-outline',
  chat:  'chatbubble-outline',
};

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isToday(dateStr: string) {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const now = new Date();
  return now.getFullYear() === y && now.getMonth() + 1 === m && now.getDate() === d;
}

function getInitials(name: string) {
  return (name ?? '?').split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase();
}

// ─── Props ─────────────────────────────────────────────────────────────────

export interface ConsultationPressData {
  id: string;
  type: string;
  peerUserId: string;
  peerName: string;
  roomId: string;
}

interface Props {
  onBack: () => void;
  onConsultationPress: (data: ConsultationPressData) => void;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export const MyConsultationsScreen: React.FC<Props> = ({ onBack, onConsultationPress }) => {
  const { colors, isDark } = useAppTheme();
  const userRole = useAppStore(s => s.role) ?? 'client';

  const [tab, setTab]               = useState<Tab>('upcoming');
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const bg   = isDark ? colors.background : '#F8FAFC';
  const card = isDark ? colors.card       : '#FFFFFF';
  const text = isDark ? colors.text       : '#1A2332';
  const muted = isDark ? colors.icon      : '#64748B';

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const all = await consultationsAPI.getMyConsultations({ role: userRole });
      setConsultations(all ?? []);
    } catch {
      setConsultations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userRole]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const filtered = consultations.filter(c => {
    const s = (c.status ?? '').toLowerCase() as StatusKey;
    if (tab === 'upcoming')  return ['awaiting_confirmation', 'upcoming'].includes(s);
    if (tab === 'completed') return s === 'completed';
    if (tab === 'cancelled') return s === 'cancelled';
    return false;
  });

  // ─── Actions ────────────────────────────────────────────────────────────

  const handleCancel = (id: string) => {
    Alert.alert(
      'Cancel Consultation',
      'Are you sure you want to cancel this consultation?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(id + '_cancel');
            try {
              await consultationsAPI.cancel(id);
              load(true);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not cancel.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleConfirm = async (id: string) => {
    Alert.alert(
      'Accept Booking',
      'Accept this consultation request? The client will be notified.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Accept ✓',
          onPress: async () => {
            setActionLoading(id + '_confirm');
            try {
              await consultationsAPI.confirm(id);
              Alert.alert('✅ Accepted!', 'The client has been notified. The session is now confirmed.');
              load(true);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not confirm.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleDecline = async (id: string) => {
    Alert.alert(
      'Decline Booking',
      'Decline this consultation request? The booking will be cancelled.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(id + '_decline');
            try {
              await consultationsAPI.decline(id);
              load(true);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not decline.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  // ─── Render Item ─────────────────────────────────────────────────────────

  const renderItem = ({ item }: { item: any }) => {
    const rawStatus = (item.status ?? '').toLowerCase() as StatusKey;
    const statusMeta = STATUS_META[rawStatus] ?? STATUS_META.awaiting_confirmation;
    const type     = (item.type ?? 'video').toLowerCase();
    const date     = item.date ?? '';
    const today    = isToday(date);

    // Who to display depends on role
    const otherPerson = userRole === 'expert'
      ? item.client
      : (item.expert?.user ?? item.expert ?? {});

    const name    = otherPerson?.name ?? (userRole === 'expert' ? 'Client' : 'Expert');
    const avatar  = otherPerson?.avatar ?? null;
    const initial = getInitials(name);
    const title   = userRole === 'expert' ? '' : (item.expert?.title ?? '');

    const isConfirmedOrUpcoming = rawStatus === 'upcoming';
    const isAwaiting = rawStatus === 'awaiting_confirmation';

    const peerUserId = userRole === 'expert'
      ? (item.client?.id ?? '')
      : (item.expert?.userId ?? '');
    const consultationPressData: ConsultationPressData = {
      id: item.id,
      type,
      peerUserId,
      peerName: name,
      roomId: `room_${item.id}`,
    };

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: card,
            borderColor: today ? TEAL + '50' : isAwaiting ? BLUE + '40' : BORDER,
            borderWidth: isAwaiting ? 2 : 1,
          },
        ]}
      >
        {/* Card Header */}
        <View style={styles.cardHeader}>
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: TEAL + '20' }, avatar ? { backgroundColor: 'transparent' } : null]}>
            {avatar
              ? <Image source={{ uri: avatar }} style={styles.avatarImage} />
              : <Text style={[styles.avatarInitial, { color: TEAL }]}>{initial}</Text>
            }
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.expertName, { color: text }]}>{name}</Text>
            {!!title && <Text style={[styles.expertTitle, { color: muted }]}>{title}</Text>}
            {!!item.topic && (
              <Text style={[styles.topicText, { color: muted }]} numberOfLines={1}>
                📝 {item.topic}
              </Text>
            )}
          </View>

          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: statusMeta.color + '18' }]}>
            <Ionicons name={statusMeta.icon} size={11} color={statusMeta.color} />
            <Text style={[styles.statusText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
        </View>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={muted} />
            <Text style={[styles.metaText, { color: muted }]}>
              {date ? formatDate(date) : 'No date set'}
            </Text>
          </View>
          {!!item.time && (
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color={muted} />
              <Text style={[styles.metaText, { color: muted }]}>{item.time}</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Ionicons name={TYPE_ICON[type] ?? 'videocam-outline'} size={13} color={muted} />
            <Text style={[styles.metaText, { color: muted }]}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </View>
          {!!item.duration && (
            <View style={styles.metaItem}>
              <Ionicons name="hourglass-outline" size={13} color={muted} />
              <Text style={[styles.metaText, { color: muted }]}>{item.duration} min</Text>
            </View>
          )}
        </View>

        {/* Price */}
        {!!item.price && (
          <Text style={[styles.price, { color: TEAL }]}>${item.price.toFixed(2)}</Text>
        )}

        {/* ── EXPERT VIEW: Accept / Decline buttons for awaiting_confirmation ── */}
        {userRole === 'expert' && isAwaiting && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: TEAL }]}
              onPress={() => handleConfirm(item.id)}
              disabled={actionLoading === item.id + '_confirm'}
              activeOpacity={0.85}
            >
              {actionLoading === item.id + '_confirm'
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Ionicons name="checkmark-circle-outline" size={17} color="#fff" />
                    <Text style={styles.confirmBtnText}>Accept</Text>
                  </>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.declineBtn, { borderColor: RED + '60' }]}
              onPress={() => handleDecline(item.id)}
              disabled={actionLoading === item.id + '_decline'}
              activeOpacity={0.7}
            >
              {actionLoading === item.id + '_decline'
                ? <ActivityIndicator size="small" color={RED} />
                : <Text style={[styles.declineBtnText, { color: RED }]}>Decline</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ── EXPERT VIEW: Join / Complete buttons for upcoming ── */}
        {userRole === 'expert' && isConfirmedOrUpcoming && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.joinBtn, { backgroundColor: TEAL }]}
              onPress={() => onConsultationPress(consultationPressData)}
              activeOpacity={0.85}
            >
              <Ionicons name={TYPE_ICON[type] ?? 'videocam-outline'} size={17} color="#fff" />
              <Text style={styles.joinBtnText}>
                {type === 'chat' ? 'Open Chat' : type === 'audio' ? 'Join Call' : 'Start Session'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: BORDER }]}
              onPress={() => handleCancel(item.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.secondaryBtnText, { color: muted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── CLIENT VIEW: awaiting_confirmation — payment done, waiting expert ── */}
        {userRole !== 'expert' && isAwaiting && (
          <View style={[styles.awaitingBanner, { backgroundColor: BLUE + '12', borderColor: BLUE + '30' }]}>
            <Ionicons name="hourglass-outline" size={16} color={BLUE} />
            <Text style={[styles.awaitingText, { color: BLUE }]}>
              Payment received. Waiting for expert to confirm your booking.
            </Text>
          </View>
        )}

        {/* ── CLIENT VIEW: confirmed/upcoming — can join ── */}
        {userRole !== 'expert' && isConfirmedOrUpcoming && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.joinBtn, { backgroundColor: TEAL }]}
              onPress={() => onConsultationPress(consultationPressData)}
              activeOpacity={0.85}
            >
              <Ionicons name={TYPE_ICON[type] ?? 'videocam-outline'} size={17} color="#fff" />
              <Text style={styles.joinBtnText}>
                {type === 'chat' ? 'Open Chat' : type === 'audio' ? 'Join Call' : 'Join Session'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: BORDER }]}
              onPress={() => handleCancel(item.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.secondaryBtnText, { color: muted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ─── Empty state ─────────────────────────────────────────────────────────

  const Empty = () => (
    <View style={styles.empty}>
      <Ionicons
        name={tab === 'upcoming' ? 'calendar-outline' : tab === 'completed' ? 'checkmark-done-circle-outline' : 'close-circle-outline'}
        size={56}
        color={TEAL + '60'}
      />
      <Text style={[styles.emptyTitle, { color: text }]}>No consultations</Text>
      <Text style={[styles.emptyMsg, { color: muted }]}>
        {tab === 'upcoming'
          ? userRole === 'expert'
            ? 'No bookings awaiting confirmation or upcoming sessions yet.'
            : 'Book your first consultation with an expert.'
          : tab === 'completed'
          ? 'No completed consultations yet.'
          : 'No cancelled consultations.'}
      </Text>
    </View>
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: text }]}>
          {userRole === 'expert' ? 'Booking Requests' : 'My Consultations'}
        </Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => load(true)}>
          <Ionicons name="refresh-outline" size={22} color={text} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: isDark ? colors.card : '#F1F5F9' }]}>
        {STATUS_TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && [styles.tabBtnActive, { backgroundColor: card }]]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, { color: muted }, tab === t.key && [styles.tabLabelActive, { color: text }]]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id ?? String(Math.random())}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, filtered.length === 0 && { flex: 1 }]}
          ListEmptyComponent={<Empty />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabLabel: { fontSize: 13, fontWeight: '600' },
  tabLabelActive: { fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 100, gap: 12 },

  card: {
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 24 },
  avatarInitial: { fontSize: 20, fontWeight: '800' },

  expertName:  { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  expertTitle: { fontSize: 12, marginBottom: 2 },
  topicText:   { fontSize: 12, marginTop: 2 },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    flexShrink: 0,
  },
  statusText: { fontSize: 10, fontWeight: '800' },

  metaRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontWeight: '500' },

  price: { fontSize: 16, fontWeight: '800', marginBottom: 12 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },

  joinBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  joinBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  confirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  confirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  declineBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: { fontSize: 14, fontWeight: '600' },

  secondaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '600' },

  awaitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  awaitingText: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 17 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyMsg: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40, lineHeight: 22 },
});
