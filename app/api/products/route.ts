import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, internalError } from "@/lib/responses";
import { releaseExpiredReservations } from "@/lib/reservations";

export async function GET(req: NextRequest) {
  try {
    // Lazy expiry cleanup on every products fetch
    await releaseExpiredReservations();

    const { searchParams } = new URL(req.url);
    const warehouseId = searchParams.get("warehouseId") ?? undefined;
    const inStockOnly = searchParams.get("inStockOnly") === "true";

    const products = await prisma.product.findMany({
      include: {
        stockLevels: {
          where: warehouseId ? { warehouseId } : undefined,
          include: { warehouse: true },
          orderBy: { warehouse: { name: "asc" } },
        },
      },
      orderBy: { name: "asc" },
    });

    const enriched = products
      .map((p) => ({
        ...p,
        stockLevels: p.stockLevels.map((s) => ({
          ...s,
          availableUnits: Math.max(0, s.totalUnits - s.reservedUnits),
        })),
      }))
      .filter((p) =>
        inStockOnly
          ? p.stockLevels.some((s) => s.availableUnits > 0)
          : true
      );

    return ok(enriched);
  } catch (err) {
    return internalError("Failed to fetch products", err);
  }
}
