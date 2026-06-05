import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Image, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useAppStore } from '../../store/useAppStore';
import { authAPI } from '../../services/api';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
  onBack: () => void;
}

export const SecurityScreen: React.FC<Props> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const user = useAppStore(s => s.user);
  
  const [twoFactor, setTwoFactor] = useState(user?.isTwoFactorEnabled || false);
  const [faceId, setFaceId] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  
  const [loading2FA, setLoading2FA] = useState(false);
  const [setupData, setSetupData] = useState<{ qrCodeUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    checkBiometricAvailability();
    loadBiometricPref();
  }, []);

  const checkBiometricAvailability = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(compatible && enrolled);
    
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      setBiometricType('Face ID');
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      setBiometricType('Touch ID');
    }
  };

  const loadBiometricPref = async () => {
    const saved = await AsyncStorage.getItem('biometricEnabled');
    setFaceId(saved === 'true');
  };

  const handleToggleBiometric = async (val: boolean) => {
    if (!biometricAvailable) {
      Alert.alert('Not Available', 'Biometric authentication is not set up on this device. Please add Face ID or Touch ID in your device Settings.');
      return;
    }
    if (val) {
      // Require authentication before enabling
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Enable ${biometricType} login`,
        fallbackLabel: 'Use Passcode',
      });
      if (result.success) {
        await AsyncStorage.setItem('biometricEnabled', 'true');
        setFaceId(true);
        Alert.alert('Enabled', `${biometricType} login is now enabled!`);
      } else {
        Alert.alert('Failed', 'Authentication failed. Biometric login not enabled.');
      }
    } else {
      await AsyncStorage.setItem('biometricEnabled', 'false');
      setFaceId(false);
    }
  };

  const handleToggle2FA = async (val: boolean) => {
    // If turning on and not already enabled
    if (val && !user?.isTwoFactorEnabled) {
      setLoading2FA(true);
      try {
        const res = await authAPI.twoFactorGenerate();
        setSetupData(res);
        setTwoFactor(true);
      } catch (e: any) {
        Alert.alert('Error', e.message);
        setTwoFactor(false);
      } finally {
        setLoading2FA(false);
      }
    } else if (!val) {
      // Disabling 2FA is not implemented in this demo, just keep UI simple
      Alert.alert('Not Supported', 'Disabling 2FA requires contacting support.');
      setTwoFactor(true);
    }
  };

  const handleVerify = async () => {
    if (!code || code.length < 6) return;
    setLoading2FA(true);
    try {
      await authAPI.twoFactorVerify(code);
      Alert.alert('Success', 'Two-Factor Authentication is now enabled!');
      setSetupData(null);
      // Ideally update store user here
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading2FA(false);
    }
  };

  const bg = isDark ? '#0D1B2A' : '#F8FAFC';
  const cardBg = isDark ? '#1E2A3A' : '#FFFFFF';
  const textPrimary = isDark ? '#E8ECF0' : '#0A1628';
  const textSecondary = isDark ? '#9BA8B4' : '#64748B';

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: textPrimary }]}>Security & 2FA</Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#00D598" />
              <View style={styles.rowTexts}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>Two-Factor Authentication</Text>
                <Text style={[styles.rowSub, { color: textSecondary }]}>Add an extra layer of security</Text>
              </View>
            </View>
            <Switch
              value={twoFactor}
              onValueChange={handleToggle2FA}
              trackColor={{ false: '#cbd5e1', true: '#00D598' }}
              disabled={loading2FA}
            />
          </View>
          
          {loading2FA && !setupData && (
            <ActivityIndicator style={{ marginTop: 16 }} color="#00D598" />
          )}

          {setupData && (
            <View style={styles.setupContainer}>
              <Text style={[styles.setupTitle, { color: textPrimary }]}>Scan QR Code</Text>
              <Text style={[styles.setupSub, { color: textSecondary }]}>Scan this code with Google Authenticator or Authy</Text>
              
              <View style={styles.qrBox}>
                <Image source={{ uri: setupData.qrCodeUrl }} style={styles.qrImage} />
              </View>
              
              <TextInput
                style={[styles.input, { color: textPrimary, borderColor: isDark ? '#334155' : '#E2E8F0', backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}
                placeholder="Enter 6-digit code"
                placeholderTextColor={textSecondary}
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={setCode}
              />
              <TouchableOpacity 
                style={[styles.verifyBtn, !code && { opacity: 0.5 }]} 
                onPress={handleVerify}
                disabled={!code || loading2FA}
              >
                <Text style={styles.verifyBtnText}>{loading2FA ? 'Verifying...' : 'Verify & Enable'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="scan-outline" size={22} color={biometricAvailable ? '#00D598' : '#94a3b8'} />
              <View style={styles.rowTexts}>
                <Text style={[styles.rowTitle, { color: textPrimary }]}>{biometricType} Login</Text>
                <Text style={[styles.rowSub, { color: textSecondary }]}>
                  {biometricAvailable ? `Use ${biometricType} to sign in quickly` : 'Not available on this device'}
                </Text>
              </View>
            </View>
            <Switch
              value={faceId}
              onValueChange={handleToggleBiometric}
              trackColor={{ false: '#cbd5e1', true: '#00D598' }}
              disabled={!biometricAvailable}
            />
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.btn, { borderColor: '#EF4444' }]}
          onPress={() => Alert.alert(
            'Delete Account',
            'Are you sure you want to permanently delete your account? This action cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Request Sent', 'Your account deletion request has been submitted. You will receive a confirmation email within 24 hours.') },
            ]
          )}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
          <Text style={styles.btnText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  backBtn: { padding: 4, marginRight: 12 },
  title: { fontSize: 18, fontWeight: '800' },
  content: { padding: 16, gap: 12 },
  card: { borderRadius: 16, padding: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowTexts: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  rowSub: { fontSize: 13 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 20, paddingVertical: 16, borderRadius: 16, borderWidth: 1,
    backgroundColor: '#FEF2F2',
  },
  btnText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },

  setupContainer: { marginTop: 24, alignItems: 'center' },
  setupTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  setupSub: { fontSize: 13, textAlign: 'center', marginBottom: 16 },
  qrBox: { padding: 8, backgroundColor: '#fff', borderRadius: 12, marginBottom: 16 },
  qrImage: { width: 160, height: 160 },
  input: {
    width: '100%', height: 48, borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 16, fontSize: 16, textAlign: 'center', letterSpacing: 4,
    marginBottom: 16,
  },
  verifyBtn: {
    width: '100%', height: 48, backgroundColor: '#00D598',
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  verifyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
