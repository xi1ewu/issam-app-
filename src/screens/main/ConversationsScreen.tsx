import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../hooks/useAppTheme';
import { Colors } from '../../theme';
import { useAppStore } from '../../store/useAppStore';
import { messagesAPI } from '../../services/api';

interface Props {
  onBack: () => void;
  onConversationPress: (conversationId: string, participantName: string, expertId?: string) => void;
}

export const ConversationsScreen: React.FC<Props> = ({ onBack, onConversationPress }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const currentUserId = useAppStore(s => s.user?.id ?? '');
  const clearUnread = useAppStore(s => s.clearUnread);

  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await messagesAPI.getConversations();
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    clearUnread();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const getOtherParticipant = (conv: any): { id: string; name: string; avatar?: string; expertId?: string } => {
    const parts: any[] = conv.participants ?? [];
    const other = parts.find((p: any) => p.userId !== currentUserId) ?? parts[0];
    if (!other) return { id: '', name: 'Unknown' };
    return {
      id: other.userId ?? '',
      name: other.user?.name ?? 'Unknown',
      avatar: other.user?.avatar,
      expertId: other.user?.role === 'EXPERT' ? other.userId : undefined,
    };
  };

  const formatTime = (ts: string) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString('en', { weekday: 'short' });
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  };

  const initials = (name: string) =>
    (name ?? '?').split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';

  const lastMessageText = (conv: any): string => {
    const msg = conv.lastMessage ?? conv.messages?.[conv.messages.length - 1];
    if (!msg?.content) return 'Start the conversation';
    return msg.content.length > 60 ? msg.content.slice(0, 60) + '…' : msg.content;
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: Colors.inputBg }]}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={conversations}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />}
        contentContainerStyle={conversations.length === 0 && styles.emptyContainer}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.tint + '20' }]}>
              <Ionicons name="chatbubbles-outline" size={36} color={colors.tint} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No conversations yet</Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              Start a chat with an expert from their profile page
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const other = getOtherParticipant(item);
          const unread: number = item.unreadCount ?? 0;
          const timeStr = formatTime(item.updatedAt ?? item.lastMessage?.createdAt ?? '');

          return (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: colors.card }]}
              onPress={() => onConversationPress(item.id, other.name, other.expertId)}
              activeOpacity={0.75}
            >
              {/* Avatar */}
              <View style={[styles.avatar, { backgroundColor: colors.tint + '25' }, other.avatar ? { backgroundColor: 'transparent' } : null]}>
                {other.avatar ? (
                  <Image source={{ uri: other.avatar }} style={styles.avatarImage} />
                ) : (
                  <Text style={[styles.avatarText, { color: colors.tint }]}>{initials(other.name)}</Text>
                )}
              </View>

              {/* Content */}
              <View style={styles.content}>
                <View style={styles.topRow}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {other.name}
                  </Text>
                  <Text style={[styles.time, { color: colors.textSecondary }]}>{timeStr}</Text>
                </View>
                <View style={styles.bottomRow}>
                  <Text
                    style={[
                      styles.preview,
                      { color: unread > 0 ? colors.text : colors.textSecondary },
                      unread > 0 && styles.previewBold,
                    ]}
                    numberOfLines={1}
                  >
                    {lastMessageText(item)}
                  </Text>
                  {unread > 0 && (
                    <View style={[styles.badge, { backgroundColor: colors.tint }]}>
                      <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    justifyContent: 'space-between',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 26 },
  avatarText: { fontSize: 18, fontWeight: '700' },
  content: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  time: { fontSize: 12 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { fontSize: 13, flex: 1 },
  previewBold: { fontWeight: '600' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  separator: { height: 1, marginLeft: 80 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', gap: 12, paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
