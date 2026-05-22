import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/jwt';

export interface AuthedRequest extends Request { userId?: string; }

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const { userId } = verifyToken(h.slice(7));
    req.userId = userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
