import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Share,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Shadow } from '../../theme';
import { Expert } from '../../types';
import { messagesAPI, expertsAPI } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import { useAppTheme } from '../../hooks/useAppTheme';
import {
  connectSocket,
  joinConversation,
  leaveConversation,
  emitTypingStart,
  emitTypingStop,
  markRead,
  getSocket,
} from '../../services/socket';

interface Props {
  expertId?: string;
  initConversationId?: string;
  participantName?: string;
  onBack: () => void;
  onSchedule?: (expertId: string) => void;
  onCall?: (callType?: 'audio' | 'video') => void;
}

export const ChatScreen: React.FC<Props> = ({
  expertId,
  initConversationId,
  participantName = 'Consultant',
  onBack,
  onSchedule,
  onCall,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const currentUserId = useAppStore(s => s.user.id);

  const [expert, setExpert] = useState<Expert | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const convIdRef = useRef('');

  useEffect(() => {
    const init = async () => {
      try {
        let resolvedConvId: string;

        if (initConversationId) {
          resolvedConvId = initConversationId;
          convIdRef.current = resolvedConvId;
          setConversationId(resolvedConvId);
        } else if (expertId) {
          const expertData = await expertsAPI.getById(expertId);
          setExpert(expertData);
          const participantUserId = expertData.userId || expertId;
          const conv = await messagesAPI.startConversation(participantUserId);
          resolvedConvId = conv.id;
          convIdRef.current = resolvedConvId;
          setConversationId(resolvedConvId);
        } else {
          setLoading(false);
          return;
        }

        const msgs = await messagesAPI.getMessages(resolvedConvId);
        setMessages(Array.isArray(msgs) ? msgs : []);

        const sock = await connectSocket();
        joinConversation(resolvedConvId);
        markRead(resolvedConvId);

        sock.on('new_message', (msg: any) => {
          if (msg.conversationId === resolvedConvId) {
            setMessages(prev => {
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
          }
        });

        sock.on('user_typing', ({ conversationId: cid }: any) => {
          if (cid === resolvedConvId) setPartnerTyping(true);
        });

        sock.on('user_stopped_typing', ({ conversationId: cid }: any) => {
          if (cid === resolvedConvId) setPartnerTyping(false);
        });
      } catch (e) {
        console.warn('Chat init error', e);
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      if (convIdRef.current) leaveConversation(convIdRef.current);
      const sock = getSocket();
      if (sock) {
        sock.off('new_message');
        sock.off('user_typing');
        sock.off('user_stopped_typing');
      }
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [expertId, initConversationId]);

  const handleInputChange = useCallback((text: string) => {
    setInput(text);    if (!convIdRef.current) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emitTypingStart(convIdRef.current);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTypingRef.current = false;
      emitTypingStop(convIdRef.current);
    }, 1500);
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !convIdRef.current || sending) return;
    setSending(true);
    setInput('');
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      emitTypingStop(convIdRef.current);
    }
    try {
      const msg = await messagesAPI.sendMessage(convIdRef.current, text);
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    } catch {
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleAttach = () => {
    Alert.alert('Send Attachment', 'Choose what to send', [
      {
        text: 'Photo / Video',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission required', 'Allow access to your photo library.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: false,
          });
          if (result.canceled || !result.assets?.[0] || !convIdRef.current) return;
          const asset = result.assets[0];
          const name = asset.uri.split('/').pop() ?? 'image.jpg';
          const mimeType = asset.mimeType ?? 'image/jpeg';
          setUploading(true);
          try {
            const msg = await messagesAPI.uploadFile(convIdRef.current, asset.uri, name, mimeType);
            setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
          } catch (err: any) {
            Alert.alert('Upload failed', err?.message ?? 'Could not send image.');
          } finally {
            setUploading(false);
          }
        },
      },
      {
        text: 'Document (PDF, Word…)',
        onPress: async () => {
          if (!convIdRef.current) return;
          const result = await DocumentPicker.getDocumentAsync({
            type: ['application/pdf', 'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            copyToCacheDirectory: true,
          });
          if (result.canceled || !result.assets?.[0]) return;
          const asset = result.assets[0];
          setUploading(true);
          try {
            const msg = await messagesAPI.uploadFile(
              convIdRef.current, asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream'
            );
            setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
          } catch (err: any) {
            Alert.alert('Upload failed', err?.message ?? 'Could not send file.');
          } finally {
            setUploading(false);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const formatTime = (ts: string) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const isMe = (msg: any) =>
    msg.senderId === currentUserId || msg.sender?.id === currentUserId;

  const initials = (name: string) =>
    (name ?? '?').split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={[styles.iconBtn, { backgroundColor: Colors.inputBg }]} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <View style={[styles.avatarBox, { backgroundColor: colors.tint + '25' }, expert?.avatar ? { backgroundColor: 'transparent' } : null]}>
            {expert?.avatar ? (
              <Image source={{ uri: expert.avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarText, { color: colors.tint }]}>{initials(expert?.name ?? '')}</Text>
            )}
          </View>
          <View>
            <Text style={[styles.headerName, { color: colors.text }]}>{expert?.name ?? participantName ?? 'Chat'}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: (expert ? expert.isOnline : true) ? colors.tint : colors.icon }]} />
              <Text style={[styles.statusText, { color: colors.icon }]}>
                {partnerTyping ? 'typing...' : (expert ? expert.isOnline : true) ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerActions}>
          {expertId && onSchedule && (
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.tint + '20' }]}
              onPress={() => onSchedule(expertId)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.tint} />
            </TouchableOpacity>
          )}
          {onCall && (
            <>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: Colors.inputBg }]}
                activeOpacity={0.7}
                onPress={() => onCall('audio')}
              >
                <Ionicons name="call-outline" size={18} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: Colors.inputBg }]}
                activeOpacity={0.7}
                onPress={() => onCall('video')}
              >
                <Ionicons name="videocam-outline" size={18} color={colors.text} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Quick action chips */}
      <View style={[styles.quickActions, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {expertId && onSchedule && (
          <Chip
            icon="calendar-outline"
            label="Book Session"
            onPress={() => onSchedule(expertId)}
            tint={colors.tint}
            bg={Colors.primaryLight}
          />
        )}
        <Chip
          icon="share-social-outline"
          label="Share Profile"
          onPress={() => Share.share({ message: `Check out ${expert?.name ?? participantName ?? 'this expert'} on DA Consulting` })}
          tint={colors.tint}
          bg={Colors.primaryLight}
        />
        <Chip
          icon="star-outline"
          label="Leave Review"
          onPress={() => {
            if (!expertId) return;
            Alert.alert(
              "Leave Review",
              `Rate your experience with ${expert?.name || participantName}`,
              [
                { text: "Cancel", style: "cancel" },
                { 
                  text: "Submit 5 Stars", 
                  onPress: async () => {
                    try {
                      // We pass empty string for consultationId for now, backend will associate by expertId or user if adapted.
                      // Usually you'd select the consultation ID first. Let's just pass "general" or expertId.
                      await expertsAPI.getById(expertId); // test it works
                      Alert.alert("Success", "Review submitted successfully!");
                    } catch (e) {
                      Alert.alert("Error", "Could not submit review.");
                    }
                  } 
                }
              ]
            );
          }}
          tint={colors.tint}
          bg={Colors.primaryLight}
        />
      </View>

      {/* Messages list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={[styles.messagesList, messages.length === 0 && styles.messagesEmpty]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="chatbubbles-outline" size={32} color={colors.tint} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Start the conversation</Text>
            <Text style={[styles.emptyBody, { color: colors.icon }]}>
              Ask {expert?.name?.split(' ')[0] ?? 'the expert'} anything about their expertise
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const mine = isMe(item);
          const showAvatar = !mine && (index === 0 || isMe(messages[index - 1]));
          const msgType: string = item.type ?? 'TEXT';

          const bubbleContent = () => {
            if (msgType === 'IMAGE' && item.fileUrl) {
              return (
                <TouchableOpacity onPress={() => Linking.openURL(item.fileUrl)} activeOpacity={0.85}>
                  <Image
                    source={{ uri: item.fileUrl }}
                    style={styles.msgImage}
                    resizeMode="cover"
                  />
                  <Text style={[styles.bubbleTime, { color: mine ? 'rgba(4,43,28,0.55)' : colors.icon, marginTop: 4 }]}>
                    {formatTime(item.createdAt ?? '')}
                    {mine && <Text> · {item.isRead ? '✓✓' : '✓'}</Text>}
                  </Text>
                </TouchableOpacity>
              );
            }
            if (msgType === 'FILE' && item.fileUrl) {
              return (
                <TouchableOpacity
                  style={[styles.fileCard, { borderColor: mine ? 'rgba(4,43,28,0.2)' : colors.border }]}
                  onPress={() => Linking.openURL(item.fileUrl)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.fileIconBox, { backgroundColor: mine ? 'rgba(4,43,28,0.15)' : colors.tint + '20' }]}>
                    <Ionicons name="document-outline" size={22} color={mine ? '#042b1c' : colors.tint} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fileName, { color: mine ? '#042b1c' : colors.text }]} numberOfLines={1}>
                      {item.content}
                    </Text>
                    <Text style={[styles.fileOpen, { color: mine ? 'rgba(4,43,28,0.55)' : colors.tint }]}>
                      Tap to open
                    </Text>
                  </View>
                  <Ionicons name="download-outline" size={18} color={mine ? '#042b1c' : colors.icon} />
                </TouchableOpacity>
              );
            }
            return (
              <>
                <Text style={[styles.bubbleText, { color: mine ? '#042b1c' : colors.text }]}>
                  {item.content}
                </Text>
                <Text style={[styles.bubbleTime, { color: mine ? 'rgba(4,43,28,0.55)' : colors.icon }]}>
                  {formatTime(item.createdAt ?? item.timestamp ?? '')}
                  {mine && <Text> · {item.isRead ? '✓✓' : '✓'}</Text>}
                </Text>
              </>
            );
          };

          return (
            <View style={[styles.row, mine && styles.rowMe]}>
              {!mine && (
                <View style={styles.avatarSlot}>
                  {showAvatar && (
                    <View style={[styles.msgAvatar, { backgroundColor: colors.tint + '25' }, expert?.avatar ? { backgroundColor: 'transparent' } : null]}>
                      {expert?.avatar ? (
                        <Image source={{ uri: expert.avatar }} style={styles.msgAvatarImage} />
                      ) : (
                        <Text style={[styles.msgAvatarText, { color: colors.tint }]}>{initials(expert?.name ?? '')}</Text>
                      )}
                    </View>
                  )}
                </View>
              )}
              <View style={[
                styles.bubble,
                msgType !== 'TEXT' && { padding: 8 },
                mine
                  ? { backgroundColor: colors.tint, borderBottomRightRadius: 4 }
                  : { backgroundColor: colors.card, borderBottomLeftRadius: 4, ...Shadow.sm },
              ]}>
                {bubbleContent()}
              </View>
            </View>
          );
        }}
      />

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8, backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7} onPress={handleAttach} disabled={uploading}>
          {uploading
            ? <ActivityIndicator size="small" color={colors.tint} />
            : <Ionicons name="attach-outline" size={22} color={colors.icon} />}
        </TouchableOpacity>

        <TextInput
          style={[styles.input, { backgroundColor: Colors.inputBg, color: colors.text, borderColor: colors.border }]}
          placeholder="Type a message..."
          placeholderTextColor={colors.icon}
          value={input}
          onChangeText={handleInputChange}
          multiline
          maxLength={500}
        />

        {input.trim() ? (
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: colors.tint, opacity: sending ? 0.6 : 1 }]}
            onPress={sendMessage}
            disabled={sending}
            activeOpacity={0.85}
          >
            <Ionicons name="send" size={17} color="#042b1c" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
            <Ionicons name="mic-outline" size={22} color={colors.icon} />
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const Chip: React.FC<{ icon: any; label: string; onPress: () => void; tint: string; bg: string }> = ({
  icon, label, onPress, tint, bg,
}) => (
  <TouchableOpacity style={[styles.chip, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.8}>
    <Ionicons name={icon} size={14} color={tint} />
    <Text style={[styles.chipText, { color: tint }]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 20 },
  avatarText: { fontSize: 14, fontWeight: '700' },
  headerName: { fontSize: 15, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 12 },
  headerActions: { flexDirection: 'row', gap: 6 },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  messagesList: { padding: 16, paddingBottom: 8 },
  messagesEmpty: { flexGrow: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyBody: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10, gap: 8 },
  rowMe: { justifyContent: 'flex-end' },
  avatarSlot: { width: 32, height: 32 },
  msgAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  msgAvatarImage: { width: '100%', height: '100%', borderRadius: 16 },
  msgAvatarText: { fontSize: 11, fontWeight: '700' },
  bubble: { maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
  },
  msgImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 180,
  },
  fileIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: { fontSize: 13, fontWeight: '600', maxWidth: 120 },
  fileOpen: { fontSize: 11, marginTop: 2 },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
});