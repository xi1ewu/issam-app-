import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useAppStore } from '../../store/useAppStore';
import { LANGUAGE_OPTIONS, applyRTLForLanguage, useTranslation } from '../../constants/i18n';
import FadeInView from '../../components/ui/FadeInView';

interface Props {
  onBack: () => void;
}

export const SettingsScreen: React.FC<Props> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { t } = useTranslation();
  const themeMode = useAppStore((s) => s.themeMode);
  const language = useAppStore((s) => s.language);
  const notificationsEnabled = useAppStore((s) => s.notificationsEnabled);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const setNotifications = useAppStore((s) => s.setNotificationsEnabled);

  const [langModalVisible, setLangModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const themeOptions: { label: string; value: 'light' | 'dark' | 'system'; icon: keyof typeof Ionicons.glyphMap }[] = [
    { label: 'Light', value: 'light', icon: 'sunny-outline' },
    { label: 'Dark', value: 'dark', icon: 'moon-outline' },
    { label: 'System', value: 'system', icon: 'phone-portrait-outline' },
  ];

  const currentLang = LANGUAGE_OPTIONS.find((l) => l.code === language) ?? LANGUAGE_OPTIONS[0];

  const menuSections: {
    title: string;
    items: {
      icon: keyof typeof Ionicons.glyphMap;
      iconBg: string;
      label: string;
      right?: React.ReactNode;
      onPress?: () => void;
    }[];
  }[] = [
    {
      title: 'Notifications',
      items: [
        {
          icon: 'notifications-outline',
          iconBg: colors.tint + '20',
          label: 'Push Notifications',
          right: (
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotifications}
              trackColor={{ false: colors.border, true: colors.tint + '60' }}
              thumbColor={notificationsEnabled ? colors.tint : isDark ? '#555' : '#fff'}
              ios_backgroundColor={colors.border}
            />
          ),
        },
      ],
    },
    {
      title: 'Appearance',
      items: [
        {
          icon: 'language-outline',
          iconBg: '#3B82F620',
          label: 'Language',
          right: (
            <View style={styles.rightRow}>
              <Text style={[styles.rightValue, { color: colors.textSecondary }]}>
                {currentLang.flag} {currentLang.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </View>
          ),
          onPress: () => setLangModalVisible(true),
        },
      ],
    },
    {
      title: 'Security',
      items: [
        {
          icon: 'lock-closed-outline',
          iconBg: '#F59E0B20',
          label: 'Change Password',
          right: <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />,
          onPress: () => setPasswordModalVisible(true),
        },
        {
          icon: 'shield-checkmark-outline',
          iconBg: '#8B5CF620',
          label: 'Two-Factor Authentication',
          right: <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />,
          onPress: () => Alert.alert('Coming Soon', '2FA will be available in a future update.'),
        },
      ],
    },
    {
      title: 'About',
      items: [
        {
          icon: 'document-text-outline',
          iconBg: '#10B98120',
          label: 'Privacy Policy',
          right: <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />,
          onPress: () => Alert.alert('Privacy Policy', 'This application values your privacy. We do not sell your personal data. All communication through the app is secured. For the full policy, please visit our website.'),
        },
        {
          icon: 'clipboard-outline',
          iconBg: '#6B728020',
          label: 'Terms of Service',
          right: <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />,
          onPress: () => Alert.alert('Terms of Service', 'By using this app, you agree to our standard terms of use. Respect all experts and clients, and adhere to community guidelines.'),
        },
        {
          icon: 'information-circle-outline',
          iconBg: '#EF444420',
          label: 'App Version',
          right: <Text style={[styles.rightValue, { color: colors.textSecondary }]}>1.0.0</Text>,
        },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Theme Selector */}
        <FadeInView index={0}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>THEME</Text>
            <View style={[styles.themeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {themeOptions.map((opt) => {
                const active = themeMode === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.themeOption,
                      active && { backgroundColor: colors.tint + '20' },
                    ]}
                    onPress={() => setThemeMode(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={18}
                      color={active ? colors.tint : colors.textSecondary}
                    />
                    <Text style={[styles.themeLabel, { color: active ? colors.tint : colors.textSecondary }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </FadeInView>

        {menuSections.map((section, si) => (
          <FadeInView key={section.title} index={si + 1}>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                {section.title.toUpperCase()}
              </Text>
              <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {section.items.map((item, i) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[
                      styles.menuItem,
                      i < section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                    onPress={item.onPress}
                    activeOpacity={item.onPress ? 0.7 : 1}
                  >
                    <View style={[styles.menuIconBox, { backgroundColor: item.iconBg }]}>
                      <Ionicons
                        name={item.icon}
                        size={18}
                        color={item.iconBg.replace('20', 'EE')}
                      />
                    </View>
                    <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
                    {item.right}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </FadeInView>
        ))}
      </ScrollView>

      {/* Language Modal */}
      <Modal visible={langModalVisible} transparent animationType="slide" onRequestClose={() => setLangModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setLangModalVisible(false)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.text }]}>Select Language</Text>
          {LANGUAGE_OPTIONS.map((lang) => {
            const active = language === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setLanguage(lang.code as any);
                  applyRTLForLanguage(lang.code as any);
                  setLangModalVisible(false);
                  if (lang.code === 'ar' || language === 'ar') {
                    Alert.alert('Restart Required', t('languageRestart'));
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text style={[styles.langLabel, { color: colors.text }]}>{lang.label}</Text>
                {active && <Ionicons name="checkmark" size={20} color={colors.tint} />}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 24 }} />
        </View>
      </Modal>

      {/* Password Change Modal */}
      <Modal visible={passwordModalVisible} transparent animationType="slide" onRequestClose={() => setPasswordModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPasswordModalVisible(false)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.text }]}>Change Password</Text>
          
          <View style={styles.passwordForm}>
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>CURRENT PASSWORD</Text>
              <TextInput
                style={[styles.passwordInput, { color: colors.text, borderColor: colors.border }]}
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={colors.textSecondary + '80'}
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>NEW PASSWORD</Text>
              <TextInput
                style={[styles.passwordInput, { color: colors.text, borderColor: colors.border }]}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={colors.textSecondary + '80'}
              />
            </View>
            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: colors.tint }]} 
              activeOpacity={0.8}
              disabled={passwordSaving}
              onPress={async () => {
                if (!currentPassword || newPassword.length < 6) {
                  Alert.alert('Invalid', 'New password must be at least 6 characters.');
                  return;
                }
                setPasswordSaving(true);
                try {
                  const { authAPI } = require('../../services/api');
                  await authAPI.changePassword(currentPassword, newPassword);
                  Alert.alert('Success', 'Password changed successfully!');
                  setPasswordModalVisible(false);
                  setCurrentPassword('');
                  setNewPassword('');
                } catch (e: any) {
                  Alert.alert('Error', e.message || 'Could not change password');
                } finally {
                  setPasswordSaving(false);
                }
              }}
            >
              <Text style={styles.saveBtnText}>{passwordSaving ? 'Saving...' : 'Save Password'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  themeRow: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  themeLabel: { fontSize: 13, fontWeight: '600' },
  menuCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rightValue: { fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    paddingBottom: 0,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12 },
      android: { elevation: 16 },
    }),
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16, paddingHorizontal: 4 },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    gap: 12,
  },
  langFlag: { fontSize: 24 },
  langLabel: { flex: 1, fontSize: 16, fontWeight: '500' },
  passwordForm: { paddingHorizontal: 4, gap: 16, marginTop: 8 },
  inputContainer: { gap: 8 },
  inputLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  passwordInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  saveBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#042b1c',
  },
});
