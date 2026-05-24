export type ReservationStatus = "PENDING" | "CONFIRMED" | "RELEASED" | "EXPIRED";

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  stockLevels: StockLevelWithWarehouse[];
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockLevel {
  id: string;
  productId: string;
  warehouseId: string;
  totalUnits: number;
  reservedUnits: number;
}

export interface StockLevelWithWarehouse extends StockLevel {
  warehouse: Warehouse;
  availableUnits: number;
}

export interface Reservation {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  customerEmail: string | null;
  createdAt: string;
  updatedAt: string;
  product?: Product;
  warehouse?: Warehouse;
}

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}
