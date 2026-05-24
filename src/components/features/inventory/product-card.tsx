import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/types";
import { ReserveButton } from "@/components/features/reservation/reserve-button";
import { StockHealth } from "@/components/features/inventory/stock-health";
import { MapPin } from "lucide-react";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const totalAvailable = product.inventory.reduce((s, i) => s + i.availableUnits, 0);
  const totalUnits = product.inventory.reduce((s, i) => s + i.totalUnits, 0);

  return (
    <Card className="flex flex-col overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute top-2 left-2">
          <StockHealth total={totalUnits} available={totalAvailable} showLabel />
        </div>
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-sm leading-tight">{product.name}</h3>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{product.sku}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 flex-1 justify-end">
        <div className="space-y-1">
          {product.inventory.slice(0, 3).map((inv) => (
            <div key={inv.id} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {inv.warehouse.name}
              </span>
              <span className={inv.availableUnits === 0 ? "text-muted-foreground" : "font-medium"}>
                {inv.availableUnits === 0 ? "—" : `${inv.availableUnits} avail.`}
              </span>
            </div>
          ))}
          {product.inventory.length > 3 && (
            <p className="text-xs text-muted-foreground">+{product.inventory.length - 3} more warehouses</p>
          )}
        </div>

        <ReserveButton product={product} />
      </CardContent>
    </Card>
  );
}
