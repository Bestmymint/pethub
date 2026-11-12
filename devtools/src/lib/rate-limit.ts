import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { rateLimitDisabled } from '@/lib/server-config';

export async function consumeRateLimit({
  key,
  action,
  limit,
  windowMs,
  client,
}: {
  key: string;
  action: string;
  limit: number;
  windowMs: number;
  client?: Prisma.TransactionClient;
}) {
  if (rateLimitDisabled()) {
    return { allowed: true, remaining: limit, expiresAt: new Date(Date.now() + windowMs) };
  }
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);
  const bucket = await (client ?? prisma).rateLimitBucket.upsert({
    where: { bucketKey_action_windowStart: { bucketKey: key, action, windowStart } },
    create: { bucketKey: key, action, windowStart, expiresAt, count: 1 },
    update: { count: { increment: 1 }, expiresAt },
  });
  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    expiresAt,
  };
}
