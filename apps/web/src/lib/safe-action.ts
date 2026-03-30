import { createSafeActionClient } from "next-safe-action";
import { getAuthTenant } from "./auth";
import { getTenantPrisma } from "./tenant-prisma";

export const action = createSafeActionClient({
  handleServerError(e) {
    if (e instanceof Error) {
      return e.message;
    }
    return "An unexpected error occurred";
  },
});

export const authAction = action.use(async ({ next }) => {
  const { userId, tenantId, tenant } = await getAuthTenant();
  const tenantPrisma = getTenantPrisma(tenantId);

  return next({
    ctx: { userId, tenantId, tenant, db: tenantPrisma },
  });
});
