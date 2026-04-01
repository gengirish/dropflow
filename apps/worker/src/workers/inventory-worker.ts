import type { Job } from "bullmq";
import { prisma } from "@dropflow/db";
import { QUEUE_NAMES } from "@dropflow/config";
import { createWorker } from "../lib/redis";
import { logger } from "../lib/logger";
import { broadcast } from "../sse/broadcaster";

type LineItem = { productId: string; quantity: number };

type ReserveStockPayload = {
  tenantId: string;
  orderId: string;
  channelId: string;
  items: LineItem[];
};

type ReleaseStockPayload = {
  tenantId: string;
  orderId: string;
  channelId: string;
  items: LineItem[];
};

type SyncChannelStockPayload = {
  tenantId: string;
  channelId: string;
};

type InventoryJobPayload = ReserveStockPayload | ReleaseStockPayload | SyncChannelStockPayload;

async function processReserveStock(job: Job<ReserveStockPayload>) {
  const { tenantId, orderId, channelId, items } = job.data;
  const log = logger.child({ tenantId, orderId, channelId, jobId: job.id });

  await prisma.$transaction(async (tx) => {
    const channel = await tx.salesChannel.findFirst({
      where: { id: channelId, tenantId },
    });
    if (!channel) {
      throw new Error("Channel not found");
    }

    for (const { productId, quantity } of items) {
      if (quantity <= 0) continue;

      const allocation = await tx.channelStockAllocation.findFirst({
        where: { tenantId, channelId, productId },
      });
      if (!allocation) {
        throw new Error(`No stock allocation for product ${productId} on channel`);
      }
      if (allocation.allocatedQty < quantity) {
        throw new Error(
          `Insufficient allocated stock for product ${productId}: need ${quantity}, have ${allocation.allocatedQty}`,
        );
      }

      await tx.channelStockAllocation.update({
        where: { id: allocation.id },
        data: {
          allocatedQty: { decrement: quantity },
          reservedQty: { increment: quantity },
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          tenantId,
          productId,
          channelId,
          type: "RESERVE",
          quantity,
          referenceType: "ORDER",
          referenceId: orderId,
        },
      });
    }
  });

  log.info({ itemCount: items.length }, "reserve-stock completed");
  broadcast(tenantId, {
    type: "INVENTORY",
    data: { kind: "reserve-stock", orderId, channelId },
  });
}

async function processReleaseStock(job: Job<ReleaseStockPayload>) {
  const { tenantId, orderId, channelId, items } = job.data;
  const log = logger.child({ tenantId, orderId, channelId, jobId: job.id });

  await prisma.$transaction(async (tx) => {
    const channel = await tx.salesChannel.findFirst({
      where: { id: channelId, tenantId },
    });
    if (!channel) {
      throw new Error("Channel not found");
    }

    for (const { productId, quantity } of items) {
      if (quantity <= 0) continue;

      const allocation = await tx.channelStockAllocation.findFirst({
        where: { tenantId, channelId, productId },
      });
      if (!allocation) {
        throw new Error(`No stock allocation for product ${productId} on channel`);
      }
      if (allocation.reservedQty < quantity) {
        throw new Error(
          `Cannot release ${quantity} for product ${productId}: reserved ${allocation.reservedQty}`,
        );
      }

      await tx.channelStockAllocation.update({
        where: { id: allocation.id },
        data: {
          allocatedQty: { increment: quantity },
          reservedQty: { decrement: quantity },
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          tenantId,
          productId,
          channelId,
          type: "RELEASE",
          quantity,
          referenceType: "ORDER",
          referenceId: orderId,
        },
      });
    }
  });

  log.info({ itemCount: items.length }, "release-stock completed");
  broadcast(tenantId, {
    type: "INVENTORY",
    data: { kind: "release-stock", orderId, channelId },
  });
}

async function processSyncChannelStock(job: Job<SyncChannelStockPayload>) {
  const { tenantId, channelId } = job.data;
  const log = logger.child({ tenantId, channelId, jobId: job.id });

  const channel = await prisma.salesChannel.findFirst({
    where: { id: channelId, tenantId },
  });
  if (!channel) {
    throw new Error("Channel not found");
  }

  const bufferPercent = channel.bufferPercent;
  const listings = await prisma.channelListing.findMany({
    where: { tenantId, channelId, isActive: true },
    include: {
      product: { select: { id: true, sku: true, name: true } },
    },
  });

  const now = new Date();

  for (const listing of listings) {
    const allocation = await prisma.channelStockAllocation.findFirst({
      where: {
        tenantId,
        channelId,
        productId: listing.productId,
      },
    });

    const allocatedQty = allocation?.allocatedQty ?? 0;
    const reservedQty = allocation?.reservedQty ?? 0;
    const visibleStock = Math.max(
      0,
      Math.floor((allocatedQty * bufferPercent) / 100) - reservedQty,
    );

    log.info(
      {
        listingId: listing.id,
        productId: listing.productId,
        sku: listing.product.sku,
        allocatedQty,
        reservedQty,
        bufferPercent,
        visibleStock,
        syncStatus: "computed",
      },
      "sync-channel-stock listing (marketplace API placeholder)",
    );

    await prisma.channelListing.update({
      where: { id: listing.id },
      data: {
        lastSyncedAt: now,
        syncStatus: "SYNCED",
      },
    });

    if (allocation) {
      await prisma.channelStockAllocation.update({
        where: { id: allocation.id },
        data: { lastSyncedAt: now },
      });
    }
  }

  log.info({ listingCount: listings.length }, "sync-channel-stock completed");
  broadcast(tenantId, {
    type: "INVENTORY",
    data: { kind: "sync-channel-stock", channelId },
  });
}

async function processInventoryJob(job: Job<InventoryJobPayload>) {
  switch (job.name) {
    case "reserve-stock":
      await processReserveStock(job as Job<ReserveStockPayload>);
      break;
    case "release-stock":
      await processReleaseStock(job as Job<ReleaseStockPayload>);
      break;
    case "sync-channel-stock":
      await processSyncChannelStock(job as Job<SyncChannelStockPayload>);
      break;
    default:
      throw new Error(`Unknown inventory job name: ${job.name}`);
  }
}

export function startInventoryWorker() {
  const worker = createWorker<InventoryJobPayload>(QUEUE_NAMES.INVENTORY, processInventoryJob, {
    concurrency: 3,
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, name: job.name }, "Inventory job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error(
      { jobId: job?.id, name: job?.name, error: error.message },
      "Inventory job failed",
    );
  });

  logger.info("Inventory worker started");
  return worker;
}
