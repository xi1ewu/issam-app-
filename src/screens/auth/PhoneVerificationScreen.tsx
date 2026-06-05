import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authPhoneAPI } from '../../services/api';

const TEAL = '#00D598';
const NAVY = '#0A1628';
const OTP_LENGTH = 4;
const RESEND_COUNTDOWN = 60;

interface Props {
  phone: string;
  onVerified: () => void;
  onBack: () => void;
}

export const PhoneVerificationScreen: React.FC<Props> = ({ phone, onVerified, onBack }) => {
  const insets = useSafeAreaInsets();
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [sent, setSent] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  // Auto-send OTP on mount
  useEffect(() => {
    handleSend();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!sent) return;
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [sent, countdown]);

  const handleSend = async () => {
    setSending(true);
    try {
      await authPhoneAPI.sendOtp(phone);
      setSent(true);
      setCountdown(RESEND_COUNTDOWN);
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.toLowerCase().includes('too many') || msg.toLowerCase().includes('hour')) {
        Alert.alert('Rate limit reached', 'Too many OTP requests. Please wait an hour before trying again.');
        setCountdown(3600);
        setSent(true);
      } else {
        Alert.alert('Error', msg || 'Failed to send OTP. Please check your phone number and try again.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleChange = (value: string, index: number) => {
    // Handle paste of full OTP
    if (value.length === OTP_LENGTH) {
      const digits = value.replace(/\D/g, '').slice(0, OTP_LENGTH).split('');
      if (digits.length === OTP_LENGTH) {
        setOtp(digits);
        inputs.current[OTP_LENGTH - 1]?.focus();
        return;
      }
    }

    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);

    if (digit && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = '';
      setOtp(next);
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) {
      Alert.alert('Incomplete', 'Please enter all 4 digits.');
      return;
    }
    setVerifying(true);
    try {
      await authPhoneAPI.verifyOtp(code);
      onVerified();
    } catch {
      Alert.alert('Invalid Code', 'The code you entered is incorrect or has expired. Please try again.');
      setOtp(Array(OTP_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const displayPhone = phone.startsWith('+213')
    ? `+213 ${phone.slice(4).replace(/(\d{3})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4')}`
    : phone;

  const otpComplete = otp.every(d => d !== '');

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Back */}
      <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={22} color={NAVY} />
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconWrap}>
          <Ionicons name="phone-portrait-outline" size={40} color={TEAL} />
        </View>

        <Text style={styles.title}>Verify your number</Text>
        <Text style={styles.subtitle}>
          We sent a 4-digit code to{'\n'}
          <Text style={styles.phone}>{displayPhone}</Text>
        </Text>

        {/* OTP boxes */}
        <View style={styles.otpRow}>
          {Array(OTP_LENGTH).fill(null).map((_, i) => (
            <TextInput
              key={i}
              ref={r => { inputs.current[i] = r; }}
              style={[
                styles.otpBox,
                otp[i] ? styles.otpBoxFilled : null,
              ]}
              value={otp[i]}
              onChangeText={v => handleChange(v, i)}
              onKeyPress={e => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              selectTextOnFocus
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
            />
          ))}
        </View>

        {/* Verify button */}
        <TouchableOpacity
          style={[styles.verifyBtn, !otpComplete && styles.verifyBtnDisabled]}
          onPress={handleVerify}
          disabled={!otpComplete || verifying}
          activeOpacity={0.85}
        >
          {verifying
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.verifyBtnText}>Verify</Text>
          }
        </TouchableOpacity>

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>Didn't receive it? </Text>
          {countdown > 0 ? (
            <Text style={styles.resendCountdown}>Resend in {countdown}s</Text>
          ) : (
            <TouchableOpacity onPress={handleSend} disabled={sending} activeOpacity={0.7}>
              {sending
                ? <ActivityIndicator size="small" color={TEAL} />
                : <Text style={styles.resendLink}>Resend code</Text>
              }
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backBtn: {
    marginLeft: 16,
    marginTop: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F6F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: TEAL + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: NAVY,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
  },
  phone: {
    fontWeight: '700',
    color: NAVY,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 36,
  },
  otpBox: {
    width: 46,
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: NAVY,
    backgroundColor: '#F8FAFC',
  },
  otpBoxFilled: {
    borderColor: TEAL,
    backgroundColor: TEAL + '10',
  },
  verifyBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  verifyBtnDisabled: {
    opacity: 0.4,
  },
  verifyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  resendCountdown: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  resendLink: {
    fontSize: 14,
    fontWeight: '700',
    color: TEAL,
  },
});
