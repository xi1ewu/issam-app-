import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../hooks/useAppTheme';
import { myAvailabilityAPI, DayAvailability, TimeSlot } from '../../services/api';

const TEAL = '#00D598';
const NAVY = '#0A1628';
const DAY_HEADERS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DEFAULT_SLOTS: TimeSlot[] = [
  { id: '1', start: '09:00 AM', end: '10:00 AM', label: 'Morning Session', isAvailable: true },
  { id: '2', start: '10:30 AM', end: '11:30 AM', label: 'Morning Session', isAvailable: true },
  { id: '3', start: '01:00 PM', end: '02:00 PM', label: 'Afternoon Lunch Break', isAvailable: false },
  { id: '4', start: '03:30 PM', end: '04:30 PM', label: 'Evening Wrap-up', isAvailable: true },
];

const pad = (n: number) => n.toString().padStart(2, '0');
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const formatMonthDay = (dateStr: string) => {
  const [, m, d] = dateStr.split('-');
  return `${MONTH_NAMES[parseInt(m) - 1].slice(0, 3)} ${parseInt(d)}`;
};

interface Props {
  onBack: () => void;
  onSave: () => void;
}

export const AvailabilityCalendarScreen: React.FC<Props> = ({ onBack, onSave }) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();

  const bg = isDark ? '#0D1B2A' : '#F0F4F8';
  const card = isDark ? '#1E2A3A' : '#fff';
  const text = isDark ? '#E8ECF0' : NAVY;
  const muted = isDark ? '#9BA8B4' : '#64748B';
  const border = isDark ? '#2D3F55' : '#E2E8F0';

  const today = new Date();
  const todayStr = toDateStr(today);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Map of dateStr → DayAvailability (loaded or locally edited)
  const [dayData, setDayData] = useState<Record<string, DayAvailability>>({});
  const [loadingDate, setLoadingDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Add slot form state
  const [addingSlot, setAddingSlot] = useState(false);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const getDayData = (date: string): DayAvailability =>
    dayData[date] ?? { dayAvailable: true, slots: DEFAULT_SLOTS };

  const selectDate = useCallback(async (dateStr: string) => {
    setSelectedDate(dateStr);
    if (dayData[dateStr] !== undefined) return; // already loaded

    setLoadingDate(dateStr);
    try {
      const result = await myAvailabilityAPI.get(dateStr);
      setDayData(prev => ({
        ...prev,
        [dateStr]: result ?? { dayAvailable: true, slots: DEFAULT_SLOTS },
      }));
    } catch {
      setDayData(prev => ({
        ...prev,
        [dateStr]: { dayAvailable: true, slots: DEFAULT_SLOTS },
      }));
    } finally {
      setLoadingDate(null);
    }
  }, [dayData]);

  const setDayAvailable = (date: string, val: boolean) => {
    setDayData(prev => ({
      ...prev,
      [date]: { ...getDayData(date), dayAvailable: val },
    }));
  };

  const toggleSlot = (date: string, slotId: string) => {
    const data = getDayData(date);
    setDayData(prev => ({
      ...prev,
      [date]: {
        ...data,
        slots: data.slots.map(s => s.id === slotId ? { ...s, isAvailable: !s.isAvailable } : s),
      },
    }));
  };

  const removeSlot = (date: string, slotId: string) => {
    const data = getDayData(date);
    setDayData(prev => ({
      ...prev,
      [date]: { ...data, slots: data.slots.filter(s => s.id !== slotId) },
    }));
  };

  const addSlot = () => {
    if (!newStart.trim() || !newEnd.trim()) {
      Alert.alert('Required', 'Enter start and end times.');
      return;
    }
    const data = getDayData(selectedDate);
    const newSlot: TimeSlot = {
      id: Date.now().toString(),
      start: newStart.trim(),
      end: newEnd.trim(),
      label: newLabel.trim() || 'Custom Session',
      isAvailable: true,
    };
    setDayData(prev => ({
      ...prev,
      [selectedDate]: { ...data, slots: [...data.slots, newSlot] },
    }));
    setNewStart(''); setNewEnd(''); setNewLabel('');
    setAddingSlot(false);
  };

  const handleSave = async () => {
    const data = getDayData(selectedDate);
    setSaving(true);
    try {
      await myAvailabilityAPI.save(selectedDate, data);
      Alert.alert('Saved', `Schedule for ${formatMonthDay(selectedDate)} saved.`, [
        { text: 'OK', onPress: onSave },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Calendar rendering ──
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const calCells: React.ReactNode[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calCells.push(<View key={`e${i}`} style={styles.calCell} />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewYear, viewMonth, d);
    const dateStr = toDateStr(date);
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;
    const hasDot = dayData[dateStr] !== undefined &&
      (dayData[dateStr].dayAvailable || dayData[dateStr].slots.some(s => s.isAvailable));

    calCells.push(
      <TouchableOpacity key={d} style={styles.calCell} onPress={() => selectDate(dateStr)} activeOpacity={0.7}>
        <View style={[
          styles.calNum,
          isToday && !isSelected && styles.calNumToday,
          isSelected && styles.calNumSelected,
        ]}>
          <Text style={[
            styles.calNumText,
            isToday && !isSelected && styles.calNumTodayText,
            isSelected && styles.calNumSelectedText,
          ]}>{d}</Text>
        </View>
        {hasDot && <View style={styles.calDot} />}
      </TouchableOpacity>
    );
  }

  const current = getDayData(selectedDate);
  const isLoading = loadingDate === selectedDate;

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: card, borderBottomColor: border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: text }]}>Availability Calendar</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveBtnText}>Save Schedule</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Calendar card */}
        <View style={[styles.calCard, { backgroundColor: card, shadowColor: '#000' }]}>
          {/* Month nav */}
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.monthArrow} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={text} />
            </TouchableOpacity>
            <Text style={[styles.monthTitle, { color: text }]}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={nextMonth} style={styles.monthArrow} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={20} color={text} />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={styles.calRow}>
            {DAY_HEADERS.map(d => (
              <View key={d} style={styles.calCell}>
                <Text style={styles.calDayHeader}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Date grid */}
          <View style={styles.calGrid}>
            {calCells}
          </View>
        </View>

        {/* Time slots section */}
        <View style={styles.slotsSection}>
          <View style={styles.slotsSectionHeader}>
            <Text style={[styles.slotsSectionTitle, { color: text }]}>
              Time Slots for {formatMonthDay(selectedDate)}
            </Text>
            <View style={styles.availRow}>
              <Text style={[styles.availLabel, { color: TEAL }]}>Available</Text>
              <Switch
                value={current.dayAvailable}
                onValueChange={v => setDayAvailable(selectedDate, v)}
                trackColor={{ false: '#CBD5E1', true: TEAL + '50' }}
                thumbColor={current.dayAvailable ? TEAL : '#94A3B8'}
                ios_backgroundColor="#CBD5E1"
              />
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={TEAL} />
            </View>
          ) : (
            <>
              {current.slots.map(slot => (
                <TouchableOpacity
                  key={slot.id}
                  style={[styles.slotCard, { backgroundColor: card, shadowColor: '#000' }]}
                  onLongPress={() => Alert.alert(
                    'Remove Slot',
                    `Remove "${slot.label}"?`,
                    [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => removeSlot(selectedDate, slot.id) }]
                  )}
                  activeOpacity={0.95}
                >
                  <Ionicons
                    name="time-outline"
                    size={22}
                    color={slot.isAvailable ? TEAL : muted}
                    style={{ marginRight: 14 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.slotTime, { color: slot.isAvailable ? text : muted }]}>
                      {slot.start} - {slot.end}
                    </Text>
                    <Text style={[styles.slotLabel, { color: muted }]}>{slot.label}</Text>
                  </View>
                  <Switch
                    value={slot.isAvailable}
                    onValueChange={() => toggleSlot(selectedDate, slot.id)}
                    trackColor={{ false: '#CBD5E1', true: TEAL + '50' }}
                    thumbColor={slot.isAvailable ? TEAL : '#94A3B8'}
                    ios_backgroundColor="#CBD5E1"
                  />
                </TouchableOpacity>
              ))}

              {/* Add custom time slot */}
              {addingSlot ? (
                <View style={[styles.addForm, { backgroundColor: card, borderColor: TEAL }]}>
                  <Text style={[styles.addFormTitle, { color: text }]}>New Time Slot</Text>
                  <View style={styles.addFormRow}>
                    <TextInput
                      style={[styles.addInput, { color: text, borderColor: border, flex: 1, marginRight: 8 }]}
                      placeholder="Start (e.g. 02:00 PM)"
                      placeholderTextColor={muted}
                      value={newStart}
                      onChangeText={setNewStart}
                    />
                    <TextInput
                      style={[styles.addInput, { color: text, borderColor: border, flex: 1 }]}
                      placeholder="End (e.g. 03:00 PM)"
                      placeholderTextColor={muted}
                      value={newEnd}
                      onChangeText={setNewEnd}
                    />
                  </View>
                  <TextInput
                    style={[styles.addInput, { color: text, borderColor: border, marginBottom: 12 }]}
                    placeholder="Label (e.g. Afternoon Session)"
                    placeholderTextColor={muted}
                    value={newLabel}
                    onChangeText={setNewLabel}
                  />
                  <View style={styles.addFormBtns}>
                    <TouchableOpacity
                      style={[styles.addFormBtn, { borderColor: border }]}
                      onPress={() => { setAddingSlot(false); setNewStart(''); setNewEnd(''); setNewLabel(''); }}
                    >
                      <Text style={[styles.addFormBtnTxt, { color: muted }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.addFormBtn, { backgroundColor: TEAL, borderColor: TEAL }]} onPress={addSlot}>
                      <Text style={[styles.addFormBtnTxt, { color: '#fff' }]}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.addSlotBtn, { borderColor: TEAL }]}
                  onPress={() => setAddingSlot(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={20} color={TEAL} style={{ marginRight: 8 }} />
                  <Text style={[styles.addSlotTxt, { color: TEAL }]}>Add custom time slot</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', flex: 1, marginLeft: 8 },
  saveBtn: {
    backgroundColor: TEAL, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, minWidth: 110, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Calendar
  calCard: {
    margin: 16, borderRadius: 16, padding: 16,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  monthArrow: { padding: 6 },
  monthTitle: { fontSize: 16, fontWeight: '700' },
  calRow: { flexDirection: 'row', marginBottom: 4 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 },
  calDayHeader: { fontSize: 11, fontWeight: '700', color: TEAL, writingDirection: 'ltr', textAlign: 'center' },
  calNum: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  calNumToday: { backgroundColor: TEAL },
  calNumSelected: { backgroundColor: TEAL },
  calNumText: { fontSize: 13, fontWeight: '500', color: '#64748B', writingDirection: 'ltr', textAlign: 'center' },
  calNumTodayText: { color: '#fff', fontWeight: '700' },
  calNumSelectedText: { color: '#fff', fontWeight: '700' },
  calDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: TEAL, marginTop: 2 },

  // Slots
  slotsSection: { paddingHorizontal: 16 },
  slotsSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
  },
  slotsSectionTitle: { fontSize: 17, fontWeight: '800' },
  availRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  availLabel: { fontSize: 13, fontWeight: '600' },
  loadingWrap: { padding: 32, alignItems: 'center' },
  slotCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 16, marginBottom: 10,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  slotTime: { fontSize: 16, fontWeight: '700' },
  slotLabel: { fontSize: 12, marginTop: 2 },
  addSlotBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14,
    paddingVertical: 16, marginTop: 4,
  },
  addSlotTxt: { fontSize: 14, fontWeight: '600' },
  addForm: {
    borderWidth: 1.5, borderRadius: 14, padding: 14, marginTop: 4,
  },
  addFormTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  addFormRow: { flexDirection: 'row', marginBottom: 8 },
  addInput: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9,
    fontSize: 13, marginBottom: 8,
  },
  addFormBtns: { flexDirection: 'row', gap: 10 },
  addFormBtn: {
    flex: 1, borderWidth: 1.5, borderRadius: 8, paddingVertical: 10,
    alignItems: 'center',
  },
  addFormBtnTxt: { fontSize: 14, fontWeight: '700' },
});
