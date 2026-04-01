import { z } from "zod";

export const CreateChannelInput = z.object({
  name: z.string().min(1),
  type: z.enum(["WEBSITE", "AMAZON", "FLIPKART", "MEESHO", "MYNTRA", "SHOPIFY", "CUSTOM"]),
  credentials: z.record(z.unknown()).optional().default({}),
  bufferPercent: z.number().int().min(1).max(100).default(100),
  configJson: z.record(z.unknown()).optional().default({}),
});
export type CreateChannelInput = z.infer<typeof CreateChannelInput>;

export const UpdateChannelInput = CreateChannelInput.partial();
export type UpdateChannelInput = z.infer<typeof UpdateChannelInput>;

export const CreateListingInput = z.object({
  channelId: z.string().min(1),
  productId: z.string().min(1),
  channelSku: z.string().optional(),
  channelPricePaise: z.number().int().nonnegative().optional(),
  isActive: z.boolean().default(true),
});
export type CreateListingInput = z.infer<typeof CreateListingInput>;

export const BulkListingInput = z.object({
  channelId: z.string().min(1),
  listings: z.array(z.object({
    productId: z.string().min(1),
    channelSku: z.string().optional(),
    channelPricePaise: z.number().int().nonnegative().optional(),
  })).min(1),
});
export type BulkListingInput = z.infer<typeof BulkListingInput>;

export const StockAllocationInput = z.object({
  channelId: z.string().min(1),
  productId: z.string().min(1),
  allocatedQty: z.number().int().nonnegative(),
});
export type StockAllocationInput = z.infer<typeof StockAllocationInput>;

export const BulkStockAllocationInput = z.object({
  channelId: z.string().min(1),
  allocations: z.array(z.object({
    productId: z.string().min(1),
    allocatedQty: z.number().int().nonnegative(),
  })).min(1),
});
export type BulkStockAllocationInput = z.infer<typeof BulkStockAllocationInput>;

export const ChannelFilters = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ChannelFilters = z.infer<typeof ChannelFilters>;

export const ChannelInventorySnapshot = z.object({
  productId: z.string(),
  productName: z.string(),
  sku: z.string(),
  totalStock: z.number().int(),
  channels: z.array(z.object({
    channelId: z.string(),
    channelName: z.string(),
    channelType: z.string(),
    allocated: z.number().int(),
    reserved: z.number().int(),
    available: z.number().int(),
    bufferPercent: z.number().int(),
    visibleStock: z.number().int(),
  })),
  unallocated: z.number().int(),
});
export type ChannelInventorySnapshot = z.infer<typeof ChannelInventorySnapshot>;
