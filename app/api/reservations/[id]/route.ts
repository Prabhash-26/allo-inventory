import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, notFound, internalError } from "@/lib/responses";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { product: true, warehouse: true },
    });

    if (!reservation) return notFound("Reservation not found");
    return ok(reservation);
  } catch (err) {
    return internalError("Failed to fetch reservation", err);
  }
}
