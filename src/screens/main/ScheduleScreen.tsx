import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Expert, TimeSlot } from '../../types';
import { expertsAPI, availabilityAPI, consultationsAPI } from '../../services/api';
import { useAppTheme } from '../../hooks/useAppTheme';

const TEAL = '#00D598';
const DARK_NAV = '#0A1628';

interface BookingData {
  consultationId: string;
  expertId: string;
  expertName: string;
  date: string;
  time: string;
  duration: number;
  sessionType: string;
  price: number;
}

interface Props {
  expertId: string;
  onBack: () => void;
  onConfirm: (data: BookingData) => void;
}

const DURATIONS = [30, 60, 90];
const SESSION_TYPES = [
  { id: 'video', label: 'Video Call', icon: 'videocam-outline' as const },
  { id: 'audio', label: 'Audio Call', icon: 'call-outline' as const },
  { id: 'chat', label: 'Chat Only', icon: 'chatbubble-outline' as const },
];

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function pad2(n: number) { return String(n).padStart(2, '0'); }

export const ScheduleScreen: React.FC<Props> = ({ expertId, onBack, onConfirm }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const now = new Date();

  const [expert, setExpert] = useState<Expert | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingExpert, setLoadingExpert] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [selectedDate, setSelectedDate] = useState(now.getDate());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [duration, setDuration] = useState(60);
  const [sessionType, setSessionType] = useState('video');
  const [topic, setTopic] = useState('');
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());

  // Current month navigation
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-indexed

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  // Convert Sunday=0 to Monday=0 offset
  const startOffset = (firstDayOfMonth + 6) % 7;

  const buildDateStr = (day: number) =>
    `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;

  useEffect(() => {
    expertsAPI.getById(expertId)
      .then(setExpert)
      .catch(() => {})
      .finally(() => setLoadingExpert(false));
  }, [expertId]);

  // Load which dates have availability whenever month changes
  useEffect(() => {
    expertsAPI.getAvailableDates(expertId, viewYear, viewMonth + 1)
      .then(dates => setAvailableDates(new Set(dates)))
      .catch(() => {});
  }, [expertId, viewYear, viewMonth]);

  const loadSlots = useCallback(async (day: number) => {
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const s = await availabilityAPI.getTimeSlots(expertId, buildDateStr(day));
      setSlots(Array.isArray(s) ? s : []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [expertId, viewYear, viewMonth]);

  useEffect(() => { loadSlots(selectedDate); }, [loadSlots, selectedDate]);

  const totalPrice = expert ? (expert.hourlyRate * duration) / 60 : 0;

  const handleConfirm = async () => {
    if (!selectedSlot) {
      Alert.alert('Select Time', 'Please select an available time slot.');
      return;
    }
    if (topic.trim().length < 3) {
      Alert.alert('Topic Required', 'Please enter a consultation topic (at least 3 characters).');
      return;
    }
    setBooking(true);
    try {
      const typeMap: Record<string, string> = { video: 'VIDEO', audio: 'AUDIO', chat: 'CHAT' };
      const consultation = await consultationsAPI.book({
        expertId,
        date: buildDateStr(selectedDate),
        time: selectedSlot.time,
        duration,
        type: typeMap[sessionType] ?? 'VIDEO',
        topic: topic.trim(),
      });
      onConfirm({
        consultationId: consultation.id,
        expertId,
        expertName: expert?.name ?? 'Expert',
        date: `${MONTH_NAMES[viewMonth]} ${selectedDate}, ${viewYear}`,
        time: selectedSlot.time,
        duration,
        sessionType,
        price: totalPrice,
      });
    } catch (err: any) {
      Alert.alert('Booking Failed', err?.message ?? 'Unable to create consultation. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  if (loadingExpert) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    );
  }

  const calendarCells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const isPastDate = (day: number) =>
    viewYear < now.getFullYear() ||
    (viewYear === now.getFullYear() && viewMonth < now.getMonth()) ||
    (viewYear === now.getFullYear() && viewMonth === now.getMonth() && day < now.getDate());

  const goMonthBack = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
    setSelectedDate(1); setSelectedSlot(null); setSlots([]);
  };
  const goMonthFwd = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
    setSelectedDate(1); setSelectedSlot(null); setSlots([]);
  };

  const initials = (expert?.name ?? 'E').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const bg = colors.background;
  const card = isDark ? colors.surface : '#fff';
  const border = isDark ? colors.border : '#E8EDF2';
  const text = colors.text;
  const textSec = colors.textSecondary;

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, backgroundColor: card, borderBottomColor: border }]}>
        <TouchableOpacity onPress={onBack} style={[s.iconBtn, { backgroundColor: isDark ? colors.surface : '#F5F6F8' }]} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: text }]}>Schedule Consultation</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Expert card */}
        <View style={[s.expertCard, { backgroundColor: card, borderColor: border }]}>
          <View style={s.expertAvatar}>
            <Text style={s.expertInitials}>{initials}</Text>
          </View>
          <View style={s.expertInfo}>
            <Text style={[s.expertName, { color: text }]}>{expert?.name}</Text>
            <Text style={[s.expertTitle, { color: textSec }]}>{expert?.title}</Text>
            <View style={s.expertMeta}>
              <Ionicons name="star" size={13} color="#F59E0B" />
              <Text style={[s.expertMetaText, { color: textSec }]}>
                {expert?.rating?.toFixed(1) ?? '—'} · {(expert?.hourlyRate ?? 0).toLocaleString('fr-DZ')} DZD/hr
              </Text>
            </View>
          </View>
          <View style={[s.availPill, { backgroundColor: TEAL + '18' }]}>
            <View style={s.availDot} />
            <Text style={[s.availText, { color: TEAL }]}>Available</Text>
          </View>
        </View>

        {/* Topic */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: text }]}>Consultation Topic <Text style={{ color: '#EF4444' }}>*</Text></Text>
          <TextInput
            style={[s.topicInput, { backgroundColor: isDark ? colors.surface : '#F8FAFC', borderColor: border, color: text }]}
            placeholder="e.g. Market entry strategy for Algeria..."
            placeholderTextColor={textSec}
            value={topic}
            onChangeText={setTopic}
            maxLength={120}
            returnKeyType="done"
          />
        </View>

        {/* Session Type */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: text }]}>Session Type</Text>
          <View style={s.row}>
            {SESSION_TYPES.map(type => {
              const active = sessionType === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[s.typeBtn, { borderColor: active ? TEAL : border, backgroundColor: active ? TEAL + '12' : card }]}
                  onPress={() => setSessionType(type.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={type.icon} size={17} color={active ? TEAL : textSec} />
                  <Text style={[s.typeBtnText, { color: active ? TEAL : textSec }]}>{type.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Duration */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: text }]}>Duration</Text>
          <View style={s.row}>
            {DURATIONS.map(d => {
              const active = duration === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[s.durationBtn, { borderColor: active ? TEAL : border, backgroundColor: active ? TEAL : card }]}
                  onPress={() => setDuration(d)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.durationText, { color: active ? '#fff' : textSec }]}>{d} min</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Calendar */}
        <View style={s.section}>
          <View style={s.monthNav}>
            <TouchableOpacity onPress={goMonthBack} style={[s.monthBtn, { backgroundColor: isDark ? colors.surface : '#F5F6F8' }]}>
              <Ionicons name="chevron-back" size={18} color={text} />
            </TouchableOpacity>
            <Text style={[s.monthLabel, { color: text }]}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={goMonthFwd} style={[s.monthBtn, { backgroundColor: isDark ? colors.surface : '#F5F6F8' }]}>
              <Ionicons name="chevron-forward" size={18} color={text} />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={s.dayHeaderRow}>
            {DAY_LABELS.map(d => (
              <Text key={d} style={[s.dayHeader, { color: textSec }]}>{d}</Text>
            ))}
          </View>

          {/* Date cells */}
          <View style={s.calGrid}>
            {calendarCells.map((day, idx) => {
              if (day === null) return <View key={`empty-${idx}`} style={s.dateCell} />;
              const isSelected = selectedDate === day;
              const isPast = isPastDate(day);
              const isToday = day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
              const dateStr = buildDateStr(day);
              const hasDot = availableDates.has(dateStr);
              return (
                <TouchableOpacity
                  key={`d${day}`}
                  style={[
                    s.dateCell,
                    isToday && !isSelected && { backgroundColor: TEAL + '20' },
                    isSelected && { backgroundColor: TEAL },
                    isPast && { opacity: 0.3 },
                  ]}
                  onPress={() => !isPast && setSelectedDate(day)}
                  disabled={isPast}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    s.dateCellText,
                    { color: text },
                    isSelected && { color: '#fff', fontWeight: '700' },
                    isToday && !isSelected && { color: TEAL },
                  ]}>
                    {day}
                  </Text>
                  {hasDot && !isSelected && (
                    <View style={s.availDotCal} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Time Slots */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: text }]}>
            Available Times · {MONTH_NAMES[viewMonth]} {selectedDate}
          </Text>
          {loadingSlots ? (
            <ActivityIndicator size="small" color={TEAL} style={{ marginVertical: 12 }} />
          ) : slots.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 20, gap: 6 }}>
              <Ionicons name="calendar-outline" size={32} color={textSec} />
              <Text style={[s.noSlots, { color: textSec }]}>No available slots for this date.</Text>
              <Text style={[{ color: textSec, fontSize: 12, textAlign: 'center' }]}>
                Try another date — green dots mark dates with availability.
              </Text>
            </View>
          ) : (
            <View style={s.slotsGrid}>
              {slots.map(slot => {
                const active = selectedSlot?.id === slot.id;
                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[
                      s.slotBtn,
                      { borderColor: active ? TEAL : border, backgroundColor: active ? TEAL : card },
                      !slot.isAvailable && { opacity: 0.35 },
                    ]}
                    onPress={() => slot.isAvailable && setSelectedSlot(slot)}
                    disabled={!slot.isAvailable}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.slotText, { color: active ? '#fff' : textSec }]}>{slot.time}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Bottom Bar */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 16, backgroundColor: card, borderTopColor: border }]}>
        <View style={s.priceRow}>
          <Text style={[s.priceLabel, { color: textSec }]}>Total for {duration} min</Text>
          <Text style={[s.priceValue, { color: text }]}>
            {totalPrice > 0 ? totalPrice.toLocaleString('fr-DZ', { maximumFractionDigits: 0 }) + ' DZD' : '—'}
          </Text>
        </View>
        <TouchableOpacity
          style={[s.confirmBtn, (!selectedSlot || booking) && { opacity: 0.5 }]}
          onPress={handleConfirm}
          disabled={!selectedSlot || booking}
          activeOpacity={0.85}
        >
          {booking
            ? <ActivityIndicator size="small" color="#fff" />
            : <>
                <Text style={s.confirmBtnText}>Confirm & Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingBottom: 12, borderBottomWidth: 1, justifyContent: 'space-between',
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  expertCard: {
    flexDirection: 'row', alignItems: 'center', margin: 16,
    borderRadius: 18, padding: 14, borderWidth: 1, gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  expertAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center',
  },
  expertInitials: { fontSize: 18, fontWeight: '800', color: '#fff' },
  expertInfo: { flex: 1 },
  expertName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  expertTitle: { fontSize: 12, marginBottom: 4 },
  expertMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  expertMetaText: { fontSize: 12 },
  availPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  availDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: TEAL },
  availText: { fontSize: 11, fontWeight: '600' },

  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },

  topicInput: {
    borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, minHeight: 48,
  },

  row: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
  },
  typeBtnText: { fontSize: 12, fontWeight: '600' },
  durationBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, alignItems: 'center',
  },
  durationText: { fontSize: 13, fontWeight: '600' },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  monthBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '700' },

  dayHeaderRow: { flexDirection: 'row', marginBottom: 4 },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', paddingBottom: 6, writingDirection: 'ltr' },

  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dateCell: {
    width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 22,
  },
  dateCellText: { fontSize: 14, fontWeight: '500' },
  availDotCal: { width: 5, height: 5, borderRadius: 3, backgroundColor: TEAL, position: 'absolute', bottom: 2 },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5 },
  slotText: { fontSize: 13, fontWeight: '600', writingDirection: 'ltr' },
  noSlots: { fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginVertical: 12 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 6 },
      android: { elevation: 6 },
    }),
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceLabel: { fontSize: 14 },
  priceValue: { fontSize: 20, fontWeight: '700' },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: TEAL, borderRadius: 14, paddingVertical: 16,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
