function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env var faltando: ${name}`);
  return v;
}
export const env = {
  DATABASE_URL: req('DATABASE_URL'),
  JWT_SECRET: req('JWT_SECRET'),
  GOOGLE_CLIENT_IDS: req('GOOGLE_CLIENT_IDS').split(',').map(s => s.trim()).filter(Boolean),
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim()),
  PORT: parseInt(process.env.PORT || '3000', 10),
};
