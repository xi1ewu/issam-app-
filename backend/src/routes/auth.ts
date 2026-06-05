import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { z } from 'zod';
import { prisma } from '../config/database';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { generateTokens } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { AuthRequest, AuthPayload } from '../types';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(['USER', 'EXPERT']).default('USER'),
  phone: z.string().optional(),
  phoneVerified: z.boolean().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const passwordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6),
});

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, role, phone, phoneVerified } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return next(createError('Email already in use', 409));

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email, password: hashed, name, role,
        ...(phone ? { phone } : {}),
        ...(phone && phoneVerified ? { isPhoneVerified: true } : {}),
      },
      select: { id: true, email: true, name: true, role: true, avatar: true, phone: true, isPhoneVerified: true, createdAt: true },
    });

    if (role === 'EXPERT') {
      await prisma.expert.create({
        data: {
          userId: user.id,
          title: '',
          bio: '',
          category: 'Strategy',
          expertise: [],
          hourlyRate: 100,
        },
      });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) return next(createError('Invalid credentials or use social login', 401));

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return next(createError('Invalid credentials', 401));

    if (user.isTwoFactorEnabled) {
      const tempToken = jwt.sign({ userId: user.id, role: user.role, isTemp: true }, process.env.JWT_SECRET || 'secret', { expiresIn: '5m' });
      return res.json({ require2fa: true, tempToken });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return next(createError('No refresh token', 400));

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      return next(createError('Invalid refresh token', 401));
    }

    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as AuthPayload;
    const tokens = generateTokens(payload.userId, payload.role);

    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: payload.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json(tokens);
  } catch {
    next(createError('Invalid refresh token', 401));
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    // Set expert offline when they log out
    await prisma.expert.updateMany({
      where: { userId: req.user!.userId },
      data: { isAvailable: false },
    });
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        phone: true,
        isPhoneVerified: true,
        location: true,
        company: true,
        bio: true,
        isTwoFactorEnabled: true,
        createdAt: true,
        expert: {
          select: {
            id: true,
            title: true,
            category: true,
            expertise: true,
            hourlyRate: true,
            rating: true,
            reviewCount: true,
            isVerified: true,
            isAvailable: true,
          },
        },
      },
    });
    if (!user) return next(createError('User not found', 404));
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/password
router.put('/password', authenticate, validate(passwordSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return next(createError('User not found', 404));

    if (!user.password) return next(createError('Account created with social login. Cannot change password.', 400));

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return next(createError('Invalid current password', 401));

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

const socialAuthSchema = z.object({
  provider: z.enum(['google', 'linkedin']),
  providerId: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatar: z.string().optional(),
  role: z.enum(['USER', 'EXPERT']).default('USER'),
});

const linkedinCallbackSchema = z.object({
  code: z.string(),
  redirectUri: z.string(),
  role: z.enum(['USER', 'EXPERT']).default('USER'),
});

// POST /api/auth/social
router.post('/social', validate(socialAuthSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, providerId, email, name, avatar, role } = req.body;

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          provider === 'google' ? { googleId: providerId } : { linkedinId: providerId },
        ],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          avatar,
          role,
          googleId: provider === 'google' ? providerId : undefined,
          linkedinId: provider === 'linkedin' ? providerId : undefined,
        },
      });

      if (role === 'EXPERT') {
        await prisma.expert.create({
          data: {
            userId: user.id,
            title: '',
            bio: '',
            category: 'Strategy',
            expertise: [],
            hourlyRate: 100,
          },
        });
      }
    } else {
      // Update provider ID if they already had an account with this email but no provider ID
      const updateData: any = {};
      if (provider === 'google' && !user.googleId) updateData.googleId = providerId;
      if (provider === 'linkedin' && !user.linkedinId) updateData.linkedinId = providerId;
      if (avatar && !user.avatar) updateData.avatar = avatar;
      
      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/linkedin-callback — server-side LinkedIn code exchange
router.post('/linkedin-callback', validate(linkedinCallbackSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, redirectUri, role } = req.body;

    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
      return next(createError('LinkedIn OAuth not configured on server', 500));
    }

    // Exchange auth code for access token
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.json().catch(() => ({})) as any;
      return next(createError(errBody.error_description || 'LinkedIn token exchange failed', 400));
    }

    const tokenData = await tokenRes.json() as any;
    const access_token: string = tokenData.access_token;

    // Fetch profile via OpenID Connect userinfo (requires openid + profile + email scopes)
    const userInfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userInfoRes.ok) {
      return next(createError('Failed to fetch LinkedIn profile', 400));
    }

    const li = await userInfoRes.json() as any;
    // li.sub = LinkedIn ID, li.name = full name, li.email = email, li.picture = avatar

    let user = await prisma.user.findFirst({
      where: { OR: [{ email: li.email }, { linkedinId: li.sub }] },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email: li.email, name: li.name, avatar: li.picture, role, linkedinId: li.sub },
      });
      if (role === 'EXPERT') {
        await prisma.expert.create({
          data: { userId: user.id, title: '', bio: '', category: 'Strategy', expertise: [], hourlyRate: 100 },
        });
      }
    } else {
      const updateData: any = {};
      if (!user.linkedinId) updateData.linkedinId = li.sub;
      if (li.picture && !user.avatar) updateData.avatar = li.picture;
      if (Object.keys(updateData).length > 0) {
        user = await prisma.user.update({ where: { id: user.id }, data: updateData });
      }
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

export default router;

// 2FA Routes

// POST /api/auth/2fa/generate
router.post('/2fa/generate', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return next(createError('User not found', 404));

    const secret = speakeasy.generateSecret({ name: `WheelWorld Consulting (${user.email})` });
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret.base32 },
    });

    res.json({ qrCodeUrl, secret: secret.base32 });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/2fa/verify (to enable it)
router.post('/2fa/verify', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !user.twoFactorSecret) return next(createError('2FA not set up', 400));

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
    });
    if (!isValid) return next(createError('Invalid code', 401));

    await prisma.user.update({
      where: { id: user.id },
      data: { isTwoFactorEnabled: true },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/2fa/validate (during login)
router.post('/2fa/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) return next(createError('Missing token or code', 400));

    const payload = jwt.verify(tempToken, process.env.JWT_SECRET || 'secret') as any;
    if (!payload.isTemp) return next(createError('Invalid token', 401));

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.twoFactorSecret) return next(createError('User not found or 2FA not enabled', 400));

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
    });
    if (!isValid) return next(createError('Invalid code', 401));

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser, accessToken, refreshToken });
  } catch (err) {
    next(createError('Invalid or expired token', 401));
  }
});
