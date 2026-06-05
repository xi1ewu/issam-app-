import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Radius, Shadow } from '../../theme';
import { consultationsAPI, authAPI } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { useAppTheme } from '../../hooks/useAppTheme';
import { capitalize, getSessionIcon } from '../../utils/formatters';

interface Props {
  onSessionPress: (id: string) => void;
  onClientsPress: () => void;
  onProfilePress: () => void;
  onAvailabilityPress: () => void;
  onAnalyticsPress: () => void;
  onBack?: () => void;
}

export const ExpertDashboardScreen: React.FC<Props> = ({
  onSessionPress,
  onClientsPress,
  onProfilePress,
  onAvailabilityPress,
  onAnalyticsPress,
  onBack,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const storeUser = useAppStore(s => s.user);
  const unreadMessages = useAppStore(s => s.unreadMessages);

  const [sessions, setSessions] = useState<any[]>([]);
  const [expertProfile, setExpertProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [me, consultations] = await Promise.all([
        authAPI.getMe(),
        consultationsAPI.getMyConsultations({ role: 'expert' }),
      ]);
      setExpertProfile(me.expert);
      setSessions(Array.isArray(consultations) ? consultations : []);
    } catch (e) {
      console.warn('Expert dashboard load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const upcoming = sessions.filter(s => s.status === 'upcoming' || s.status === 'awaiting_confirmation');
  const completed = sessions.filter(s => s.status === 'completed');

  const monthlyEarnings = completed
    .filter(s => {
      const d = new Date(s.date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, s) => sum + (s.price ?? 0), 0);

  const firstName = storeUser?.name?.split(' ')[0] || 'Expert';
  const rating = expertProfile?.rating ?? 0;
  const reviewCount = expertProfile?.reviewCount ?? 0;
  const initials = storeUser?.name
    ? storeUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'EX';

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadData(); }}
          tintColor={colors.tint}
        />
      }
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <LinearGradient colors={['#0f3460', '#16213e']} style={StyleSheet.absoluteFill} />
        <View style={styles.headerDecor} />

        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            {onBack && (
              <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
            )}
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.expertName}>{firstName} 👋</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn} onPress={onProfilePress} activeOpacity={0.7}>
              <Ionicons name="notifications-outline" size={22} color="#fff" />
              {unreadMessages > 0 && (
                <View style={styles.notifDot}>
                  {unreadMessages < 10 && (
                    <Text style={styles.notifCount}>{unreadMessages}</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onProfilePress}
              style={[styles.avatarCircle, { backgroundColor: colors.tint + '30' }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.avatarText, { color: colors.tint }]}>{initials}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats card */}
        <View style={styles.earningsCard}>
          <View style={styles.earningsItem}>
            <Text style={styles.earningsLabel}>This Month</Text>
            <Text style={styles.earningsValue}>${monthlyEarnings.toFixed(0)}</Text>
            <View style={styles.earningsTrend}>
              <Ionicons name="trending-up" size={14} color={colors.tint} />
              <Text style={[styles.earningsTrendText, { color: colors.tint }]}>Earnings</Text>
            </View>
          </View>
          <View style={styles.earningsDivider} />
          <View style={styles.earningsItem}>
            <Text style={styles.earningsLabel}>Sessions</Text>
            <Text style={styles.earningsValue}>{sessions.length}</Text>
            <Text style={styles.earningsSubLabel}>{upcoming.length} upcoming</Text>
          </View>
          <View style={styles.earningsDivider} />
          <View style={styles.earningsItem}>
            <Text style={styles.earningsLabel}>Rating</Text>
            <Text style={styles.earningsValue}>{rating > 0 ? rating.toFixed(1) : '—'}</Text>
            <View style={styles.earningsTrend}>
              <Ionicons name="star" size={13} color="#F59E0B" />
              <Text style={styles.earningsTrendText}>{reviewCount} reviews</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <ActionCard icon="calendar-outline" label="Availability" color={colors.tint} bgColor={colors.tint + '20'} onPress={onAvailabilityPress} />
          <ActionCard icon="people-outline" label="Clients" color="#3B82F6" bgColor="#3B82F620" onPress={onClientsPress} />
          <ActionCard icon="bar-chart-outline" label="Analytics" color="#8B5CF6" bgColor="#8B5CF620" onPress={onAnalyticsPress} />
          <ActionCard icon="star-outline" label="Reviews" color="#F59E0B" bgColor="#F59E0B20" onPress={() => Alert.alert('Reviews', 'Coming soon')} />
        </View>
      </View>

      {/* Upcoming Sessions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Sessions</Text>
          <TouchableOpacity onPress={() => onSessionPress('')} activeOpacity={0.7}>
            <Text style={[styles.viewAll, { color: colors.tint }]}>View All</Text>
          </TouchableOpacity>
        </View>

        {upcoming.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={36} color={colors.icon} />
            <Text style={[styles.emptyText, { color: colors.icon }]}>No upcoming sessions</Text>
          </View>
        ) : (
          upcoming.slice(0, 5).map(session => {
            const sessionDate = new Date(session.date);
            return (
              <TouchableOpacity
                key={session.id}
                style={[styles.sessionCard, { backgroundColor: colors.card, ...Shadow.sm }]}
                onPress={() => onSessionPress(session.id)}
                activeOpacity={0.85}
              >
                <View style={[styles.sessionDate, { backgroundColor: colors.tint + '20' }]}>
                  <Text style={[styles.sessionMonth, { color: colors.tint }]}>
                    {sessionDate.toLocaleDateString('en', { month: 'short' }).toUpperCase()}
                  </Text>
                  <Text style={[styles.sessionDay, { color: colors.tint }]}>{sessionDate.getDate()}</Text>
                </View>
                <View style={styles.sessionInfo}>
                  <Text style={[styles.sessionClient, { color: colors.text }]}>
                    {session.client?.name ?? 'Client'}
                  </Text>
                  <Text style={[styles.sessionTopic, { color: colors.icon }]} numberOfLines={1}>
                    {session.topic}
                  </Text>
                  <View style={styles.sessionMeta}>
                    <Ionicons name="time-outline" size={12} color={colors.icon} />
                    <Text style={[styles.sessionMetaText, { color: colors.icon }]}>
                      {session.time} · {session.duration} min
                    </Text>
                  </View>
                </View>
                <View style={styles.sessionRight}>
                  <Text style={[styles.sessionPrice, { color: colors.text }]}>${session.price?.toFixed(0)}</Text>
                  <View style={[styles.sessionTypeBadge, { backgroundColor: colors.tint + '20' }]}>
                    <Ionicons name={getSessionIcon(session.type)} size={13} color={colors.tint} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Performance */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Performance</Text>
        <View style={[styles.performanceCard, { backgroundColor: colors.card, ...Shadow.sm }]}>
          <PerfRow
            label="Booking Rate"
            value={sessions.length > 0 ? Math.min(Math.round((upcoming.length / sessions.length) * 100), 100) : 0}
            maxValue={100}
            color={colors.tint}
            unit="%"
            colors={colors}
          />
          <PerfRow
            label="Completion Rate"
            value={sessions.length > 0 ? Math.round((completed.length / sessions.length) * 100) : 0}
            maxValue={100}
            color="#10B981"
            unit="%"
            colors={colors}
          />
          <PerfRow
            label="Sessions Done"
            value={completed.length}
            maxValue={Math.max(sessions.length, 1)}
            color="#3B82F6"
            colors={colors}
          />
          <PerfRow
            label="Avg Rating"
            value={Math.round(rating * 20)}
            maxValue={100}
            color="#F59E0B"
            unit={rating > 0 ? ` (${rating.toFixed(1)})` : ''}
            colors={colors}
          />
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const ActionCard: React.FC<{
  icon: any;
  label: string;
  color: string;
  bgColor: string;
  onPress: () => void;
}> = ({ icon, label, color, bgColor, onPress }) => (
  <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.85}>
    <View style={[styles.actionIcon, { backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

const PerfRow: React.FC<{
  label: string;
  value: number;
  maxValue: number;
  color: string;
  unit?: string;
  colors: any;
}> = ({ label, value, maxValue, color, unit = '', colors }) => (
  <View style={styles.perfRow}>
    <Text style={[styles.perfLabel, { color: colors.textSecondary }]}>{label}</Text>
    <View style={[styles.perfBar, { backgroundColor: colors.border }]}>
      <View style={[styles.perfFill, { width: `${Math.min((value / maxValue) * 100, 100)}%`, backgroundColor: color }]} />
    </View>
    <Text style={[styles.perfValue, { color: colors.text }]}>{value}{unit}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,213,152,0.08)',
    top: -60,
    right: -40,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  expertName: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  notifCount: { fontSize: 9, fontWeight: '700', color: '#fff' },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700' },
  earningsCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  earningsItem: { flex: 1, alignItems: 'center' },
  earningsDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  earningsLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  earningsValue: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  earningsSubLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  earningsTrend: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  earningsTrendText: { fontSize: 11 },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  viewAll: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  actionsGrid: { flexDirection: 'row', gap: 10 },
  actionCard: {
    flex: 1,
    borderRadius: Radius.xl,
    padding: 14,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '600', color: '#888', textAlign: 'center' },
  emptyCard: {
    borderRadius: Radius.xl,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  emptyText: { fontSize: 14 },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.xl,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  sessionDate: {
    width: 48,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionMonth: { fontSize: 9, fontWeight: '700' },
  sessionDay: { fontSize: 20, fontWeight: '700' },
  sessionInfo: { flex: 1 },
  sessionClient: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  sessionTopic: { fontSize: 12, marginBottom: 4 },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sessionMetaText: { fontSize: 12 },
  sessionRight: { alignItems: 'flex-end', gap: 6 },
  sessionPrice: { fontSize: 15, fontWeight: '700' },
  sessionTypeBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  performanceCard: {
    borderRadius: Radius.xl,
    padding: 16,
    gap: 14,
  },
  perfRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  perfLabel: { width: 110, fontSize: 13 },
  perfBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  perfFill: { height: '100%', borderRadius: 4 },
  perfValue: { width: 50, fontSize: 13, fontWeight: '700', textAlign: 'right' },
});
