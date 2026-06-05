import { Colors } from '../theme';

export const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1);

export const getStatusColor = (status: string): string => {
  if (status === 'upcoming') return Colors.primary;
  if (status === 'completed') return Colors.success;
  return Colors.error;
};

export const getSessionIcon = (type: string) => {
  if (type === 'video') return 'videocam-outline' as const;
  if (type === 'audio') return 'call-outline' as const;
  return 'chatbubble-outline' as const;
};
