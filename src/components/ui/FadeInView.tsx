/**
 * Fade-in + optional slide-up animation for list items and cards
 */
import React, { useEffect } from "react";
import { type ViewProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

type Props = ViewProps & {
  children: React.ReactNode;
  /** Delay in ms before starting animation */
  delay?: number;
  /** Duration for opacity (default 400) */
  duration?: number;
  /** Slide up distance (default 12); 0 = no slide */
  slideUp?: number;
  /** Stagger index for list (delay = index * 60ms) */
  index?: number;
};

export default function FadeInView({
  children,
  delay = 0,
  duration = 400,
  slideUp = 12,
  index = 0,
  style,
  ...rest
}: Props) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(slideUp);

  useEffect(() => {
    const totalDelay = delay + index * 60;
    opacity.value = withDelay(
      totalDelay,
      withTiming(1, { duration })
    );
    if (slideUp > 0) {
      translateY.value = withDelay(
        totalDelay,
        withSpring(0, { damping: 18, stiffness: 120 })
      );
    }
    // opacity / translateY are Reanimated shared values — not valid hook deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, duration, slideUp, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]} {...rest}>
      {children}
    </Animated.View>
  );
}
