"use client";

import { useEffect, useState, useCallback, use } from "react";
import { Reservation } from "@/types";
import Link from "next/link";

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, ms));
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [expiresAt]);

  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const pct = Math.min(
    100,
    (remaining / (10 * 60 * 1000)) * 100
  );

  const color =
    remaining === 0
      ? "text-red-600"
      : remaining < 60_000
      ? "text-amber-600"
      : "text-indigo-600";

  if (remaining === 0) {
    return (
      <div className="text-center">
        <p className="text-red-600 font-bold text-xl">Expired</p>
      </div>
    );
  }

  return (
    <div className="text-center space-y-2">
      <p className={`text-4xl font-mono font-bold tabular-nums ${color}`}>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </p>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            remaining < 60_000 ? "bg-amber-500" : "bg-indigo-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-500">remaining to confirm</p>
    </div>
  );
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-amber-100 text-amber-700" },
  CONFIRMED: { label: "Confirmed", color: "bg-green-100 text-green-700" },
  RELEASED: { label: "Released", color: "bg-gray-100 text-gray-600" },
  EXPIRED: { label: "Expired", color: "bg-red-100 text-red-700" },
};

export default function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"confirm" | "release" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchReservation = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${id}`);
      if (!res.ok) throw new Error("Reservation not found");
      const data = await res.json();
      setReservation(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  async function handleConfirm() {
    setActionLoading("confirm");
    setActionError(null);
    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": `confirm-${id}` },
      });
      const data = await res.json();
      if (res.status === 410) {
        setActionError("This reservation has expired and can no longer be confirmed.");
        fetchReservation();
        return;
      }
      if (!res.ok) {
        setActionError(data.error ?? "Failed to confirm");
        return;
      }
      setReservation(data);
    } catch {
      setActionError("Network error");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRelease() {
    setActionLoading("release");
    setActionError(null);
    try {
      const res = await fetch(`/api/reservations/${id}/release`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Failed to cancel");
        return;
      }
      setReservation(data);
    } catch {
      setActionError("Network error");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error ?? "Reservation not found"}
        </div>
        <Link href="/" className="mt-4 inline-block text-indigo-600 text-sm">
          ← Back to products
        </Link>
      </div>
    );
  }

  const statusMeta = STATUS_LABELS[reservation.status] ?? STATUS_LABELS.PENDING;
  const isPending = reservation.status === "PENDING";
  const isExpired = reservation.status === "EXPIRED";
  const isTerminal = ["CONFIRMED", "RELEASED", "EXPIRED"].includes(reservation.status);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <Link href="/" className="text-sm text-indigo-600 hover:underline">
        ← Back to products
      </Link>

      <div className="mt-4 bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-xl text-gray-900">Reservation</h1>
            <p className="text-xs font-mono text-gray-400 mt-0.5">{reservation.id}</p>
          </div>
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${statusMeta.color}`}>
            {statusMeta.label}
          </span>
        </div>

        {/* Countdown (only for pending) */}
        {isPending && (
          <div className="p-6 border-b border-gray-100 bg-indigo-50/50">
            <Countdown expiresAt={reservation.expiresAt} />
          </div>
        )}

        {/* Details */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Product</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {(reservation as any).product?.name ?? reservation.productId}
              </p>
              <p className="text-xs text-gray-400 font-mono">
                {(reservation as any).product?.sku}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Warehouse</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {(reservation as any).warehouse?.name ?? reservation.warehouseId}
              </p>
              <p className="text-xs text-gray-400">
                {(reservation as any).warehouse?.location}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Quantity</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">
                {reservation.quantity} unit{reservation.quantity !== 1 ? "s" : ""}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Reserved at</p>
              <p className="text-sm text-gray-900 mt-0.5">
                {new Date(reservation.createdAt).toLocaleString()}
              </p>
            </div>
            {!isPending && (
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Expires at</p>
                <p className="text-sm text-gray-900 mt-0.5">
                  {new Date(reservation.expiresAt).toLocaleString()}
                </p>
              </div>
            )}
            {reservation.confirmedAt && (
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Confirmed at</p>
                <p className="text-sm text-gray-900 mt-0.5">
                  {new Date(reservation.confirmedAt).toLocaleString()}
                </p>
              </div>
            )}
            {reservation.releasedAt && (
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Released at</p>
                <p className="text-sm text-gray-900 mt-0.5">
                  {new Date(reservation.releasedAt).toLocaleString()}
                </p>
              </div>
            )}
            {reservation.customerEmail && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Customer email</p>
                <p className="text-sm text-gray-900 mt-0.5">{reservation.customerEmail}</p>
              </div>
            )}
          </div>
        </div>

        {/* Action error */}
        {actionError && (
          <div className="mx-6 mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            ⚠ {actionError}
          </div>
        )}

        {/* Terminal state messages */}
        {reservation.status === "CONFIRMED" && (
          <div className="mx-6 mb-6 bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
            ✓ Payment confirmed. Stock has been permanently decremented.
          </div>
        )}
        {reservation.status === "RELEASED" && (
          <div className="mx-6 mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
            This reservation was cancelled. The units are now available again.
          </div>
        )}
        {isExpired && (
          <div className="mx-6 mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            This reservation expired before payment was confirmed. The units have been released.
          </div>
        )}

        {/* Actions (only for pending) */}
        {isPending && (
          <div className="p-6 pt-0 flex gap-3">
            <button
              onClick={handleRelease}
              disabled={actionLoading !== null}
              className="flex-1 py-2.5 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {actionLoading === "release" ? "Cancelling…" : "Cancel reservation"}
            </button>
            <button
              onClick={handleConfirm}
              disabled={actionLoading !== null}
              className="flex-1 py-2.5 px-4 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {actionLoading === "confirm" ? "Confirming…" : "✓ Confirm purchase"}
            </button>
          </div>
        )}

        {isTerminal && (
          <div className="p-6 pt-0">
            <Link
              href="/"
              className="block w-full py-2.5 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-center"
            >
              ← Back to products
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
