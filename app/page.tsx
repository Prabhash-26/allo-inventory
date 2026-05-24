"use client";

import { useEffect, useState, useCallback } from "react";
import { Product, Warehouse, Reservation } from "@/types";
import ReserveModal from "@/components/ReserveModal";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [reservingProduct, setReservingProduct] = useState<Product | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedWarehouse !== "all") params.set("warehouseId", selectedWarehouse);
      if (inStockOnly) params.set("inStockOnly", "true");

      const [productsRes, warehousesRes] = await Promise.all([
        fetch(`/api/products?${params}`),
        fetch("/api/warehouses"),
      ]);

      if (!productsRes.ok || !warehousesRes.ok) throw new Error("Failed to fetch data");

      const [p, w] = await Promise.all([productsRes.json(), warehousesRes.json()]);
      setProducts(p);
      setWarehouses(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouse, inStockOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getAvailableStock = (product: Product) => {
    if (selectedWarehouse === "all") {
      return product.stockLevels.reduce((sum, s) => sum + s.availableUnits, 0);
    }
    const level = product.stockLevels.find((s) => s.warehouseId === selectedWarehouse);
    return level?.availableUnits ?? 0;
  };

  const getTotalStock = (product: Product) => {
    if (selectedWarehouse === "all") {
      return product.stockLevels.reduce((sum, s) => sum + s.totalUnits, 0);
    }
    const level = product.stockLevels.find((s) => s.warehouseId === selectedWarehouse);
    return level?.totalUnits ?? 0;
  };

  const getReservedStock = (product: Product) => {
    if (selectedWarehouse === "all") {
      return product.stockLevels.reduce((sum, s) => sum + s.reservedUnits, 0);
    }
    const level = product.stockLevels.find((s) => s.warehouseId === selectedWarehouse);
    return level?.reservedUnits ?? 0;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Product Catalogue</h1>
        <p className="text-gray-500 mt-1">
          {products.length} products across {warehouses.length} warehouses
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Warehouse</label>
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All warehouses</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 pt-4">
          <input
            type="checkbox"
            id="inStockOnly"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="inStockOnly" className="text-sm text-gray-700">
            In stock only
          </label>
        </div>
        <button
          onClick={fetchData}
          className="ml-auto text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Product grid */}
      {products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No products found</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => {
            const available = getAvailableStock(product);
            const total = getTotalStock(product);
            const reserved = getReservedStock(product);
            const pct = total > 0 ? Math.round((available / total) * 100) : 0;

            return (
              <div
                key={product.id}
                className="bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all p-5 flex flex-col gap-3"
              >
                {/* SKU badge */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                    {product.sku}
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      available === 0
                        ? "bg-red-100 text-red-700"
                        : available < 5
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {available === 0 ? "Out of stock" : available < 5 ? "Low stock" : "In stock"}
                  </span>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900">{product.name}</h3>
                  {product.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                  )}
                </div>

                {/* Stock breakdown */}
                <div className="space-y-2">
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        pct === 0 ? "bg-red-400" : pct < 30 ? "bg-amber-400" : "bg-green-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{available} available</span>
                    <span>{reserved} reserved · {total} total</span>
                  </div>
                </div>

                {/* Per-warehouse stock (when showing all) */}
                {selectedWarehouse === "all" && product.stockLevels.length > 0 && (
                  <div className="space-y-1 border-t border-gray-100 pt-2">
                    {product.stockLevels.map((s) => (
                      <div key={s.id} className="flex justify-between text-xs text-gray-500">
                        <span className="truncate">{s.warehouse.name}</span>
                        <span>{s.availableUnits} avail</span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  disabled={available === 0}
                  onClick={() => setReservingProduct(product)}
                  className={`mt-auto w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    available === 0
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  }`}
                >
                  {available === 0 ? "Unavailable" : "Reserve →"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Reserve Modal */}
      {reservingProduct && (
        <ReserveModal
          product={reservingProduct}
          warehouses={warehouses}
          defaultWarehouseId={selectedWarehouse !== "all" ? selectedWarehouse : undefined}
          onClose={() => setReservingProduct(null)}
          onSuccess={(reservation: Reservation) => {
            setReservingProduct(null);
            fetchData();
            window.location.href = `/reservations/${reservation.id}`;
          }}
        />
      )}
    </div>
  );
}
