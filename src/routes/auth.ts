import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { signToken } from "../auth/jwt";
import { hashPassword, verifyPassword, tokenHash } from "../auth/password";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const authRouter = Router();

const DEFAULT_USER = {
  email: "bruno@financeiro.local",
  passwordHash: "Bruno@123",
  name: "Bruno Ferreira",
  role: "ADMIN",
  profile: "GESTOR",
};

async function ensureDefaultUser() {
  const count = await prisma.user.count();
  if (count > 0) return;
  await prisma.user.create({
    data: {
      email: DEFAULT_USER.email,
      name: DEFAULT_USER.name,
      passwordHash: hashPassword(DEFAULT_USER.passwordHash),
      role: DEFAULT_USER.role,
      profile: DEFAULT_USER.profile,
      active: true,
    },
  });
}

function safeUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    profile: user.profile,
    active: user.active,
    lastLoginAt: user.lastLoginAt,
  };
}

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    await ensureDefaultUser();
    const { email, password } = LoginBody.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "E-mail ou senha inválidos." });
    }
    const token = signToken({ userId: user.id });
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await prisma.userSession
      .create({
        data: {
          userId: user.id,
          tokenHash: tokenHash(token),
          userAgent: req.get("user-agent") || "",
          ip: req.ip || "",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        },
      })
      .catch(() => null);
    res.json({ token, user: safeUser(user) });
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(400).json({ error: 'Já existe usuário com este e-mail.' });
    next(e);
  }
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user)
      return res.status(404).json({ error: "Usuário não encontrado." });
    res.json(safeUser(user));
  } catch (e) {
    next(e);
  }
});

const CreateUserBody = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),
  senha: z.string().min(6).optional(),
  name: z.string().min(1).optional(),
  nome: z.string().min(1).optional(),
  role: z.string().default("OPERADOR"),
  profile: z.string().default("OPERADOR"),
  active: z.boolean().default(true),
}).refine((v) => Boolean(v.password || v.senha), { message: "Informe uma senha com pelo menos 6 caracteres." });

authRouter.get("/users", requireAuth, async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profile: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(users);
  } catch (e) {
    next(e);
  }
});

authRouter.post("/users", requireAuth, async (req, res, next) => {
  try {
    const data = CreateUserBody.parse(req.body);
    const password = data.password || data.senha || "";
    const name = data.name || data.nome || data.email.split('@')[0] || "Usuário";
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        name,
        role: data.role,
        profile: data.profile,
        active: data.active,
        passwordHash: hashPassword(password),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profile: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.status(201).json(user);
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(400).json({ error: 'Já existe usuário com este e-mail.' });
    next(e);
  }
});



const UpdateUserBody = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  senha: z.string().min(6).optional(),
  name: z.string().min(1).optional(),
  nome: z.string().min(1).optional(),
  role: z.string().optional(),
  profile: z.string().optional(),
  active: z.boolean().optional(),
});

authRouter.put("/users/:id", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Usuário não encontrado." });
    const data = UpdateUserBody.parse(req.body || {});
    const password = data.password || data.senha;
    const update: any = {};
    if (data.email) update.email = data.email.toLowerCase().trim();
    if (data.name || data.nome) update.name = data.name || data.nome;
    if (data.role) update.role = data.role;
    if (data.profile) update.profile = data.profile;
    if (typeof data.active === "boolean") update.active = data.active;
    if (password) update.passwordHash = hashPassword(password);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: update,
      select: { id: true, email: true, name: true, role: true, profile: true, active: true, createdAt: true, updatedAt: true },
    });
    res.json(user);
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(400).json({ error: 'Já existe usuário com este e-mail.' });
    next(e);
  }
});

authRouter.delete("/users/:id", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Usuário não encontrado." });
    await prisma.user.update({ where: { id: existing.id }, data: { active: false } });
    await prisma.userSession.updateMany({ where: { userId: existing.id, active: true }, data: { active: false, revokedAt: new Date() } }).catch(() => null);
    res.json({ ...safeUser({ ...existing, active: false }), active: false });
  } catch (e) { next(e); }
});

authRouter.get(
  "/sessions",
  requireAuth,
  async (req: AuthedRequest, res, next) => {
    try {
      const sessions = await prisma.userSession.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userAgent: true,
          ip: true,
          active: true,
          revokedAt: true,
          expiresAt: true,
          createdAt: true,
        },
      });
      res.json(sessions);
    } catch (e) {
      next(e);
    }
  },
);
