---
name: better-sse
description: >-
  better-sse for real-time Server-Sent Events in DropFlow. Use when implementing
  the SSE broadcaster, tenant-scoped channels, or the useSSE hook for live
  order/workflow/inventory updates.
---

# better-sse — Real-Time Events

Package: `better-sse`  
Location: `apps/worker/src/sse/`

## SSE Broadcaster (sse/broadcaster.ts)

```typescript
import { createSession, createChannel } from "better-sse";
import type { Request, Response } from "express";

export interface SSEEvent {
  type: string;
  workflowRunId?: string;
  step?: string;
  status?: string;
  data?: unknown;
}

const channels = new Map<string, ReturnType<typeof createChannel>>();

function getOrCreateChannel(tenantId: string) {
  if (!channels.has(tenantId)) {
    channels.set(tenantId, createChannel());
  }
  return channels.get(tenantId)!;
}

export async function addClient(tenantId: string, req: Request, res: Response) {
  const session = await createSession(req, res);
  const channel = getOrCreateChannel(tenantId);
  channel.register(session);

  req.on("close", () => {
    channel.deregister(session);
    if (channel.sessionCount === 0) {
      channels.delete(tenantId);
    }
  });

  return session;
}

export function broadcast(tenantId: string, event: SSEEvent) {
  const channel = channels.get(tenantId);
  if (channel) {
    channel.broadcast(event, event.type);
  }
}
```

## Express SSE Route (worker)

```typescript
import { addClient } from "./sse/broadcaster";

app.get("/sse/:tenantId", async (req, res) => {
  const secret = req.headers["x-worker-secret"];
  if (secret !== env.WORKER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  await addClient(req.params.tenantId, req, res);
});
```

## Next.js SSE Proxy (web)

File: `app/api/v1/sse/route.ts`

```typescript
import { env } from "@/lib/env";
import { getAuthTenant } from "@/lib/auth";

export async function GET(req: Request) {
  const { tenantId } = await getAuthTenant();

  const upstream = await fetch(`${env.FLY_WORKER_URL}/sse/${tenantId}`, {
    headers: { "x-worker-secret": env.WORKER_SECRET },
  });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

## Client Hook (hooks/useSSE.ts)

```typescript
"use client";

import { useEffect, useRef } from "react";

interface UseSSEOptions {
  onEvent: (event: SSEEvent) => void;
  url?: string;
}

export function useSSE({ onEvent, url = "/api/v1/sse" }: UseSSEOptions) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const source = new EventSource(url);

    const handler = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data);
        onEventRef.current(event);
      } catch {}
    };

    const eventTypes = [
      "WORKFLOW_STEP",
      "ORDER_STATUS",
      "INVENTORY_ALERT",
      "SHIPMENT_UPDATE",
    ];

    eventTypes.forEach((type) => source.addEventListener(type, handler));
    source.addEventListener("message", handler);

    return () => source.close();
  }, [url]);
}
```

## Event Types

```typescript
type SSEEventType =
  | { type: "WORKFLOW_STEP"; workflowRunId: string; step: string; status: string; data?: unknown }
  | { type: "ORDER_STATUS"; orderId: string; status: string }
  | { type: "INVENTORY_ALERT"; productId: string; stockQty: number }
  | { type: "SHIPMENT_UPDATE"; shipmentId: string; trackingStatus: string };
```

## Conventions

- One channel per tenantId — prevents cross-tenant event leakage
- Worker broadcasts events after each DAG step completion
- Web app proxies SSE through `/api/v1/sse` to add Clerk auth
- Client-side: use `useSSE` hook → invalidate TanStack Query caches on events
- Keep-alive handled automatically by better-sse
