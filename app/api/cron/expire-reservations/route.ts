import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredReservations } from "@/lib/reservations";

/**
 * GET /api/cron/expire-reservations
 *
 * Called by Vercel Cron (or any external scheduler) every minute.
 * Protected by a shared secret so it can't be triggered by random users.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // In production, require the Authorization header
  if (
    process.env.NODE_ENV === "production" &&
    cronSecret &&
    authHeader !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const released = await releaseExpiredReservations();
    return NextResponse.json({
      ok: true,
      releasedCount: released,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Cron expire-reservations error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
