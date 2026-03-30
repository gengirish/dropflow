import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { prisma } from "@dropflow/db";

export async function getAuthTenant() {
  const appEnv = (process.env.NEXT_PUBLIC_APP_ENV ?? "").trim();
  const e2eKey = (process.env.E2E_TEST_KEY ?? "").trim();

  if (appEnv === "development" && e2eKey) {
    const headersList = await headers();
    const testKey = headersList.get("x-e2e-test-key")?.trim();
    if (testKey && testKey === e2eKey) {
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

export async function requireAuth(_req?: Request) {
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
