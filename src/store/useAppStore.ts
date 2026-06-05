import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'en' | 'fr' | 'ar';
export type AppUserRole = 'client' | 'expert' | 'admin';

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  phone: string;
  plan: 'free' | 'premium';
  avatar?: string;
  location?: string;
  company?: string;
  bio?: string;
  role?: AppUserRole;
  isTwoFactorEnabled?: boolean;
}

interface AppState {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;

  language: Language;
  setLanguage: (lang: Language) => void;

  user: UserProfile;
  setUser: (u: Partial<UserProfile>) => void;

  isLoggedIn: boolean;
  setLoggedIn: (v: boolean) => void;

  role: AppUserRole;
  setRole: (r: AppUserRole) => void;

  notificationsEnabled: boolean;
  toggleNotifications: () => void;
  setNotificationsEnabled: (v: boolean) => void;

  unreadMessages: number;
  incrementUnread: () => void;
  clearUnread: () => void;

  unreadNotifications: number;
  setUnreadNotifications: (n: number) => void;
  incrementUnreadNotifications: () => void;
  clearUnreadNotifications: () => void;

  hasSeenOnboarding: boolean;
  setHasSeenOnboarding: (v: boolean) => void;

  reset: () => void;
}

const DEFAULT_USER: UserProfile = {
  name: '',
  email: '',
  phone: '',
  plan: 'free',
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      themeMode: 'light',
      setThemeMode: (themeMode) => set({ themeMode }),

      language: 'en',
      setLanguage: (language) => set({ language }),

      user: DEFAULT_USER,
      setUser: (partial) => set((s) => ({ user: { ...s.user, ...partial } })),

      isLoggedIn: false,
      setLoggedIn: (isLoggedIn) => set({ isLoggedIn }),

      role: 'client',
      setRole: (role) => set({ role }),

      notificationsEnabled: true,
      toggleNotifications: () => set((s) => ({ notificationsEnabled: !s.notificationsEnabled })),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),

      unreadMessages: 0,
      incrementUnread: () => set((s) => ({ unreadMessages: s.unreadMessages + 1 })),
      clearUnread: () => set({ unreadMessages: 0 }),

      unreadNotifications: 0,
      setUnreadNotifications: (unreadNotifications) => set({ unreadNotifications }),
      incrementUnreadNotifications: () => set((s) => ({ unreadNotifications: s.unreadNotifications + 1 })),
      clearUnreadNotifications: () => set({ unreadNotifications: 0 }),

      hasSeenOnboarding: false,
      setHasSeenOnboarding: (hasSeenOnboarding) => set({ hasSeenOnboarding }),

      reset: () => set({
        themeMode: 'light',
        language: 'en',
        user: DEFAULT_USER,
        isLoggedIn: false,
        role: 'client',
        notificationsEnabled: true,
        unreadMessages: 0,
        unreadNotifications: 0,
        hasSeenOnboarding: false,
      }),
    }),
    {
      name: 'da-consulting-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
