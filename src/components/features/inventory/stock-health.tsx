import { cn } from "@/lib/utils";

interface StockHealthProps {
  total: number;
  available: number;
  showLabel?: boolean;
}

function getHealth(total: number, available: number): { color: string; label: string; bg: string } {
  if (total === 0) return { color: "bg-gray-400", label: "No stock", bg: "bg-gray-100 text-gray-600" };
  const pct = (available / total) * 100;
  if (pct > 50) return { color: "bg-green-500", label: "In Stock", bg: "bg-green-50 text-green-700" };
  if (pct > 20) return { color: "bg-yellow-500", label: "Low Stock", bg: "bg-yellow-50 text-yellow-700" };
  if (available > 0) return { color: "bg-red-500", label: "Critical", bg: "bg-red-50 text-red-700" };
  return { color: "bg-gray-400", label: "Out of Stock", bg: "bg-gray-100 text-gray-600" };
}

export function StockHealth({ total, available, showLabel = false }: StockHealthProps) {
  const { color, label, bg } = getHealth(total, available);
  return (
    <span className={cn("inline-flex items-center gap-1.5", showLabel && `px-2 py-0.5 rounded-full text-xs font-medium ${bg}`)}>
      <span className={cn("h-2 w-2 rounded-full", color)} />
      {showLabel && label}
    </span>
  );
}
