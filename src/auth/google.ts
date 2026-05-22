import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';

const client = new OAuth2Client();

export interface GoogleProfile {
  googleId: string; email: string; name?: string; picture?: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_IDS });
  const p = ticket.getPayload();
  if (!p || !p.sub || !p.email) throw new Error('Token Google inválido');
  return { googleId: p.sub, email: p.email, name: p.name, picture: p.picture };
}
