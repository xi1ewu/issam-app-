import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme';

const { width, height } = Dimensions.get('window');
const PRIMARY = Colors.primary; // teal #00D598
const DARK = '#1A2332';

// Replace each file with the matching illustration from the design
const IMAGES = [
  require('../../../assets/images/onboarding1.png'),
  require('../../../assets/images/onboarding2.png'),
  require('../../../assets/images/onboarding3.png'),
];

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  bullets: { icon: keyof typeof Ionicons.glyphMap; text: string }[];
}

const slides: Slide[] = [
  {
    id: '1',
    title: 'Get Expert Guidance, Fast',
    subtitle: 'Connect with verified consultants tailored to your goals.',
    bullets: [
      { icon: 'shield-checkmark', text: 'Secure Communication' },
      { icon: 'cash',             text: 'Transparent Pricing' },
      { icon: 'star',             text: 'Great Ratings & reviews' },
    ],
  },
  {
    id: '2',
    title: 'Simple. Secure. Effective.',
    subtitle: 'Choose your consulting category, match with the right expert and get actionable advice',
    bullets: [
      { icon: 'shield-checkmark', text: 'Privacy-First Platform' },
      { icon: 'ribbon',           text: 'Verified Excellence' },
      { icon: 'lock-closed',      text: 'End-to-End Encryption' },
    ],
  },
  {
    id: '3',
    title: 'Start Your First Consultation',
    subtitle: 'Whether you need quick advice or long-term guidance',
    bullets: [
      { icon: 'close-circle-outline', text: 'Cancel anytime' },
      { icon: 'cash',                 text: 'Flexible pricing' },
      { icon: 'flash',                text: 'Instant or scheduled sessions' },
    ],
  },
];

interface Props { onComplete: () => void }

export const OnboardingScreen: React.FC<Props> = ({ onComplete }) => {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const goNext = () => {
    if (currentIndex < slides.length - 1) {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    } else {
      onComplete();
    }
  };

  const goBack = () => {
    if (currentIndex > 0) {
      const prev = currentIndex - 1;
      flatListRef.current?.scrollToIndex({ index: prev, animated: true });
      setCurrentIndex(prev);
    }
  };

  const ILLUS_HEIGHT = height * 0.42;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Top bar: logo + Skip */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        {/* WXW logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoW}>W</Text>
          <View style={styles.logoCross}>
            <View style={styles.crossLine1} />
            <View style={styles.crossLine2} />
          </View>
          <Text style={styles.logoW}>W</Text>
        </View>
        <TouchableOpacity onPress={onComplete} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <View style={[styles.slide, { width }]}>
            {/* Illustration */}
            <View style={[styles.illustrationWrap, { height: ILLUS_HEIGHT }]}>
              <Image
                source={IMAGES[index]}
                style={[styles.illustrationImage, { height: ILLUS_HEIGHT * 0.9 }]}
                resizeMode="contain"
              />
            </View>

            {/* Text content */}
            <View style={styles.content}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>

              <View style={styles.bulletList}>
                {item.bullets.map((b: Slide['bullets'][number], i: number) => (
                  <View key={i} style={styles.bulletRow}>
                    <View style={[
                      styles.bulletIcon,
                      // alternate teal variants to match the design
                      i === 1 && styles.bulletIconAlt,
                    ]}>
                      <Ionicons name={b.icon} size={15} color={PRIMARY} />
                    </View>
                    <Text style={styles.bulletText}>{b.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      />

      {/* Dot indicators */}
      <View style={styles.dotsRow}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === currentIndex && styles.dotActive]}
          />
        ))}
      </View>

      {/* Bottom nav */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          onPress={goBack}
          activeOpacity={0.7}
          style={[styles.prevBtn, currentIndex === 0 && styles.invisible]}
          disabled={currentIndex === 0}
        >
          <Text style={styles.prevText}>Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={goNext} style={styles.nextBtn} activeOpacity={0.85}>
          <Text style={styles.nextText}>
            {currentIndex < slides.length - 1 ? 'Next' : 'Get Started'}
          </Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  logoWrap: { flexDirection: 'row', alignItems: 'center' },
  logoW: { fontSize: 22, fontWeight: '900', color: PRIMARY, letterSpacing: -1 },
  logoCross: { width: 20, height: 24, alignItems: 'center', justifyContent: 'center' },
  crossLine1: {
    position: 'absolute', width: 2.5, height: 24,
    backgroundColor: PRIMARY, borderRadius: 2,
    transform: [{ rotate: '22deg' }], left: 7,
  },
  crossLine2: {
    position: 'absolute', width: 2.5, height: 24,
    backgroundColor: PRIMARY, borderRadius: 2,
    transform: [{ rotate: '-22deg' }], left: 11,
  },
  skipText: { fontSize: 15, color: DARK, fontWeight: '600' },

  slide: { flex: 1 },

  illustrationWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  illustrationImage: { width: width * 0.85 },

  content: { paddingHorizontal: 28, paddingTop: 20, flex: 1 },
  title: {
    fontSize: 26, fontWeight: '800', color: DARK,
    lineHeight: 34, marginBottom: 8,
  },
  subtitle: {
    fontSize: 14, color: '#6B7A8D', lineHeight: 22, marginBottom: 20,
  },

  bulletList: { gap: 14 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bulletIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: PRIMARY + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  bulletIconAlt: { backgroundColor: PRIMARY + '22' },
  bulletText: { fontSize: 15, color: DARK, fontWeight: '500', flex: 1 },

  dotsRow: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 6, paddingVertical: 8,
  },
  dot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#DDE1E7',
  },
  dotActive: { backgroundColor: DARK, width: 20, borderRadius: 4 },

  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 4,
  },
  invisible: { opacity: 0 },
  prevBtn: { paddingVertical: 12 },
  prevText: { fontSize: 15, color: DARK, fontWeight: '600' },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: DARK, borderRadius: 28,
    paddingVertical: 14, paddingHorizontal: 28,
  },
  nextText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
