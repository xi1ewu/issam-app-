import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../hooks/useAppTheme';
import { Radius } from '../../theme';
import { notificationsAPI } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';

// ─── types ────────────────────────────────────────────────────────────────────

type NotifType =
  | 'MESSAGE'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_DECLINED'
  | 'BOOKING_NEW'
  | 'BOOKING_CANCELLED'
  | 'PAYMENT_SUCCESS'
  | 'REVIEW_NEW'
  | 'EXPERT_SAVED'
  | 'BAN'
  | 'SYSTEM';

interface Notif {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  senderName?: string;
  senderAvatar?: string;
  data?: Record<string, any>;
}

interface Props {
  onBack: () => void;
  onNotificationPress: (type: NotifType, data?: Record<string, any>) => void;
}

// ─── per-type visual config ──────────────────────────────────────────────────

function getVisual(type: NotifType): { icon: any; color: string; bg: string } {
  switch (type) {
    case 'MESSAGE':           return { icon: 'chatbubble',               color: '#3B82F6', bg: '#3B82F615' };
    case 'BOOKING_CONFIRMED': return { icon: 'checkmark-circle',         color: '#10B981', bg: '#10B98115' };
    case 'BOOKING_DECLINED':  return { icon: 'close-circle',             color: '#EF4444', bg: '#EF444415' };
    case 'BOOKING_NEW':       return { icon: 'calendar',                 color: '#00D598', bg: '#00D59815' };
    case 'BOOKING_CANCELLED': return { icon: 'calendar-clear',           color: '#F59E0B', bg: '#F59E0B15' };
    case 'PAYMENT_SUCCESS':   return { icon: 'card',                     color: '#10B981', bg: '#10B98115' };
    case 'REVIEW_NEW':        return { icon: 'star',                     color: '#F59E0B', bg: '#F59E0B15' };
    case 'EXPERT_SAVED':      return { icon: 'bookmark',                 color: '#8B5CF6', bg: '#8B5CF615' };
    case 'BAN':               return { icon: 'ban',                      color: '#EF4444', bg: '#EF444415' };
    default:                  return { icon: 'notifications',            color: '#6B7A8D', bg: '#6B7A8D15' };
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)    return 'Just now';
  if (m < 60)   return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

// ─── component ───────────────────────────────────────────────────────────────

export const NotificationsScreen: React.FC<Props> = ({ onBack, onNotificationPress }) => {
  const { colors, isDark } = useAppTheme();
  const clearUnreadNotifications = useAppStore(s => s.clearUnreadNotifications);

  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);

  const load = useCallback(async () => {
    try {
      const raw = await notificationsAPI.getAll();
      setNotifications(Array.isArray(raw) ? raw : []);
      // Mark all read on the server and clear the local badge
      notificationsAPI.markRead().catch(() => {});
      clearUnreadNotifications();
    } catch {
      // silently fail — empty list
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clearUnreadNotifications]);

  useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    try {
      await notificationsAPI.markRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {}
  };

  const handlePress = (n: Notif) => {
    // Optimistically mark as read
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
    onNotificationPress(n.type, n.data);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: colors.background }]} edges={['top']}>
        <Header onBack={onBack} unreadCount={0} onMarkAll={() => {}} colors={colors} isDark={isDark} />
        <View style={s.center}><ActivityIndicator color="#00D598" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.background }]} edges={['top']}>
      <Header onBack={onBack} unreadCount={unreadCount} onMarkAll={markAllRead} colors={colors} isDark={isDark} />

      <ScrollView
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#00D598" />
        }
      >
        {notifications.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="notifications-off-outline" size={52} color={colors.icon} />
            <Text style={[s.emptyTitle, { color: colors.text }]}>No notifications yet</Text>
            <Text style={[s.emptySub, { color: colors.textSecondary }]}>
              Bookings, messages, reviews and more will appear here.
            </Text>
          </View>
        ) : (
          notifications.map(n => <NotifRow key={n.id} n={n} colors={colors} isDark={isDark} onPress={handlePress} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── sub-components ──────────────────────────────────────────────────────────

function Header({ onBack, unreadCount, onMarkAll, colors, isDark }: {
  onBack: () => void; unreadCount: number; onMarkAll: () => void; colors: any; isDark: boolean;
}) {
  return (
    <View style={[s.header, { borderBottomColor: colors.border }]}>
      <Pressable
        onPress={onBack}
        style={[s.headerBack, { backgroundColor: isDark ? colors.surface : '#F5F6F8' }]}
      >
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>

      <View style={s.headerCenter}>
        <Text style={[s.headerTitle, { color: colors.text }]}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={s.unreadBadge}>
            <Text style={s.unreadBadgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {unreadCount > 0 ? (
        <TouchableOpacity onPress={onMarkAll} style={s.headerAction}>
          <Text style={[s.headerActionText, { color: '#00D598' }]}>Mark all read</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.headerAction} />
      )}
    </View>
  );
}

function NotifRow({ n, colors, isDark, onPress }: {
  n: Notif; colors: any; isDark: boolean; onPress: (n: Notif) => void;
}) {
  const { icon, color, bg } = getVisual(n.type);
  const unread = !n.isRead;

  return (
    <Pressable
      style={[
        s.card,
        {
          backgroundColor: unread
            ? (isDark ? color + '12' : color + '08')
            : colors.card,
          borderColor: unread ? color + '30' : colors.border,
        },
      ]}
      onPress={() => onPress(n)}
      android_ripple={{ color: color + '20' }}
    >
      {/* Left: avatar or icon */}
      <View style={s.cardLeft}>
        {n.senderAvatar ? (
          <View>
            <Image source={{ uri: n.senderAvatar }} style={s.senderAvatar} />
            <View style={[s.iconOverlay, { backgroundColor: bg, borderColor: colors.background }]}>
              <Ionicons name={icon} size={10} color={color} />
            </View>
          </View>
        ) : (
          <View style={[s.iconCircle, { backgroundColor: bg }]}>
            <Ionicons name={icon} size={20} color={color} />
          </View>
        )}
      </View>

      {/* Content */}
      <View style={s.cardContent}>
        <View style={s.titleRow}>
          <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>{n.title}</Text>
          <Text style={[s.time, { color: colors.textSecondary }]}>{timeAgo(n.createdAt)}</Text>
        </View>

        {n.senderName && n.type === 'MESSAGE' && (
          <Text style={[s.senderLabel, { color: color }]}>{n.senderName}</Text>
        )}

        <Text style={[s.body, { color: colors.textSecondary }]} numberOfLines={2}>
          {n.message}
        </Text>

        {/* Action hint */}
        <Text style={[s.tapHint, { color: color }]}>{tapHintFor(n.type)}</Text>
      </View>

      {/* Unread dot */}
      {unread && <View style={[s.dot, { backgroundColor: color }]} />}
    </Pressable>
  );
}

function tapHintFor(type: NotifType): string {
  switch (type) {
    case 'MESSAGE':           return 'Tap to open conversation →';
    case 'BOOKING_CONFIRMED':
    case 'BOOKING_DECLINED':
    case 'BOOKING_NEW':
    case 'BOOKING_CANCELLED': return 'Tap to view consultation →';
    case 'PAYMENT_SUCCESS':   return 'Tap to view receipt →';
    case 'REVIEW_NEW':        return 'Tap to see your review →';
    case 'EXPERT_SAVED':      return 'Tap to view your profile →';
    case 'BAN':               return 'Contact support to appeal →';
    default:                  return '';
  }
}

// ─── styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:             { flex: 1 },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 10 },
  headerBack:       { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerCenter:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:      { fontSize: 18, fontWeight: '700' },
  unreadBadge:      { backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadBadgeText:  { fontSize: 11, fontWeight: '800', color: '#fff' },
  headerAction:     { minWidth: 80, alignItems: 'flex-end' },
  headerActionText: { fontSize: 13, fontWeight: '600' },
  list:             { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, gap: 10 },
  empty:            { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle:       { fontSize: 18, fontWeight: '700' },
  emptySub:         { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 32 },
  card:             { flexDirection: 'row', alignItems: 'flex-start', borderRadius: Radius.xl, borderWidth: 1, padding: 14, gap: 12 },
  cardLeft:         { paddingTop: 2 },
  iconCircle:       { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  senderAvatar:     { width: 44, height: 44, borderRadius: 22 },
  iconOverlay:      { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  cardContent:      { flex: 1, gap: 2 },
  titleRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  title:            { flex: 1, fontSize: 14, fontWeight: '700' },
  time:             { fontSize: 11, flexShrink: 0, marginTop: 1 },
  senderLabel:      { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  body:             { fontSize: 13, lineHeight: 18 },
  tapHint:          { fontSize: 11, fontWeight: '600', marginTop: 4 },
  dot:              { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0 },
});
