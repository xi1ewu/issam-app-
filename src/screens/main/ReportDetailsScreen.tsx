import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../hooks/useAppTheme';
import { reportsAPI } from '../../services/api';
import { Colors } from '../../theme';

const TEAL    = Colors.primary;
const TEXT    = '#1A2332';
const TEXT_SEC = '#64748B';

interface Props {
  reportId: string;
  onBack: () => void;
  onBookConsultation: () => void;
}

export const ReportDetailsScreen: React.FC<Props> = ({ reportId, onBack, onBookConsultation }) => {
  const { colors, isDark } = useAppTheme();
  const [report, setReport]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const bg   = isDark ? colors.background : '#FFFFFF';
  const text = isDark ? colors.text : TEXT;
  const sec  = isDark ? colors.icon : TEXT_SEC;

  useEffect(() => {
    if (!reportId) { setLoading(false); return; }
    reportsAPI.getById(reportId)
      .then(setReport)
      .catch(() => setError('Could not load report.'))
      .finally(() => setLoading(false));
  }, [reportId]);

  const handleShare = async () => {
    try {
      await Share.share({
        title: report?.title ?? 'Report',
        message: `${report?.title ?? 'Check out this report'} — DA Consulting`,
      });
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: bg }]} edges={['top']}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={24} color={text} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !report) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: bg }]} edges={['top']}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={24} color={text} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={TEAL + '60'} />
          <Text style={[styles.errorText, { color: sec }]}>{error || 'Report not found.'}</Text>
          <TouchableOpacity onPress={onBack} style={styles.backLink}>
            <Text style={{ color: TEAL, fontWeight: '700' }}>← Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const categoryColor = '#00C896';
  const initial = (report.author ?? 'A').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: bg }]} edges={['top']}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: text }]} numberOfLines={1}>
          {report.title}
        </Text>
        <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={22} color={TEAL} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Meta badges */}
        <View style={styles.metaRow}>
          {report.isPremium && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumText}>PREMIUM</Text>
            </View>
          )}
          <View style={[styles.catBadge, { backgroundColor: categoryColor + '18' }]}>
            <Text style={[styles.catText, { color: categoryColor }]}>
              {(report.category ?? 'Report').toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.publishedDate, { color: sec }]}>
            {report.publishedAt ?? report.createdAt?.slice(0, 10) ?? ''}
          </Text>
        </View>

        {/* Title */}
        <Text style={[styles.reportTitle, { color: text }]}>{report.title}</Text>

        {/* Author */}
        <View style={styles.authorRow}>
          <View style={[styles.authorAvatar, { backgroundColor: TEAL + '20' }]}>
            <Text style={[styles.authorInitial, { color: TEAL }]}>{initial}</Text>
          </View>
          <View>
            <Text style={[styles.authorName, { color: text }]}>{report.author ?? 'DA Consulting'}</Text>
            <Text style={[styles.authorTitle, { color: sec }]}>
              {report.readTime ?? 5} min read
            </Text>
          </View>
        </View>

        {/* Description */}
        {!!report.description && (
          <>
            <Text style={[styles.sectionTitle, { color: text }]}>Summary</Text>
            <Text style={[styles.paragraph, { color: sec }]}>{report.description}</Text>
          </>
        )}

        {/* Full content */}
        {!!report.content && (
          <>
            <Text style={[styles.sectionTitle, { color: text }]}>Full Report</Text>
            <Text style={[styles.paragraph, { color: sec }]}>{report.content}</Text>
          </>
        )}

        {/* CTA */}
        <View style={[styles.ctaCard, { backgroundColor: TEAL + '10', borderColor: TEAL + '30' }]}>
          <Ionicons name="bulb-outline" size={22} color={TEAL} style={{ marginBottom: 8 }} />
          <Text style={[styles.ctaTitle, { color: text }]}>
            Need expert analysis on this topic?
          </Text>
          <Text style={[styles.ctaBody, { color: sec }]}>
            Book a consultation with one of our verified experts for personalized insights.
          </Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={onBookConsultation} activeOpacity={0.85}>
            <Text style={styles.ctaBtnText}>Find an Expert</Text>
            <Ionicons name="arrow-forward" size={15} color="#fff" />
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorText: { fontSize: 15, textAlign: 'center' },
  backLink: { marginTop: 8 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '700', marginHorizontal: 8 },

  scroll: { paddingHorizontal: 20, paddingBottom: 60 },

  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  premiumBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  premiumText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  catBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  catText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  publishedDate: { fontSize: 12 },

  reportTitle: { fontSize: 22, fontWeight: '800', lineHeight: 30, marginBottom: 16 },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  authorAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  authorInitial: { fontSize: 16, fontWeight: '800' },
  authorName:  { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  authorTitle: { fontSize: 12 },

  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, marginTop: 8 },
  paragraph:    { fontSize: 14, lineHeight: 24, marginBottom: 16 },

  ctaCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginTop: 8,
    alignItems: 'flex-start',
  },
  ctaTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  ctaBody:  { fontSize: 13, lineHeight: 20, marginBottom: 16 },
  ctaBtn: {
    backgroundColor: TEAL,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  ctaBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default ReportDetailsScreen;
