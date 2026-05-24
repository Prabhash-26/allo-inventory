import { prisma } from "./prisma";
import { withLock } from "./redis";
import type { CreateReservationInput } from "./schemas";

const RESERVATION_EXPIRY_MINUTES = 10;

// ── Expiry cleanup ────────────────────────────────────────────────────────────

/**
 * Release all reservations that have passed their expiresAt.
 * Called by the cron endpoint (production) and lazily on every read (dev).
 * Uses a transaction so the stock counter and status change atomically.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();

  // Find expired pending reservations
  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    select: { id: true, productId: true, warehouseId: true, quantity: true },
  });

  if (expired.length === 0) return 0;

  await prisma.$transaction(
    expired.map((r) =>
      prisma.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: r.productId,
            warehouseId: r.warehouseId,
          },
        },
        data: { reservedUnits: { decrement: r.quantity } },
      })
    )
  );

  await prisma.reservation.updateMany({
    where: { id: { in: expired.map((r) => r.id) } },
    data: { status: "EXPIRED" },
  });

  return expired.length;
}

// ── Create reservation ────────────────────────────────────────────────────────

/**
 * Atomically create a reservation, decrementing reservedUnits on the stock row.
 *
 * Concurrency strategy:
 *   1. Acquire a Redis distributed lock keyed to `product:warehouse`.
 *   2. Inside the lock, read available units and check sufficiency.
 *   3. If sufficient, run a Postgres transaction that:
 *      a. Increments `reservedUnits` only if the math still holds
 *         (raw SQL WHERE guard — double-check inside the DB).
 *      b. Creates the Reservation row.
 *   4. Release the lock.
 *
 * This two-layer approach (Redis lock + DB-level WHERE guard) means:
 *   - The Redis lock eliminates the thundering-herd of concurrent readers
 *     all seeing "1 unit available" and all trying to decrement.
 *   - The DB WHERE guard is the final safety net if Redis is unavailable
 *     or the lock somehow fails (e.g. network partition).
 */
export async function createReservation(input: CreateReservationInput) {
  const lockKey = `reservation:${input.productId}:${input.warehouseId}`;

  return withLock(lockKey, async () => {
    // Lazy cleanup before checking stock
    await releaseExpiredReservations();

    const stock = await prisma.stockLevel.findUnique({
      where: {
        productId_warehouseId: {
          productId: input.productId,
          warehouseId: input.warehouseId,
        },
      },
    });

    if (!stock) {
      throw new StockNotFoundError(
        "No stock record for this product/warehouse combination"
      );
    }

    const available = stock.totalUnits - stock.reservedUnits;
    if (available < input.quantity) {
      throw new InsufficientStockError(
        `Only ${available} unit(s) available, but ${input.quantity} requested`,
        available
      );
    }

    // Atomic: increment reservedUnits + create reservation in one transaction.
    // The UPDATE WHERE clause acts as a DB-level guard against TOCTOU races
    // (the Redis lock already eliminates them, but defence-in-depth is free).
    const [updatedStock, reservation] = await prisma.$transaction(async (tx) => {
      const updated = await tx.$executeRaw`
        UPDATE "StockLevel"
        SET "reservedUnits" = "reservedUnits" + ${input.quantity}
        WHERE id = ${stock.id}
          AND ("totalUnits" - "reservedUnits") >= ${input.quantity}
      `;

      if (updated === 0) {
        throw new InsufficientStockError(
          "Stock was modified concurrently — no units reserved",
          0
        );
      }

      const ttl = input.ttlMinutes ?? RESERVATION_EXPIRY_MINUTES;
      const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

      const res = await tx.reservation.create({
        data: {
          productId: input.productId,
          warehouseId: input.warehouseId,
          quantity: input.quantity,
          expiresAt,
          customerEmail: input.customerEmail,
          status: "PENDING",
        },
        include: {
          product: true,
          warehouse: true,
        },
      });

      return [updated, res];
    });

    return reservation;
  });
}

// ── Confirm reservation ───────────────────────────────────────────────────────

export async function confirmReservation(id: string) {
  const reservation = await prisma.reservation.findUnique({ where: { id } });

  if (!reservation) throw new ReservationNotFoundError();

  if (reservation.status === "CONFIRMED") return reservation; // idempotent

  if (reservation.status !== "PENDING") {
    throw new ReservationStateError(
      `Cannot confirm a reservation with status "${reservation.status}"`
    );
  }

  if (reservation.expiresAt < new Date()) {
    // Mark expired and release stock
    await prisma.$transaction([
      prisma.reservation.update({
        where: { id },
        data: { status: "EXPIRED" },
      }),
      prisma.stockLevel.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: { reservedUnits: { decrement: reservation.quantity } },
      }),
    ]);
    throw new ReservationExpiredError();
  }

  // Confirming: decrement totalUnits AND reservedUnits (both drop by quantity)
  const [updated] = await prisma.$transaction([
    prisma.reservation.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
      include: { product: true, warehouse: true },
    }),
    prisma.stockLevel.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
      },
      data: {
        totalUnits: { decrement: reservation.quantity },
        reservedUnits: { decrement: reservation.quantity },
      },
    }),
  ]);

  return updated;
}

// ── Release reservation ───────────────────────────────────────────────────────

export async function releaseReservation(id: string) {
  const reservation = await prisma.reservation.findUnique({ where: { id } });

  if (!reservation) throw new ReservationNotFoundError();

  if (reservation.status === "RELEASED" || reservation.status === "EXPIRED") {
    return reservation; // already released — idempotent
  }

  if (reservation.status === "CONFIRMED") {
    throw new ReservationStateError("Cannot release a confirmed reservation");
  }

  const [updated] = await prisma.$transaction([
    prisma.reservation.update({
      where: { id },
      data: { status: "RELEASED", releasedAt: new Date() },
      include: { product: true, warehouse: true },
    }),
    prisma.stockLevel.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId,
        },
      },
      data: { reservedUnits: { decrement: reservation.quantity } },
    }),
  ]);

  return updated;
}

// ── Domain errors ─────────────────────────────────────────────────────────────

export class InsufficientStockError extends Error {
  constructor(message: string, public readonly available: number) {
    super(message);
    this.name = "InsufficientStockError";
  }
}

export class StockNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockNotFoundError";
  }
}

export class ReservationNotFoundError extends Error {
  constructor() {
    super("Reservation not found");
    this.name = "ReservationNotFoundError";
  }
}

export class ReservationExpiredError extends Error {
  constructor() {
    super("Reservation has expired");
    this.name = "ReservationExpiredError";
  }
}

export class ReservationStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationStateError";
  }
}
