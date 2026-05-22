import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthPayload { userId: string; }

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '90d' });
}
export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
}
