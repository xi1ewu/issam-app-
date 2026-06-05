/**
 * Skeleton – shimmer loading placeholder
 */
import { useAppTheme } from "@/hooks/useAppTheme";
import React, { useEffect, useRef } from "react";
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

interface SkeletonProps {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

export default function Skeleton({
  width,
  height,
  radius = 8,
  style,
}: SkeletonProps) {
  const { isDark } = useAppTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const bg = isDark ? "#2A2D30" : "#E5E7EB";

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: bg,
          opacity,
        },
        style,
      ]}
    />
  );
}

/* ── Pre-built skeleton layouts ── */

export function CardSkeleton() {
  const { isDark, colors } = useAppTheme();
  return (
    <View
      style={[
        skeletonStyles.card,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? colors.border : "#F0F0F0",
        },
      ]}
    >
      <Skeleton width="100%" height={120} radius={12} />
      <View style={skeletonStyles.cardBody}>
        <Skeleton width="40%" height={14} radius={6} />
        <Skeleton width="90%" height={16} radius={6} style={{ marginTop: 8 }} />
        <Skeleton width="60%" height={12} radius={6} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

export function ExpertCardSkeleton() {
  const { isDark, colors } = useAppTheme();
  return (
    <View
      style={[
        skeletonStyles.card,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? colors.border : "#F0F0F0",
          padding: 16,
        },
      ]}
    >
      <View style={skeletonStyles.expertRow}>
        <Skeleton width={54} height={54} radius={27} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Skeleton width="70%" height={16} radius={6} />
          <Skeleton
            width="50%"
            height={12}
            radius={6}
            style={{ marginTop: 6 }}
          />
          <Skeleton
            width="35%"
            height={12}
            radius={6}
            style={{ marginTop: 6 }}
          />
        </View>
      </View>
      <View style={skeletonStyles.tagsRow}>
        <Skeleton width={70} height={24} radius={8} />
        <Skeleton width={60} height={24} radius={8} />
        <Skeleton width={80} height={24} radius={8} />
      </View>
      <Skeleton
        width="100%"
        height={44}
        radius={12}
        style={{ marginTop: 14 }}
      />
    </View>
  );
}

export function ProfileSkeleton() {
  return (
    <View style={skeletonStyles.profileContainer}>
      <Skeleton width={80} height={80} radius={40} />
      <Skeleton width={160} height={20} radius={8} style={{ marginTop: 12 }} />
      <Skeleton width={200} height={14} radius={6} style={{ marginTop: 6 }} />
      <Skeleton width={120} height={28} radius={14} style={{ marginTop: 8 }} />
    </View>
  );
}

export function HomeCategorySkeleton() {
  const { isDark, colors } = useAppTheme();
  return (
    <View style={skeletonStyles.grid}>
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[
            skeletonStyles.gridCard,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? colors.border : "#F0F0F0",
            },
          ]}
        >
          <Skeleton width={44} height={44} radius={14} />
          <Skeleton
            width="70%"
            height={16}
            radius={6}
            style={{ marginTop: 10 }}
          />
          <Skeleton
            width="50%"
            height={12}
            radius={6}
            style={{ marginTop: 4 }}
          />
        </View>
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 14,
  },
  cardBody: { padding: 14 },
  expertRow: { flexDirection: "row", marginBottom: 12 },
  tagsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 0,
  },
  profileContainer: { alignItems: "center", paddingVertical: 24 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  gridCard: {
    width: "47%",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
});
