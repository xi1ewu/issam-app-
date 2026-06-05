import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types';
import { ZodError } from 'zod';

export function errorHandler(
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation error', details: err.errors });
    return;
  }

  const status = err.statusCode ?? 500;
  const message = err.message || 'Internal server error';

  if (process.env.NODE_ENV !== 'production' && status === 500) {
    console.error(err);
  }

  res.status(status).json({ error: message });
}

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  const err: ApiError = new Error('Not found');
  err.statusCode = 404;
  next(err);
}

export function createError(message: string, statusCode: number): ApiError {
  const err: ApiError = new Error(message);
  err.statusCode = statusCode;
  return err;
}
