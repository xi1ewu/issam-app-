import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WorldMapSVG } from '../../components/ui/WorldMapSVG';

const { width: W, height: H } = Dimensions.get('window');
const DARK_NAV = '#0A1628';
const TEAL = '#00D598';

interface Props {
  onGetStarted: () => void;
  onSignIn: () => void;
}

const STATS = [
  { value: '300+', label: 'Companies' },
  { value: '50+', label: 'Experts' },
  { value: '98%', label: 'Satisfaction' },
];

const FEATURES = [
  { icon: 'briefcase-outline' as const, text: 'Expert-led consultations tailored for Algeria' },
  { icon: 'bar-chart-outline' as const, text: 'Real-time market data & economic reports' },
  { icon: 'shield-checkmark-outline' as const, text: 'Verified consultants, secure payments' },
];

export const GetStartedScreen: React.FC<Props> = ({ onGetStarted, onSignIn }) => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(36)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 9 }),
    ]).start();
  }, []);

  return (
    <View style={s.root}>
      {/* Map background */}
      <WorldMapSVG
        width={W}
        height={H * 0.52}
        dotColor="rgba(0,213,152,0.28)"
        lineColor="rgba(0,213,152,0.10)"
        dotRadius={1.6}
        style={StyleSheet.absoluteFill}
      />

      {/* Brand */}
      <Animated.View
        style={[s.brandWrap, { paddingTop: insets.top + 32 }, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        <Text style={s.brand}>WHEELWORLD</Text>
        <Text style={s.brandSub}>CONSULTING</Text>

        {/* Trust badge */}
        <View style={s.badge}>
          <View style={s.badgeDots}>
            {[TEAL + 'CC', TEAL + '99', TEAL + '66'].map((c, i) => (
              <View key={i} style={[s.badgeDot, { backgroundColor: c, marginLeft: i > 0 ? -6 : 0 }]} />
            ))}
          </View>
          <Text style={s.badgeText}>Trusted by 300+ Companies</Text>
        </View>
      </Animated.View>

      {/* Card */}
      <Animated.View
        style={[s.card, { paddingBottom: insets.bottom + 20 }, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        {/* Headline */}
        <Text style={s.headline}>
          Consulting{'\n'}<Text style={s.teal}>Excellence</Text>
        </Text>
        <Text style={s.tagline}>
          Strategic insights & expert consultations{'\n'}for the Algerian market.
        </Text>

        {/* Features */}
        <View style={s.featuresList}>
          {FEATURES.map((f, i) => (
            <View key={i} style={s.featureRow}>
              <View style={s.featureIcon}>
                <Ionicons name={f.icon} size={16} color={TEAL} />
              </View>
              <Text style={s.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          {STATS.map((stat, i) => (
            <React.Fragment key={stat.value}>
              {i > 0 && <View style={s.statDivider} />}
              <View style={s.stat}>
                <Text style={s.statVal}>{stat.value}</Text>
                <Text style={s.statLabel}>{stat.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* CTAs */}
        <TouchableOpacity style={s.primaryBtn} onPress={onGetStarted} activeOpacity={0.85}>
          <Text style={s.primaryBtnText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={18} color={DARK_NAV} />
        </TouchableOpacity>

        <TouchableOpacity style={s.secondaryBtn} onPress={onSignIn} activeOpacity={0.85}>
          <Text style={s.secondaryBtnText}>Sign In</Text>
        </TouchableOpacity>

        <Text style={s.terms}>
          By continuing, you agree to our{' '}
          <Text style={{ color: TEAL }}>Terms & Conditions</Text>
          {' & '}
          <Text style={{ color: TEAL }}>Privacy Policy</Text>
        </Text>
      </Animated.View>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK_NAV },

  brandWrap: { alignItems: 'center', paddingBottom: 12 },
  brand: { fontSize: 30, fontWeight: '900', color: TEAL, letterSpacing: 4 },
  brandSub: { fontSize: 12, fontWeight: '300', color: 'rgba(255,255,255,0.65)', letterSpacing: 6, marginTop: 2 },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  badgeDots: { flexDirection: 'row' },
  badgeDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: DARK_NAV },
  badgeText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },

  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 0,
  },

  headline: { fontSize: 34, fontWeight: '800', color: '#1A2332', lineHeight: 42, marginBottom: 8 },
  teal: { color: TEAL },
  tagline: { fontSize: 14, color: '#6B7A8D', lineHeight: 22, marginBottom: 16 },

  featuresList: { gap: 10, marginBottom: 18 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureIcon: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: TEAL + '18', alignItems: 'center', justifyContent: 'center',
  },
  featureText: { flex: 1, fontSize: 13, color: '#4A5568', lineHeight: 18 },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, marginBottom: 18,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: '#E0E7EF' },
  statVal: { fontSize: 20, fontWeight: '800', color: TEAL, marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#8899AA', fontWeight: '500' },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: TEAL, borderRadius: 14, height: 54,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
    marginBottom: 10,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: DARK_NAV },
  secondaryBtn: {
    alignItems: 'center', justifyContent: 'center', height: 50,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#D1D9E0', marginBottom: 12,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: '#1A2332' },
  terms: { fontSize: 11, color: '#B0BAC9', textAlign: 'center', lineHeight: 18 },
});
