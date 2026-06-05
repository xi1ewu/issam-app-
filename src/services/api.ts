import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000') + '/api';

// ─── Token management ──────────────────────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem('accessToken');
}

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem('accessToken', accessToken),
    AsyncStorage.setItem('refreshToken', refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem('accessToken'),
    AsyncStorage.removeItem('refreshToken'),
  ]);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    await clearTokens();
    return null;
  }
  const { accessToken, refreshToken: newRT } = await res.json();
  await saveTokens(accessToken, newRT);
  return accessToken;
}

// ─── Core fetch wrapper ────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) return request<T>(path, options, false);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || 'Request failed');
  }

  return res.json() as Promise<T>;
}

const get = <T>(path: string) => request<T>(path, { method: 'GET' });
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });
const put = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
const patch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
const del = <T>(path: string) =>
  request<T>(path, { method: 'DELETE' });

// ─── Expert normalizer ────────────────────────────────────────────────────
// Backend returns expert with nested user: { id, title, user: { name, avatar } }
// Frontend expects flat Expert type: { id, name, avatar, title, ... }

export function normalizeExpert(e: any) {
  return {
    id: e.id ?? '',
    userId: e.user?.id ?? '',
    name: e.user?.name ?? e.name ?? 'Unknown',
    avatar: e.user?.avatar ?? e.avatar ?? '',
    title: e.title ?? '',
    company: e.user?.company ?? e.company ?? '',
    rating: e.rating ?? 0,
    reviewCount: e.reviewCount ?? 0,
    consultations: e._count?.consultations ?? e.consultations ?? 0,
    yearsExperience: e.yearsExp ?? e.yearsExperience ?? 0,
    expertise: e.expertise ?? [],
    industries: e.industries ?? [],
    languages: e.languages ?? [],
    bio: e.bio ?? '',
    hourlyRate: e.hourlyRate ?? 0,
    currency: 'USD',
    availability: e.isAvailable ? 'Available' : 'Unavailable',
    category: e.category ?? 'Strategy',
    isVerified: e.isVerified ?? false,
    isOnline: e.isAvailable ?? false,
    responseTime: '< 2h',
    location: e.user?.location ?? e.location ?? 'Algeria',
  };
}

// ─── Auth API ──────────────────────────────────────────────────────────────

export const authAPI = {
  signIn: async (email: string, password: string) => {
    const res = await post<any>(
      '/auth/login',
      { email, password }
    );
    if (res.require2fa) {
      return res; // let the caller handle it
    }
    await saveTokens(res.accessToken, res.refreshToken);
    return res;
  },

  twoFactorGenerate: async () => {
    return await post<{ qrCodeUrl: string; secret: string }>('/auth/2fa/generate');
  },

  twoFactorVerify: async (code: string) => {
    return await post<{ success: boolean }>('/auth/2fa/verify', { code });
  },

  twoFactorValidate: async (tempToken: string, code: string) => {
    const res = await post<{ user: any; accessToken: string; refreshToken: string }>(
      '/auth/2fa/validate',
      { tempToken, code }
    );
    await saveTokens(res.accessToken, res.refreshToken);
    return res;
  },

  signUp: async (
    emailOrData: string | { email: string; password: string; name: string; role?: string; company?: string; phone?: string; phoneVerified?: boolean },
    password?: string,
    name?: string,
    role: 'USER' | 'EXPERT' = 'USER'
  ) => {
    const payload =
      typeof emailOrData === 'object'
        ? { ...emailOrData, role: (emailOrData.role?.toUpperCase() === 'EXPERT' ? 'EXPERT' : 'USER') }
        : { email: emailOrData, password: password!, name: name!, role };
    const res = await post<{ user: any; accessToken: string; refreshToken: string }>(
      '/auth/register',
      payload
    );
    await saveTokens(res.accessToken, res.refreshToken);
    return res;
  },

  socialLogin: async (data: { provider: string; providerId: string; email: string; name: string; avatar?: string; role?: string }) => {
    const res = await post<{ user: any; accessToken: string; refreshToken: string }>(
      '/auth/social',
      data
    );
    await saveTokens(res.accessToken, res.refreshToken);
    return res;
  },

  linkedinCallback: async (data: { code: string; redirectUri: string; role?: string }) => {
    const res = await post<{ user: any; accessToken: string; refreshToken: string }>(
      '/auth/linkedin-callback',
      data
    );
    await saveTokens(res.accessToken, res.refreshToken);
    return res;
  },

  signOut: async () => {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    try { await post('/auth/logout', { refreshToken }); } catch {}
    await clearTokens();
  },

  getMe: () => get<any>('/auth/me'),

  changePassword: (currentPassword: string, newPassword: string) =>
    put<any>('/auth/password', { currentPassword, newPassword }),
};

// ─── Users API ────────────────────────────────────────────────────────────

export const usersAPI = {
  getProfile: () => get<any>('/users/profile'),
  updateProfile: (data: object) => put<any>('/users/profile', data),
  registerPushToken: (token: string) => post<{ success: boolean }>('/users/push-token', { token }),
  deregisterPushToken: () => request<{ success: boolean }>('/users/push-token', { method: 'DELETE' }),

  uploadAvatar: async (uri: string) => {
    const fileType = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = fileType === 'jpg' ? 'image/jpeg' : `image/${fileType}`;
    const token = await AsyncStorage.getItem('accessToken');

    const file = new FileSystem.File(uri);
    const result = await file.upload(`${BASE_URL}/users/avatar`, {
      httpMethod: 'POST',
      uploadType: FileSystem.UploadType.MULTIPART,
      fieldName: 'avatar',
      mimeType,
      headers: { Authorization: `Bearer ${token ?? ''}` },
    });

    if (result.status !== 200 && result.status !== 201) {
      let body: any = {};
      try { body = JSON.parse(result.body); } catch {}
      throw new Error(body.error ?? 'Avatar upload failed');
    }
    return JSON.parse(result.body);
  },
};

// ─── Experts API ──────────────────────────────────────────────────────────

export const expertsAPI = {
  getAll: (params?: { category?: string; search?: string; sort?: string }) => {
    const qs = params
      ? '?' + new URLSearchParams(
          Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)) as Record<string, string>
        ).toString()
      : '';
    return get<{ experts: any[]; total: number }>(`/experts${qs}`).then(r => r.experts.map(normalizeExpert));
  },

  getById: (id: string) => get<any>(`/experts/${id}`).then(normalizeExpert),

  search: (q: string) => expertsAPI.getAll({ search: q }),

  getAvailability: (expertId: string, date: string) =>
    get<{ slots: any[] }>(`/experts/${expertId}/availability/${date}`).then(r => r.slots ?? []),

  getAvailableDates: (expertId: string, year: number, month: number) =>
    get<{ dates: string[] }>(`/experts/${expertId}/available-dates?year=${year}&month=${month}`).then(r => r.dates ?? []),

  updateProfile: (data: object) => put<any>('/experts/profile', data),
};

// ─── Saved Experts API ────────────────────────────────────────────────────

export const savedExpertsAPI = {
  getSaved: () => get<any[]>('/experts/saved').then(list => list.map(normalizeExpert)),

  getSavedStatus: (expertId: string) =>
    get<{ saved: boolean }>(`/experts/${expertId}/saved-status`),

  toggleSave: (expertId: string) =>
    post<{ saved: boolean }>(`/experts/${expertId}/save`),

  recordView: (expertId: string) =>
    post<{ success: boolean }>(`/experts/${expertId}/view`),
};

// ─── Consultation normalizer ──────────────────────────────────────────────
// Backend returns status as uppercase ('UPCOMING'), frontend types use lowercase

function normalizeConsultation(c: any) {
  return {
    ...c,
    status: (c.status ?? '').toLowerCase(),
    type: (c.type ?? '').toLowerCase(),
    expert: c.expert
      ? {
          id: c.expert.id ?? '',
          userId: c.expert.user?.id ?? c.expert.userId ?? '',
          name: c.expert.user?.name ?? c.expert.name ?? 'Expert',
          avatar: c.expert.user?.avatar ?? '',
          title: c.expert.title ?? '',
        }
      : c.expert,
  };
}

// ─── Consultations API ────────────────────────────────────────────────────

export const consultationsAPI = {
  getMyConsultations: (params?: { status?: string; role?: string }) => {
    const qs = params
      ? '?' + new URLSearchParams(
          Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)) as Record<string, string>
        ).toString()
      : '';
    return get<any[]>(`/consultations${qs}`).then(list => list.map(normalizeConsultation));
  },

  getById: (id: string) => get<any>(`/consultations/${id}`).then(normalizeConsultation),

  book: (data: {
    expertId: string;
    date: string;
    time: string;
    duration: number;
    type: string;
    topic: string;
    notes?: string;
  }) => post<any>('/consultations', data).then(normalizeConsultation),

  cancel: (id: string) => put<any>(`/consultations/${id}/cancel`),

  confirm: (id: string) => put<any>(`/consultations/${id}/confirm`),

  decline: (id: string) => put<any>(`/consultations/${id}/decline`),

  reschedule: (id: string, date: string, time: string) =>
    put<any>(`/consultations/${id}/reschedule`, { date, time }),

  complete: (id: string) => put<any>(`/consultations/${id}/complete`),
};

// ─── Messages API ─────────────────────────────────────────────────────────

export const messagesAPI = {
  getConversations: () => get<any[]>('/conversations'),
  startConversation: (participantId: string) =>
    post<any>('/conversations', { participantId }),
  getMessages: (conversationId: string, page = 1) =>
    get<any[]>(`/conversations/${conversationId}/messages?page=${page}`),
  sendMessage: (conversationId: string, content: string) =>
    post<any>(`/conversations/${conversationId}/messages`, { content }),

  uploadFile: async (conversationId: string, uri: string, name: string, mimeType: string): Promise<any> => {
    const token = await AsyncStorage.getItem('accessToken');
    const file = new FileSystem.File(uri);
    const uploadResult = await file.upload(`${BASE_URL}/conversations/${conversationId}/upload`, {
      httpMethod: 'POST',
      uploadType: FileSystem.UploadType.MULTIPART,
      fieldName: 'file',
      mimeType: mimeType,
      headers: { Authorization: `Bearer ${token}` }
    });
    if (uploadResult.status !== 200 && uploadResult.status !== 201) {
      let body;
      try { body = JSON.parse(uploadResult.body); } catch { body = { error: 'Upload failed' }; }
      throw new Error(body.error ?? 'Upload failed');
    }
    return JSON.parse(uploadResult.body);
  },
};

// ─── Notifications API ────────────────────────────────────────────────────

export const notificationsAPI = {
  getAll: () => get<any[]>('/notifications'),
  getUnreadCount: () => get<{ count: number }>('/notifications/unread-count'),
  markRead: () => put<any>('/notifications/read'),
  markOneRead: (id: string) => put<any>(`/notifications/${id}/read`),
};

// ─── Reports API ──────────────────────────────────────────────────────────

export const reportsAPI = {
  getAll: (params?: { category?: string; search?: string }) => {
    const qs = params
      ? '?' + new URLSearchParams(
          Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)) as Record<string, string>
        ).toString()
      : '';
    return get<{ reports: any[]; total: number }>(`/reports${qs}`).then(r => r.reports);
  },
  getById: (id: string) => get<any>(`/reports/${id}`),
};

// ─── Reviews API ──────────────────────────────────────────────────────────

export const reviewsAPI = {
  getExpertReviews: (expertId: string) => get<any[]>(`/reviews/expert/${expertId}`),
  create: (consultationId: string, rating: number, comment: string) =>
    post<any>('/reviews', { consultationId, rating, comment }),
};

// ─── Payments API ─────────────────────────────────────────────────────────

export const paymentsAPI = {
  createIntent: (consultationId: string) =>
    post<{ clientSecret: string; amount: number; currency: string }>(
      '/payments/create-intent',
      { consultationId }
    ),
  confirm: (consultationId: string, paymentIntentId: string) =>
    post<any>('/payments/confirm', { consultationId, paymentIntentId }),
  createPayPalOrder: (consultationId: string) =>
    post<{ orderId: string; approvalUrl: string }>(
      '/payments/paypal/create-order',
      { consultationId }
    ),
  capturePayPalOrder: (orderId: string, consultationId?: string) =>
    post<{ status: string; captureId: string }>(
      '/payments/paypal/capture-order',
      { orderId, consultationId }
    ),
};

// ─── Chargily Pay API ────────────────────────────────────────────────────────

export const chargilyAPI = {
  createCheckout: (consultationId: string) =>
    post<{
      checkoutId: string;
      checkoutUrl: string;
      status: string;
      amountDzd: number;
      amountCentimes: number;
    }>('/payments/chargily/create-checkout', { consultationId }),

  verifyCheckout: (checkoutId: string, consultationId: string) =>
    post<{ status: string; paid: boolean; checkoutId: string; amount: number; currency: string }>(
      '/payments/chargily/verify-checkout',
      { checkoutId, consultationId }
    ),

  getCheckoutStatus: (checkoutId: string) =>
    get<{ id: string; status: string; amount: number }>(
      `/payments/chargily/checkout-status/${checkoutId}`
    ),
};

// ─── Subscriptions API ────────────────────────────────────────────────────

export const subscriptionAPI = {
  getPlans: () => get<any[]>('/subscriptions/plans'),

  getCurrent: () => get<any>('/subscriptions/current'),

  cancel: () => post<any>('/subscriptions/cancel'),

  activateFree: () => post<any>('/subscriptions/activate-free'),

  // Chargily (DZD — Algeria)
  chargilyCheckout: (planId: string, billing: 'monthly' | 'yearly') =>
    post<{ checkoutId: string; checkoutUrl: string; amountDzd: number }>(
      '/subscriptions/chargily-checkout',
      { planId, billing }
    ),
  chargilyVerify: (checkoutId: string, planId: string, billing: 'monthly' | 'yearly') =>
    post<{ paid: boolean; subscription?: any }>(
      '/subscriptions/chargily-verify',
      { checkoutId, planId, billing }
    ),

  // PayPal (USD — international)
  createPayPalOrder: (planId: string, billing: 'monthly' | 'yearly') =>
    post<{ orderId: string; approvalUrl: string }>(
      '/subscriptions/paypal-order',
      { planId, billing }
    ),
  capturePayPalOrder: (orderId: string, planId: string, billing: 'monthly' | 'yearly') =>
    post<any>('/subscriptions/paypal-capture', { orderId, planId, billing }),
};

// ─── Dashboard API ────────────────────────────────────────────────────────

export const dashboardAPI = {
  getStats: () => get<any>('/dashboard/stats'),
  getExpertStats: () => get<any>('/dashboard/expert-stats'),
  getFeaturedExperts: () => get<any[]>('/dashboard/featured-experts').then(list => list.map(normalizeExpert)),
  getExpertAnalytics: () => get<any>('/dashboard/expert-analytics'),
};

// ─── Availability (backward compat) ───────────────────────────────────────

export const availabilityAPI = {
  getTimeSlots: (expertId: string, date: string) =>
    expertsAPI.getAvailability(expertId, date),
};

// ─── Weekly Schedule (Availability Calendar) ─────────────────────────────

export const weeklyScheduleAPI = {
  get: () => get<{ grid: Record<string, boolean> }>('/experts/my-schedule'),
  save: (grid: Record<string, boolean>) => put<{ success: boolean }>('/experts/my-schedule', { grid }),
};

// ─── Per-date Availability (Availability Calendar) ────────────────────────

export interface TimeSlot {
  id: string;
  start: string;
  end: string;
  label: string;
  isAvailable: boolean;
}

export interface DayAvailability {
  dayAvailable: boolean;
  slots: TimeSlot[];
}

export const myAvailabilityAPI = {
  get: (date: string) => get<DayAvailability | null>(`/experts/my-availability/${date}`),
  save: (date: string, data: DayAvailability) =>
    put<{ success: boolean }>(`/experts/my-availability/${date}`, data),
};

// ─── Invoices ─────────────────────────────────────────────────────────────

export interface InvoiceLine { description: string; quantity: number; rate: number; amount: number }

export const invoiceAPI = {
  getAll: () => get<any[]>('/invoices'),
  create: (data: {
    clientName: string;
    clientEmail?: string;
    services: InvoiceLine[];
    tax?: number;
    currency?: string;
    dueDate?: string;
    notes?: string;
  }) => post<any>('/invoices', data),
  updateStatus: (id: string, status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE') =>
    patch<any>(`/invoices/${id}/status`, { status }),
  delete: (id: string) => del<{ success: boolean }>(`/invoices/${id}`),
};

// ─── Phone Verification (SMSSAK) ──────────────────────────────────────────

export const authPhoneAPI = {
  sendOtp: (phone: string) =>
    post<{ success: boolean; message: string }>('/phone/send-otp', { phone }),
  verifyOtp: (otp: string) =>
    post<{ success: boolean; message: string }>('/phone/verify-otp', { otp }),
  sendOtpAnon: (phone: string) =>
    post<{ success: boolean }>('/phone/send-otp-anon', { phone }),
  verifyOtpAnon: (phone: string, otp: string) =>
    post<{ success: boolean }>('/phone/verify-otp-anon', { phone, otp }),
};
