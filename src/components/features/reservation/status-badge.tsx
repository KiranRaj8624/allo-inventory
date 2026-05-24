import { Badge } from "@/components/ui/badge";
import type { ReservationStatus } from "@/types";

const config: Record<ReservationStatus, { label: string; variant: "success" | "warning" | "destructive" | "info" | "secondary" }> = {
  PENDING: { label: "Pending", variant: "warning" },
  CONFIRMED: { label: "Confirmed", variant: "success" },
  RELEASED: { label: "Released", variant: "secondary" },
  EXPIRED: { label: "Expired", variant: "destructive" },
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const { label, variant } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}
