import { createSession, createChannel, type Channel, type Session } from "better-sse";
import type { Request, Response } from "express";
import { logger } from "../lib/logger";

export interface SSEEvent {
  type: string;
  workflowRunId?: string;
  step?: string;
  status?: string;
  data?: unknown;
}

const channels = new Map<string, Channel>();

function getOrCreateChannel(tenantId: string): Channel {
  let channel = channels.get(tenantId);
  if (!channel) {
    channel = createChannel();
    channels.set(tenantId, channel);
    logger.info({ tenantId }, "SSE channel created");
  }
  return channel;
}

export async function addSSEClient(
  tenantId: string,
  req: Request,
  res: Response,
): Promise<Session> {
  const session = await createSession(req, res);
  const channel = getOrCreateChannel(tenantId);
  channel.register(session);

  logger.info({ tenantId, sessionCount: channel.sessionCount }, "SSE client connected");

  req.on("close", () => {
    channel.deregister(session);
    if (channel.sessionCount === 0) {
      channels.delete(tenantId);
      logger.info({ tenantId }, "SSE channel removed (no clients)");
    }
  });

  return session;
}

export function broadcast(tenantId: string, event: SSEEvent): void {
  const channel = channels.get(tenantId);
  if (channel && channel.sessionCount > 0) {
    channel.broadcast(event, event.type);
    logger.debug({ tenantId, eventType: event.type }, "SSE event broadcast");
  }
}

export function getChannelStats() {
  const stats: { tenantId: string; clients: number }[] = [];
  for (const [tenantId, channel] of channels) {
    stats.push({ tenantId, clients: channel.sessionCount });
  }
  return stats;
}
