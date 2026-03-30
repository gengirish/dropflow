import { auth } from "@clerk/nextjs/server";
import { prisma } from "@dropflow/db";

export async function getAuthTenant() {
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
