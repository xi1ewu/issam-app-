import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { notifyMany } from '../config/notify';
import { AuthPayload } from '../types';

interface SocketUser extends Socket {
  userId?: string;
}

export function setupSocketHandlers(io: Server): void {
  // JWT auth middleware for socket connections
  io.use((socket: SocketUser, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) return next(new Error('No token'));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
      socket.userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: SocketUser) => {
    const userId = socket.userId!;

    // Join personal room so we can send targeted events
    socket.join(`user:${userId}`);

    // Join a conversation room
    socket.on('join_conversation', async (conversationId: string) => {
      const isMember = await prisma.conversationParticipant.findFirst({
        where: { conversationId, userId },
      });
      if (!isMember) {
        socket.emit('error', { message: 'Not a member of this conversation' });
        return;
      }
      socket.join(`conv:${conversationId}`);
      socket.emit('joined_conversation', conversationId);
    });

    // Leave a conversation room
    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conv:${conversationId}`);
    });

    // Send a message
    socket.on('send_message', async (data: { conversationId: string; content: string; type?: string }) => {
      try {
        const { conversationId, content, type = 'TEXT' } = data;

        const isMember = await prisma.conversationParticipant.findFirst({
          where: { conversationId, userId },
        });
        if (!isMember) {
          socket.emit('error', { message: 'Forbidden' });
          return;
        }

        const message = await prisma.message.create({
          data: {
            conversationId,
            senderId: userId,
            content,
            type: type as 'TEXT' | 'FILE' | 'IMAGE',
          },
          include: {
            sender: { select: { id: true, name: true, avatar: true } },
          },
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { lastMessage: content, lastMessageAt: new Date() },
        });

        // Broadcast to everyone in the conversation room (including sender)
        io.to(`conv:${conversationId}`).emit('new_message', message);

        // Notify offline participants via their personal room + in-app + push
        const participants = await prisma.conversationParticipant.findMany({
          where: { conversationId, userId: { not: userId } },
          select: { userId: true },
        });
        const otherIds = participants.map(p => p.userId);
        otherIds.forEach(pid => {
          io.to(`user:${pid}`).emit('conversation_updated', {
            conversationId,
            lastMessage: content,
            lastMessageAt: new Date(),
          });
        });

        const senderName   = message.sender?.name   ?? 'Someone';
        const senderAvatar = (message.sender as any)?.avatar ?? undefined;
        const preview      = content.length > 60 ? content.slice(0, 60) + '…' : content;

        notifyMany(otherIds, {
          type:        'MESSAGE',
          title:       `💬 ${senderName}`,
          message:     preview,
          data:        { conversationId, senderId: userId },
          senderName,
          senderAvatar,
        });
      } catch (err) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing_start', (conversationId: string) => {
      socket.to(`conv:${conversationId}`).emit('user_typing', { userId, conversationId });
    });

    socket.on('typing_stop', (conversationId: string) => {
      socket.to(`conv:${conversationId}`).emit('user_stopped_typing', { userId, conversationId });
    });

    // Mark messages as read
    socket.on('mark_read', async (conversationId: string) => {
      await prisma.message.updateMany({
        where: { conversationId, senderId: { not: userId }, isRead: false },
        data: { isRead: true },
      });
      socket.to(`conv:${conversationId}`).emit('messages_read', { conversationId, readBy: userId });
    });

    // ─── WebRTC signaling ─────────────────────────────────────────────────

    // Caller initiates a call to another user
    socket.on('call_user', (data: { targetUserId: string; callType: 'audio' | 'video'; roomId: string }) => {
      io.to(`user:${data.targetUserId}`).emit('incoming_call', {
        callerId: userId,
        callType: data.callType,
        roomId: data.roomId,
      });
    });

    // Callee accepts the call
    socket.on('accept_call', (data: { callerId: string; roomId: string }) => {
      io.to(`user:${data.callerId}`).emit('call_accepted', {
        accepterId: userId,
        roomId: data.roomId,
      });
    });

    // Callee rejects the call
    socket.on('reject_call', (data: { callerId: string; roomId: string }) => {
      io.to(`user:${data.callerId}`).emit('call_rejected', {
        rejecterId: userId,
        roomId: data.roomId,
      });
    });

    // Forward SDP offer to the remote peer
    socket.on('webrtc_offer', (data: { targetUserId: string; offer: object; roomId: string }) => {
      io.to(`user:${data.targetUserId}`).emit('webrtc_offer', {
        fromUserId: userId,
        offer: data.offer,
        roomId: data.roomId,
      });
    });

    // Forward SDP answer back to the caller
    socket.on('webrtc_answer', (data: { targetUserId: string; answer: object; roomId: string }) => {
      io.to(`user:${data.targetUserId}`).emit('webrtc_answer', {
        fromUserId: userId,
        answer: data.answer,
        roomId: data.roomId,
      });
    });

    // Relay ICE candidates between peers
    socket.on('webrtc_ice_candidate', (data: { targetUserId: string; candidate: object; roomId: string }) => {
      io.to(`user:${data.targetUserId}`).emit('webrtc_ice_candidate', {
        fromUserId: userId,
        candidate: data.candidate,
        roomId: data.roomId,
      });
    });

    // Either peer ends the call
    socket.on('end_call', (data: { targetUserId: string; roomId: string }) => {
      io.to(`user:${data.targetUserId}`).emit('call_ended', {
        byUserId: userId,
        roomId: data.roomId,
      });
    });

    socket.on('disconnect', () => {
      io.emit('user_offline', { userId });
    });
  });
}
