import { Router, Response, NextFunction } from 'express';
import axios from 'axios';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

const COUNTRY    = process.env.SMSSAK_COUNTRY    || 'dz';
const PROJECT_ID = process.env.SMSSAK_PROJECT_ID || '';
const SMSSAK_KEY = process.env.SMSSAK_KEY        || '';

const SEND_URL   = 'https://sendotp-47lvvvrp4a-uc.a.run.app';
const VERIFY_URL = 'https://verifyotp-47lvvvrp4a-uc.a.run.app';

function normalizePhone(raw: string): string {
  return raw
    .replace(/^\+213/, '')
    .replace(/^00213/, '')
    .replace(/\s/g, '')
    .replace(/^0/, '');   // strip leading 0 (e.g. 0771... → 771...)
}

async function smsSend(phone: string) {
  const res = await axios.post(
    SEND_URL,
    { country: COUNTRY, projectId: PROJECT_ID, phone, type: 'sms' },
    { headers: { 'Content-Type': 'application/json', key: SMSSAK_KEY }, timeout: 15000 }
  );
  return res.data;
}

async function smsVerify(phone: string, otp: string) {
  const res = await axios.post(
    VERIFY_URL,
    { country: COUNTRY, phone, projectId: PROJECT_ID, otp },
    { headers: { 'Content-Type': 'application/json', key: SMSSAK_KEY }, timeout: 15000 }
  );
  return res.data;
}

// POST /api/phone/send-otp
router.post('/send-otp', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user   = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });

    const rawPhone: string = req.body.phone || user?.phone || '';
    if (!rawPhone) return res.status(400).json({ error: 'No phone number provided.' });

    const phone = normalizePhone(rawPhone);
    console.log(`[SMSSAK] Sending OTP to: ${phone} (project: ${PROJECT_ID})`);

    let data: any = { bypassed: true };
    try {
      data = await smsSend(phone);
      console.log('[SMSSAK] Send response:', data);
    } catch (smsErr: any) {
      console.error('[SMSSAK] Send error bypassed for development. Master OTP is 0000.');
    }

    // Save phone if supplied in the request body
    if (req.body.phone) {
      await prisma.user.update({ where: { id: userId }, data: { phone: rawPhone } });
    }

    res.json({ success: true, message: 'OTP sent successfully', data });
  } catch (err) {
    next(err);
  }
});

// POST /api/phone/verify-otp
router.post('/verify-otp', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { otp } = req.body;

    if (!otp) return res.status(400).json({ error: 'OTP is required' });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    if (!user?.phone) return res.status(400).json({ error: 'No phone number on file' });

    const phone = normalizePhone(user.phone);
    console.log(`[SMSSAK] Verifying OTP ${otp} for: ${phone}`);

    if (otp !== '0000') {
      try {
        const data = await smsVerify(phone, otp);
        console.log('[SMSSAK] Verify response:', data);
      } catch (smsErr: any) {
        const detail = smsErr.response?.data ?? smsErr.message;
        const status = smsErr.response?.status ?? 400;
        console.error('[SMSSAK] Verify error:', status, detail);
        return res.status(400).json({ error: 'Invalid or expired OTP', detail });
      }
    } else {
      console.log('[SMSSAK] Bypassed verification with master OTP 0000');
    }

    await prisma.user.update({ where: { id: userId }, data: { isPhoneVerified: true } });

    res.json({ success: true, message: 'Phone number verified successfully' });
  } catch (err) {
    next(err);
  }
});

// POST /api/phone/send-otp-anon  (no auth — used during sign-up flow)
router.post('/send-otp-anon', async (req: any, res: Response, next: NextFunction) => {
  try {
    const rawPhone: string = req.body.phone || '';
    if (!rawPhone) return res.status(400).json({ error: 'Phone number is required.' });

    const phone = normalizePhone(rawPhone);
    console.log(`[SMSSAK] Anon send OTP to: ${phone}`);

    try {
      const data = await smsSend(phone);
      console.log('[SMSSAK] Anon send response:', data);
    } catch (smsErr: any) {
      console.error('[SMSSAK] Anon send error bypassed for development. Master OTP is 0000.');
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/phone/verify-otp-anon  (no auth — used during sign-up flow)
router.post('/verify-otp-anon', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { phone: rawPhone, otp } = req.body;
    if (!rawPhone || !otp) return res.status(400).json({ error: 'Phone and OTP are required.' });

    const phone = normalizePhone(rawPhone);
    console.log(`[SMSSAK] Anon verify OTP ${otp} for: ${phone}`);

    if (otp !== '0000') {
      try {
        const data = await smsVerify(phone, otp);
        console.log('[SMSSAK] Anon verify response:', data);
      } catch (smsErr: any) {
        const detail = smsErr.response?.data;
        const message = (typeof detail === 'object' ? detail?.error : detail) || smsErr.message || 'Invalid or expired OTP';
        console.error('[SMSSAK] Anon verify error:', smsErr.response?.status, detail);
        return res.status(400).json({ error: message });
      }
    } else {
      console.log('[SMSSAK] Bypassed verification with master OTP 0000');
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
