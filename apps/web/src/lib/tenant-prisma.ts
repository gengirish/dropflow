import { PrismaClient } from "@dropflow/db";

const globalPrisma = new PrismaClient();

export function getTenantPrisma(tenantId: string) {
  return globalPrisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }: { args: { where?: object }; query: (a: unknown) => unknown }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }: { args: { where?: object }; query: (a: unknown) => unknown }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async update({ args, query }: { args: { where: object }; query: (a: unknown) => unknown }) {
          (args.where as Record<string, unknown>).tenantId = tenantId;
          return query(args);
        },
        async delete({ args, query }: { args: { where: object }; query: (a: unknown) => unknown }) {
          (args.where as Record<string, unknown>).tenantId = tenantId;
          return query(args);
        },
        async create({ args, query }: { args: { data: object }; query: (a: unknown) => unknown }) {
          (args.data as Record<string, unknown>).tenantId = tenantId;
          return query(args);
        },
        async createMany({
          args,
          query,
        }: {
          args: { data: object | object[] };
          query: (a: unknown) => unknown;
        }) {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((d) => ({ ...(d as Record<string, unknown>), tenantId }));
          } else {
            (args.data as Record<string, unknown>).tenantId = tenantId;
          }
          return query(args);
        },
      },
    },
  });
}
