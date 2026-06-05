import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Switch,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useAppStore } from '../../store/useAppStore';
import { usersAPI, expertsAPI, authAPI } from '../../services/api';
import FadeInView from '../../components/ui/FadeInView';
import { Colors, Radius } from '../../theme';

interface Props {
  onBack: () => void;
  onSaved: () => void;
}

export const EditProfileScreen: React.FC<Props> = ({ onBack, onSaved }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const user = useAppStore(s => s.user);
  const role = useAppStore(s => s.role);
  const setUser = useAppStore(s => s.setUser);
  const isExpert = role === 'expert';

  // User fields
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [company, setCompany] = useState(user?.company ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [location, setLocation] = useState(user?.location ?? '');

  // Expert fields
  const [title, setTitle] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [expertiseInput, setExpertiseInput] = useState('');
  const [expertiseTags, setExpertiseTags] = useState<string[]>([]);
  const [yearsExp, setYearsExp] = useState('');
  const [languages, setLanguages] = useState('');

  const [avatarUri, setAvatarUri] = useState<string | undefined>(user?.avatar);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingExpert, setLoadingExpert] = useState(true);

  // Always fetch fresh profile from server so fields are never empty
  useEffect(() => {
    authAPI.getMe().then((me: any) => {
      // User fields
      if (me.name)     setName(me.name);
      if (me.phone)    setPhone(me.phone);
      if (me.company)  setCompany(me.company);
      if (me.bio)      setBio(me.bio);
      if (me.location) setLocation(me.location);
      if (me.avatar)   setAvatarUri(me.avatar);

      // Sync store so other screens stay fresh
      setUser({
        name:     me.name     ?? user?.name     ?? '',
        phone:    me.phone    ?? user?.phone    ?? '',
        company:  me.company  ?? user?.company,
        bio:      me.bio      ?? user?.bio,
        location: me.location ?? user?.location,
        avatar:   me.avatar   ?? user?.avatar,
      });

      // Expert fields
      const ep = me.expert;
      if (ep) {
        setTitle(ep.title ?? '');
        setHourlyRate(ep.hourlyRate?.toString() ?? '');
        setIsAvailable(ep.isAvailable ?? true);
        setExpertiseTags(ep.expertise ?? []);
        setYearsExp(ep.yearsExp?.toString() ?? '');
        setLanguages((ep.languages ?? []).join(', '));
      }
    }).catch(() => {}).finally(() => setLoadingExpert(false));
  }, []);

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const handleChangePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow access to your photo library to change your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;
    setAvatarUri(uri);
    setUploadingAvatar(true);
    try {
      const updated = await usersAPI.uploadAvatar(uri);
      setUser({ avatar: updated.avatar });
      setAvatarUri(updated.avatar);
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not upload photo.');
      setAvatarUri(user?.avatar);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const addExpertiseTag = () => {
    const tag = expertiseInput.trim();
    if (tag && !expertiseTags.includes(tag)) {
      setExpertiseTags(prev => [...prev, tag]);
    }
    setExpertiseInput('');
  };

  const removeTag = (tag: string) => {
    setExpertiseTags(prev => prev.filter(t => t !== tag));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    setSaving(true);
    try {
      const updatedUser = await usersAPI.updateProfile({
        name: name.trim(),
        phone,
        company,
        bio,
        location,
      });
      setUser({
        name: updatedUser.name,
        phone: updatedUser.phone ?? phone,
        company: updatedUser.company ?? company,
        bio: updatedUser.bio ?? bio,
        location: updatedUser.location ?? location,
      });

      if (isExpert) {
        await expertsAPI.updateProfile({
          title,
          bio,
          hourlyRate: parseFloat(hourlyRate) || undefined,
          isAvailable,
          expertise: expertiseTags,
          yearsExp: parseInt(yearsExp) || undefined,
          languages: languages.split(',').map(l => l.trim()).filter(Boolean),
        });
      }

      Alert.alert('Profile Updated', 'Your profile has been saved successfully.', [
        { text: 'OK', onPress: onSaved },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingExpert) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveBtn, { backgroundColor: colors.tint }]}
            activeOpacity={0.8}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#042b1c" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Avatar hero */}
          <FadeInView index={0}>
            <View style={[styles.avatarHero, { backgroundColor: colors.tint + '12' }]}>
              <TouchableOpacity
                onPress={handleChangePhoto}
                disabled={uploadingAvatar}
                activeOpacity={0.85}
                style={styles.avatarTap}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <View style={[styles.avatarImg, { backgroundColor: colors.tint + '30', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={[styles.avatarInitials, { color: colors.tint }]}>{initials}</Text>
                  </View>
                )}
                <View style={[styles.cameraOverlay, { backgroundColor: colors.tint }]}>
                  {uploadingAvatar
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="camera" size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
              <Text style={[styles.userName, { color: colors.text }]}>{name || 'Your Name'}</Text>
              <Text style={[styles.userRole, { color: colors.tint }]}>
                {isExpert ? 'Expert Profile' : 'Client Profile'}
              </Text>
            </View>
          </FadeInView>

          {/* Personal Info */}
          <FadeInView index={1}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PERSONAL INFO</Text>
            <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <FieldRow icon="person-outline" label="Full Name" colors={colors}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your full name"
                  placeholderTextColor={colors.textSecondary + '80'}
                />
              </FieldRow>
              <FieldRow icon="call-outline" label="Phone" colors={colors} last={false}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+213 ..."
                  placeholderTextColor={colors.textSecondary + '80'}
                  keyboardType="phone-pad"
                />
              </FieldRow>
              <FieldRow icon="business-outline" label="Company" colors={colors} last={false}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={company}
                  onChangeText={setCompany}
                  placeholder="Your company"
                  placeholderTextColor={colors.textSecondary + '80'}
                />
              </FieldRow>
              <FieldRow icon="location-outline" label="Location" colors={colors} last={false}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="City, Country"
                  placeholderTextColor={colors.textSecondary + '80'}
                />
              </FieldRow>
              <FieldRow icon="document-text-outline" label="Bio" colors={colors} last>
                <TextInput
                  style={[styles.input, styles.multiline, { color: colors.text }]}
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Short bio..."
                  placeholderTextColor={colors.textSecondary + '80'}
                  multiline
                  numberOfLines={3}
                />
              </FieldRow>
            </View>
          </FadeInView>

          {/* Expert Fields */}
          {isExpert && (
            <FadeInView index={2}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>EXPERT PROFILE</Text>
              <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <FieldRow icon="briefcase-outline" label="Professional Title" colors={colors}>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Strategy Consultant"
                    placeholderTextColor={colors.textSecondary + '80'}
                  />
                </FieldRow>
                <FieldRow icon="cash-outline" label="Hourly Rate (USD)" colors={colors}>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={hourlyRate}
                    onChangeText={setHourlyRate}
                    placeholder="e.g. 150"
                    placeholderTextColor={colors.textSecondary + '80'}
                    keyboardType="numeric"
                  />
                </FieldRow>
                <FieldRow icon="time-outline" label="Years of Experience" colors={colors}>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={yearsExp}
                    onChangeText={setYearsExp}
                    placeholder="e.g. 8"
                    placeholderTextColor={colors.textSecondary + '80'}
                    keyboardType="numeric"
                  />
                </FieldRow>
                <FieldRow icon="language-outline" label="Languages (comma-separated)" colors={colors}>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={languages}
                    onChangeText={setLanguages}
                    placeholder="Arabic, French, English"
                    placeholderTextColor={colors.textSecondary + '80'}
                  />
                </FieldRow>

                {/* Availability toggle */}
                <View style={[styles.toggleRow, { borderTopColor: colors.border }]}>
                  <View style={[styles.fieldIconWrap, { backgroundColor: colors.tint + '15' }]}>
                    <Ionicons name="checkmark-circle-outline" size={17} color={colors.tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>AVAILABLE FOR BOOKINGS</Text>
                    <Text style={[styles.input, { color: colors.text, fontSize: 13, paddingVertical: 0 }]}>
                      {isAvailable ? 'Visible to clients' : 'Hidden from clients'}
                    </Text>
                  </View>
                  <Switch
                    value={isAvailable}
                    onValueChange={setIsAvailable}
                    trackColor={{ false: colors.border, true: colors.tint + '60' }}
                    thumbColor={isAvailable ? colors.tint : colors.icon}
                  />
                </View>
              </View>

              {/* Expertise tags */}
              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 16 }]}>EXPERTISE TAGS</Text>
              <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.tagInputRow}>
                  <TextInput
                    style={[styles.tagInput, { color: colors.text, borderColor: colors.border, backgroundColor: Colors.inputBg }]}
                    value={expertiseInput}
                    onChangeText={setExpertiseInput}
                    placeholder="Add expertise tag..."
                    placeholderTextColor={colors.textSecondary + '80'}
                    onSubmitEditing={addExpertiseTag}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={[styles.addTagBtn, { backgroundColor: colors.tint }]}
                    onPress={addExpertiseTag}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={20} color="#042b1c" />
                  </TouchableOpacity>
                </View>
                {expertiseTags.length > 0 && (
                  <View style={styles.tagsWrap}>
                    {expertiseTags.map(tag => (
                      <TouchableOpacity
                        key={tag}
                        style={[styles.tag, { backgroundColor: colors.tint + '20' }]}
                        onPress={() => removeTag(tag)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.tagText, { color: colors.tint }]}>{tag}</Text>
                        <Ionicons name="close" size={13} color={colors.tint} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </FadeInView>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const FieldRow: React.FC<{
  icon: any;
  label: string;
  children: React.ReactNode;
  colors: any;
  last?: boolean;
}> = ({ icon, label, children, colors, last = false }) => (
  <View style={[styles.fieldRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
    <View style={[styles.fieldIconWrap, { backgroundColor: colors.tint + '15' }]}>
      <Ionicons name={icon} size={17} color={colors.tint} />
    </View>
    <View style={styles.fieldContent}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label.toUpperCase()}</Text>
      {children}
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#042b1c', fontSize: 14, fontWeight: '700' },
  avatarHero: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    marginBottom: 8,
  },
  avatarTap: { position: 'relative', marginBottom: 12 },
  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarInitials: { fontSize: 34, fontWeight: '800' },
  userName: { fontSize: 18, fontWeight: '700', marginBottom: 3 },
  userRole: { fontSize: 13, fontWeight: '600' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginBottom: 8,
    marginTop: 4,
  },
  formCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  fieldIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  fieldContent: { flex: 1 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, marginBottom: 2 },
  input: { fontSize: 15, paddingVertical: 4, minHeight: 36 },
  multiline: { height: 72, textAlignVertical: 'top' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderTopWidth: 1,
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  tagInput: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    borderWidth: 1,
  },
  addTagBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  tagText: { fontSize: 13, fontWeight: '600' },
});
