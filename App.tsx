import 'react-native-gesture-handler';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { I18nManager, View, StyleSheet, StatusBar } from 'react-native';
import * as Localization from 'expo-localization';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Auth screens
import { GetStartedScreen } from './src/screens/auth/GetStartedScreen';
import { SignInScreen } from './src/screens/auth/SignInScreen';
import { SignUpScreen } from './src/screens/auth/SignUpScreen';
import { OnboardingScreen } from './src/screens/auth/OnboardingScreen';
import { PhoneVerificationScreen } from './src/screens/auth/PhoneVerificationScreen';

// Main screens
import { HomeScreen } from './src/screens/main/HomeScreen';
import { ConsultantDirectoryScreen } from './src/screens/main/ConsultantDirectoryScreen';
import { ExpertProfileScreen } from './src/screens/main/ExpertProfileScreen';
import { ChatScreen } from './src/screens/main/ChatScreen';
import { ScheduleScreen } from './src/screens/main/ScheduleScreen';
import { CheckoutScreen } from './src/screens/main/CheckoutScreen';
import { MyConsultationsScreen, ConsultationPressData } from './src/screens/main/MyConsultationsScreen';
import { PremiumPlansScreen } from './src/screens/main/PremiumPlansScreen';
import { ReportsScreen } from './src/screens/main/ReportsScreen';
import { ReportDetailsScreen } from './src/screens/main/ReportDetailsScreen';
import { ProfileScreen } from './src/screens/main/ProfileScreen';
import { SettingsScreen } from './src/screens/main/SettingsScreen';
import { EditProfileScreen } from './src/screens/main/EditProfileScreen';
import { ConversationsScreen } from './src/screens/main/ConversationsScreen';
import { NotificationsScreen } from './src/screens/main/NotificationsScreen';
import { MeetingScreen } from './src/screens/main/MeetingScreen';
import { InvoiceScreen } from './src/screens/main/InvoiceScreen';
import { SecurityScreen } from './src/screens/main/SecurityScreen';

// Admin screens
import { AdminDashboardScreen } from './src/screens/admin/AdminDashboardScreen';

// Expert screens
import { AvailabilityCalendarScreen } from './src/screens/expert/AvailabilityCalendarScreen';
import { ReviewsFeedbackScreen } from './src/screens/expert/ReviewsFeedbackScreen';
import { ExpertAnalyticsScreen } from './src/screens/expert/ExpertAnalyticsScreen';
import { ExpertEarningsScreen } from './src/screens/main/ExpertEarningsScreen';
import { SavedExpertsScreen } from './src/screens/main/SavedExpertsScreen';

// Navigation
import { BottomTabBar, TabName } from './src/navigation/BottomTabBar';

// Types
import { User } from './src/types';
import { Colors } from './src/theme';
import { useAppStore } from './src/store/useAppStore';
import { useAppTheme } from './src/hooks/useAppTheme';
import { connectSocket, disconnectSocket, getSocket } from './src/services/socket';
import { notificationsAPI } from './src/services/api';
import { applyRTLForLanguage } from './src/constants/i18n';
import {
  registerForPushNotifications,
  deregisterPushToken,
  addNotificationResponseListener,
  addForegroundNotificationListener,
} from './src/services/pushNotifications';

// Screen names (simple stack-based navigation)
type ScreenName =
  | 'GetStarted'
  | 'SignIn'
  | 'SignUp'
  | 'PhoneVerification'
  | 'Onboarding'
  | 'MainApp'
  | 'ConsultantDirectory'
  | 'ExpertProfile'
  | 'Chat'
  | 'Schedule'
  | 'Checkout'
  | 'MyConsultations'
  | 'PremiumPlans'
  | 'ReportDetails'
  | 'AvailabilityCalendar'
  | 'ReviewsFeedback'
  | 'ExpertAnalytics'
  | 'Settings'
  | 'EditProfile'
  | 'Conversations'
  | 'Notifications'
  | 'Meeting'
  | 'ExpertEarnings'
  | 'Invoice'
  | 'Security'
  | 'SavedExperts'
  | 'AdminDashboard';

interface NavState {
  screen: ScreenName;
  params?: Record<string, any>;
}

export default function App() {
  const storeSetUser = useAppStore((s) => s.setUser);
  const storeSetLoggedIn = useAppStore((s) => s.setLoggedIn);
  const storeSetRole = useAppStore((s) => s.setRole);
  const storeReset = useAppStore((s) => s.reset);
  const incrementUnread = useAppStore((s) => s.incrementUnread);
  const clearUnread = useAppStore((s) => s.clearUnread);
  const isLoggedIn = useAppStore((s) => s.isLoggedIn);
  const unreadMessages = useAppStore((s) => s.unreadMessages);
  const setUnreadNotifications = useAppStore((s) => s.setUnreadNotifications);
  const incrementUnreadNotifications = useAppStore((s) => s.incrementUnreadNotifications);
  const clearUnreadNotifications = useAppStore((s) => s.clearUnreadNotifications);
  const storedLanguage = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const { isDark } = useAppTheme();
  const navStackRef = useRef<NavState[]>([]);

  // Apply RTL from stored preference and auto-detect device locale on first launch
  useEffect(() => {
    applyRTLForLanguage(storedLanguage);

    // Auto-detect device locale if language is still default English
    if (storedLanguage === 'en') {
      const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'en';
      if (deviceLocale === 'fr') {
        setLanguage('fr');
      } else if (deviceLocale === 'ar') {
        setLanguage('ar');
        applyRTLForLanguage('ar');
      }
    }
  }, []);

  const [navStack, setNavStack] = useState<NavState[]>([{ screen: 'GetStarted' }]);
  const [activeTab, setActiveTab] = useState<TabName>('Home');
  const [bookingData, setBookingData] = useState<any>(null);

  const current = navStack[navStack.length - 1];

  const push = useCallback((screen: ScreenName, params?: Record<string, any>) => {
    setNavStack(prev => {
      const next = [...prev, { screen, params }];
      navStackRef.current = next;
      return next;
    });
  }, []);

  const pop = useCallback(() => {
    setNavStack(prev => {
      const next = prev.length > 1 ? prev.slice(0, -1) : prev;
      navStackRef.current = next;
      return next;
    });
  }, []);

  const replace = useCallback((screen: ScreenName, params?: Record<string, any>) => {
    const next = [{ screen, params }] as NavState[];
    navStackRef.current = next;
    setNavStack(next);
  }, []);

  // Clear unread counts when navigating to the relevant screens
  useEffect(() => {
    const screen = current.screen;
    if (screen === 'Chat' || screen === 'Conversations') {
      clearUnread();
    }
    if (screen === 'Notifications') {
      clearUnreadNotifications();
    }
  }, [current.screen]);

  // Socket listeners for real-time badge updates
  useEffect(() => {
    if (!isLoggedIn) return;
    const timer = setTimeout(() => {
      const sock = getSocket();
      if (!sock) return;

      // New chat message
      const msgHandler = () => {
        const curr = navStackRef.current[navStackRef.current.length - 1];
        if (curr?.screen !== 'Chat' && curr?.screen !== 'Conversations') {
          incrementUnread();
        }
      };

      // Any new notification (booking, review, save, etc.)
      const notifHandler = () => {
        const curr = navStackRef.current[navStackRef.current.length - 1];
        if (curr?.screen !== 'Notifications') {
          incrementUnreadNotifications();
        }
      };

      sock.on('new_message', msgHandler);
      sock.on('new_notification', notifHandler);
      return () => {
        sock.off('new_message', msgHandler);
        sock.off('new_notification', notifHandler);
      };
    }, 1500);
    return () => clearTimeout(timer);
  }, [isLoggedIn]);

  // Fetch unread count from server when app comes back to MainApp
  useEffect(() => {
    if (!isLoggedIn || current.screen !== 'MainApp') return;
    notificationsAPI.getUnreadCount()
      .then(r => setUnreadNotifications(r.count))
      .catch(() => {});
  }, [isLoggedIn, current.screen]);

  // Push notification listeners
  useEffect(() => {
    // Notification tap handler → navigate to the relevant screen
    const tapSub = addNotificationResponseListener((data) => {
      if (data.type === 'new_message' && data.conversationId) {
        push('Chat', { conversationId: data.conversationId });
      } else if (data.type === 'booking_confirmed' || data.type === 'new_booking' || data.type === 'booking_declined') {
        push('MyConsultations');
      } else if (data.type === 'payment_success') {
        push('MyConsultations');
      }
    });

    // Foreground notification listener (just log; banner is shown automatically)
    const fgSub = addForegroundNotificationListener(() => {});

    return () => {
      tapSub.remove();
      fgSub.remove();
    };
  }, []);

  const handleSignIn = (signedInUser: User) => {
    // Backend returns role as "USER"/"EXPERT"/"ADMIN" — normalize to store's expected format
    const rawRole = ((signedInUser as any).role ?? '').toUpperCase();
    const appRole: 'client' | 'expert' | 'admin' =
      rawRole === 'EXPERT' ? 'expert' : rawRole === 'ADMIN' ? 'admin' : 'client';

    storeSetUser({
      id: signedInUser.id,
      name: signedInUser.name ?? '',
      email: signedInUser.email ?? '',
      phone: (signedInUser as any).phone ?? '',
      plan: 'free',
      avatar: (signedInUser as any).avatar ?? undefined,
      company: (signedInUser as any).company ?? undefined,
      bio: (signedInUser as any).bio ?? undefined,
      location: (signedInUser as any).location ?? undefined,
      role: appRole,
    });
    storeSetLoggedIn(true);
    storeSetRole(appRole);
    connectSocket();

    if (appRole === 'admin') {
      replace('AdminDashboard');
      return;
    }

    registerForPushNotifications().catch(() => {});

    const phone = (signedInUser as any).phone ?? '';
    const isPhoneVerified = (signedInUser as any).isPhoneVerified ?? false;

    if (phone && !isPhoneVerified) {
      replace('PhoneVerification', { phone });
    } else {
      replace('Onboarding');
    }
  };

  const handleSignOut = () => {
    deregisterPushToken().catch(() => {});
    disconnectSocket();
    storeReset();
    replace('GetStarted');
  };

  const renderScreen = () => {
    const { screen, params } = current;

    switch (screen) {
      case 'GetStarted':
        return (
          <GetStartedScreen
            onGetStarted={() => push('SignUp')}
            onSignIn={() => push('SignIn')}
          />
        );

      case 'SignIn':
        return (
          <SignInScreen
            onSignIn={handleSignIn}
            onSignUp={() => replace('SignUp')}
            onBack={pop}
          />
        );

      case 'SignUp':
        return (
          <SignUpScreen
            onSignUp={handleSignIn}
            onSignIn={() => replace('SignIn')}
            onBack={pop}
          />
        );

      case 'PhoneVerification':
        return (
          <PhoneVerificationScreen
            phone={params?.phone || ''}
            onVerified={() => replace('Onboarding')}
            onBack={pop}
          />
        );

      case 'Onboarding':
        return (
          <OnboardingScreen
            onComplete={() => replace('MainApp')}
          />
        );

      case 'MainApp':
        return (
          <View style={styles.mainApp}>
            {renderTabContent()}
            <BottomTabBar activeTab={activeTab} onTabPress={setActiveTab} />
          </View>
        );

      case 'ConsultantDirectory':
        return (
          <ConsultantDirectoryScreen
            onExpertPress={(id) => push('ExpertProfile', { expertId: id })}
            onBack={pop}
          />
        );

      case 'ExpertProfile':
        return (
          <ExpertProfileScreen
            expertId={params?.expertId || 'e1'}
            onBack={pop}
            onSchedule={(id) => push('Schedule', { expertId: id })}
            onChat={(id) => push('Chat', { expertId: id })}
          />
        );

      case 'Chat':
        return (
          <ChatScreen
            expertId={params?.expertId}
            initConversationId={params?.conversationId}
            participantName={params?.participantName}
            onBack={pop}
            onSchedule={(id) => push('Schedule', { expertId: id })}
            onCall={(callType?: string) => push('Meeting', {
            peerName: params?.participantName || 'Expert',
            peerUserId: params?.expertId,
            callType: callType ?? 'video',
            roomId: `room_${Date.now()}`,
          })}
          />
        );

      case 'Schedule':
        return (
          <ScheduleScreen
            expertId={params?.expertId || 'e1'}
            onBack={pop}
            onConfirm={(data) => {
              setBookingData(data);
              push('Checkout', { bookingData: data });
            }}
          />
        );

      case 'Checkout':
        return (
          <CheckoutScreen
            bookingData={bookingData || params?.bookingData}
            onBack={pop}
            onSuccess={() => replace('MainApp')}
          />
        );

      case 'MyConsultations':
        return (
          <MyConsultationsScreen
            onBack={pop}
            onConsultationPress={(data: ConsultationPressData) => {
              if (data.type === 'chat') {
                push('Chat', { expertId: data.peerUserId, participantName: data.peerName });
              } else {
                push('Meeting', {
                  peerName: data.peerName,
                  peerUserId: data.peerUserId,
                  callType: data.type === 'audio' ? 'audio' : 'video',
                  roomId: data.roomId,
                });
              }
            }}
          />
        );

      case 'PremiumPlans':
        return (
          <PremiumPlansScreen
            onBack={pop}
            onSuccess={() => replace('MainApp')}
          />
        );

      case 'ReportDetails':
        return (
          <ReportDetailsScreen
            reportId={params?.reportId ?? ''}
            onBack={pop}
            onBookConsultation={() => push('ConsultantDirectory')}
          />
        );

      case 'ExpertAnalytics':
        return <ExpertAnalyticsScreen onBack={pop} />;

      case 'SavedExperts':
        return (
          <SavedExpertsScreen
            onBack={pop}
            onExpertPress={(id) => push('ExpertProfile', { expertId: id })}
          />
        );

      case 'AdminDashboard':
        return <AdminDashboardScreen onSignOut={handleSignOut} />;

      case 'AvailabilityCalendar':
        return (
          <AvailabilityCalendarScreen
            onBack={pop}
            onSave={pop}
          />
        );

      case 'ReviewsFeedback':
        return (
          <ReviewsFeedbackScreen onBack={pop} />
        );

      case 'Settings':
        return (
          <SettingsScreen onBack={pop} />
        );

      case 'EditProfile':
        return (
          <EditProfileScreen onBack={pop} onSaved={pop} />
        );

      case 'Conversations':
        return (
          <ConversationsScreen
            onBack={pop}
            onConversationPress={(convId, name, expId) =>
              push('Chat', { conversationId: convId, participantName: name, expertId: expId })
            }
          />
        );

      case 'Notifications':
        return (
          <NotificationsScreen
            onBack={pop}
            onNotificationPress={(type, data) => {
              switch (type) {
                case 'MESSAGE':
                  if (data?.conversationId) {
                    push('Chat', { conversationId: data.conversationId });
                  } else {
                    push('Conversations');
                  }
                  break;
                case 'BOOKING_CONFIRMED':
                case 'BOOKING_DECLINED':
                case 'BOOKING_NEW':
                case 'BOOKING_CANCELLED':
                case 'PAYMENT_SUCCESS':
                  push('MyConsultations');
                  break;
                case 'REVIEW_NEW':
                case 'EXPERT_SAVED':
                  push('ExpertEarnings');
                  break;
                default:
                  pop();
              }
            }}
          />
        );

      case 'Meeting':
        return (
          <MeetingScreen
            onBack={pop}
            peerName={params?.peerName}
            peerUserId={params?.peerUserId}
            callType={params?.callType ?? 'video'}
            roomId={params?.roomId}
          />
        );

      case 'ExpertEarnings':
        return (
          <ExpertEarningsScreen
            onBack={pop}
            onInvoice={() => push('Invoice')}
            onSecurity={() => push('Security')}
            onNotifications={() => push('Notifications')}
            onAvailabilityPress={() => push('AvailabilityCalendar')}
            onClientsPress={() => push('Conversations')}
            onAnalyticsPress={() => push('ExpertAnalytics')}
            onSessionPress={(_id) => push('MyConsultations')}
            onReviewsPress={() => push('ReviewsFeedback')}
          />
        );

      case 'Invoice': return <InvoiceScreen onBack={pop} />;
      case 'Security': return <SecurityScreen onBack={pop} />;

      default:
        return null;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Home':
        return (
          <HomeScreen
            onExpertPress={(id) => push('ExpertProfile', { expertId: id })}
            onSearchPress={() => push('ConsultantDirectory')}
            onReportPress={(id) => id === 'all' ? setActiveTab('Reports') : push('ReportDetails', { reportId: id })}
            onViewAllExperts={() => push('ConsultantDirectory')}
            onNotificationsPress={() => push('Notifications')}
            onProfilePress={() => setActiveTab('Profile')}
          />
        );
      case 'Experts':
        return (
          <ConsultantDirectoryScreen
            onExpertPress={(id) => push('ExpertProfile', { expertId: id })}
            onBack={() => setActiveTab('Home')}
          />
        );
      case 'Reports':
        return (
          <ReportsScreen
            onReportPress={(id) => push('ReportDetails', { reportId: id })}
          />
        );
      case 'Profile':
        return (
          <ProfileScreen
            onSignOut={handleSignOut}
            onPremiumPress={() => push('PremiumPlans')}
            onEditProfile={() => push('EditProfile')}
            onMyConsultations={() => push('MyConsultations')}
            onSettings={() => push('Settings')}
            onSecurity={() => push('Security')}
            onConsultantChat={() => push('Conversations')}
            onMyReports={() => setActiveTab('Reports')}
            onExpertHub={() => push('ExpertEarnings')}
            onSavedExperts={() => push('SavedExperts')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <View style={styles.container}>
          {renderScreen()}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mainApp: {
    flex: 1,
  },
});
