import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useAppStore } from '../../store/useAppStore';
import { Radius, Shadow } from '../../theme';

const TEAL  = '#00D598';
const NAVY  = '#0A1628';
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000') + '/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
  onSignOut: () => void;
}

async function adminGet<T>(path: string): Promise<T> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token ?? ''}` },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function adminPut<T>(path: string, body: object): Promise<T> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function adminPost<T>(path: string, body: object = {}): Promise<T> {
  const token = await AsyncStorage.getItem('accessToken');
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function Trend({ value }: { value: number }) {
  const pos = value >= 0;
  return (
    <View style={[tr.wrap, { backgroundColor: pos ? '#10B98115' : '#EF444415' }]}>
      <Ionicons name={pos ? 'trending-up' : 'trending-down'} size={11} color={pos ? '#10B981' : '#EF4444'} />
      <Text style={[tr.txt, { color: pos ? '#10B981' : '#EF4444' }]}>{pos ? '+' : ''}{value}%</Text>
    </View>
  );
}

function KpiCard({ label, value, sub, trend, color, icon }: {
  label: string; value: string; sub?: string; trend?: number; color: string; icon: any;
}) {
  return (
    <View style={[kpi.wrap, Shadow.sm]}>
      <View style={[kpi.iconBox, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={kpi.value}>{value}</Text>
      <Text style={kpi.label}>{label}</Text>
      {sub && <Text style={kpi.sub}>{sub}</Text>}
      {trend !== undefined && <Trend value={trend} />}
    </View>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={bc.row}>
      {data.map((d, i) => (
        <View key={i} style={bc.col}>
          <View style={bc.barWrap}>
            <View style={[bc.bar, { height: `${Math.round((d.value / max) * 100)}%` }]} />
          </View>
          <Text style={bc.lbl}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

export const AdminDashboardScreen: React.FC<Props> = ({ onSignOut }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const user = useAppStore(s => s.user);
  const reset = useAppStore(s => s.reset);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'consultations' | 'payments'>('overview');

  const load = useCallback(async () => {
    try {
      const analytics = await adminGet<any>('/admin/analytics');
      setData(analytics);
    } catch (e) {
      console.warn('Admin load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    );
  }

  const d = data ?? {};
  const trend = (d.monthlyTrend ?? []) as { label: string; gmv: number; users: number }[];

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient colors={['#0f3460', '#1a1a2e']} style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.headerTitle}>Admin Panel</Text>
            <Text style={s.headerSub}>Platform Analytics</Text>
          </View>
          <TouchableOpacity
            style={s.signOutBtn}
            onPress={() => { reset(); onSignOut(); }}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll} contentContainerStyle={s.tabRow}>
          {([
            { key: 'overview',      label: 'Overview'  },
            { key: 'users',         label: 'Users'     },
            { key: 'consultations', label: 'Consults'  },
            { key: 'payments',      label: '💳 Payments' },
          ] as const).map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, activeTab === tab.key && s.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={TEAL} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {activeTab === 'overview' && (
          <>
            {/* KPI Grid */}
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>Platform KPIs</Text>
              <View style={s.kpiGrid}>
                <KpiCard label="Total GMV"         value={`$${(d.gmv?.total ?? 0).toLocaleString('en', { maximumFractionDigits: 0 })}`}             trend={d.gmv?.growth}          color={TEAL}      icon="trending-up-outline" />
                <KpiCard label="Platform Revenue"  value={`$${(d.revenue?.total ?? 0).toLocaleString('en', { maximumFractionDigits: 0 })}`}          trend={d.revenue?.growth}      color="#3B82F6"   icon="cash-outline" />
                <KpiCard label="This Month GMV"    value={`$${(d.gmv?.thisMonth ?? 0).toLocaleString('en', { maximumFractionDigits: 0 })}`}          sub={`Last: $${(d.gmv?.lastMonth ?? 0).toLocaleString()}`} color="#8B5CF6" icon="calendar-outline" />
                <KpiCard label="Total Users"       value={(d.users?.total ?? 0).toLocaleString()}                                                     trend={d.users?.growth}        color="#F59E0B"   icon="people-outline" />
                <KpiCard label="Active Experts"    value={`${d.experts?.activeThisMonth ?? 0}`}                                                       sub={`${d.experts?.total ?? 0} total`} color="#10B981" icon="person-outline" />
                <KpiCard label="Active Subs"       value={(d.subscriptions?.active ?? 0).toLocaleString()}                                            trend={d.subscriptions?.growth} color="#EF4444"  icon="card-outline" />
              </View>
            </View>

            {/* Health Metrics */}
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>Platform Health</Text>
              <View style={[s.healthCard, { backgroundColor: colors.card, ...Shadow.sm }]}>
                <MetricRow label="Completion Rate"        value={`${d.completionRate ?? 0}%`}    color="#10B981" />
                <MetricRow label="Churn Rate"             value={`${d.churnRate ?? 0}%`}          color="#EF4444" />
                <MetricRow label="Sub Conversion"         value={`${d.subConversionRate ?? 0}%`}  color="#3B82F6" />
                <MetricRow label="Disputes (paid+cancel)" value={`${d.disputes ?? 0}`}             color="#F59E0B" isLast />
              </View>
            </View>

            {/* Consultations Summary */}
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>Consultations</Text>
              <View style={s.kpiGrid}>
                <KpiCard label="Total"     value={(d.consultations?.total     ?? 0).toLocaleString()} color={TEAL}    icon="calendar-outline" />
                <KpiCard label="Completed" value={(d.consultations?.completed ?? 0).toLocaleString()} color="#10B981" icon="checkmark-circle-outline" />
                <KpiCard label="Cancelled" value={(d.consultations?.cancelled ?? 0).toLocaleString()} color="#EF4444" icon="close-circle-outline" />
              </View>
            </View>

            {/* Monthly GMV Trend */}
            {trend.length > 0 && (
              <View style={s.section}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>GMV Trend (6 months)</Text>
                <View style={[s.chartCard, { backgroundColor: colors.card, ...Shadow.sm }]}>
                  <BarChart data={trend.map(t => ({ label: t.label, value: t.gmv }))} />
                  <View style={s.chartLegend}>
                    {trend.map((t, i) => (
                      <View key={i} style={s.chartLegendItem}>
                        <Text style={[s.chartLegendLabel, { color: colors.textSecondary }]}>{t.label}</Text>
                        <Text style={[s.chartLegendValue, { color: colors.text }]}>${t.gmv.toLocaleString('en', { maximumFractionDigits: 0 })}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Top Experts */}
            {(d.topExperts ?? []).length > 0 && (
              <View style={s.section}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>Top Experts</Text>
                <View style={[s.healthCard, { backgroundColor: colors.card, ...Shadow.sm }]}>
                  {(d.topExperts as any[]).map((e, i) => (
                    <View key={e.id} style={[s.expertRow, i < d.topExperts.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                      <Text style={[s.expertRank, { color: i === 0 ? '#F59E0B' : colors.textSecondary }]}>#{i + 1}</Text>
                      {e.avatar
                        ? <Image source={{ uri: e.avatar }} style={s.expertAvatar} />
                        : <View style={[s.expertAvatarFallback, { backgroundColor: TEAL + '20' }]}><Ionicons name="person" size={16} color={TEAL} /></View>}
                      <View style={s.expertInfo}>
                        <Text style={[s.expertName, { color: colors.text }]} numberOfLines={1}>{e.name}</Text>
                        <Text style={[s.expertSub, { color: colors.textSecondary }]}>★ {e.rating.toFixed(1)} · {e.reviewCount} reviews</Text>
                      </View>
                      <Text style={[s.expertRevenue, { color: TEAL }]}>${e.revenue.toLocaleString('en', { maximumFractionDigits: 0 })}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {activeTab === 'users' && (
          <AdminUsersTab colors={colors} />
        )}

        {activeTab === 'consultations' && (
          <AdminConsultationsTab colors={colors} />
        )}

        {activeTab === 'payments' && (
          <AdminPaymentsTab colors={colors} isDark={isDark} />
        )}
      </ScrollView>
    </View>
  );
};

// ─── Sub-tabs ──────────────────────────────────────────────────────────────

function AdminUsersTab({ colors }: { colors: any }) {
  const [users, setUsers]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    adminGet<any>('/admin/users').then(r => setUsers(r.users ?? [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleBan = (user: any) => {
    Alert.alert(
      `Ban "${user.name}"?`,
      'They will be immediately signed out and blocked from logging in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban Account', style: 'destructive',
          onPress: () => {
            Alert.prompt(
              'Reason (optional)',
              'This message is shown to the user.',
              async (reason) => {
                setActionUserId(user.id);
                try {
                  await adminPut(`/admin/users/${user.id}/ban`, { reason: reason || '' });
                  setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isBanned: true, bannedReason: reason || 'Terms violation' } : u));
                } catch (e: any) {
                  Alert.alert('Error', e.message);
                } finally {
                  setActionUserId(null);
                }
              },
              'plain-text',
              'Violated platform terms of service'
            );
          },
        },
      ]
    );
  };

  const handleUnban = (user: any) => {
    Alert.alert(`Restore "${user.name}"?`, 'They will regain access to their account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restore Access',
        onPress: async () => {
          setActionUserId(user.id);
          try {
            await adminPut(`/admin/users/${user.id}/unban`, {});
            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isBanned: false, bannedReason: null } : u));
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setActionUserId(null);
          }
        },
      },
    ]);
  };

  const filtered = search.trim()
    ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
    : users;

  if (loading) return <View style={s.center}><ActivityIndicator color={TEAL} /></View>;

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
      {/* Search */}
      <View style={[ub.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
        <TextInput
          style={[ub.searchInput, { color: colors.text }]}
          placeholder="Search name or email…"
          placeholderTextColor={colors.textSecondary + '80'}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={[s.sectionTitle, { color: colors.text }]}>
        {filtered.length} user{filtered.length !== 1 ? 's' : ''}
        {search ? ` matching "${search}"` : ''}
      </Text>

      {filtered.map(u => (
        <View
          key={u.id}
          style={[
            s.listRow,
            { backgroundColor: colors.card, borderColor: u.isBanned ? '#EF444440' : colors.border },
            u.isBanned && { backgroundColor: '#EF444408' },
          ]}
        >
          {/* Avatar */}
          {u.avatar
            ? <Image source={{ uri: u.avatar }} style={[s.rowAvatar, u.isBanned && ub.avatarBanned]} />
            : <View style={[s.rowAvatarFallback, { backgroundColor: u.isBanned ? '#EF444420' : TEAL + '20' }]}>
                <Ionicons name="person" size={16} color={u.isBanned ? '#EF4444' : TEAL} />
              </View>}

          {/* Info */}
          <View style={s.rowInfo}>
            <View style={ub.nameRow}>
              <Text style={[s.rowName, { color: colors.text }]} numberOfLines={1}>{u.name}</Text>
              {u.isBanned && (
                <View style={ub.bannedBadge}>
                  <Ionicons name="ban-outline" size={10} color="#EF4444" />
                  <Text style={ub.bannedBadgeText}>BANNED</Text>
                </View>
              )}
            </View>
            <Text style={[s.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>{u.email}</Text>
            {u.isBanned && u.bannedReason && (
              <Text style={ub.bannedReason} numberOfLines={1}>Reason: {u.bannedReason}</Text>
            )}
          </View>

          {/* Role badge */}
          <View style={[s.roleBadge, { backgroundColor: u.role === 'EXPERT' ? TEAL + '20' : u.role === 'ADMIN' ? '#EF444420' : '#3B82F620' }]}>
            <Text style={[s.roleText, { color: u.role === 'EXPERT' ? TEAL : u.role === 'ADMIN' ? '#EF4444' : '#3B82F6' }]}>{u.role}</Text>
          </View>

          {/* Ban / Unban button — never show for ADMIN accounts */}
          {u.role !== 'ADMIN' && (
            <TouchableOpacity
              style={[ub.actionBtn, { backgroundColor: u.isBanned ? '#10B98120' : '#EF444420' }]}
              onPress={() => u.isBanned ? handleUnban(u) : handleBan(u)}
              disabled={actionUserId === u.id}
            >
              {actionUserId === u.id
                ? <ActivityIndicator size="small" color={u.isBanned ? '#10B981' : '#EF4444'} />
                : <Ionicons name={u.isBanned ? 'checkmark-circle-outline' : 'ban-outline'} size={18} color={u.isBanned ? '#10B981' : '#EF4444'} />}
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

function AdminConsultationsTab({ colors }: { colors: any }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminGet<any[]>('/admin/consultations').then(r => setItems(r ?? [])).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={s.center}><ActivityIndicator color={TEAL} /></View>;

  const statusColor: Record<string, string> = {
    COMPLETED: '#10B981', UPCOMING: '#3B82F6', CANCELLED: '#EF4444',
    AWAITING_CONFIRMATION: '#F59E0B', PENDING_PAYMENT: '#9CA3AF',
  };

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
      <Text style={[s.sectionTitle, { color: colors.text }]}>Recent Consultations ({items.length})</Text>
      {items.map(c => (
        <View key={c.id} style={[s.listRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[s.statusDot, { backgroundColor: statusColor[c.status] ?? '#9CA3AF' }]} />
          <View style={s.rowInfo}>
            <Text style={[s.rowName, { color: colors.text }]} numberOfLines={1}>{c.topic}</Text>
            <Text style={[s.rowSub, { color: colors.textSecondary }]}>
              {c.client?.name ?? '—'} → {c.expert?.user?.name ?? '—'} · {c.date}
            </Text>
          </View>
          <View>
            <Text style={[s.rowPrice, { color: TEAL }]}>${c.price?.toFixed(0) ?? '0'}</Text>
            <Text style={[s.rowStatus, { color: statusColor[c.status] ?? '#9CA3AF' }]}>{c.status}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Small helper components ──────────────────────────────────────────────

function MetricRow({ label, value, color, isLast }: { label: string; value: string; color: string; isLast?: boolean }) {
  return (
    <View style={[s.metricRow, !isLast && { borderBottomWidth: 1 }]}>
      <View style={[s.metricDot, { backgroundColor: color }]} />
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

// ─── Payments Tab ─────────────────────────────────────────────────────────

interface TestResult { ok: boolean; message: string }
interface TestResults { paypal?: TestResult; chargily?: TestResult }

function AdminPaymentsTab({ colors, isDark }: { colors: any; isDark: boolean }) {
  const [cfg, setCfg]           = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);
  const [testResult, setTestResult] = useState<TestResults>({});

  // Editable fields (empty = keep existing value)
  const [paypalId,     setPaypalId]     = useState('');
  const [paypalSecret, setPaypalSecret] = useState('');
  const [paypalMode,   setPaypalMode]   = useState<'sandbox' | 'live'>('sandbox');
  const [chargilyKey,  setChargilyKey]  = useState('');
  const [chargilyPub,  setChargilyPub]  = useState('');
  const [chargilyMode, setChargilyMode] = useState<'test' | 'live'>('test');
  const [dzdRate,      setDzdRate]      = useState('');

  useEffect(() => {
    adminGet<any>('/admin/payment-config').then(data => {
      setCfg(data);
      setPaypalMode(data.paypal?.mode ?? 'sandbox');
      setChargilyMode(data.chargily?.mode ?? 'test');
      setDzdRate(data.dzdRate ?? '135');
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminPut('/admin/payment-config', {
        paypal_client_id:     paypalId,
        paypal_client_secret: paypalSecret,
        paypal_mode:          paypalMode,
        chargily_api_key:     chargilyKey,
        chargily_public_key:  chargilyPub,
        chargily_mode:        chargilyMode,
        dzd_rate:             dzdRate,
      });
      // Refresh masked display
      const fresh = await adminGet<any>('/admin/payment-config');
      setCfg(fresh);
      setPaypalId(''); setPaypalSecret('');
      setChargilyKey(''); setChargilyPub('');
      Alert.alert('Saved', 'Payment configuration updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult({});
    try {
      const res = await adminPost<TestResults>('/admin/payment-config/test');
      setTestResult(res);
    } catch (e: any) {
      Alert.alert('Test Error', e?.message ?? 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator color={TEAL} /></View>;
  }

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts?: { placeholder?: string; secure?: boolean; keyboardType?: any }
  ) => (
    <View style={pm.field}>
      <Text style={[pm.label, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[pm.input, { backgroundColor: isDark ? colors.background : '#F8FAFC', color: colors.text, borderColor: colors.border }]}
        value={value}
        onChangeText={onChange}
        placeholder={opts?.placeholder ?? ''}
        placeholderTextColor={colors.textSecondary + '80'}
        secureTextEntry={opts?.secure}
        keyboardType={opts?.keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );

  const StatusDot = ({ ok }: { ok?: boolean }) =>
    ok === undefined ? null : (
      <View style={[pm.dot, { backgroundColor: ok ? '#10B981' : '#EF4444' }]} />
    );

  const ModeToggle = ({ value, onChange, opts }: {
    value: string; onChange: (v: string) => void; opts: string[];
  }) => (
    <View style={pm.modeRow}>
      {opts.map(o => (
        <TouchableOpacity
          key={o}
          style={[pm.modeBtn, { borderColor: value === o ? TEAL : colors.border, backgroundColor: value === o ? TEAL + '15' : 'transparent' }]}
          onPress={() => onChange(o)}
        >
          <Text style={[pm.modeTxt, { color: value === o ? TEAL : colors.textSecondary }]}>
            {o.charAt(0).toUpperCase() + o.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 }}>

        {/* ── PayPal ─────────────────────────────────────── */}
        <View style={[pm.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={pm.cardHeader}>
            <View style={[pm.logoBox, { backgroundColor: '#003087' + '15' }]}>
              <Text style={pm.logoText}>PP</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[pm.cardTitle, { color: colors.text }]}>PayPal</Text>
              <Text style={[pm.cardSub, { color: colors.textSecondary }]}>International payments (USD)</Text>
            </View>
            <View style={pm.statusBadge}>
              <StatusDot ok={cfg?.paypal?.isConfigured} />
              <Text style={[pm.statusText, { color: cfg?.paypal?.isConfigured ? '#10B981' : '#EF4444' }]}>
                {cfg?.paypal?.isConfigured ? 'Configured' : 'Not set'}
              </Text>
            </View>
          </View>

          {cfg?.paypal?.isConfigured && (
            <View style={[pm.currentValues, { backgroundColor: isDark ? colors.background : '#F0FDF4', borderColor: '#10B98130' }]}>
              <Text style={[pm.currentLine, { color: colors.textSecondary }]}>
                Client ID: <Text style={{ fontFamily: 'monospace', color: colors.text }}>{cfg.paypal.clientId}</Text>
              </Text>
              <Text style={[pm.currentLine, { color: colors.textSecondary }]}>
                Secret: <Text style={{ fontFamily: 'monospace', color: colors.text }}>{cfg.paypal.clientSecret}</Text>
              </Text>
              <Text style={[pm.currentLine, { color: colors.textSecondary }]}>
                Mode: <Text style={{ color: cfg.paypal.mode === 'live' ? '#10B981' : '#F59E0B', fontWeight: '700' }}>{cfg.paypal.mode}</Text>
              </Text>
            </View>
          )}

          {field('Client ID', paypalId, setPaypalId, { placeholder: 'Leave blank to keep current' })}
          {field('Client Secret', paypalSecret, setPaypalSecret, { placeholder: 'Leave blank to keep current', secure: true })}

          <Text style={[pm.label, { color: colors.textSecondary, marginBottom: 8 }]}>Mode</Text>
          <ModeToggle value={paypalMode} onChange={v => setPaypalMode(v as any)} opts={['sandbox', 'live']} />

          {testResult.paypal && (
            <View style={[pm.testResult, { backgroundColor: testResult.paypal.ok ? '#10B98115' : '#EF444415', borderColor: testResult.paypal.ok ? '#10B981' : '#EF4444' }]}>
              <Ionicons name={testResult.paypal.ok ? 'checkmark-circle' : 'close-circle'} size={16} color={testResult.paypal.ok ? '#10B981' : '#EF4444'} />
              <Text style={[pm.testResultText, { color: testResult.paypal.ok ? '#10B981' : '#EF4444' }]}>{testResult.paypal.message}</Text>
            </View>
          )}
        </View>

        {/* ── Chargily ───────────────────────────────────── */}
        <View style={[pm.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={pm.cardHeader}>
            <View style={[pm.logoBox, { backgroundColor: TEAL + '15' }]}>
              <Text style={[pm.logoText, { color: TEAL }]}>CH</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[pm.cardTitle, { color: colors.text }]}>Chargily Pay</Text>
              <Text style={[pm.cardSub, { color: colors.textSecondary }]}>Algerian payments (DZD · CIB / Dahabia)</Text>
            </View>
            <View style={pm.statusBadge}>
              <StatusDot ok={cfg?.chargily?.isConfigured} />
              <Text style={[pm.statusText, { color: cfg?.chargily?.isConfigured ? '#10B981' : '#EF4444' }]}>
                {cfg?.chargily?.isConfigured ? 'Configured' : 'Not set'}
              </Text>
            </View>
          </View>

          {cfg?.chargily?.isConfigured && (
            <View style={[pm.currentValues, { backgroundColor: isDark ? colors.background : '#F0FDF4', borderColor: '#10B98130' }]}>
              <Text style={[pm.currentLine, { color: colors.textSecondary }]}>
                API Key: <Text style={{ fontFamily: 'monospace', color: colors.text }}>{cfg.chargily.apiKey}</Text>
              </Text>
              <Text style={[pm.currentLine, { color: colors.textSecondary }]}>
                Public Key: <Text style={{ fontFamily: 'monospace', color: colors.text }}>{cfg.chargily.publicKey}</Text>
              </Text>
              <Text style={[pm.currentLine, { color: colors.textSecondary }]}>
                Mode: <Text style={{ color: cfg.chargily.mode === 'live' ? '#10B981' : '#F59E0B', fontWeight: '700' }}>{cfg.chargily.mode}</Text>
              </Text>
            </View>
          )}

          {field('API Key (Secret)', chargilyKey, setChargilyKey, { placeholder: 'test_sk_... or live_sk_...', secure: true })}
          {field('Public Key', chargilyPub, setChargilyPub, { placeholder: 'test_pk_... or live_pk_...' })}

          <Text style={[pm.label, { color: colors.textSecondary, marginBottom: 8 }]}>Mode</Text>
          <ModeToggle value={chargilyMode} onChange={v => setChargilyMode(v as any)} opts={['test', 'live']} />

          {testResult.chargily && (
            <View style={[pm.testResult, { backgroundColor: testResult.chargily.ok ? '#10B98115' : '#EF444415', borderColor: testResult.chargily.ok ? '#10B981' : '#EF4444' }]}>
              <Ionicons name={testResult.chargily.ok ? 'checkmark-circle' : 'close-circle'} size={16} color={testResult.chargily.ok ? '#10B981' : '#EF4444'} />
              <Text style={[pm.testResultText, { color: testResult.chargily.ok ? '#10B981' : '#EF4444' }]}>{testResult.chargily.message}</Text>
            </View>
          )}
        </View>

        {/* ── DZD Exchange Rate ──────────────────────────── */}
        <View style={[pm.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={pm.cardHeader}>
            <View style={[pm.logoBox, { backgroundColor: '#F59E0B15' }]}>
              <Text style={[pm.logoText, { color: '#F59E0B' }]}>FX</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[pm.cardTitle, { color: colors.text }]}>DZD Exchange Rate</Text>
              <Text style={[pm.cardSub, { color: colors.textSecondary }]}>Used to convert USD → DZD for Chargily</Text>
            </View>
          </View>
          {field('1 USD = ? DZD', dzdRate, setDzdRate, { placeholder: '135', keyboardType: 'decimal-pad' })}
        </View>

        {/* ── Action Buttons ─────────────────────────────── */}
        <View style={pm.actions}>
          <TouchableOpacity
            style={[pm.testBtn, { borderColor: TEAL }]}
            onPress={handleTest}
            disabled={testing}
            activeOpacity={0.8}
          >
            {testing
              ? <ActivityIndicator size="small" color={TEAL} />
              : <>
                  <Ionicons name="wifi-outline" size={16} color={TEAL} />
                  <Text style={[pm.testBtnText, { color: TEAL }]}>Test Connections</Text>
                </>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[pm.saveBtn, { backgroundColor: TEAL }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator size="small" color={NAVY} />
              : <>
                  <Ionicons name="save-outline" size={16} color={NAVY} />
                  <Text style={pm.saveBtnText}>Save Configuration</Text>
                </>}
          </TouchableOpacity>
        </View>

        <Text style={[pm.hint, { color: colors.textSecondary }]}>
          Credentials are stored encrypted in the database and override .env values. Leave a field blank to keep the current value.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: { paddingHorizontal: 16, paddingBottom: 0 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  signOutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  tabScroll: { paddingBottom: 0 },
  tabRow: { flexDirection: 'row', gap: 4, paddingBottom: 16, paddingHorizontal: 0 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  tabActive: { backgroundColor: TEAL },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  tabTextActive: { color: NAVY },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  healthCard: { borderRadius: Radius.xl, overflow: 'hidden' },
  metricRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderColor: 'rgba(0,0,0,0.06)', gap: 10 },
  metricDot: { width: 8, height: 8, borderRadius: 4 },
  metricLabel: { flex: 1, fontSize: 14, color: '#4A5568' },
  metricValue: { fontSize: 15, fontWeight: '700' },
  chartCard: { borderRadius: Radius.xl, padding: 16 },
  expertRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  expertRank: { width: 24, fontSize: 13, fontWeight: '700' },
  expertAvatar: { width: 36, height: 36, borderRadius: 18 },
  expertAvatarFallback: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  expertInfo: { flex: 1 },
  expertName: { fontSize: 14, fontWeight: '600' },
  expertSub: { fontSize: 11 },
  expertRevenue: { fontSize: 14, fontWeight: '700' },
  listRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8, gap: 10 },
  rowAvatar: { width: 40, height: 40, borderRadius: 20 },
  rowAvatarFallback: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  roleText: { fontSize: 11, fontWeight: '700' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  rowPrice: { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  rowStatus: { fontSize: 10, fontWeight: '600', textAlign: 'right', marginTop: 2 },
  chartLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chartLegendItem: { alignItems: 'center', minWidth: 48 },
  chartLegendLabel: { fontSize: 10 },
  chartLegendValue: { fontSize: 11, fontWeight: '700' },
});

const kpi = StyleSheet.create({
  wrap: { width: '47%', backgroundColor: '#fff', borderRadius: Radius.xl, padding: 14, gap: 6 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 20, fontWeight: '800', color: '#1A2332' },
  label: { fontSize: 12, color: '#6B7A8D' },
  sub: { fontSize: 11, color: '#9BA8B4' },
});

const tr = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  txt: { fontSize: 10, fontWeight: '700' },
});

const bc = StyleSheet.create({
  row: { flexDirection: 'row', height: 80, alignItems: 'flex-end', gap: 4, paddingHorizontal: 4 },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  barWrap: { flex: 1, width: '80%', justifyContent: 'flex-end' },
  bar: { width: '100%', backgroundColor: TEAL, borderRadius: 4, minHeight: 4 },
  lbl: { fontSize: 9, color: '#9BA8B4' },
});

const ub = StyleSheet.create({
  searchRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 42, marginBottom: 14 },
  searchInput:     { flex: 1, fontSize: 14 },
  nameRow:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bannedBadge:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EF444420', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  bannedBadgeText: { fontSize: 9, fontWeight: '800', color: '#EF4444' },
  bannedReason:    { fontSize: 11, color: '#EF4444', marginTop: 2 },
  avatarBanned:    { opacity: 0.5 },
  actionBtn:       { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
});

const pm = StyleSheet.create({
  card:          { borderRadius: Radius.xl, borderWidth: 1, padding: 16, marginBottom: 16, gap: 0 },
  cardHeader:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  logoBox:       { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logoText:      { fontSize: 14, fontWeight: '800', color: '#003087' },
  cardTitle:     { fontSize: 16, fontWeight: '700' },
  cardSub:       { fontSize: 12, marginTop: 2 },
  statusBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot:           { width: 8, height: 8, borderRadius: 4 },
  statusText:    { fontSize: 12, fontWeight: '700' },
  currentValues: { borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 14, gap: 4 },
  currentLine:   { fontSize: 12 },
  field:         { marginBottom: 12 },
  label:         { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input:         { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 44, fontSize: 14 },
  modeRow:       { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeBtn:       { flex: 1, height: 38, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  modeTxt:       { fontSize: 13, fontWeight: '700' },
  testResult:    { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 4 },
  testResultText:{ fontSize: 13, fontWeight: '600', flex: 1 },
  actions:       { flexDirection: 'row', gap: 12, marginBottom: 16 },
  testBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: 14, borderWidth: 1.5 },
  testBtnText:   { fontSize: 14, fontWeight: '700' },
  saveBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: 14 },
  saveBtnText:   { fontSize: 14, fontWeight: '700', color: NAVY },
  hint:          { fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
