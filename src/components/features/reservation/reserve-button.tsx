"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Product, InventoryWithWarehouse } from "@/types";
import { ShoppingCart, Loader2 } from "lucide-react";
import { StockHealth } from "@/components/features/inventory/stock-health";

interface ReserveButtonProps {
  product: Product;
}

async function createReservation(productId: string, warehouseId: string, quantity: number) {
  const res = await fetch("/api/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, warehouseId, quantity }),
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, message: data.error };
  return data;
}

export function ReserveButton({ product }: ReserveButtonProps) {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const inventoryOptions = product.inventory.filter((inv) => inv.availableUnits > 0);
  const selectedInv: InventoryWithWarehouse | undefined = product.inventory.find(
    (i) => i.warehouseId === selectedWarehouseId
  );

  const mutation = useMutation({
    mutationFn: () => createReservation(product.id, selectedWarehouseId, quantity),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Reservation created!", description: `${data.reservationNumber} — ${quantity} unit(s) held for 10 minutes.` });
      router.push(`/checkout/${data.id}`);
    },
    onError: (err: { status?: number; message?: string }) => {
      if (err.status === 409) {
        toast({ variant: "destructive", title: "Out of stock", description: err.message ?? "Not enough stock available." });
      } else {
        toast({ variant: "destructive", title: "Error", description: err.message ?? "Something went wrong." });
      }
    },
  });

  if (inventoryOptions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">Out of stock across all warehouses</div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
        <SelectTrigger className="w-full text-sm h-9">
          <SelectValue placeholder="Select warehouse" />
        </SelectTrigger>
        <SelectContent>
          {inventoryOptions.map((inv) => (
            <SelectItem key={inv.warehouseId} value={inv.warehouseId}>
              <span className="flex items-center gap-2">
                <StockHealth total={inv.totalUnits} available={inv.availableUnits} />
                {inv.warehouse.name} — {inv.availableUnits} left
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedInv && (
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md">
            <button
              className="px-2 py-1 text-sm hover:bg-muted transition-colors rounded-l-md"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            >-</button>
            <span className="px-3 py-1 text-sm border-x min-w-[2rem] text-center">{quantity}</span>
            <button
              className="px-2 py-1 text-sm hover:bg-muted transition-colors rounded-r-md"
              onClick={() => setQuantity((q) => Math.min(selectedInv.availableUnits, q + 1))}
            >+</button>
          </div>
          <Button
            size="sm"
            className="flex-1"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ShoppingCart className="h-4 w-4 mr-2" />
            )}
            Reserve
          </Button>
        </div>
      )}
    </div>
  );
}
