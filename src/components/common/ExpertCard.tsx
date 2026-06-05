import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Expert } from '../../types';
import { Colors, Radius, Shadow } from '../../theme';
import { StarRating } from './StarRating';
import { Badge } from './Badge';

interface ExpertCardProps {
  expert: Expert;
  onPress: () => void;
  compact?: boolean;
}

export const ExpertCard: React.FC<ExpertCardProps> = ({ expert, onPress, compact = false }) => {
  if (compact) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={styles.compactCard}
        activeOpacity={0.85}
      >
        <View style={styles.compactAvatarWrap}>
          <Image source={{ uri: expert.avatar }} style={styles.compactAvatar} />
          <View
            style={[
              styles.onlineDot,
              { backgroundColor: expert.isOnline ? Colors.primary : Colors.textTertiary },
            ]}
          />
        </View>
        <Text style={styles.compactName} numberOfLines={1}>{expert.name}</Text>
        <Text style={styles.compactTitle} numberOfLines={1}>{expert.title}</Text>
        <View style={styles.compactRating}>
          <Ionicons name="star" size={11} color={Colors.ratingGold} />
          <Text style={styles.compactRatingText}>{expert.rating}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.card}
      activeOpacity={0.85}
    >
      {expert.isVerified && (
        <View style={styles.verifiedBadge}>
          <Badge label="Verified" variant="success" size="sm" />
        </View>
      )}

      <View style={styles.top}>
        <View style={styles.avatarWrap}>
          <Image source={{ uri: expert.avatar }} style={styles.avatar} />
          <View
            style={[
              styles.onlineDot,
              { backgroundColor: expert.isOnline ? Colors.primary : Colors.textTertiary },
            ]}
          />
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{expert.name}</Text>
          <Text style={styles.title}>{expert.title}</Text>
          {expert.company && (
            <Text style={styles.company}>{expert.company}</Text>
          )}
          <View style={styles.ratingRow}>
            <StarRating rating={expert.rating} size={13} />
            <Text style={styles.ratingText}>
              {expert.rating} ({expert.reviewCount})
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.tags}>
        {expert.expertise.slice(0, 3).map(tag => (
          <Badge key={tag} label={tag} variant="primary" size="sm" style={styles.tag} />
        ))}
      </View>

      <View style={styles.bottom}>
        <View style={styles.stat}>
          <Ionicons name="briefcase-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.statText}>{expert.consultations}+ sessions</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.statText}>{expert.responseTime}</Text>
        </View>
        <View style={styles.priceWrap}>
          <Text style={styles.price}>${expert.hourlyRate}</Text>
          <Text style={styles.priceUnit}>/hr</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.xl,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    ...Shadow.md,
    overflow: 'hidden',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  top: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatarWrap: {
    marginRight: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.borderLight,
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
    bottom: 2,
    right: 2,
    borderWidth: 2,
    borderColor: Colors.backgroundWhite,
  },
  info: {
    flex: 1,
    paddingRight: 40,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  title: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  company: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 4,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    marginRight: 0,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 10,
    gap: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginLeft: 'auto',
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  priceUnit: {
    fontSize: 12,
    color: Colors.textMuted,
    marginLeft: 2,
  },

  // Compact styles
  compactCard: {
    width: 130,
    backgroundColor: Colors.backgroundWhite,
    borderRadius: Radius.xl,
    padding: 14,
    alignItems: 'center',
    ...Shadow.md,
  },
  compactAvatarWrap: {
    marginBottom: 8,
  },
  compactAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.borderLight,
  },
  compactName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  compactTitle: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
  compactRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  compactRatingText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
});
