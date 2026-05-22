function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env var faltando: ${name}`);
  return v;
}

const opt = (name: string, fallback = "") => {
  return process.env[name] || fallback;
};

export const env = {
  DATABASE_URL: req("DATABASE_URL"),
  JWT_SECRET: req("JWT_SECRET"),
  GOOGLE_CLIENT_IDS: opt("GOOGLE_CLIENT_IDS"),
  CORS_ORIGINS: (process.env.CORS_ORIGINS || "*")
    .split(",")
    .map((s) => s.trim()),
  PORT: parseInt(process.env.PORT || "3000", 10),
};
