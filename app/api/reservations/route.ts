import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ok,
  created,
  badRequest,
  conflict,
  internalError,
  validationError,
} from "@/lib/responses";
import { CreateReservationSchema } from "@/lib/schemas";
import {
  createReservation,
  InsufficientStockError,
  StockNotFoundError,
} from "@/lib/reservations";
import {
  checkIdempotency,
  storeIdempotency,
  getIdempotencyKey,
} from "@/lib/idempotency";
import { NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as
      | "PENDING"
      | "CONFIRMED"
      | "RELEASED"
      | "EXPIRED"
      | null;

    const reservations = await prisma.reservation.findMany({
      where: status ? { status } : undefined,
      include: { product: true, warehouse: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return ok(reservations);
  } catch (err) {
    return internalError("Failed to fetch reservations", err);
  }
}

export async function POST(req: NextRequest) {
  // ── Idempotency check ──────────────────────────────────────────────────────
  const idempotencyKey = getIdempotencyKey(req);
  if (idempotencyKey) {
    const cached = await checkIdempotency(idempotencyKey, "/api/reservations");
    if (cached) {
      return NextResponse.json(JSON.parse(cached.responseBody), {
        status: cached.statusCode,
        headers: { "X-Idempotent-Replay": "true" },
      });
    }
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  // ── Validate ───────────────────────────────────────────────────────────────
  let input;
  try {
    input = CreateReservationSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) return validationError(err);
    throw err;
  }

  // ── Business logic ─────────────────────────────────────────────────────────
  try {
    const reservation = await createReservation(input);

    const responseBody = JSON.stringify(reservation);
    const statusCode = 201;

    if (idempotencyKey) {
      await storeIdempotency(
        idempotencyKey,
        "/api/reservations",
        responseBody,
        statusCode
      );
    }

    return NextResponse.json(reservation, { status: statusCode });
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      const body = {
        error: err.message,
        code: "INSUFFICIENT_STOCK",
        available: err.available,
      };

      if (idempotencyKey) {
        await storeIdempotency(
          idempotencyKey,
          "/api/reservations",
          JSON.stringify(body),
          409
        );
      }

      return NextResponse.json(body, { status: 409 });
    }

    if (err instanceof StockNotFoundError) {
      return badRequest(err.message);
    }

    return internalError("Failed to create reservation", err);
  }
}
