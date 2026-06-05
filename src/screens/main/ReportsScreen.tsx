import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CardSkeleton } from "../../components/ui/Skeleton";
import FadeInView from "../../components/ui/FadeInView";
import { useTranslation } from "../../constants/i18n";
import { Fonts, Radius, Shadow } from "../../theme";
import { useAppTheme } from "../../hooks/useAppTheme";
import { reportsAPI } from "../../services/api";

const CATEGORIES = ["All", "Strategy", "Finance", "Economy", "Energy", "Legal"];

type Report = {
  id: string;
  title: string;
  category: string;
  readTime: string;
  views: string;
  premium: boolean;
};

interface Props {
  onReportPress: (id: string) => void;
  onNotificationsPress?: () => void;
}

export const ReportsScreen: React.FC<Props> = ({ onReportPress, onNotificationsPress }) => {
  const { colors, isDark } = useAppTheme();
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    reportsAPI.getAll()
      .then((rows) =>
        setReports(
          rows.map((r) => ({
            id: r.id,
            title: r.title,
            category: r.category,
            readTime: `${r.readTime ?? 10} min`,
            views: "—",
            premium: Boolean(r.isPremium),
          })),
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered =
    activeFilter === "All"
      ? reports
      : reports.filter((r) => r.category === activeFilter);

  const renderReport = ({ item, index }: { item: Report; index: number }) => (
    <FadeInView key={item.id} index={index} slideUp={8}>
    <Pressable
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? colors.border : "#F0F0F0",
        },
      ]}
      onPress={() => onReportPress(item.id)}
    >
      <View style={styles.cardImagePlaceholder}>
        {item.premium && (
          <View style={[styles.premiumBadge, { backgroundColor: colors.tint }]}>
            <Text style={styles.premiumText}>PREMIUM</Text>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <View
          style={[
            styles.catBadge,
            { backgroundColor: isDark ? colors.surface : "#F5F6F8" },
          ]}
        >
          <Text
            style={[
              styles.catText,
              { color: isDark ? colors.textSecondary : "#555" },
            ]}
            numberOfLines={1}
          >
            {item.category}
          </Text>
        </View>
        <Text
          style={[styles.cardTitle, { color: colors.text }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          📖 {item.readTime} read · 👁 {item.views} views
        </Text>
      </View>
    </Pressable>
    </FadeInView>
  );

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.brand, { color: colors.tint }]}>WHEELWORLD</Text>
        <Pressable
          style={[
            styles.iconBtn,
            { backgroundColor: isDark ? colors.surface : "#F5F6F8" },
          ]}
          onPress={onNotificationsPress}
        >
          <Ionicons
            name="notifications-outline"
            size={22}
            color={colors.text}
          />
        </Pressable>
      </View>

      <Text style={[styles.pageTitle, { color: colors.text }]}>
        {t("marketReports").split(" ")[0]}{" "}
        <Text style={{ color: colors.tint }}>
          {t("marketReports").split(" ").slice(1).join(" ")}
        </Text>
      </Text>

      {/* Search */}
      <View
        style={[
          styles.searchBar,
          { backgroundColor: isDark ? colors.surface : "#F5F6F8" },
        ]}
      >
        <Ionicons
          name="search-outline"
          size={18}
          color={colors.textSecondary}
        />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t("searchReports")}
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
      >
        {CATEGORIES.map((c) => {
          const active = c === activeFilter;
          return (
            <Pressable
              key={c}
              style={[
                styles.chip,
                {
                  borderColor: isDark ? colors.border : "#E5E7EB",
                  backgroundColor: isDark ? colors.surface : "#fff",
                },
                active && {
                  backgroundColor: colors.tint,
                  borderColor: colors.tint,
                },
              ]}
              onPress={() => setActiveFilter(c)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: active ? "#fff" : colors.text },
                ]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {c}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </ScrollView>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          renderItem={renderReport}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  brand: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
    fontFamily: Fonts.sans,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
  },
  chipsScroll: {
    flexGrow: 0,
    marginBottom: 4,
  },
  chipsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingRight: 28,
    paddingBottom: 14,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
    minWidth: 72,
    flexShrink: 0,
    marginRight: 10,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: Fonts.sans,
    writingDirection: 'ltr',
    textAlign: 'center',
  },
  listContent: { paddingHorizontal: 20, paddingBottom: 120 },
  card: {
    borderRadius: Radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 14,
    ...Shadow.card,
  },
  cardImagePlaceholder: {
    height: 120,
    backgroundColor: "#2D3748",
    justifyContent: "flex-start",
    paddingTop: 10,
    paddingLeft: 10,
  },
  premiumBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  premiumText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  cardBody: { padding: 14 },
  catBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  catText: { fontSize: 12, fontWeight: "600", fontFamily: Fonts.sans },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
    lineHeight: 21,
    fontFamily: Fonts.sans,
  },
  meta: { fontSize: 12 },
});
