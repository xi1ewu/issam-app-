import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../hooks/useAppTheme';
import { dashboardAPI } from '../../services/api';
import { Radius, Shadow } from '../../theme';

interface Props {
  onBack: () => void;
}

function TrendBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <View style={[badge.wrap, { backgroundColor: positive ? '#10B98120' : '#EF444420' }]}>
      <Ionicons name={positive ? 'trending-up' : 'trending-down'} size={12} color={positive ? '#10B981' : '#EF4444'} />
      <Text style={[badge.text, { color: positive ? '#10B981' : '#EF4444' }]}>
        {positive ? '+' : ''}{value}%
      </Text>
    </View>
  );
}

function StatCard({
  icon, label, value, sub, trend, iconColor, bg,
}: {
  icon: any; label: string; value: string; sub?: string; trend?: number; iconColor: string; bg: string;
}) {
  return (
    <View style={[card.wrap, Shadow.sm]}>
      <View style={[card.iconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={card.info}>
        <Text style={card.label}>{label}</Text>
        <Text style={card.value}>{value}</Text>
        {sub && <Text style={card.sub}>{sub}</Text>}
      </View>
      {trend !== undefined && <TrendBadge value={trend} />}
    </View>
  );
}

export const ExpertAnalyticsScreen: React.FC<Props> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await dashboardAPI.getExpertAnalytics();
      setData(res);
    } catch {
      // show zeros on error
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const views = data?.profileViews ?? { total: 0, last30Days: 0, trend: 0 };
  const convRate = data?.bookingConversionRate ?? 0;
  const repeatClients = data?.repeatClients ?? 0;
  const totalClients = data?.totalClients ?? 0;
  const topCats: { topic: string; count: number }[] = data?.topCategories ?? [];
  const earnings = data?.earnings ?? { thisMonth: 0, lastMonth: 0, growth: 0 };
  const bookings = data?.bookings ?? { last30Days: 0, trend: 0 };

  const maxCatCount = topCats.reduce((m, c) => Math.max(m, c.count), 1);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient colors={['#0f3460', '#16213e']} style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerText}>
          <Text style={s.headerTitle}>Analytics</Text>
          <Text style={s.headerSub}>Your business insights</Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#00D598" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D598" />}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Profile Views */}
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Profile Views</Text>
            <View style={s.row}>
              <StatCard
                icon="eye-outline"
                label="Total Views"
                value={views.total.toLocaleString()}
                iconColor="#3B82F6"
                bg="#3B82F620"
              />
              <StatCard
                icon="eye-outline"
                label="Last 30 Days"
                value={views.last30Days.toLocaleString()}
                trend={views.trend}
                iconColor="#8B5CF6"
                bg="#8B5CF620"
              />
            </View>
          </View>

          {/* Conversion & Bookings */}
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Bookings</Text>
            <View style={s.row}>
              <StatCard
                icon="funnel-outline"
                label="Conversion Rate"
                value={`${convRate}%`}
                sub="views → bookings"
                iconColor="#00D598"
                bg="#00D59820"
              />
              <StatCard
                icon="calendar-outline"
                label="Bookings (30d)"
                value={bookings.last30Days.toString()}
                trend={bookings.trend}
                iconColor="#F59E0B"
                bg="#F59E0B20"
              />
            </View>
          </View>

          {/* Clients */}
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Clients</Text>
            <View style={s.row}>
              <StatCard
                icon="people-outline"
                label="Total Clients"
                value={totalClients.toString()}
                iconColor="#10B981"
                bg="#10B98120"
              />
              <StatCard
                icon="refresh-outline"
                label="Repeat Clients"
                value={repeatClients.toString()}
                sub={totalClients > 0 ? `${Math.round((repeatClients / totalClients) * 100)}% retention` : '—'}
                iconColor="#EF4444"
                bg="#EF444420"
              />
            </View>
          </View>

          {/* Earnings */}
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Earnings Growth</Text>
            <View style={[s.earningsCard, { backgroundColor: colors.card, ...Shadow.sm }]}>
              <LinearGradient colors={['#0f3460', '#16213e']} style={s.earningsGradient}>
                <View style={s.earningsMain}>
                  <Text style={s.earningsLabel}>This Month</Text>
                  <Text style={s.earningsValue}>${earnings.thisMonth.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
                  {earnings.growth !== 0 && <TrendBadge value={earnings.growth} />}
                </View>
                <View style={s.earningsDivider} />
                <View style={s.earningsMain}>
                  <Text style={s.earningsLabel}>Last Month</Text>
                  <Text style={s.earningsValue}>${earnings.lastMonth.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
                  {earnings.lastMonthGrowth !== 0 && <TrendBadge value={earnings.lastMonthGrowth} />}
                </View>
              </LinearGradient>
            </View>
          </View>

          {/* Top Consultation Categories */}
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Top Consultation Topics</Text>
            {topCats.length === 0 ? (
              <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="bar-chart-outline" size={32} color={colors.icon} />
                <Text style={[s.emptyText, { color: colors.icon }]}>No consultations yet</Text>
              </View>
            ) : (
              <View style={[s.catCard, { backgroundColor: colors.card, ...Shadow.sm }]}>
                {topCats.map((cat, i) => (
                  <View key={i} style={s.catRow}>
                    <View style={[s.catRank, { backgroundColor: i === 0 ? '#F59E0B20' : colors.border }]}>
                      <Text style={[s.catRankText, { color: i === 0 ? '#F59E0B' : colors.textSecondary }]}>#{i + 1}</Text>
                    </View>
                    <View style={s.catInfo}>
                      <Text style={[s.catTopic, { color: colors.text }]} numberOfLines={1}>{cat.topic}</Text>
                      <View style={[s.catBarBg, { backgroundColor: colors.border }]}>
                        <View
                          style={[s.catBarFill, {
                            width: `${Math.round((cat.count / maxCatCount) * 100)}%`,
                            backgroundColor: i === 0 ? '#00D598' : i === 1 ? '#3B82F6' : '#8B5CF6',
                          }]}
                        />
                      </View>
                    </View>
                    <Text style={[s.catCount, { color: colors.textSecondary }]}>{cat.count}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  emptyCard: { borderRadius: Radius.xl, padding: 24, alignItems: 'center', gap: 8, borderWidth: 1 },
  emptyText: { fontSize: 14 },
  catCard: { borderRadius: Radius.xl, padding: 16, gap: 12 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catRank: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  catRankText: { fontSize: 11, fontWeight: '700' },
  catInfo: { flex: 1, gap: 4 },
  catTopic: { fontSize: 13, fontWeight: '600' },
  catBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 3 },
  catCount: { fontSize: 13, fontWeight: '700', minWidth: 24, textAlign: 'right' },
  earningsCard: { borderRadius: Radius.xl, overflow: 'hidden' },
  earningsGradient: { flexDirection: 'row', padding: 20, gap: 0 },
  earningsMain: { flex: 1, alignItems: 'center', gap: 8 },
  earningsDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 8 },
  earningsLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  earningsValue: { fontSize: 24, fontWeight: '700', color: '#fff' },
});

const card = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: Radius.xl,
    padding: 14,
    gap: 10,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  info: { gap: 2 },
  label: { fontSize: 12, color: '#6B7A8D' },
  value: { fontSize: 20, fontWeight: '700', color: '#1A2332' },
  sub: { fontSize: 11, color: '#9BA8B4' },
});

const badge = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
  text: { fontSize: 11, fontWeight: '700' },
});
