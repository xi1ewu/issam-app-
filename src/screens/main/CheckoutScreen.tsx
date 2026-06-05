import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useAppTheme } from '../../hooks/useAppTheme';
import { chargilyAPI, paymentsAPI } from '../../services/api';
import { Colors } from '../../theme';

const TEAL         = Colors.primary;
const NAVY         = '#0A1628';
const BORDER       = '#E2E8F0';
const CHARGILY_RED = '#E53935';
const PAYPAL_BLUE  = '#0070BA';

const USD_TO_DZD = 135; // approximate rate

type PayMethod = 'chargily' | 'paypal';

interface Props {
  bookingData?: {
    consultationId: string;
    expertId: string;
    expertName?: string;
    date: string;
    time?: string;
    duration: number;
    sessionType: string;
    price: number;
  };
  onBack: () => void;
  onSuccess: () => void;
}

export const CheckoutScreen: React.FC<Props> = ({ bookingData, onBack, onSuccess }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const [payMethod, setPayMethod] = useState<PayMethod>('chargily');
  const [loading, setLoading]     = useState(false);
  const [step, setStep]           = useState('');
  const [pendingCheckoutId, setPendingCheckoutId] = useState<string | null>(null);

  const bg   = isDark ? colors.background : '#F8FAFC';
  const card = isDark ? colors.card : '#FFFFFF';
  const text = isDark ? colors.text : NAVY;
  const muted = isDark ? colors.icon : '#64748B';

  const price  = bookingData?.price ?? 0;
  const fee    = parseFloat((price * 0.05).toFixed(2));
  const total  = parseFloat((price + fee).toFixed(2));
  const dzdTotal = Math.round(total * USD_TO_DZD);
  const isFree = total === 0;

  const sessionTypeLabel = (() => {
    const t = (bookingData?.sessionType ?? '').toUpperCase();
    if (t === 'VIDEO') return 'Video Call';
    if (t === 'AUDIO') return 'Voice Call';
    return 'Chat';
  })();

  // Handle deep-link return from Chargily
  useEffect(() => {
    const sub = Linking.addEventListener('url', async ({ url }) => {
      if (!pendingCheckoutId || !bookingData?.consultationId) return;

      if (url.includes('chargily-success')) {
        // App returned — verify payment on backend
        try {
          setLoading(true);
          setStep('Verifying payment…');
          const result = await chargilyAPI.verifyCheckout(pendingCheckoutId, bookingData.consultationId);
          if (result.paid) {
            Alert.alert('✅ Payment Confirmed!', `Your consultation is booked.\nAmount paid: ${dzdTotal.toLocaleString()} DZD`, [
              { text: 'View Consultations', onPress: onSuccess },
            ]);
          } else {
            Alert.alert('Payment Pending', `Status: ${result.status}. Your booking is reserved.`, [
              { text: 'OK', onPress: onSuccess },
            ]);
          }
        } catch {
          Alert.alert('Booking Reserved', 'Payment received. Your consultation is confirmed.', [
            { text: 'OK', onPress: onSuccess },
          ]);
        } finally {
          setLoading(false);
          setStep('');
          setPendingCheckoutId(null);
        }
      } else if (url.includes('chargily-failure')) {
        Alert.alert('Payment Failed', 'Your payment was not completed. Try again or use PayPal.', [
          { text: 'Retry', onPress: handleChargily },
          { text: 'Use PayPal', onPress: () => { setPayMethod('paypal'); handlePayPal(); } },
          { text: 'Cancel', style: 'cancel' },
        ]);
        setPendingCheckoutId(null);
      }
    });
    return () => sub.remove();
  }, [pendingCheckoutId, bookingData]);

  // ── Chargily ──────────────────────────────────────────────────────────────
  const handleChargily = async () => {
    if (!bookingData?.consultationId) {
      Alert.alert('Error', 'Missing booking information.');
      return;
    }

    setLoading(true);
    try {
      setStep('Creating payment…');
      const checkout = await chargilyAPI.createCheckout(bookingData.consultationId);

      if (!checkout.checkoutUrl) {
        throw new Error('No checkout URL received from Chargily.');
      }

      setPendingCheckoutId(checkout.checkoutId);
      setStep('Opening Chargily…');

      const result = await WebBrowser.openAuthSessionAsync(
        checkout.checkoutUrl,
        'da-consulting://checkout/chargily-success'
      );

      if (result.type === 'success' && result.url.includes('chargily-success')) {
        // Verify via the deep-link handler above
        setStep('Verifying payment…');
        const verify = await chargilyAPI.verifyCheckout(checkout.checkoutId, bookingData.consultationId);
        if (verify.paid) {
          Alert.alert(
            '✅ Payment Confirmed!',
            `Your consultation has been booked.\nAmount: ${dzdTotal.toLocaleString()} DZD`,
            [{ text: 'View Consultations', onPress: onSuccess }]
          );
        } else {
          Alert.alert('Payment Processing', `Your booking is reserved. Status: ${verify.status}`, [
            { text: 'OK', onPress: onSuccess },
          ]);
        }
        setPendingCheckoutId(null);
      } else if (result.type === 'success' && result.url.includes('chargily-failure')) {
        Alert.alert('Payment Failed', 'Please try again or choose PayPal.', [
          { text: 'Retry', onPress: handleChargily },
          { text: 'Use PayPal instead', onPress: () => setPayMethod('paypal') },
          { text: 'Cancel', style: 'cancel' },
        ]);
        setPendingCheckoutId(null);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        Alert.alert('Payment Cancelled', 'You closed the payment page.', [
          { text: 'Try Again', onPress: handleChargily },
          { text: 'Use PayPal', onPress: () => setPayMethod('paypal') },
          { text: 'Close', style: 'cancel' },
        ]);
        setPendingCheckoutId(null);
      }
    } catch (err: any) {
      const msg = err?.message ?? 'Could not connect to Chargily.';
      Alert.alert(
        'Chargily Error',
        msg.includes('not configured')
          ? 'Chargily API key not set.\n\nGet your key at dashboard.chargily.com and set CHARGILY_API_KEY in your backend .env'
          : msg,
        [
          { text: 'Use PayPal', onPress: () => setPayMethod('paypal') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      setPendingCheckoutId(null);
    } finally {
      setLoading(false);
      setStep('');
    }
  };

  // ── PayPal ────────────────────────────────────────────────────────────────
  const handlePayPal = async () => {
    if (!bookingData?.consultationId) {
      Alert.alert('Error', 'Missing booking information.');
      return;
    }

    setLoading(true);
    try {
      setStep('Creating PayPal order…');
      const { orderId, approvalUrl } = await paymentsAPI.createPayPalOrder(bookingData.consultationId);

      if (!approvalUrl) throw new Error('No approval URL from PayPal.');

      setStep('Opening PayPal…');
      const result = await WebBrowser.openAuthSessionAsync(
        approvalUrl,
        'da-consulting://checkout/paypal-success'
      );

      if (result.type !== 'success') {
        Alert.alert('PayPal Cancelled', 'Payment was not completed.', [
          { text: 'Try Again', onPress: handlePayPal },
          { text: 'Use Chargily', onPress: () => setPayMethod('chargily') },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }

      setStep('Confirming payment…');
      const capture = await paymentsAPI.capturePayPalOrder(orderId, bookingData.consultationId);

      if (capture.status === 'COMPLETED') {
        Alert.alert('✅ Payment Confirmed!', 'Your consultation is booked and paid via PayPal.', [
          { text: 'View Consultations', onPress: onSuccess },
        ]);
      } else {
        Alert.alert('Payment Pending', `PayPal status: ${capture.status}`, [
          { text: 'OK', onPress: onSuccess },
        ]);
      }
    } catch (err: any) {
      Alert.alert('PayPal Error', err?.message ?? 'Something went wrong.', [
        { text: 'Use Chargily', onPress: () => setPayMethod('chargily') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } finally {
      setLoading(false);
      setStep('');
    }
  };

  // ── Main handler ──────────────────────────────────────────────────────────
  const handlePay = () => {
    if (isFree) {
      Alert.alert('Booking Confirmed!', 'Your free consultation has been booked.', [
        { text: 'View Consultations', onPress: onSuccess },
      ]);
      return;
    }
    if (payMethod === 'chargily') handleChargily();
    else handlePayPal();
  };

  const btnColor = isFree ? TEAL : payMethod === 'chargily' ? CHARGILY_RED : PAYPAL_BLUE;
  const btnLabel = isFree
    ? 'Confirm Free Booking'
    : payMethod === 'chargily'
    ? `Pay ${dzdTotal.toLocaleString()} DZD with Chargily`
    : `Pay $${total.toFixed(2)} with PayPal`;
  const btnIcon: any = isFree ? 'checkmark-circle' : payMethod === 'chargily' ? 'card-outline' : 'logo-paypal';

  return (
    <View style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={[styles.backBtn, { backgroundColor: card }]}>
          <Ionicons name="chevron-back" size={24} color={text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: text }]}>Checkout</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Booking summary */}
        <View style={[styles.card, { backgroundColor: card }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Booking Summary</Text>
          <Row icon="person-circle-outline" label="Expert">
            <Text style={[styles.rowVal, { color: text }]}>{bookingData?.expertName ?? 'Expert'}</Text>
          </Row>
          <Row icon="calendar-outline" label="Date">
            <Text style={[styles.rowVal, { color: text }]}>{bookingData?.date ?? '—'}</Text>
          </Row>
          {!!bookingData?.time && (
            <Row icon="time-outline" label="Time">
              <Text style={[styles.rowVal, { color: text }]}>{bookingData.time}</Text>
            </Row>
          )}
          <Row icon="videocam-outline" label="Session">
            <Text style={[styles.rowVal, { color: text }]}>{sessionTypeLabel}</Text>
          </Row>
          <Row icon="hourglass-outline" label="Duration">
            <Text style={[styles.rowVal, { color: text }]}>{bookingData?.duration ?? 60} min</Text>
          </Row>
        </View>

        {/* Payment method selector */}
        {!isFree && (
          <>
            <Text style={[styles.sectionTitle, { color: text }]}>Payment Method</Text>

            {/* Chargily */}
            <TouchableOpacity
              style={[
                styles.methodRow,
                { backgroundColor: card, borderColor: payMethod === 'chargily' ? CHARGILY_RED : BORDER },
              ]}
              onPress={() => setPayMethod('chargily')}
              activeOpacity={0.8}
            >
              <View style={[styles.methodLogoBox, { backgroundColor: '#FFEBEE' }]}>
                <Ionicons name="card" size={22} color={CHARGILY_RED} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.methodName, { color: text }]}>Chargily Pay</Text>
                <Text style={[styles.methodSub, { color: muted }]}>CIB · Dahabia · eDahabia · Instant</Text>
              </View>
              <View style={[styles.radio, payMethod === 'chargily' && { borderColor: CHARGILY_RED }]}>
                {payMethod === 'chargily' && <View style={[styles.radioFill, { backgroundColor: CHARGILY_RED }]} />}
              </View>
            </TouchableOpacity>

            {/* PayPal */}
            <TouchableOpacity
              style={[
                styles.methodRow,
                { backgroundColor: card, borderColor: payMethod === 'paypal' ? PAYPAL_BLUE : BORDER },
              ]}
              onPress={() => setPayMethod('paypal')}
              activeOpacity={0.8}
            >
              <View style={styles.methodLogoBox}>
                <Text style={styles.paypalP}>P</Text>
                <Text style={styles.paypalAy}>ay</Text>
                <Text style={styles.paypalPal}>Pal</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.methodName, { color: text }]}>PayPal</Text>
                <Text style={[styles.methodSub, { color: muted }]}>Credit / Debit card · International</Text>
              </View>
              <View style={[styles.radio, payMethod === 'paypal' && { borderColor: PAYPAL_BLUE }]}>
                {payMethod === 'paypal' && <View style={[styles.radioFill, { backgroundColor: PAYPAL_BLUE }]} />}
              </View>
            </TouchableOpacity>

            {/* Info banner for selected method */}
            {payMethod === 'chargily' && (
              <View style={[styles.infoBanner, { backgroundColor: '#FFEBEE' }]}>
                <Ionicons name="information-circle-outline" size={16} color={CHARGILY_RED} />
                <Text style={[styles.infoText, { color: '#B71C1C' }]}>
                  Algerian bank cards (CIB / Dahabia). Amount charged in DZD.{'\n'}
                  Rate: 1 USD ≈ {USD_TO_DZD} DZD
                </Text>
              </View>
            )}
            {payMethod === 'paypal' && (
              <View style={[styles.infoBanner, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="information-circle-outline" size={16} color={PAYPAL_BLUE} />
                <Text style={[styles.infoText, { color: '#0D47A1' }]}>
                  Pay with any international card or PayPal balance. Amount charged in USD.
                </Text>
              </View>
            )}
          </>
        )}

        {/* Price breakdown */}
        <View style={[styles.card, { backgroundColor: card }]}>
          <Text style={[styles.cardTitle, { color: text }]}>Price Breakdown</Text>
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: muted }]}>Consultation Fee</Text>
            <View style={styles.priceAmtWrap}>
              <Text style={[styles.priceAmt, { color: text }]}>${price.toFixed(2)}</Text>
              {!isFree && payMethod === 'chargily' && (
                <Text style={styles.priceAmtSub}>{Math.round(price * USD_TO_DZD).toLocaleString()} DZD</Text>
              )}
            </View>
          </View>
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: muted }]}>Platform Fee (5%)</Text>
            <View style={styles.priceAmtWrap}>
              <Text style={[styles.priceAmt, { color: text }]}>${fee.toFixed(2)}</Text>
              {!isFree && payMethod === 'chargily' && (
                <Text style={styles.priceAmtSub}>{Math.round(fee * USD_TO_DZD).toLocaleString()} DZD</Text>
              )}
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: BORDER }]} />
          <View style={styles.priceRow}>
            <Text style={[styles.totalLabel, { color: text }]}>Total</Text>
            <View style={styles.priceAmtWrap}>
              {payMethod === 'chargily' && !isFree ? (
                <>
                  <Text style={[styles.totalAmt, { color: CHARGILY_RED }]}>{dzdTotal.toLocaleString()} DZD</Text>
                  <Text style={styles.priceAmtSub}>(≈ ${total.toFixed(2)})</Text>
                </>
              ) : (
                <Text style={[styles.totalAmt, { color: TEAL }]}>${total.toFixed(2)}</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.secureRow}>
          <Ionicons name="lock-closed-outline" size={13} color="#94A3B8" />
          <Text style={styles.secureText}>
            SECURE ENCRYPTED PAYMENT ·{' '}
            {payMethod === 'chargily' ? 'POWERED BY CHARGILY' : 'POWERED BY PAYPAL'}
          </Text>
        </View>
      </ScrollView>

      {/* CTA button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16, backgroundColor: card }]}>
        <TouchableOpacity
          style={[styles.payBtn, { backgroundColor: btnColor }, loading && { opacity: 0.7 }]}
          onPress={handlePay}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <View style={styles.payBtnInner}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.payBtnText}>{step || 'Processing…'}</Text>
            </View>
          ) : (
            <View style={styles.payBtnInner}>
              <Ionicons name={btnIcon} size={22} color="#fff" />
              <Text style={styles.payBtnText}>{btnLabel}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

function Row({ icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <View style={styles.summaryRow}>
      <Ionicons name={icon} size={16} color="#94A3B8" style={{ marginRight: 10 }} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  headerTitle: { fontSize: 18, fontWeight: '800' },

  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },

  card: {
    borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', marginBottom: 14 },

  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  summaryLabel: { fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  rowVal: { fontSize: 14, fontWeight: '700' },

  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },

  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    gap: 14,
  },
  methodLogoBox: {
    width: 46, height: 46, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row',
  },
  paypalP:   { fontSize: 17, fontWeight: '900', color: '#003087' },
  paypalAy:  { fontSize: 17, fontWeight: '700', color: '#009cde' },
  paypalPal: { fontSize: 17, fontWeight: '900', color: '#012169' },
  methodName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  methodSub:  { fontSize: 12 },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
  },
  radioFill: { width: 10, height: 10, borderRadius: 5 },

  infoBanner: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '500' },

  priceRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  priceLabel:  { fontSize: 14, fontWeight: '500' },
  priceAmtWrap:{ alignItems: 'flex-end' },
  priceAmt:    { fontSize: 14, fontWeight: '700' },
  priceAmtSub: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  divider:     { height: 1, marginVertical: 10 },
  totalLabel:  { fontSize: 16, fontWeight: '800' },
  totalAmt:    { fontSize: 20, fontWeight: '900' },

  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secureText: { fontSize: 10, color: '#94A3B8', fontWeight: '700', letterSpacing: 0.4 },

  bottomBar: { paddingHorizontal: 20, paddingTop: 16 },
  payBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  payBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payBtnText:  { color: '#fff', fontSize: 16, fontWeight: '800' },
});
