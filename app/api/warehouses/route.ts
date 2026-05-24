import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, internalError } from "@/lib/responses";

export async function GET(_req: NextRequest) {
  try {
    const warehouses = await prisma.warehouse.findMany({
      include: {
        stockLevels: {
          include: { product: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const enriched = warehouses.map((w) => ({
      ...w,
      stockLevels: w.stockLevels.map((s) => ({
        ...s,
        availableUnits: Math.max(0, s.totalUnits - s.reservedUnits),
      })),
    }));

    return ok(enriched);
  } catch (err) {
    return internalError("Failed to fetch warehouses", err);
  }
}
