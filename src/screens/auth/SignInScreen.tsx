import React, { useEffect, useRef, useState } from 'react';
import {
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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WorldMapSVG } from '../../components/ui/WorldMapSVG';
import { authAPI } from '../../services/api';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

const { width: W, height: H } = Dimensions.get('window');
const DARK_NAV = '#0A1628';
const TEAL = '#00D598';

interface Props {
  onSignIn: (user: any) => void;
  onSignUp: () => void;
  onBack: () => void;
}

export const SignInScreen: React.FC<Props> = ({ onSignIn, onSignUp, onBack }) => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  const [loginMode, setLoginMode] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});

  const [tempToken, setTempToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');

  // Never pass placeholder strings — undefined tells the library to skip that client
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId:     process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID   || undefined,
    iosClientId:     process.env.EXPO_PUBLIC_GOOGLE_IOS_ID      || undefined,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_ID  || undefined,
  });

  const linkedinRedirectUri = AuthSession.makeRedirectUri();

  const [linkedinRequest, linkedinResponse, linkedinPromptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_LINKEDIN_CLIENT_ID || '',
      scopes: ['openid', 'profile', 'email'],
      redirectUri: linkedinRedirectUri,
      responseType: AuthSession.ResponseType.Code,
    },
    { authorizationEndpoint: 'https://www.linkedin.com/oauth/v2/authorization' }
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 9 }),
    ]).start();
    checkBiometric();
  }, []);

  const checkBiometric = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const enabled = await AsyncStorage.getItem('biometricEnabled');
    if (compatible && enrolled && enabled === 'true') {
      setBiometricAvailable(true);
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('Face ID');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('Touch ID');
      }
    }
  };

  const handleBiometricSignIn = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in with biometrics',
      fallbackLabel: 'Use password instead',
    });
    if (result.success) {
      // Biometric passed — retrieve saved credentials and auto sign in
      const savedEmail = await AsyncStorage.getItem('savedEmail');
      const savedToken = await AsyncStorage.getItem('accessToken');
      if (savedToken) {
        // Token still valid — try to get user from /me endpoint
        setLoading(true);
        try {
          const user = await authAPI.getMe();
          onSignIn(user);
        } catch {
          Alert.alert('Session Expired', 'Please sign in with your phone number and password.');
        } finally {
          setLoading(false);
        }
      } else {
        Alert.alert('Session Expired', 'Please sign in with your phone number and password once to re-enable biometrics.');
      }
    }
  };

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        fetchGoogleUserInfo(authentication.accessToken);
      }
    }
  }, [response]);

  useEffect(() => {
    if (linkedinResponse?.type === 'success') {
      const code = linkedinResponse.params?.code;
      if (code) handleLinkedInCallback(code);
    } else if (linkedinResponse?.type === 'error') {
      Alert.alert('LinkedIn Sign-In Error', linkedinResponse.error?.message || 'Authentication failed');
    }
  }, [linkedinResponse]);

  const handleLinkedInCallback = async (code: string) => {
    setLoading(true);
    try {
      const result = await authAPI.linkedinCallback({ code, redirectUri: linkedinRedirectUri, role: 'USER' });
      onSignIn(result.user);
    } catch (e: any) {
      Alert.alert('LinkedIn Sign-In Error', e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const fetchGoogleUserInfo = async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = await res.json();
      const result = await authAPI.socialLogin({
        provider: 'google',
        providerId: user.id,
        email: user.email,
        name: user.name,
        avatar: user.picture,
        role: 'USER',
      });
      onSignIn(result.user);
    } catch (e: any) {
      Alert.alert('Google Sign-In Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const deriveEmailFromPhone = (raw: string) =>
    `${raw.trim().replace(/^0+/, '')}@wheelworld.dz`;

  const validate = () => {
    const e: typeof errors = {};
    if (loginMode === 'phone') {
      if (!phone.trim() || phone.trim().length < 8) e.identifier = 'Enter a valid phone number';
    } else {
      if (!email.trim() || !email.includes('@')) e.identifier = 'Enter a valid email address';
    }
    if (!password || password.length < 6) e.password = 'Password must be at least 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignIn = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (tempToken) {
        if (twoFactorCode.length < 6) {
          Alert.alert('Error', 'Please enter a valid 6-digit code');
          setLoading(false);
          return;
        }
        const result = await authAPI.twoFactorValidate(tempToken, twoFactorCode);
        onSignIn(result.user);
      } else {
        const loginEmail = loginMode === 'phone'
          ? deriveEmailFromPhone(phone)
          : email.trim();
        const result = await authAPI.signIn(loginEmail, password);
        if (result.require2fa) {
          setTempToken(result.tempToken);
        } else {
          onSignIn(result.user);
        }
      }
    } catch (err: any) {
      Alert.alert('Sign In Failed', err?.message ?? 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'linkedin') => {
    if (provider === 'google') {
      // Each platform needs its own client ID — using the wrong one or a dummy
      // string triggers Google's "invalid_request" 400 error.
      const neededId =
        Platform.OS === 'android'
          ? process.env.EXPO_PUBLIC_GOOGLE_ANDROID_ID
          : Platform.OS === 'ios'
          ? process.env.EXPO_PUBLIC_GOOGLE_IOS_ID
          : process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

      if (!neededId) {
        const platformLabel =
          Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'iOS' : 'Web';
        Alert.alert(
          'Google Sign-In not configured',
          `Add EXPO_PUBLIC_GOOGLE_${Platform.OS.toUpperCase()}_ID to your .env file.\n\n` +
          `Create a "${platformLabel}" OAuth 2.0 client at console.cloud.google.com → APIs & Services → Credentials, then restart Expo.`
        );
        return;
      }
      promptAsync();
      return;
    }

    // LinkedIn — real OAuth via server-side code exchange
    if (!process.env.EXPO_PUBLIC_LINKEDIN_CLIENT_ID) {
      Alert.alert('LinkedIn not configured', 'Add EXPO_PUBLIC_LINKEDIN_CLIENT_ID to your .env to enable LinkedIn login.');
      return;
    }
    linkedinPromptAsync();
  };

  return (
    <View style={s.root}>
      {/* Map background — top half */}
      <WorldMapSVG
        width={W}
        height={H * 0.52}
        dotColor="rgba(0,213,152,0.28)"
        lineColor="rgba(0,213,152,0.10)"
        dotRadius={1.6}
        style={StyleSheet.absoluteFill}
      />

      {/* Back button */}
      <Animated.View style={[s.backWrap, { top: insets.top + 12 }, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.75}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingTop: insets.top + 56 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Brand hero */}
          <Animated.View style={[s.brandWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={s.brand}>WHEELWORLD</Text>
            <Text style={s.brandSub}>CONSULTING</Text>
            <Text style={s.brandTagline}>Welcome back</Text>
          </Animated.View>

          {/* White card */}
          <Animated.View
            style={[s.card, { paddingBottom: insets.bottom + 24 }, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
          >
            <Text style={s.headline}>Sign In</Text>
            <Text style={s.tagline}>Access your strategic consulting hub</Text>
            
            {tempToken ? (
              <View style={s.fieldWrap}>
                <Text style={s.fieldLabel}>Two-Factor Authentication Code</Text>
                <View style={s.inputRow}>
                  <Ionicons name="keypad-outline" size={18} color="#8899AA" style={s.inputIcon} />
                  <TextInput
                    style={[s.input, { letterSpacing: 4, textAlign: 'center' }]}
                    placeholder="123456"
                    placeholderTextColor="#B0BAC9"
                    value={twoFactorCode}
                    onChangeText={setTwoFactorCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
                <Text style={s.terms}>Enter the 6-digit code from your Authenticator app</Text>
              </View>
            ) : (
              <>
                {/* Toggle: Phone / Email */}
                <View style={s.modeToggle}>
                  <TouchableOpacity
                    style={[s.modeBtn, loginMode === 'phone' && s.modeBtnActive]}
                    onPress={() => { setLoginMode('phone'); setErrors({}); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="call-outline" size={14} color={loginMode === 'phone' ? '#fff' : '#6B7A8D'} style={{ marginRight: 5 }} />
                    <Text style={[s.modeBtnText, loginMode === 'phone' && s.modeBtnTextActive]}>Phone</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.modeBtn, loginMode === 'email' && s.modeBtnActive]}
                    onPress={() => { setLoginMode('email'); setErrors({}); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="mail-outline" size={14} color={loginMode === 'email' ? '#fff' : '#6B7A8D'} style={{ marginRight: 5 }} />
                    <Text style={[s.modeBtnText, loginMode === 'email' && s.modeBtnTextActive]}>Email</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.fieldWrap}>
                  {loginMode === 'phone' ? (
                    <>
                      <Text style={s.fieldLabel}>Phone Number</Text>
                      <View style={[s.inputRow, errors.identifier ? s.inputError : null]}>
                        <View style={s.phonePrefix}>
                          <Text style={s.phonePre}>🇩🇿 +213</Text>
                        </View>
                        <TextInput
                          style={s.input}
                          placeholder="771 19 03 84"
                          placeholderTextColor="#B0BAC9"
                          value={phone}
                          onChangeText={(t) => { setPhone(t); setErrors(prev => ({ ...prev, identifier: undefined })); }}
                          keyboardType="phone-pad"
                        />
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={s.fieldLabel}>Email Address</Text>
                      <View style={[s.inputRow, errors.identifier ? s.inputError : null]}>
                        <Ionicons name="mail-outline" size={18} color={errors.identifier ? '#EF4444' : '#8899AA'} style={s.inputIcon} />
                        <TextInput
                          style={s.input}
                          placeholder="you@company.com"
                          placeholderTextColor="#B0BAC9"
                          value={email}
                          onChangeText={(t) => { setEmail(t); setErrors(prev => ({ ...prev, identifier: undefined })); }}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </View>
                    </>
                  )}
                  {errors.identifier && <Text style={s.errorText}>{errors.identifier}</Text>}
                </View>

                <View style={s.fieldWrap}>
                  <Text style={s.fieldLabel}>Password</Text>
                  <View style={[s.inputRow, errors.password ? s.inputError : null]}>
                    <Ionicons name="lock-closed-outline" size={18} color={errors.password ? '#EF4444' : '#8899AA'} style={s.inputIcon} />
                    <TextInput
                      style={s.input}
                      placeholder="••••••••"
                      placeholderTextColor="#B0BAC9"
                      value={password}
                      onChangeText={(t) => { setPassword(t); setErrors(prev => ({ ...prev, password: undefined })); }}
                      secureTextEntry={!showPass}
                    />
                    <TouchableOpacity onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
                      <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color="#8899AA" />
                    </TouchableOpacity>
                  </View>
                  {errors.password && <Text style={s.errorText}>{errors.password}</Text>}
                </View>
              </>
            )}

            {/* Forgot */}
            <TouchableOpacity
              style={s.forgotBtn}
              activeOpacity={0.7}
              onPress={() => Alert.alert('Reset Password', 'A reset link will be sent to your registered email address.')}
            >
              <Text style={s.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Sign In CTA */}
            <TouchableOpacity
              style={[s.primaryBtn, loading && { opacity: 0.75 }]}
              onPress={handleSignIn}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={DARK_NAV} size="small" />
                : <>
                    <Text style={s.primaryBtnText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={18} color={DARK_NAV} />
                  </>
              }
            </TouchableOpacity>

            {/* Biometric Quick Sign In */}
            {biometricAvailable && !tempToken && (
              <TouchableOpacity style={s.biometricBtn} onPress={handleBiometricSignIn} activeOpacity={0.8}>
                <Ionicons name="finger-print-outline" size={22} color={TEAL} />
                <Text style={s.biometricText}>Sign in with {biometricType}</Text>
              </TouchableOpacity>
            )}

            {/* Divider */}
            <View style={s.dividerRow}>
              <View style={s.divider} />
              <Text style={s.dividerText}>or continue with</Text>
              <View style={s.divider} />
            </View>

            {/* Social */}
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

            {/* Sign up link */}
            <View style={s.signUpRow}>
              <Text style={s.signUpText}>Don't have an account? </Text>
              <TouchableOpacity onPress={onSignUp} activeOpacity={0.7}>
                <Text style={s.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK_NAV },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'flex-end' },

  backWrap: { position: 'absolute', left: 20, zIndex: 10 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center',
  },

  brandWrap: { alignItems: 'center', paddingBottom: 16, paddingTop: 12 },
  brand: { fontSize: 30, fontWeight: '900', color: TEAL, letterSpacing: 4 },
  brandSub: { fontSize: 12, fontWeight: '300', color: 'rgba(255,255,255,0.65)', letterSpacing: 6, marginTop: 2 },
  brandTagline: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 12, letterSpacing: 0.5 },

  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
  },

  headline: { fontSize: 26, fontWeight: '800', color: '#1A2332', marginBottom: 4 },
  tagline: { fontSize: 13, color: '#6B7A8D', marginBottom: 22 },

  fieldWrap: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#4A5568', marginBottom: 7 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E0E7EF', borderRadius: 12,
    backgroundColor: '#F8FAFC', paddingHorizontal: 12, height: 50,
  },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FFF5F5' },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: '#1A2332' },
  eyeBtn: { padding: 4 },
  errorText: { fontSize: 11, color: '#EF4444', marginTop: 4, marginLeft: 2 },

  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 18,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  modeBtnActive: {
    backgroundColor: TEAL,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7A8D' },
  modeBtnTextActive: { color: '#fff' },

  phonePrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: '#E0E7EF',
    marginRight: 10,
  },
  phonePre: { fontSize: 14, color: '#1A2332', fontWeight: '600' },

  forgotBtn: { alignSelf: 'flex-end', marginTop: -2, marginBottom: 20 },
  forgotText: { fontSize: 13, color: TEAL, fontWeight: '600' },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: TEAL, borderRadius: 14, height: 54,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
    marginBottom: 20,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: DARK_NAV },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  divider: { flex: 1, height: 1, backgroundColor: '#E8EDF2' },
  dividerText: { fontSize: 12, color: '#B0BAC9' },

  socialRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  socialBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: '#D1D9E0', backgroundColor: '#fff',
  },
  socialBtnText: { fontSize: 14, fontWeight: '600', color: '#1A2332' },

  signUpRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signUpText: { fontSize: 13, color: '#8899AA' },
  signUpLink: { fontSize: 13, color: TEAL, fontWeight: '700' },
  terms: { fontSize: 11, color: '#B0BAC9', textAlign: 'center', marginTop: 10 },

  biometricBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: TEAL,
    backgroundColor: 'rgba(0,213,152,0.06)', marginBottom: 16,
  },
  biometricText: { fontSize: 14, fontWeight: '600', color: TEAL },
});
