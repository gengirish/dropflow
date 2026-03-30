import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { prisma } from "@dropflow/db";

export async function getAuthTenant() {
  // E2E test mode: bypass Clerk and use test tenant
  if (process.env.NEXT_PUBLIC_APP_ENV === "development") {
    const headersList = await headers();
    const testKey = headersList.get("x-e2e-test-key");
    if (testKey && testKey === process.env.E2E_TEST_KEY) {
      const tenant = await prisma.tenant.findFirst({
        where: { clerkOrgId: "org_test_dropflow" },
      });
      if (tenant) {
        return { userId: "e2e-test-user", orgId: "org_test_dropflow", tenantId: tenant.id, tenant };
      }
    }
  }

  const { userId, orgId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  if (!orgId) {
    throw new Error("No organization selected");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { clerkOrgId: orgId },
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  return { userId, orgId, tenantId: tenant.id, tenant };
}

export async function requireAuth(req?: Request) {
  const { userId, orgId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  if (!orgId) {
    throw new Error("No organization selected");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { clerkOrgId: orgId },
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  return { userId, orgId, tenantId: tenant.id, tenant };
}

export async function requireRole(role: string) {
  const { userId, orgRole } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (!orgRole || orgRole !== role) {
    throw new Error(`Forbidden: requires role ${role}`);
  }

  return { userId, role: orgRole };
}
