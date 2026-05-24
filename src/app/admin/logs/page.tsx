"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/features/reservation/status-badge";
import { Search, ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { format } from "date-fns";
import type { ReservationStatus } from "@/types";

const EVENT_TYPES = [
  "ALL",
  "RESERVATION_CREATED",
  "RESERVATION_CONFIRMED",
  "RESERVATION_RELEASED",
  "RESERVATION_EXPIRED",
];

const EVENT_COLORS: Record<string, string> = {
  RESERVATION_CREATED: "bg-blue-100 text-blue-800",
  RESERVATION_CONFIRMED: "bg-green-100 text-green-800",
  RESERVATION_RELEASED: "bg-gray-100 text-gray-800",
  RESERVATION_EXPIRED: "bg-red-100 text-red-800",
};

async function fetchLogs(page: number, search: string, eventType: string) {
  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
    ...(search && { search }),
    ...(eventType !== "ALL" && { eventType }),
  });
  const res = await fetch(`/api/admin/logs?${params}`);
  if (!res.ok) throw new Error("Failed to fetch logs");
  return res.json();
}

export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState("ALL");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__searchTimeout);
    (window as any).__searchTimeout = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 300);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["logs", page, debouncedSearch, eventType],
    queryFn: () => fetchLogs(page, debouncedSearch, eventType),
  });

  const totalPages = data?.pagination?.totalPages ?? 1;

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">Complete event history for all reservations.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by reservation number, product, or SKU..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={eventType}
            onValueChange={(v) => { setEventType(v); setPage(1); }}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t === "ALL" ? "All Events" : t.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="h-4 w-4" />
              Events
              {data?.pagination && (
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {data.pagination.total} total
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-14 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : data?.events?.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-sm">No events found.</div>
            ) : (
              <div className="divide-y">
                {data?.events?.map((event: any) => (
                  <div key={event.id} className="px-6 py-4 flex items-start gap-4 hover:bg-muted/30 transition-colors">
                    <div className="shrink-0 mt-0.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EVENT_COLORS[event.eventType] ?? "bg-gray-100 text-gray-800"}`}>
                        {event.eventType.replace("RESERVATION_", "")}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{event.reservation?.product?.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{event.reservation?.reservationNumber}</span>
                        <StatusBadge status={event.reservation?.status as ReservationStatus} />
                      </div>
                      <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        <span>{event.reservation?.warehouse?.name}</span>
                        <span>·</span>
                        <span>Qty: {event.reservation?.quantity}</span>
                        <span>·</span>
                        <span>{format(new Date(event.createdAt), "PPp")}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
