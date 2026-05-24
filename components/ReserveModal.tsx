"use client";

import { useState } from "react";
import { Product, Warehouse, Reservation } from "@/types";

interface Props {
  product: Product;
  warehouses: Warehouse[];
  defaultWarehouseId?: string;
  onClose: () => void;
  onSuccess: (reservation: Reservation) => void;
}

export default function ReserveModal({
  product,
  warehouses,
  defaultWarehouseId,
  onClose,
  onSuccess,
}: Props) {
  const [warehouseId, setWarehouseId] = useState(
    defaultWarehouseId ?? product.stockLevels[0]?.warehouseId ?? ""
  );
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStock = product.stockLevels.find(
    (s) => s.warehouseId === warehouseId
  );
  const maxAvailable = selectedStock?.availableUnits ?? 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          productId: product.id,
          warehouseId,
          quantity,
          customerEmail: email || undefined,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError(`Not enough stock. Only ${data.available ?? 0} unit(s) available.`);
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Failed to create reservation");
        return;
      }

      onSuccess(data as Reservation);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Reserve Units</h2>
              <p className="text-sm text-gray-500 mt-0.5">{product.name}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Warehouse selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Warehouse
            </label>
            <select
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setQuantity(1);
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              {product.stockLevels.map((s) => {
                const wh = warehouses.find((w) => w.id === s.warehouseId);
                return (
                  <option key={s.warehouseId} value={s.warehouseId} disabled={s.availableUnits === 0}>
                    {wh?.name ?? s.warehouseId} — {s.availableUnits} available
                  </option>
                );
              })}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
              >
                −
              </button>
              <span className="text-xl font-semibold w-8 text-center">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(maxAvailable, q + 1))}
                className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                disabled={quantity >= maxAvailable}
              >
                +
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">{maxAvailable} units available</p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer email{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Info box */}
          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
            <strong>10-minute hold:</strong> We'll reserve these units for 10 minutes while you complete payment. The hold releases automatically if not confirmed.
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              ⚠ {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || maxAvailable === 0}
              className="flex-1 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Reserving…" : "Reserve now"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
