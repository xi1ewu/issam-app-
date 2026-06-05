import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useAppStore } from '../../store/useAppStore';
import { dashboardAPI, consultationsAPI } from '../../services/api';
import { getSessionIcon } from '../../utils/formatters';

const TEAL = '#00D598';
const NAVY = '#0A1628';
const BG_COLOR = '#F8FAFC';
const CARD_BG = '#FFFFFF';

interface Props {
  onBack: () => void;
  onInvoice?: () => void;
  onSecurity?: () => void;
  onNotifications?: () => void;
  onAvailabilityPress?: () => void;
  onClientsPress?: () => void;
  onAnalyticsPress?: () => void;
  onSessionPress?: (id: string) => void;
  onReviewsPress?: () => void;
}

export const ExpertEarningsScreen: React.FC<Props> = ({
  onBack, onInvoice, onSecurity, onNotifications,
  onAvailabilityPress, onClientsPress, onAnalyticsPress, onSessionPress,
  onReviewsPress,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useAppTheme();
  const user = useAppStore(s => s.user);

  const screenBg = isDark ? '#0D1B2A' : BG_COLOR;
  const cardBg = isDark ? '#1E2A3A' : CARD_BG;
  const textPrimary = isDark ? '#E8ECF0' : NAVY;
  const textSecondary = isDark ? '#9BA8B4' : '#64748B';

  const [stats, setStats] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardAPI.getExpertStats(),
      consultationsAPI.getMyConsultations({ role: 'expert' }),
    ])
      .then(([s, c]) => {
        setStats(s);
        setSessions(Array.isArray(c) ? c : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalEarnings = stats?.totalEarnings ?? 0;
  const thisMonthEarnings = stats?.thisMonthEarnings ?? 0;
  const earningsGrowth: number = stats?.earningsGrowth ?? 0;
  const activeClients = stats?.activeClients ?? 0;
  const newClientsCount: number = stats?.newClientsCount ?? 0;
  const avgRating: number = stats?.avgRating ?? 0;
  const nextSession = stats?.nextSession ?? null;
  const activities = stats?.activities || [];

  const upcomingList = sessions.filter(s => s.status === 'upcoming' || s.status === 'awaiting_confirmation');
  const completed = sessions.filter(s => s.status === 'completed');

  const bookingRate = sessions.length > 0 ? Math.min(Math.round((upcomingList.length / sessions.length) * 100), 100) : 0;
  const completionRate = sessions.length > 0 ? Math.round((completed.length / sessions.length) * 100) : 0;

  const earningsTrendText = stats
    ? `${earningsGrowth >= 0 ? '+' : ''}${earningsGrowth}% vs last month · $${thisMonthEarnings.toLocaleString()} this month`
    : 'Loading...';

  const clientsTrendText = stats
    ? `+${newClientsCount} new client${newClientsCount !== 1 ? 's' : ''} this month`
    : 'Loading...';

  const nextSessionText = nextSession
    ? `Next: ${nextSession.time}${nextSession.clientName ? ` · ${nextSession.clientName}` : ''}`
    : upcomingList.length > 0 ? `${upcomingList.length} session${upcomingList.length !== 1 ? 's' : ''} pending` : 'No sessions scheduled';

  const welcomeSubtitle = upcomingList.length > 0
    ? `You have ${upcomingList.length} upcoming session${upcomingList.length !== 1 ? 's' : ''}.`
    : activeClients > 0
    ? `You have ${activeClients} active client${activeClients !== 1 ? 's' : ''} in your network.`
    : 'Your profile is live and ready for bookings.';

  return (
    <View style={[styles.container, { backgroundColor: screenBg, paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={textPrimary} />
          </TouchableOpacity>
          <View style={styles.appIconBox}>
            <Ionicons name="grid" size={18} color="#fff" />
          </View>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Expert Hub</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>ONLINE</Text>
          </View>
          <TouchableOpacity style={styles.bellBtn} onPress={onNotifications}>
            <Ionicons name="notifications-outline" size={22} color={textSecondary} />
          </TouchableOpacity>
          <Image
            source={{ uri: user?.avatar || 'https://i.pravatar.cc/150?img=11' }}
            style={styles.avatarMini}
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* ── Welcome Card ── */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeOverlay} />
          <Text style={styles.welcomeTitle}>
            Welcome back,{'\n'}{user?.name?.split(' ')[0] || 'Expert'}
          </Text>
          <Text style={styles.welcomeSub}>{welcomeSubtitle}</Text>
        </View>

        {/* ── Stats Cards ── */}
        <View style={[styles.statCard, { backgroundColor: cardBg }]}>
          <View style={styles.statHeader}>
            <Text style={[styles.statLabel, { color: textSecondary }]}>Total Earnings</Text>
            <Ionicons name="cash-outline" size={20} color={TEAL} />
          </View>
          <Text style={[styles.statValue, { color: textPrimary }]}>${totalEarnings.toLocaleString()}</Text>
          <Text style={[styles.statTrend, earningsGrowth < 0 && styles.statTrendNeg]}>{earningsTrendText}</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: cardBg }]}>
          <View style={styles.statHeader}>
            <Text style={[styles.statLabel, { color: textSecondary }]}>Active Clients</Text>
            <Ionicons name="people-outline" size={20} color={TEAL} />
          </View>
          <Text style={[styles.statValue, { color: textPrimary }]}>{activeClients}</Text>
          <Text style={styles.statTrend}>{clientsTrendText}</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: cardBg }]}>
          <View style={styles.statHeader}>
            <Text style={[styles.statLabel, { color: textSecondary }]}>Upcoming Sessions</Text>
            <Ionicons name="calendar-outline" size={20} color={TEAL} />
          </View>
          <Text style={[styles.statValue, { color: textPrimary }]}>{upcomingList.length}</Text>
          <Text style={styles.statTrend}>{nextSessionText}</Text>
        </View>

        {/* ── Upcoming Sessions List ── */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Upcoming Sessions</Text>
            <TouchableOpacity onPress={() => onSessionPress?.('')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          {upcomingList.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={32} color={textSecondary} />
              <Text style={[styles.emptyText, { color: textSecondary }]}>No upcoming sessions</Text>
            </View>
          ) : (
            upcomingList.slice(0, 5).map(session => {
              const d = new Date(session.date);
              return (
                <TouchableOpacity
                  key={session.id}
                  style={styles.sessionRow}
                  onPress={() => onSessionPress?.(session.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.sessionDateBox}>
                    <Text style={styles.sessionMonth}>
                      {d.toLocaleDateString('en', { month: 'short' }).toUpperCase()}
                    </Text>
                    <Text style={styles.sessionDay}>{d.getDate()}</Text>
                  </View>
                  <View style={styles.sessionInfo}>
                    <Text style={[styles.sessionClient, { color: textPrimary }]}>{session.client?.name ?? 'Client'}</Text>
                    <Text style={[styles.sessionTopic, { color: textSecondary }]} numberOfLines={1}>{session.topic}</Text>
                    <View style={styles.sessionMeta}>
                      <Ionicons name="time-outline" size={11} color={textSecondary} />
                      <Text style={[styles.sessionMetaText, { color: textSecondary }]}>
                        {session.time} · {session.duration} min
                      </Text>
                    </View>
                  </View>
                  <View style={styles.sessionRight}>
                    <Text style={[styles.sessionPrice, { color: textPrimary }]}>${session.price?.toFixed(0)}</Text>
                    <View style={styles.sessionTypeBadge}>
                      <Ionicons name={getSessionIcon(session.type)} size={13} color={TEAL} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── Performance ── */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>Performance</Text>
          <View style={styles.perfList}>
            <PerfRow label="Booking Rate" value={bookingRate} maxValue={100} color={TEAL} unit="%" textPrimary={textPrimary} textSecondary={textSecondary} />
            <PerfRow label="Completion Rate" value={completionRate} maxValue={100} color="#10B981" unit="%" textPrimary={textPrimary} textSecondary={textSecondary} />
            <PerfRow label="Sessions Done" value={completed.length} maxValue={Math.max(sessions.length, 1)} color="#3B82F6" textPrimary={textPrimary} textSecondary={textSecondary} />
            <PerfRow label="Avg Rating" value={Math.round(avgRating * 20)} maxValue={100} color="#F59E0B" unit={avgRating > 0 ? ` (${avgRating.toFixed(1)})` : ''} textPrimary={textPrimary} textSecondary={textSecondary} />
          </View>
        </View>

        {/* ── Recent Activities ── */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Recent Activities</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>

          {activities.length > 0 ? (
            activities.map((item: any) => {
              const isReview = item.type === 'REVIEW';
              const isInquiry = item.type === 'INQUIRY';
              return (
                <ActivityItem
                  key={item.id}
                  icon={isReview ? 'star' : isInquiry ? 'person-add' : 'checkmark'}
                  iconBg={isReview ? '#F1F5F9' : '#D1FAE5'}
                  iconColor={isReview ? '#64748B' : '#059669'}
                  title={item.title}
                  subtitle={item.subtitle}
                  desc={item.desc}
                  time={new Date(item.date).toLocaleDateString()}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                />
              );
            })
          ) : (
            <Text style={{ color: textSecondary, textAlign: 'center', marginVertical: 20 }}>
              No recent activities.
            </Text>
          )}
        </View>

        {/* ── Quick Actions ── */}
        <View style={[styles.quickActionsCard, { backgroundColor: TEAL }]}>
          <Text style={styles.quickActionsTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.quickActionBtn} onPress={onAvailabilityPress}>
              <Ionicons name="calendar-outline" size={24} color="#00D598" />
              <Text style={styles.quickActionText}>Availability</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionBtn} onPress={onClientsPress}>
              <Ionicons name="people-outline" size={24} color="#00D598" />
              <Text style={styles.quickActionText}>Clients</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionBtn} onPress={onAnalyticsPress}>
              <Ionicons name="bar-chart-outline" size={24} color="#00D598" />
              <Text style={styles.quickActionText}>Analytics</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionBtn} onPress={onReviewsPress}>
              <Ionicons name="star-outline" size={24} color="#00D598" />
              <Text style={styles.quickActionText}>Reviews</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionBtn} onPress={onInvoice}>
              <Ionicons name="document-text-outline" size={24} color="#00D598" />
              <Text style={styles.quickActionText}>Create Invoice</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionBtn} onPress={onSecurity}>
              <Ionicons name="lock-closed-outline" size={24} color="#00D598" />
              <Text style={styles.quickActionText}>Security</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionBtn} onPress={() => Share.share({ message: `Check out my consulting profile on WHEELWORLD!\n${user?.name ?? 'Expert'}` })}>
              <Ionicons name="share-social-outline" size={24} color="#00D598" />
              <Text style={styles.quickActionText}>Share Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Expert Tip ── */}
        <View style={styles.tipCard}>
          <Text style={[styles.tipTitle, { color: textPrimary }]}>Expert Tip</Text>
          <View style={styles.tipBox}>
            <Text style={styles.tipText}>
              "Clients are 40% more likely to book sessions if you update your availability for the weekend by Friday morning."
            </Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

const ActivityItem = ({
  icon, iconBg, iconColor, title, subtitle, desc, time, textPrimary, textSecondary
}: any) => (
  <View style={styles.activityItem}>
    <View style={[styles.activityIconBox, { backgroundColor: iconBg }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
    </View>
    <View style={styles.activityContent}>
      <Text style={[styles.activityTitle, { color: textPrimary }]}>{title}</Text>
      <Text style={[styles.activitySubtitle, { color: textPrimary }]}>{subtitle}</Text>
      {!!desc && <Text style={[styles.activityDesc, { color: textSecondary }]}>{desc}</Text>}
    </View>
    <Text style={[styles.activityTime, { color: textSecondary }]}>{time}</Text>
  </View>
);

const PerfRow = ({
  label, value, maxValue, color, unit = '', textPrimary, textSecondary,
}: {
  label: string; value: number; maxValue: number; color: string;
  unit?: string; textPrimary: string; textSecondary: string;
}) => (
  <View style={styles.perfRow}>
    <Text style={[styles.perfLabel, { color: textSecondary }]}>{label}</Text>
    <View style={styles.perfBar}>
      <View style={[styles.perfFill, { width: `${Math.min((value / maxValue) * 100, 100)}%`, backgroundColor: color }]} />
    </View>
    <Text style={[styles.perfValue, { color: textPrimary }]}>{value}{unit}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    padding: 4,
  },
  appIconBox: {
    width: 30, height: 30,
    borderRadius: 8,
    backgroundColor: TEAL,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#059669' },
  onlineText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  bellBtn: {},
  avatarMini: { width: 32, height: 32, borderRadius: 16 },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 16,
  },

  welcomeCard: {
    borderRadius: 20,
    padding: 24,
    backgroundColor: '#EBE5DC', // Light beige paper-like
    marginTop: 8,
    overflow: 'hidden',
  },
  welcomeOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 8,
  },
  welcomeSub: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },

  statCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: { fontSize: 14, fontWeight: '600' },
  statValue: { fontSize: 28, fontWeight: '900', marginBottom: 4 },
  statTrend: { fontSize: 13, fontWeight: '700', color: TEAL },
  statTrendNeg: { color: '#EF4444' },

  sectionCard: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  viewAllText: { fontSize: 13, fontWeight: '700', color: TEAL },

  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
  },
  activityIconBox: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  activitySubtitle: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  activityDesc: { fontSize: 12 },
  activityTime: { fontSize: 11, fontWeight: '500' },

  quickActionsCard: {
    borderRadius: 20,
    padding: 20,
  },
  quickActionsTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12 },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickActionBtn: { alignItems: 'center', gap: 6, width: '22%', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.2)', padding: 14, borderRadius: 12 },
  quickActionText: { fontSize: 12, fontWeight: '700', color: '#fff', textAlign: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 14 },

  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  sessionDateBox: {
    width: 46,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionMonth: { fontSize: 9, fontWeight: '700', color: '#059669' },
  sessionDay: { fontSize: 20, fontWeight: '700', color: '#059669' },
  sessionInfo: { flex: 1 },
  sessionClient: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  sessionTopic: { fontSize: 12, marginBottom: 3 },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sessionMetaText: { fontSize: 11 },
  sessionRight: { alignItems: 'flex-end', gap: 6 },
  sessionPrice: { fontSize: 14, fontWeight: '700' },
  sessionTypeBadge: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: '#D1FAE5',
    alignItems: 'center', justifyContent: 'center',
  },

  perfList: { gap: 14, marginTop: 12 },
  perfRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  perfLabel: { width: 110, fontSize: 13 },
  perfBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#E2E8F0' },
  perfFill: { height: '100%', borderRadius: 4 },
  perfValue: { width: 56, fontSize: 13, fontWeight: '700', textAlign: 'right' },

  tipCard: {
    marginTop: 8,
  },
  tipTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
  tipBox: {
    backgroundColor: '#FFFBEB',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  tipText: {
    fontSize: 14, color: '#92400E', lineHeight: 22, fontWeight: '500',
  },
});
