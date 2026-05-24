"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { StatCard } from "@/components/features/analytics/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/features/reservation/status-badge";
import { supabase } from "@/lib/supabase/client";
import type { DashboardStats } from "@/types";
import { Package, Boxes, CheckCircle2, Clock, Warehouse, Activity } from "lucide-react";
import { format } from "date-fns";

async function fetchDashboard(): Promise<DashboardStats> {
  const res = await fetch("/api/admin/dashboard");
  if (!res.ok) throw new Error("Failed to fetch dashboard");
  return res.json();
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: fetchDashboard,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "Reservation" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "Inventory" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  if (isLoading || !data) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-lg border bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </>
    );
  }

  const utilizationPct =
    data.totalInventory > 0
      ? Math.round((data.reservedInventory / data.totalInventory) * 100)
      : 0;

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Inventory Dashboard</h1>
          <p className="text-muted-foreground mt-1">Real-time view across all warehouses.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Inventory" value={data.totalInventory.toLocaleString()} subtitle="units across all warehouses" icon={Package} iconColor="text-blue-600" />
          <StatCard title="Available" value={data.availableInventory.toLocaleString()} subtitle={`${100 - utilizationPct}% of total`} icon={Boxes} iconColor="text-green-600" />
          <StatCard title="Reserved" value={data.reservedInventory.toLocaleString()} subtitle={`${utilizationPct}% utilization`} icon={Clock} iconColor="text-yellow-600" />
          <StatCard title="Confirmed Today" value={data.analytics.confirmedReservations} subtitle={`${data.analytics.confirmationRate}% conversion`} icon={CheckCircle2} iconColor="text-purple-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Warehouse className="h-4 w-4" /> Warehouse Utilization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.warehouseStats.map((wh) => (
                  <div key={wh.warehouseId}>
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="text-sm font-medium">{wh.warehouseName}</span>
                        <span className="text-xs text-muted-foreground ml-2">{wh.location}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{wh.reservedUnits}/{wh.totalUnits} reserved</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          wh.utilizationRate > 80 ? "bg-red-500" : wh.utilizationRate > 50 ? "bg-yellow-500" : "bg-green-500"
                        }`}
                        style={{ width: `${wh.utilizationRate}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-xs text-muted-foreground">{wh.availableUnits} available</span>
                      <span className="text-xs font-medium">{wh.utilizationRate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" /> Reservation Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: "Total Reservations", value: data.analytics.totalReservations, color: "bg-blue-500" },
                  { label: "Confirmed", value: data.analytics.confirmedReservations, color: "bg-green-500" },
                  { label: "Pending", value: data.analytics.pendingReservations, color: "bg-yellow-500" },
                  { label: "Released", value: data.analytics.releasedReservations, color: "bg-gray-400" },
                  { label: "Expired", value: data.analytics.expiredReservations, color: "bg-red-500" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    <span className="text-sm font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            ) : (
              <div className="space-y-3">
                {data.recentActivity.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{(event as any).reservation?.product?.name}</span>
                        <Badge variant="outline" className="text-xs">{event.eventType.replace(/_/g, " ")}</Badge>
                        <StatusBadge status={(event as any).reservation?.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(event as any).reservation?.warehouse?.name} · {format(new Date(event.createdAt), "PPp")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
