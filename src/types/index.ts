export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'client' | 'expert';
  company?: string;
  position?: string;
  bio?: string;
  subscription?: 'free' | 'professional' | 'enterprise';
  createdAt: string;
}

export interface Expert {
  id: string;
  userId?: string;
  name: string;
  avatar: string;
  title: string;
  company?: string;
  rating: number;
  reviewCount: number;
  consultations: number;
  yearsExperience: number;
  expertise: string[];
  industries: string[];
  languages: string[];
  bio: string;
  hourlyRate: number;
  currency: string;
  availability: string;
  category: ExpertCategory;
  isVerified: boolean;
  isOnline: boolean;
  responseTime: string;
  location: string;
}

export type ExpertCategory =
  | 'All'
  | 'Strategy'
  | 'Finance'
  | 'Legal'
  | 'Marketing'
  | 'Technology'
  | 'HR';

export interface Consultation {
  id: string;
  expertId: string;
  expert: Expert;
  clientId: string;
  date: string;
  time: string;
  duration: number;
  type: 'video' | 'audio' | 'chat';
  status: 'upcoming' | 'completed' | 'cancelled' | 'pending';
  topic: string;
  notes?: string;
  price: number;
  currency: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'file' | 'audio' | 'video';
  isRead: boolean;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Conversation {
  id: string;
  expertId: string;
  expert: Expert;
  lastMessage: Message;
  unreadCount: number;
  updatedAt: string;
}

export interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
  author: string;
  publishedAt: string;
  readTime: number;
  coverImage?: string;
  tags: string[];
  isPremium: boolean;
}

export interface Review {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  rating: number;
  content: string;
  date: string;
  expertId: string;
  consultationId: string;
  response?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: 'monthly' | 'yearly';
  features: string[];
  isPopular?: boolean;
  color?: string;
}

export interface TimeSlot {
  id: string;
  time: string;
  isAvailable: boolean;
}

export interface DashboardStats {
  totalConsultations: number;
  hoursConsulted: number;
  reportsRead: number;
  expertsConnected: number;
  progressPercent: number;
  weeklyGoal: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface NavigationParams {
  expertId?: string;
  consultationId?: string;
  chatId?: string;
  reportId?: string;
}
