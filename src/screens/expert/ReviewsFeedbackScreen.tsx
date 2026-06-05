import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Shadow } from '../../theme';
import { StarRating } from '../../components/common';
import { reviewsAPI, authAPI } from '../../services/api';

interface Props {
  onBack: () => void;
}

export const ReviewsFeedbackScreen: React.FC<Props> = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const [reviews, setReviews] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    authAPI.getMe()
      .then(me => {
        const expertId = me?.expert?.id;
        if (!expertId) { setLoading(false); return Promise.resolve([]); }
        return reviewsAPI.getExpertReviews(expertId);
      })
      .then(res => { if (res) setReviews(res); })
      .catch(err => console.warn('Error fetching reviews:', err))
      .finally(() => setLoading(false));
  }, []);

  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const ratingDist = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
    pct: reviews.length > 0 ? (reviews.filter(r => r.rating === star).length / reviews.length) * 100 : 0,
  }));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reviews & Feedback</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <Text style={styles.avgRating}>{avgRating.toFixed(1)}</Text>
            <StarRating rating={avgRating} size={18} />
            <Text style={styles.totalReviews}>{reviews.length} reviews</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.ratingBars}>
            {ratingDist.map(({ star, count, pct }) => (
              <View key={star} style={styles.ratingBarRow}>
                <Text style={styles.starNum}>{star}</Text>
                <Ionicons name="star" size={11} color={Colors.ratingGold} />
                <View style={styles.ratingBarBg}>
                  <View style={[styles.ratingBarFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.ratingCount}>{count}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Reviews List */}
        <View style={styles.reviewsList}>
          {reviews.length === 0 && !loading && (
             <Text style={{textAlign: 'center', marginTop: 20, color: Colors.textMuted}}>No reviews yet.</Text>
          )}
          {reviews.map(review => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewAvatar}>
                  <Text style={styles.reviewAvatarText}>
                    {(review.author?.name || review.authorName || '?').split(' ').map((n: string) => n[0] || '').join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.reviewMeta}>
                  <Text style={styles.reviewName}>{review.author?.name || review.authorName || 'Anonymous'}</Text>
                  <View style={styles.reviewRatingRow}>
                    <StarRating rating={review.rating} size={13} />
                    <Text style={styles.reviewDate}>{review.createdAt ? new Date(review.createdAt).toLocaleDateString() : review.date}</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.reviewContent}>{review.comment || review.content}</Text>
              <TouchableOpacity style={styles.replyBtn} activeOpacity={0.7}>
                <Ionicons name="return-down-forward-outline" size={14} color={Colors.primary} />
                <Text style={styles.replyBtnText}>Reply</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundWhite,
    margin: 16,
    borderRadius: Radius.xl,
    padding: 20,
    ...Shadow.md,
    gap: 16,
  },
  summaryLeft: { alignItems: 'center', width: 80, gap: 6 },
  avgRating: { fontSize: 40, fontWeight: '700', color: Colors.textPrimary },
  totalReviews: { fontSize: 12, color: Colors.textMuted },
  summaryDivider: { width: 1, backgroundColor: Colors.borderLight },
  ratingBars: { flex: 1, gap: 6 },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  starNum: { fontSize: 12, color: Colors.textMuted, width: 10 },
  ratingBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  ratingBarFill: { height: '100%', backgroundColor: Colors.ratingGold, borderRadius: 4 },
  ratingCount: { fontSize: 12, color: Colors.textMuted, width: 16, textAlign: 'right' },
  reviewsList: { paddingHorizontal: 16, gap: 12 },
  reviewCard: {
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.xl,
    padding: 16,
    ...Shadow.sm,
    gap: 10,
  },
  reviewHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: { fontSize: 14, fontWeight: '700', color: Colors.textWhite },
  reviewMeta: { flex: 1 },
  reviewName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 3 },
  reviewRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewDate: { fontSize: 12, color: Colors.textMuted },
  reviewContent: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  replyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
  },
  replyBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
});
