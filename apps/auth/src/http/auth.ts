import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { createSessionToken, hashSessionToken } from "../security/tokens.js";
import { verifyPassword } from "../security/passwords.js";
import {
  createSession,
  findActiveSessionByTokenHash,
  findUserByEmail,
  findUserById,
  revokeSessionByTokenHash
} from "../users/repository.js";
import { toPublicUser } from "../users/types.js";

export async function loginWithPassword(email: string, password: string) {
  const user = await findUserByEmail(email);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return null;
  }

  const token = createSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionTtlSeconds() * 1000);

  await createSession({
    createdAt: now,
    expiresAt,
    id: randomUUID(),
    tokenHash: hashSessionToken(token),
    userId: user.id || String(user._id ?? user.email)
  });

  return {
    expiresAt: expiresAt.toISOString(),
    token,
    user: toPublicUser(user)
  };
}

export async function getCurrentSession(request: IncomingMessage) {
  const token = readBearerToken(request);

  if (!token) {
    return null;
  }

  const session = await findActiveSessionByTokenHash(hashSessionToken(token));

  if (!session) {
    return null;
  }

  const user = await findUserById(session.userId);

  if (!user) {
    return null;
  }

  return {
    expiresAt: session.expiresAt.toISOString(),
    user: toPublicUser(user)
  };
}

export async function logout(request: IncomingMessage) {
  const token = readBearerToken(request);

  if (!token) {
    return;
  }

  await revokeSessionByTokenHash(hashSessionToken(token));
}

function readBearerToken(request: IncomingMessage) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  return authorization.slice("Bearer ".length).trim() || undefined;
}

function sessionTtlSeconds() {
  const value = Number(process.env.AUTH_SESSION_TTL_SECONDS ?? 28800);

  return Number.isFinite(value) && value > 0 ? value : 28800;
}
