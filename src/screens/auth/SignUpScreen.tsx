import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WorldMapSVG } from '../../components/ui/WorldMapSVG';
import { authAPI, usersAPI, authPhoneAPI } from '../../services/api';
import { User } from '../../types';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const { width: W, height: H } = Dimensions.get('window');
const DARK_NAV = '#0A1628';
const TEAL = '#00D598';

const CONSULTING_TYPES = [
  { id: 'strategy', label: 'Strategy', desc: 'Business growth & market entry', icon: 'trending-up-outline' as const, color: '#6366F1' },
  { id: 'finance', label: 'Finance', desc: 'Banking, fintech & investment', icon: 'cash-outline' as const, color: '#8B5CF6' },
  { id: 'economy', label: 'Economy', desc: 'GDP, trade & market data', icon: 'bar-chart-outline' as const, color: '#3B82F6' },
  { id: 'energy', label: 'Energy', desc: 'Oil, gas & renewables', icon: 'flash-outline' as const, color: '#10B981' },
  { id: 'legal', label: 'Legal', desc: 'Compliance & corporate law', icon: 'shield-checkmark-outline' as const, color: '#F59E0B' },
  { id: 'digital', label: 'Digital', desc: 'Tech transformation', icon: 'laptop-outline' as const, color: '#EF4444' },
];

const RECOMMENDED_REGION = { id: 'dz', name: 'Algeria', flag: '🇩🇿', badge: 'Primary Market' };
const OTHER_REGIONS = [
  { id: 'tn', name: 'Tunisia', flag: '🇹🇳' },
  { id: 'ma', name: 'Morocco', flag: '🇲🇦' },
  { id: 'ly', name: 'Libya', flag: '🇱🇾' },
  { id: 'eg', name: 'Egypt', flag: '🇪🇬' },
  { id: 'fr', name: 'France', flag: '🇫🇷' },
  { id: 'ae', name: 'UAE', flag: '🇦🇪' },
  { id: 'sa', name: 'Saudi Arabia', flag: '🇸🇦' },
  { id: 'gb', name: 'United Kingdom', flag: '🇬🇧' },
];

const COMPANY_TYPES = ['SARL', 'EURL', 'SPA', 'SNC', 'SCS', 'EPIC', 'EP', 'Association'];

interface Props {
  onSignUp: (user: User) => void;
  onSignIn: () => void;
  onBack?: () => void;
}

export const SignUpScreen: React.FC<Props> = ({ onSignUp, onSignIn }) => {
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Step 2
  const [userType, setUserType] = useState<'individual' | 'company'>('individual');

  // Step 3
  const [companyType, setCompanyType] = useState('SARL');
  const [companyName, setCompanyName] = useState('');
  const [nif, setNif] = useState('');
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);

  // Step 4
  const [interests, setInterests] = useState<string[]>([]);

  // Step 5
  const [selectedRegions, setSelectedRegions] = useState<string[]>(['dz']);
  const [regionSearch, setRegionSearch] = useState('');

  // Step 6 – OTP verification
  const OTP_LEN = 4;
  const [otp, setOtp] = useState<string[]>(Array(OTP_LEN).fill(''));
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const otpInputs = useRef<(any)[]>([]);

  // Step 7
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Card animation per step
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId:     process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID   || undefined,
    iosClientId:     process.env.EXPO_PUBLIC_GOOGLE_IOS_ID      || undefined,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_ID  || undefined,
  });

  useEffect(() => {
    slideAnim.setValue(60);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [step]);

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        fetchGoogleUserInfo(authentication.accessToken);
      }
    }
  }, [response]);

  const fetchGoogleUserInfo = async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userObj = await res.json();
      const result = await authAPI.socialLogin({
        provider: 'google',
        providerId: userObj.id,
        email: userObj.email,
        name: userObj.name,
        avatar: userObj.picture,
        role: 'USER',
      });
      onSignUp(result.user as User);
    } catch (e: any) {
      Alert.alert('Google Sign-Up Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  // Visual progress: individual skips step 3; step 7 is finish (no dots)
  const totalVisual = userType === 'company' ? 7 : 6;
  const visualStep = userType === 'company' ? step : step > 2 ? step - 1 : step;

  // Auto-send OTP when entering step 6
  useEffect(() => {
    if (step !== 6) return;
    sendOtpForSignup();
  }, [step]);

  // OTP resend countdown
  useEffect(() => {
    if (otpCountdown <= 0) return;
    const t = setInterval(() => setOtpCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [otpCountdown]);

  const sendOtpForSignup = async () => {
    if (!phone.trim()) return;
    setOtpSending(true);
    try {
      await authPhoneAPI.sendOtpAnon(`+213${phone.trim()}`);
      setOtpCountdown(60);
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.toLowerCase().includes('too many') || msg.toLowerCase().includes('hour')) {
        Alert.alert('Rate limit', 'Too many OTP requests. Please wait an hour and try again.');
        setOtpCountdown(3600);
      } else {
        Alert.alert('Error', msg || 'Failed to send verification code.');
      }
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOtpForSignup = async () => {
    const code = otp.join('');
    if (code.length < OTP_LEN) { Alert.alert('Incomplete', `Enter all ${OTP_LEN} digits.`); return; }
    setOtpVerifying(true);
    try {
      await authPhoneAPI.verifyOtpAnon(`+213${phone.trim()}`, code);
      setOtpVerified(true);
      setStep(7);
    } catch (err: any) {
      Alert.alert('Invalid Code', err?.message || 'The code is incorrect or expired.');
      setOtp(Array(OTP_LEN).fill(''));
      otpInputs.current[0]?.focus();
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (value.length === OTP_LEN) {
      const digits = value.replace(/\D/g, '').slice(0, OTP_LEN).split('');
      if (digits.length === OTP_LEN) { setOtp(digits); otpInputs.current[OTP_LEN - 1]?.focus(); return; }
    }
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp]; next[index] = digit; setOtp(next);
    if (digit && index < OTP_LEN - 1) otpInputs.current[index + 1]?.focus();
  };

  const handleOtpKey = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      const next = [...otp]; next[index - 1] = ''; setOtp(next);
      otpInputs.current[index - 1]?.focus();
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (name.trim().length < 2) { Alert.alert('Name Required', 'Enter your full name (min 2 characters).'); return; }
      if (!phone.trim() || phone.trim().length < 8) { Alert.alert('Phone Required', 'Enter a valid phone number.'); return; }
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) { Alert.alert('Invalid Email', 'Enter a valid email address.'); return; }
      if (password.length < 6) { Alert.alert('Password Too Short', 'Password must be at least 6 characters.'); return; }
      if (password !== confirmPassword) { Alert.alert('Passwords Mismatch', 'Both passwords must match.'); return; }
      setStep(2); return;
    }
    if (step === 2) { setStep(userType === 'company' ? 3 : 4); return; }
    if (step === 3) { setStep(4); return; }
    if (step === 4) {
      if (interests.length === 0) { Alert.alert('Select at least one area', 'Choose a consulting area to continue.'); return; }
      setStep(5); return;
    }
    if (step === 5) { setStep(6); return; }
  };

  const prevStep = () => {
    if (step === 4 && userType === 'individual') { setStep(2); return; }
    if (step > 1) setStep(s => s - 1);
  };

  const toggleInterest = (id: string) =>
    setInterests(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const toggleRegion = (id: string) => {
    if (id === 'dz') return;
    setSelectedRegions(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const handleSocialLogin = async (provider: 'google' | 'linkedin') => {
    if (provider === 'google') {
      const neededId =
        Platform.OS === 'android'
          ? process.env.EXPO_PUBLIC_GOOGLE_ANDROID_ID
          : Platform.OS === 'ios'
          ? process.env.EXPO_PUBLIC_GOOGLE_IOS_ID
          : process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

      if (!neededId) {
        Alert.alert(
          'Google Sign-Up not configured',
          `Add EXPO_PUBLIC_GOOGLE_${Platform.OS.toUpperCase()}_ID to your .env file.\n\n` +
          `Create an "${Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : 'Web'}" OAuth 2.0 client at console.cloud.google.com → APIs & Services → Credentials, then restart Expo.`
        );
        return;
      }
      promptAsync();
      return;
    }

    setLoading(true);
    try {
      const result = await authAPI.socialLogin({
        provider,
        providerId: `${provider}_user_123`,
        email: `user@${provider}.com`,
        name: `LinkedIn User`,
        role: 'USER',
      });
      onSignUp(result.user as User);
    } catch (err: any) {
      Alert.alert(`${provider} Sign Up Failed`, err?.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  // Registration (runs when step becomes 7)
  useEffect(() => {
    if (step !== 7) return;
    Animated.timing(progressAnim, { toValue: 1, duration: 2400, useNativeDriver: false }).start();
    const run = async () => {
      try {
        const result = await authAPI.signUp({
          email: email.trim(),
          password,
          name: name.trim(),
          role: 'USER',
          ...(phone.trim() ? { phone: `+213${phone.trim()}`, phoneVerified: otpVerified } : {}),
        });
        // Save extra profile fields that aren't in the register payload
        try {
          await usersAPI.updateProfile({
            location: 'Algeria',
            ...(userType === 'company' && companyName.trim() ? { company: companyName.trim() } : {}),
          });
        } catch { /* non-critical */ }
        setTimeout(() => onSignUp(result.user as User), 2600);
      } catch (err: any) {
        progressAnim.setValue(0);
        Alert.alert('Registration Failed', err?.message ?? 'Please try again.', [
          { text: 'OK', onPress: () => setStep(1) },
        ]);
      }
    };
    run();
  }, [step]);

  const filteredOther = OTHER_REGIONS.filter(r =>
    r.name.toLowerCase().includes(regionSearch.toLowerCase())
  );

  // ── Step 7: Full-screen finalizing ─────────────────────────────────────────
  if (step === 7) {
    const barW = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
    return (
      <View style={[s.root, { backgroundColor: DARK_NAV }]}>
        <WorldMapSVG width={W} height={H * 0.48} dotColor="rgba(0,213,152,0.22)" lineColor="rgba(0,213,152,0.10)" dotRadius={1.5} style={StyleSheet.absoluteFill} />
        <View style={s.finCard}>
          <View style={s.finGlobe}>
            <Ionicons name="globe-outline" size={48} color={TEAL} />
          </View>
          <Text style={s.finTitle}>Finalizing Your{'\n'}<Text style={s.teal}>Strategic Space</Text></Text>
          <Text style={s.finSub}>We're preparing your personalized dashboard{'\n'}with Algerian market insights.</Text>
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressBar, { width: barW as any }]} />
          </View>
          <Text style={s.initText}>INITIALIZING ...</Text>
        </View>
      </View>
    );
  }

  // ── Steps 1–5: Hero + Card ─────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: DARK_NAV }]}>
      {/* Hero */}
      <View style={[s.hero, { paddingTop: insets.top + 6 }]}>
        <WorldMapSVG width={W} height={H * 0.33} dotColor="rgba(0,213,152,0.28)" lineColor="rgba(0,213,152,0.11)" dotRadius={1.4} style={StyleSheet.absoluteFill} />
        <Text style={s.brand}>WHEELWORLD</Text>
        <Text style={s.brandSub}>CONSULTING</Text>
      </View>

      {/* Back button */}
      {step > 1 && (
        <Pressable style={[s.backBtn, { top: insets.top + 8 }]} onPress={prevStep}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
      )}

      {/* Card */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View style={[s.card, { paddingBottom: insets.bottom + 12, transform: [{ translateY: slideAnim }], opacity: fadeAnim }]}>
          {/* Progress dots */}
          <View style={s.dotsRow}>
            {Array.from({ length: totalVisual }).map((_, i) => (
              <View key={i} style={[s.dot, i < visualStep && s.dotActive]} />
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.cardContent}>

            {/* ─── Step 1 ─── */}
            {step === 1 && <>
              <Text style={s.title}>Lets Get <Text style={s.teal}>Started</Text></Text>

              <Text style={s.label}>Username</Text>
              <TextInput style={s.input} placeholder="Your full name" placeholderTextColor="#B0BAC9" value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="next" />

              <Text style={s.label}>Phone Number</Text>
              <View style={s.phoneRow}>
                <View style={s.phonePrefix}><Text style={s.phonePre}>🇩🇿 +213</Text></View>
                <TextInput style={[s.input, s.phoneInput]} placeholder="771 19 03 84" placeholderTextColor="#B0BAC9" value={phone} onChangeText={setPhone} keyboardType="phone-pad" returnKeyType="next" />
              </View>

              <Text style={s.label}>Email Address</Text>
              <TextInput style={s.input} placeholder="you@company.com" placeholderTextColor="#B0BAC9" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" returnKeyType="next" />

              <Text style={s.label}>Password</Text>
              <View style={s.passWrap}>
                <TextInput style={[s.input, s.passInput]} placeholder="Create a strong password" placeholderTextColor="#B0BAC9" value={password} onChangeText={setPassword} secureTextEntry={!showPass} returnKeyType="next" />
                <Pressable style={s.eye} onPress={() => setShowPass(v => !v)}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#8899AA" />
                </Pressable>
              </View>

              <Text style={s.label}>Confirm Password</Text>
              <View style={s.passWrap}>
                <TextInput style={[s.input, s.passInput]} placeholder="Repeat your password" placeholderTextColor="#B0BAC9" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirm} returnKeyType="done" />
                <Pressable style={s.eye} onPress={() => setShowConfirm(v => !v)}>
                  <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#8899AA" />
                </Pressable>
              </View>

              <TouchableOpacity style={s.btn} onPress={nextStep} activeOpacity={0.85}>
                <Text style={s.btnText}>Continue</Text><Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
              <View style={s.socialRow}>
                <TouchableOpacity style={s.socialBtn} activeOpacity={0.8} onPress={() => handleSocialLogin('google')}>
                  <Ionicons name="logo-google" size={18} color="#EA4335" />
                  <Text style={s.socialBtnText}>Google</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.socialBtn} activeOpacity={0.8} onPress={() => handleSocialLogin('linkedin')}>
                  <Ionicons name="logo-linkedin" size={18} color="#0A66C2" />
                  <Text style={s.socialBtnText}>LinkedIn</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.loginRow}>Already have an account? <Text style={s.loginLink} onPress={onSignIn}>Login</Text></Text>
              <Text style={s.terms}>Terms & Conditions · Privacy Policy</Text>
            </>}

            {/* ─── Step 2 ─── */}
            {step === 2 && <>
              <Text style={s.title}>Who Are <Text style={s.teal}>you?</Text></Text>
              {([
                { id: 'individual' as const, label: 'Individual', desc: 'Looking for consultants, freelancers, or students looking for strategic insights.', icon: 'person-outline' as const },
                { id: 'company' as const, label: 'Company', desc: 'For registered businesses seeking market data and corporate solutions.', icon: 'business-outline' as const },
              ]).map(opt => {
                const active = userType === opt.id;
                return (
                  <Pressable key={opt.id} style={[s.typeCard, active && s.typeCardOn]} onPress={() => setUserType(opt.id)}>
                    <View style={[s.typeIcon, active && s.typeIconOn]}>
                      <Ionicons name={opt.icon} size={22} color={active ? TEAL : '#8899AA'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.typeLabel, active && { color: TEAL }]}>{opt.label}</Text>
                      <Text style={s.typeDesc}>{opt.desc}</Text>
                    </View>
                    <View style={[s.radio, active && s.radioOn]}>{active && <View style={s.radioDot} />}</View>
                  </Pressable>
                );
              })}
              <TouchableOpacity style={s.btn} onPress={nextStep} activeOpacity={0.85}>
                <Text style={s.btnText}>Continue</Text><Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
              <Text style={s.terms}>Terms & Conditions · Privacy Policy</Text>
            </>}

            {/* ─── Step 3 (company only) ─── */}
            {step === 3 && <>
              <Text style={s.title}>Company <Text style={s.teal}>Details</Text></Text>

              <Text style={s.label}>Company type</Text>
              <Pressable style={[s.input, s.dropdown]} onPress={() => setShowCompanyPicker(v => !v)}>
                <Text style={s.dropdownVal}>{companyType || 'e.g. SARL'}</Text>
                <Ionicons name={showCompanyPicker ? 'chevron-up' : 'chevron-down'} size={18} color="#8899AA" />
              </Pressable>
              {showCompanyPicker && (
                <View style={s.pickerList}>
                  {COMPANY_TYPES.map(ct => (
                    <Pressable key={ct} style={[s.pickerItem, companyType === ct && s.pickerItemOn]} onPress={() => { setCompanyType(ct); setShowCompanyPicker(false); }}>
                      <Text style={[s.pickerText, companyType === ct && { color: TEAL }]}>{ct}</Text>
                      {companyType === ct && <Ionicons name="checkmark" size={16} color={TEAL} />}
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={s.label}>Company Name</Text>
              <TextInput style={s.input} placeholder="Your company name" placeholderTextColor="#B0BAC9" value={companyName} onChangeText={setCompanyName} returnKeyType="next" />

              <Text style={s.label}>NIF (Numéro d'Identification Fiscale)</Text>
              <TextInput style={s.input} placeholder="000 000 000 000 000" placeholderTextColor="#B0BAC9" value={nif} onChangeText={setNif} keyboardType="number-pad" returnKeyType="done" />

              <TouchableOpacity style={s.btn} onPress={nextStep} activeOpacity={0.85}>
                <Text style={s.btnText}>Continue</Text><Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
              <Text style={s.terms}>Terms & Conditions · Privacy Policy</Text>
            </>}

            {/* ─── Step 4 ─── */}
            {step === 4 && <>
              <Text style={s.title}>What Type of{'\n'}<Text style={s.teal}>Consulting</Text> you need?</Text>
              <View style={s.grid}>
                {CONSULTING_TYPES.map(cat => {
                  const on = interests.includes(cat.id);
                  return (
                    <Pressable key={cat.id} style={[s.catCard, on && s.catCardOn]} onPress={() => toggleInterest(cat.id)}>
                      <View style={[s.catIcon, { backgroundColor: on ? TEAL + '22' : cat.color + '1A' }]}>
                        <Ionicons name={cat.icon} size={22} color={on ? TEAL : cat.color} />
                      </View>
                      <Text style={[s.catLabel, on && { color: TEAL }]}>{cat.label}</Text>
                      <Text style={s.catDesc} numberOfLines={2}>{cat.desc}</Text>
                      {on && <View style={s.catCheck}><Ionicons name="checkmark" size={11} color="#fff" /></View>}
                    </Pressable>
                  );
                })}
              </View>
              <TouchableOpacity style={s.btn} onPress={nextStep} activeOpacity={0.85}>
                <Text style={s.btnText}>Continue</Text><Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
              <Text style={s.terms}>Terms & Conditions · Privacy Policy</Text>
            </>}

            {/* ─── Step 5 ─── */}
            {step === 5 && <>
              <Text style={s.title}>Regional <Text style={s.teal}>Localization</Text></Text>
              <View style={s.regionSearchBar}>
                <Ionicons name="search-outline" size={17} color="#8899AA" />
                <TextInput style={s.regionSearchInput} placeholder="Search, region or country" placeholderTextColor="#B0BAC9" value={regionSearch} onChangeText={setRegionSearch} />
              </View>

              {!regionSearch && <>
                <Text style={s.regionHead}>Recommended</Text>
                <View style={[s.regionRow, s.regionRowSelected]}>
                  <Text style={s.flag}>{RECOMMENDED_REGION.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.regionName}>{RECOMMENDED_REGION.name}</Text>
                    <Text style={s.regionBadge}>{RECOMMENDED_REGION.badge}</Text>
                  </View>
                  <View style={s.greenDot} />
                </View>
                <Text style={s.regionHead}>Other Regions</Text>
              </>}

              {filteredOther.map(r => {
                const on = selectedRegions.includes(r.id);
                return (
                  <Pressable key={r.id} style={[s.regionRow, on && s.regionRowActive]} onPress={() => toggleRegion(r.id)}>
                    <Text style={s.flag}>{r.flag}</Text>
                    <Text style={[s.regionName, { flex: 1 }]}>{r.name}</Text>
                    <View style={[s.checkCircle, on && s.checkCircleOn]}>
                      {on && <Ionicons name="checkmark" size={12} color="#fff" />}
                    </View>
                  </Pressable>
                );
              })}

              <TouchableOpacity style={[s.btn, { marginTop: 20 }]} onPress={nextStep} activeOpacity={0.85}>
                <Text style={s.btnText}>Continue</Text><Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
              <Text style={s.terms}>Terms & Conditions · Privacy Policy</Text>
            </>}

            {/* ─── Step 6: OTP verification ─── */}
            {step === 6 && <>
              <Text style={s.title}>Verify your <Text style={s.teal}>Number</Text></Text>
              <Text style={[s.label, { color: '#8899AA', fontWeight: '400', marginBottom: 24, lineHeight: 20 }]}>
                We sent a {OTP_LEN}-digit code to{'\n'}
                <Text style={{ fontWeight: '700', color: '#1A2332' }}>+213 {phone.trim()}</Text>
              </Text>

              {/* OTP boxes */}
              <View style={s.otpRow}>
                {Array(OTP_LEN).fill(null).map((_, i) => (
                  <TextInput
                    key={i}
                    ref={(r: any) => { otpInputs.current[i] = r; }}
                    style={[s.otpBox, otp[i] ? s.otpBoxFilled : null]}
                    value={otp[i]}
                    onChangeText={v => handleOtpChange(v, i)}
                    onKeyPress={e => handleOtpKey(e, i)}
                    keyboardType="number-pad"
                    maxLength={OTP_LEN}
                    selectTextOnFocus
                    textContentType="oneTimeCode"
                    autoComplete="sms-otp"
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[s.btn, { marginTop: 8, opacity: otp.every(d => d) && !otpVerifying ? 1 : 0.45 }]}
                onPress={verifyOtpForSignup}
                disabled={!otp.every(d => d) || otpVerifying}
                activeOpacity={0.85}
              >
                {otpVerifying
                  ? <ActivityIndicator color="#fff" />
                  : <><Text style={s.btnText}>Verify &amp; Continue</Text><Ionicons name="checkmark" size={18} color="#fff" /></>
                }
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 14 }}>
                <Text style={[s.label, { color: '#8899AA', fontWeight: '400' }]}>Didn't receive it? </Text>
                {otpCountdown > 0
                  ? <Text style={[s.label, { color: '#B0BAC9' }]}>Resend in {otpCountdown}s</Text>
                  : <TouchableOpacity onPress={sendOtpForSignup} disabled={otpSending}>
                      {otpSending
                        ? <ActivityIndicator size="small" color={TEAL} />
                        : <Text style={[s.label, { color: TEAL, fontWeight: '700' }]}>Resend code</Text>
                      }
                    </TouchableOpacity>
                }
              </View>
              <Text style={s.terms}>Terms & Conditions · Privacy Policy</Text>
            </>}

          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  hero: {
    height: H * 0.33,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 18,
    overflow: 'hidden',
  },
  brand: { fontSize: 26, fontWeight: '900', color: TEAL, letterSpacing: 4 },
  brandSub: { fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.65)', letterSpacing: 6, marginTop: 2 },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
  },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E0E7EF' },
  dotActive: { backgroundColor: TEAL, width: 20 },

  cardContent: { paddingHorizontal: 22, paddingBottom: 24 },
  title: { fontSize: 22, fontWeight: '800', color: '#1A2332', marginBottom: 18, lineHeight: 32 },
  teal: { color: TEAL },
  label: { fontSize: 13, fontWeight: '600', color: '#4A5568', marginBottom: 5 },
  input: {
    borderWidth: 1, borderColor: '#D1D9E0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#1A2332', backgroundColor: '#F9FAFB', marginBottom: 12,
  },

  phoneRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  phonePrefix: {
    borderWidth: 1, borderColor: '#D1D9E0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: '#F9FAFB', justifyContent: 'center',
  },
  phonePre: { fontSize: 13, fontWeight: '600', color: '#1A2332' },
  phoneInput: { flex: 1, marginBottom: 0 },

  passWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#D1D9E0', borderRadius: 10,
    backgroundColor: '#F9FAFB', marginBottom: 12, paddingRight: 4,
  },
  passInput: { flex: 1, marginBottom: 0, borderWidth: 0 },
  eye: { padding: 10 },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: TEAL, borderRadius: 12, paddingVertical: 15, marginTop: 6,
  },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  loginRow: { fontSize: 13, color: '#8899AA', textAlign: 'center', marginTop: 14 },
  loginLink: { color: TEAL, fontWeight: '700' },
  terms: { fontSize: 11, color: '#B0BAC9', textAlign: 'center', marginTop: 10 },

  socialRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  socialBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: '#D1D9E0', backgroundColor: '#fff',
  },
  socialBtnText: { fontSize: 14, fontWeight: '600', color: '#1A2332' },

  // Step 2
  typeCard: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E0E7EF', borderRadius: 14,
    padding: 14, marginBottom: 12, gap: 12, backgroundColor: '#F9FAFB',
  },
  typeCardOn: { borderColor: TEAL, backgroundColor: '#F0FDF8' },
  typeIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  typeIconOn: { backgroundColor: TEAL + '20' },
  typeLabel: { fontSize: 15, fontWeight: '700', color: '#1A2332', marginBottom: 2 },
  typeDesc: { fontSize: 12, color: '#8899AA', lineHeight: 17 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D9E0', alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: TEAL },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: TEAL },

  // Step 3
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownVal: { fontSize: 14, color: '#1A2332' },
  pickerList: {
    borderWidth: 1, borderColor: '#D1D9E0', borderRadius: 12,
    backgroundColor: '#fff', marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 6,
  },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F4F8' },
  pickerItemOn: { backgroundColor: '#F0FDF8' },
  pickerText: { fontSize: 14, color: '#1A2332' },

  // Step 4
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  catCard: {
    width: '47%', borderWidth: 1.5, borderColor: '#E0E7EF',
    borderRadius: 14, padding: 13, backgroundColor: '#F9FAFB', position: 'relative',
  },
  catCardOn: { borderColor: TEAL, backgroundColor: '#F0FDF8' },
  catIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  catLabel: { fontSize: 13, fontWeight: '700', color: '#1A2332', marginBottom: 2 },
  catDesc: { fontSize: 11, color: '#8899AA', lineHeight: 15 },
  catCheck: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' },

  // Step 5
  regionSearchBar: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#D1D9E0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, backgroundColor: '#F9FAFB', gap: 8, marginBottom: 14,
  },
  regionSearchInput: { flex: 1, fontSize: 14, color: '#1A2332' },
  regionHead: { fontSize: 12, fontWeight: '700', color: '#8899AA', letterSpacing: 0.4, marginBottom: 8, marginTop: 2 },
  regionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#E0E7EF', marginBottom: 8, backgroundColor: '#F9FAFB', gap: 12,
  },
  regionRowSelected: { borderColor: TEAL, backgroundColor: '#F0FDF8' },
  regionRowActive: { borderColor: TEAL + '70', backgroundColor: '#F8FFFC' },
  flag: { fontSize: 22 },
  regionName: { fontSize: 14, fontWeight: '600', color: '#1A2332' },
  regionBadge: { fontSize: 11, color: TEAL, fontWeight: '600', marginTop: 1 },
  greenDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: TEAL },
  checkCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#D1D9E0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkCircleOn: { backgroundColor: TEAL, borderColor: TEAL },

  // Step 6
  finCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0, top: H * 0.24,
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 6,
  },
  finGlobe: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: TEAL + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  finTitle: { fontSize: 24, fontWeight: '800', color: '#1A2332', textAlign: 'center', lineHeight: 34 },
  finSub: { fontSize: 14, color: '#8899AA', textAlign: 'center', lineHeight: 22, marginVertical: 6 },
  progressTrack: { width: '80%', height: 6, borderRadius: 3, backgroundColor: '#E0E7EF', overflow: 'hidden', marginTop: 10 },
  progressBar: { height: '100%', backgroundColor: TEAL, borderRadius: 3 },
  initText: { fontSize: 11, fontWeight: '700', color: '#B0BAC9', letterSpacing: 2, marginTop: 10 },

  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 24 },
  otpBox: {
    width: 58, height: 64, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#D1D9E0',
    textAlign: 'center', fontSize: 26, fontWeight: '800', color: '#1A2332',
    backgroundColor: '#F9FAFB',
  },
  otpBoxFilled: { borderColor: TEAL, backgroundColor: TEAL + '12' },
});
