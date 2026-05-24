export type ReservationStatus = "PENDING" | "CONFIRMED" | "RELEASED" | "EXPIRED";

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
  inventory: InventoryWithWarehouse[];
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  createdAt: string;
}

export interface Inventory {
  id: string;
  productId: string;
  warehouseId: string;
  totalUnits: number;
  reservedUnits: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryWithWarehouse extends Inventory {
  warehouse: Warehouse;
  availableUnits: number;
}

export interface Reservation {
  id: string;
  reservationNumber: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  product: Product;
  warehouse: Warehouse;
  events: ReservationEvent[];
}

export interface ReservationEvent {
  id: string;
  reservationId: string;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalReservations: number;
  confirmedReservations: number;
  releasedReservations: number;
  expiredReservations: number;
  pendingReservations: number;
  confirmationRate: number;
  expiryRate: number;
  cancellationRate: number;
}

export interface DashboardStats {
  totalInventory: number;
  reservedInventory: number;
  availableInventory: number;
  analytics: AnalyticsSummary;
  warehouseStats: WarehouseStat[];
  recentActivity: ReservationEvent[];
}

export interface WarehouseStat {
  warehouseId: string;
  warehouseName: string;
  location: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
  utilizationRate: number;
}
