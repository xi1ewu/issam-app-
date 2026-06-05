import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, AuthPayload } from '../types';
import { createError } from './errorHandler';
import { Role } from '@prisma/client';

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(createError('No token provided', 401));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    req.user = payload;

    // Async ban check — don't block the event loop on every request,
    // just fire-and-forget to keep latency near zero, and reject if banned.
    import('../config/database').then(({ prisma }) => {
      prisma.user.findUnique({ where: { id: payload.userId }, select: { isBanned: true, bannedReason: true } })
        .then(user => {
          if (user?.isBanned) {
            next(createError(
              `Account suspended${user.bannedReason ? ': ' + user.bannedReason : ''}. Contact support to appeal.`,
              403
            ));
          } else {
            next();
          }
        })
        .catch(() => next()); // on DB error allow through — don't lock out on transient failures
    });
  } catch {
    next(createError('Invalid or expired token', 401));
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(createError('Insufficient permissions', 403));
    }
    next();
  };
}

export function generateTokens(userId: string, role: Role) {
  const accessToken = jwt.sign(
    { userId, role } as AuthPayload,
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  );
  const refreshToken = jwt.sign(
    { userId, role } as AuthPayload,
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  );
  return { accessToken, refreshToken };
}
