import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ok,
  notFound,
  gone,
  badRequest,
  internalError,
} from "@/lib/responses";
import {
  confirmReservation,
  ReservationNotFoundError,
  ReservationExpiredError,
  ReservationStateError,
} from "@/lib/reservations";
import {
  checkIdempotency,
  storeIdempotency,
  getIdempotencyKey,
} from "@/lib/idempotency";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // ── Idempotency ─────────────────────────────────────────────────────────────
  const idempotencyKey = getIdempotencyKey(req);
  if (idempotencyKey) {
    const cached = await checkIdempotency(
      idempotencyKey,
      `/api/reservations/${id}/confirm`
    );
    if (cached) {
      return NextResponse.json(JSON.parse(cached.responseBody), {
        status: cached.statusCode,
        headers: { "X-Idempotent-Replay": "true" },
      });
    }
  }

  try {
    const reservation = await confirmReservation(id);
    const responseBody = JSON.stringify(reservation);

    if (idempotencyKey) {
      await storeIdempotency(
        idempotencyKey,
        `/api/reservations/${id}/confirm`,
        responseBody,
        200
      );
    }

    return ok(reservation);
  } catch (err) {
    if (err instanceof ReservationNotFoundError) return notFound(err.message);
    if (err instanceof ReservationExpiredError) {
      const body = { error: err.message, code: "RESERVATION_EXPIRED" };
      if (idempotencyKey) {
        await storeIdempotency(
          idempotencyKey,
          `/api/reservations/${id}/confirm`,
          JSON.stringify(body),
          410
        );
      }
      return gone(err.message);
    }
    if (err instanceof ReservationStateError) return badRequest(err.message);
    return internalError("Failed to confirm reservation", err);
  }
}
