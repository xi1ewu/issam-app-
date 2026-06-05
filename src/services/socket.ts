import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await AsyncStorage.getItem('accessToken');

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => console.log('Socket connected:', socket?.id));
  socket.on('disconnect', reason => console.log('Socket disconnected:', reason));
  socket.on('connect_error', err => console.warn('Socket error:', err.message));

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function joinConversation(conversationId: string): void {
  socket?.emit('join_conversation', conversationId);
}

export function leaveConversation(conversationId: string): void {
  socket?.emit('leave_conversation', conversationId);
}

export function sendSocketMessage(conversationId: string, content: string): void {
  socket?.emit('send_message', { conversationId, content });
}

export function emitTypingStart(conversationId: string): void {
  socket?.emit('typing_start', conversationId);
}

export function emitTypingStop(conversationId: string): void {
  socket?.emit('typing_stop', conversationId);
}

export function markRead(conversationId: string): void {
  socket?.emit('mark_read', conversationId);
}

// ─── WebRTC signaling helpers ─────────────────────────────────────────────

export function callUser(targetUserId: string, callType: 'audio' | 'video', roomId: string): void {
  socket?.emit('call_user', { targetUserId, callType, roomId });
}

export function acceptCall(callerId: string, roomId: string): void {
  socket?.emit('accept_call', { callerId, roomId });
}

export function rejectCall(callerId: string, roomId: string): void {
  socket?.emit('reject_call', { callerId, roomId });
}

export function sendOffer(targetUserId: string, offer: object, roomId: string): void {
  socket?.emit('webrtc_offer', { targetUserId, offer, roomId });
}

export function sendAnswer(targetUserId: string, answer: object, roomId: string): void {
  socket?.emit('webrtc_answer', { targetUserId, answer, roomId });
}

export function sendIceCandidate(targetUserId: string, candidate: object, roomId: string): void {
  socket?.emit('webrtc_ice_candidate', { targetUserId, candidate, roomId });
}

export function endCallSignal(targetUserId: string, roomId: string): void {
  socket?.emit('end_call', { targetUserId, roomId });
}
