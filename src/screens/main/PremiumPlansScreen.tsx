import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { subscriptionAPI, authAPI } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { useAppTheme } from '../../hooks/useAppTheme';
import { Radius, Shadow } from '../../theme';

const TEAL = '#00D598';
const NAVY = '#0A1628';

type Billing = 'monthly' | 'yearly';
type PaymentMethod = 'chargily' | 'paypal';

interface Plan {
  id: string;
  slug: string;
  name: string;
  price: number;          // DZD / month
  priceYearly: number;    // DZD / year
  features: string[];
  isPopular: boolean;
}

interface Props {
  onBack: () => void;
  onSuccess: () => void;
}

export const PremiumPlansScreen: React.FC<Props> = ({ onBack, onSuccess }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const setUser = useAppStore(s => s.setUser);

  const [plans, setPlans]                       = useState<Plan[]>([]);
  const [currentSub, setCurrentSub]             = useState<any>(null);
  const [billing, setBilling]                   = useState<Billing>('monthly');
  const [paymentMethod, setPaymentMethod]       = useState<PaymentMethod>('chargily');
  const [loadingPlans, setLoadingPlans]         = useState(true);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [cancelling, setCancelling]             = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      const [apiPlans, sub] = await Promise.all([
        subscriptionAPI.getPlans(),
        subscriptionAPI.getCurrent().catch(() => null),
      ]);
      setPlans(apiPlans as Plan[]);
      setCurrentSub(sub);
    } catch {
      Alert.alert('Error', 'Could not load subscription plans.');
    } finally {
      setLoadingPlans(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Payment handlers ─────────────────────────────────────────────────────

  const handleSubscribe = async (plan: Plan) => {
    if (plan.slug === 'enterprise') {
      Linking.openURL('mailto:sales@daconsulting.dz?subject=Enterprise Plan Inquiry');
      return;
    }
    if (plan.slug === 'free') {
      try {
        setProcessingPlanId(plan.id);
        await subscriptionAPI.activateFree();
        setUser({ plan: 'free' });
        await load();
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'Something went wrong');
      } finally {
        setProcessingPlanId(null);
      }
      return;
    }

    setProcessingPlanId(plan.id);
    try {
      if (paymentMethod === 'chargily') {
        await payViaChargily(plan);
      } else {
        await payViaPayPal(plan);
      }
    } finally {
      setProcessingPlanId(null);
    }
  };

  const payViaChargily = async (plan: Plan) => {
    let checkoutId = '';
    let checkoutUrl = '';
    try {
      const res = await subscriptionAPI.chargilyCheckout(plan.id, billing);
      checkoutId  = res.checkoutId;
      checkoutUrl = res.checkoutUrl;
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not create checkout');
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(
      checkoutUrl,
      'da-consulting://subscription/success'
    );

    if (result.type !== 'success' && result.type !== 'dismiss') {
      Alert.alert('Payment cancelled', 'Your subscription was not activated.');
      return;
    }

    // Verify even on dismiss — user may have paid but the deep link failed
    try {
      const verify = await subscriptionAPI.chargilyVerify(checkoutId, plan.id, billing);
      if (verify.paid) {
        setUser({ plan: 'premium' });
        await load();
        Alert.alert('🎉 Subscription Active!', `Welcome to ${plan.name}. Enjoy your benefits!`, [
          { text: 'Get Started', onPress: onSuccess },
        ]);
      } else {
        Alert.alert('Payment Pending', 'Payment not confirmed yet. Please try again in a moment.');
      }
    } catch (e: any) {
      Alert.alert('Verification Error', e?.message ?? 'Could not verify payment.');
    }
  };

  const payViaPayPal = async (plan: Plan) => {
    let orderId = '';
    let approvalUrl = '';
    try {
      const res = await subscriptionAPI.createPayPalOrder(plan.id, billing);
      orderId     = res.orderId;
      approvalUrl = res.approvalUrl;
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not create PayPal order');
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(
      approvalUrl,
      'da-consulting://subscription/success'
    );

    if (result.type !== 'success') {
      Alert.alert('Payment cancelled', 'Your subscription was not activated.');
      return;
    }

    try {
      await subscriptionAPI.capturePayPalOrder(orderId, plan.id, billing);
      setUser({ plan: 'premium' });
      await load();
      Alert.alert('🎉 Subscription Active!', `Welcome to ${plan.name}!`, [
        { text: 'Get Started', onPress: onSuccess },
      ]);
    } catch (e: any) {
      Alert.alert('Capture Error', e?.message ?? 'Could not confirm payment.');
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Subscription',
      'Your access will remain active until the end of your current billing period. Are you sure?',
      [
        { text: 'Keep Plan', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await subscriptionAPI.cancel();
              setUser({ plan: 'free' });
              await load();
              Alert.alert('Cancelled', 'Your subscription has been cancelled.');
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not cancel');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  // ── Derived state ────────────────────────────────────────────────────────

  const currentPlanSlug = currentSub?.plan?.slug ?? 'free';
  const isSubscribed    = currentSub?.status === 'ACTIVE' && currentPlanSlug !== 'free';
  const expiresAt       = currentSub ? new Date(currentSub.expiresAt) : null;

  function planPrice(plan: Plan): string {
    if (plan.price === 0)        return plan.slug === 'enterprise' ? 'Custom' : 'Free';
    if (billing === 'yearly')    return `${(plan.priceYearly / 12).toLocaleString('en')} DA/mo`;
    return `${plan.price.toLocaleString('en')} DA/mo`;
  }

  function yearlySaving(plan: Plan): number | null {
    if (!plan.priceYearly || plan.price === 0) return null;
    const monthly = plan.price * 12;
    return Math.round(((monthly - plan.priceYearly) / monthly) * 100);
  }

  if (loadingPlans) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onBack} style={s.headerBack}><Ionicons name="arrow-back" size={22} color={colors.text} /></TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>Plans</Text>
          <View style={s.headerBack} />
        </View>
        <View style={s.center}><ActivityIndicator size="large" color={TEAL} /></View>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={s.headerBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.text }]}>Premium Plans</Text>
        <View style={s.headerBack} />
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* Current plan status */}
        {currentSub && (
          <View style={[s.currentCard, { backgroundColor: colors.card, borderColor: TEAL }]}>
            <View style={s.currentRow}>
              <View style={[s.currentDot, { backgroundColor: TEAL }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.currentLabel, { color: colors.textSecondary }]}>Active Plan</Text>
                <Text style={[s.currentName, { color: colors.text }]}>{currentSub.plan?.name}</Text>
                {expiresAt && (
                  <Text style={[s.currentExpiry, { color: colors.textSecondary }]}>
                    Renews {expiresAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                )}
              </View>
              {isSubscribed && (
                <TouchableOpacity onPress={handleCancel} disabled={cancelling} style={s.cancelBtn}>
                  {cancelling
                    ? <ActivityIndicator size="small" color="#EF4444" />
                    : <Text style={s.cancelBtnText}>Cancel</Text>}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Hero */}
        <View style={s.hero}>
          <LinearGradient colors={[TEAL + '20', 'transparent']} style={s.heroGlow} />
          <Text style={[s.heroTitle, { color: colors.text }]}>Upgrade Your Strategy</Text>
          <Text style={[s.heroSub, { color: colors.textSecondary }]}>
            Unlock unlimited insights, expert sessions, and advanced tools for the MENA market.
          </Text>
        </View>

        {/* Billing toggle */}
        <View style={s.toggleRow}>
          <View style={[s.toggleBg, { backgroundColor: isDark ? colors.card : '#F1F5F9' }]}>
            {(['monthly', 'yearly'] as const).map(b => (
              <TouchableOpacity
                key={b}
                style={[s.toggleBtn, billing === b && [s.toggleActive, { backgroundColor: isDark ? colors.background : '#fff' }]]}
                onPress={() => setBilling(b)}
              >
                <Text style={[s.toggleText, { color: billing === b ? colors.text : colors.textSecondary }]}>
                  {b === 'monthly' ? 'Monthly' : 'Yearly'}
                </Text>
                {b === 'yearly' && (
                  <View style={[s.saveBadge, { backgroundColor: TEAL }]}>
                    <Text style={s.saveBadgeText}>-20%</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Payment method selector */}
        <View style={s.pmRow}>
          {([
            { key: 'chargily', label: 'CIB / Dahabia', icon: 'card-outline', flag: '🇩🇿' },
            { key: 'paypal',   label: 'PayPal',         icon: 'logo-paypal',  flag: '🌍' },
          ] as const).map(pm => (
            <TouchableOpacity
              key={pm.key}
              style={[s.pmBtn, { borderColor: paymentMethod === pm.key ? TEAL : colors.border, backgroundColor: paymentMethod === pm.key ? TEAL + '10' : colors.card }]}
              onPress={() => setPaymentMethod(pm.key)}
            >
              <Text style={s.pmFlag}>{pm.flag}</Text>
              <Text style={[s.pmLabel, { color: paymentMethod === pm.key ? TEAL : colors.text }]}>{pm.label}</Text>
              {paymentMethod === pm.key && <Ionicons name="checkmark-circle" size={16} color={TEAL} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Plan cards */}
        {plans.map(plan => {
          const isActive      = plan.slug === currentPlanSlug;
          const isPro         = plan.isPopular;
          const isEnterprise  = plan.slug === 'enterprise';
          const isFree        = plan.slug === 'free';
          const saving        = yearlySaving(plan);
          const isProcessing  = processingPlanId === plan.id;

          return (
            <View
              key={plan.id}
              style={[
                s.card,
                { backgroundColor: colors.card, borderColor: isPro ? TEAL : colors.border },
                isPro && s.cardPro,
                isActive && { borderColor: '#3B82F6', borderWidth: 2 },
              ]}
            >
              {isPro && (
                <View style={s.popularBadge}>
                  <Text style={s.popularText}>MOST POPULAR</Text>
                </View>
              )}
              {isActive && !isPro && (
                <View style={[s.popularBadge, { backgroundColor: '#3B82F6' }]}>
                  <Text style={s.popularText}>CURRENT PLAN</Text>
                </View>
              )}

              {/* Plan header */}
              <View style={s.cardHead}>
                <View>
                  <Text style={[s.planName, { color: colors.text }]}>{plan.name}</Text>
                  <Text style={[s.planDesc, { color: colors.textSecondary }]}>
                    {isFree ? 'For individual explorers'
                      : isPro ? 'For strategic consultants'
                      : 'For corporate teams'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.planPrice, { color: isPro ? TEAL : colors.text }]}>
                    {planPrice(plan)}
                  </Text>
                  {billing === 'yearly' && saving && plan.price > 0 && (
                    <View style={[s.yearlyChip, { backgroundColor: TEAL + '20' }]}>
                      <Text style={[s.yearlyChipText, { color: TEAL }]}>
                        Save {plan.priceYearly > 0
                          ? `${((plan.price * 12 - plan.priceYearly)).toLocaleString('en')} DA`
                          : `${saving}%`}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Features */}
              <View style={s.features}>
                {plan.features.map((f, i) => (
                  <View key={i} style={s.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color={TEAL} />
                    <Text style={[s.featureText, { color: colors.text }]}>{f}</Text>
                  </View>
                ))}
                {isEnterprise && (
                  <View style={s.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color={TEAL} />
                    <Text style={[s.featureText, { color: colors.text }]}>Custom onboarding</Text>
                  </View>
                )}
              </View>

              {/* CTA */}
              {isActive ? (
                <View style={[s.activeBtn, { borderColor: '#3B82F6' }]}>
                  <Ionicons name="checkmark-circle" size={18} color="#3B82F6" />
                  <Text style={[s.activeBtnText, { color: '#3B82F6' }]}>Active Plan</Text>
                </View>
              ) : isEnterprise ? (
                <TouchableOpacity
                  style={[s.ctaOutline, { borderColor: colors.border }]}
                  onPress={() => handleSubscribe(plan)}
                >
                  <Ionicons name="mail-outline" size={16} color={colors.text} />
                  <Text style={[s.ctaOutlineText, { color: colors.text }]}>Contact Sales</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[s.ctaSolid, { backgroundColor: isPro ? TEAL : colors.border }]}
                  onPress={() => handleSubscribe(plan)}
                  disabled={isProcessing}
                  activeOpacity={0.85}
                >
                  {isProcessing ? (
                    <ActivityIndicator color={isPro ? NAVY : colors.text} />
                  ) : (
                    <>
                      <Text style={[s.ctaSolidText, { color: isPro ? NAVY : colors.text }]}>
                        {isFree ? 'Use Free Plan' : `Upgrade — ${planPrice(plan)}`}
                      </Text>
                      <Ionicons name="arrow-forward" size={16} color={isPro ? NAVY : colors.text} />
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Trust badges */}
        <View style={s.trust}>
          {[
            { icon: 'shield-checkmark-outline', text: 'Secure payment' },
            { icon: 'refresh-outline',          text: 'Cancel anytime' },
            { icon: 'lock-closed-outline',      text: 'No hidden fees' },
          ].map(b => (
            <View key={b.text} style={s.trustItem}>
              <Ionicons name={b.icon as any} size={16} color={colors.textSecondary} />
              <Text style={[s.trustText, { color: colors.textSecondary }]}>{b.text}</Text>
            </View>
          ))}
        </View>
      </Animated.ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root:         { flex: 1 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerBack:   { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '800' },
  scroll:       { paddingHorizontal: 16, paddingTop: 8 },

  currentCard:  { borderRadius: Radius.xl, borderWidth: 1.5, padding: 16, marginBottom: 16 },
  currentRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  currentDot:   { width: 10, height: 10, borderRadius: 5 },
  currentLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  currentName:  { fontSize: 16, fontWeight: '700' },
  currentExpiry:{ fontSize: 12, marginTop: 2 },
  cancelBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#EF4444' },
  cancelBtnText:{ fontSize: 12, fontWeight: '700', color: '#EF4444' },

  hero:         { alignItems: 'center', paddingVertical: 20, marginBottom: 4, overflow: 'hidden' },
  heroGlow:     { position: 'absolute', width: 280, height: 280, borderRadius: 140, top: -60 },
  heroTitle:    { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  heroSub:      { fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  toggleRow:    { alignItems: 'center', marginBottom: 16 },
  toggleBg:     { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  toggleBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 18, borderRadius: 10 },
  toggleActive: { ...Shadow.sm },
  toggleText:   { fontSize: 14, fontWeight: '700' },
  saveBadge:    { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  saveBadgeText:{ fontSize: 10, fontWeight: '800', color: NAVY },

  pmRow:        { flexDirection: 'row', gap: 10, marginBottom: 20 },
  pmBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radius.xl, borderWidth: 1.5 },
  pmFlag:       { fontSize: 18 },
  pmLabel:      { fontSize: 13, fontWeight: '700' },

  card:         { borderRadius: Radius.xl + 4, borderWidth: 1.5, padding: 20, marginBottom: 16, overflow: 'visible' },
  cardPro:      { borderWidth: 2, ...Shadow.md },
  cardHead:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  planName:     { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  planDesc:     { fontSize: 12, fontWeight: '500' },
  planPrice:    { fontSize: 17, fontWeight: '800' },
  yearlyChip:   { marginTop: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  yearlyChipText: { fontSize: 11, fontWeight: '700' },
  popularBadge: { position: 'absolute', top: -12, alignSelf: 'center', backgroundColor: TEAL, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 14, zIndex: 1 },
  popularText:  { color: NAVY, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },

  features:     { gap: 10, marginBottom: 20 },
  featureRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText:  { fontSize: 14, fontWeight: '500', flex: 1 },

  ctaSolid:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14 },
  ctaSolidText: { fontSize: 15, fontWeight: '700' },
  ctaOutline:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14, borderWidth: 1.5 },
  ctaOutlineText: { fontSize: 15, fontWeight: '700' },
  activeBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14, borderWidth: 1.5 },
  activeBtnText:{ fontSize: 15, fontWeight: '700' },

  trust:        { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingTop: 8 },
  trustItem:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustText:    { fontSize: 12 },
});
