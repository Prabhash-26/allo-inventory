import { NextRequest } from "next/server";
import {
  ok,
  notFound,
  badRequest,
  internalError,
} from "@/lib/responses";
import {
  releaseReservation,
  ReservationNotFoundError,
  ReservationStateError,
} from "@/lib/reservations";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const reservation = await releaseReservation(id);
    return ok(reservation);
  } catch (err) {
    if (err instanceof ReservationNotFoundError) return notFound(err.message);
    if (err instanceof ReservationStateError) return badRequest(err.message);
    return internalError("Failed to release reservation", err);
  }
}
