import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme';

interface StarRatingProps {
  rating: number;
  size?: number;
  style?: object;
}

export const StarRating: React.FC<StarRatingProps> = ({ rating, size = 14, style }) => {
  return (
    <View style={[styles.container, style]}>
      {[1, 2, 3, 4, 5].map(star => (
        <Ionicons
          key={star}
          name={
            rating >= star
              ? 'star'
              : rating >= star - 0.5
              ? 'star-half'
              : 'star-outline'
          }
          size={size}
          color={Colors.ratingGold}
          style={{ marginRight: 1 }}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
