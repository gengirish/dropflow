import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const tenant = await prisma.tenant.upsert({
    where: { clerkOrgId: "org_test_dropflow" },
    update: {},
    create: {
      clerkOrgId: "org_test_dropflow",
      slug: "test-store",
      name: "Test Store",
      plan: "GROWTH",
      gstin: "29AABCU9603R1ZJ",
      sellerStateCode: "29",
      defaultCurrency: "INR",
    },
  });

  console.log(`Tenant: ${tenant.id} (${tenant.name})`);

  const supplier = await prisma.supplier.upsert({
    where: { id: "seed-supplier-1" },
    update: {},
    create: {
      id: "seed-supplier-1",
      tenantId: tenant.id,
      name: "Ace Textiles",
      contactEmail: "ace@textiles.in",
      contactPhone: "+919876543210",
      gstin: "27AABCU9603R1ZJ",
      status: "ACTIVE",
      leadTimeDays: 3,
    },
  });

  console.log(`Supplier: ${supplier.id} (${supplier.name})`);

  const product1 = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: "TSHIRT-BLK-M" } },
    update: {},
    create: {
      tenantId: tenant.id,
      supplierId: supplier.id,
      sku: "TSHIRT-BLK-M",
      name: "Black T-Shirt (M)",
      description: "Classic black cotton t-shirt, medium",
      hsnCode: "6109",
      costPricePaise: 30000,
      sellingPricePaise: 59900,
      marginPercent: 49.9,
      gstRatePercent: 5,
      stockQty: 100,
      lowStockThreshold: 10,
      isActive: true,
      isListed: true,
    },
  });

  const product2 = await prisma.product.upsert({
    where: { tenantId_sku: { tenantId: tenant.id, sku: "SHOE-WHT-42" } },
    update: {},
    create: {
      tenantId: tenant.id,
      supplierId: supplier.id,
      sku: "SHOE-WHT-42",
      name: "White Sneakers (42)",
      description: "White canvas sneakers, size 42",
      hsnCode: "6403",
      costPricePaise: 80000,
      sellingPricePaise: 149900,
      marginPercent: 46.6,
      gstRatePercent: 18,
      stockQty: 50,
      lowStockThreshold: 5,
      isActive: true,
      isListed: true,
    },
  });

  console.log(`Products: ${product1.name}, ${product2.name}`);
  console.log("Seed complete!");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
