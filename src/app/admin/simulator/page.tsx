"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Zap, CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, Users, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";

async function fetchProducts(): Promise<Product[]> {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error();
  return res.json();
}

interface SimResult {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  elapsedMs: number;
  mode: string;
  statusBreakdown: Record<number, number>;
  successfulReservations: { reservationId: string; reservationNumber: string }[];
  errors: { status: number; message: string }[];
}

type Mode = "race" | "realistic";

const MODE_CONFIG = {
  race: {
    icon: Swords,
    label: "Race Test",
    color: "border-red-200 bg-red-50",
    activeColor: "border-red-500 bg-red-50 ring-2 ring-red-300",
    description: "All requests fire at the exact same millisecond. Only 1 wins the Redis lock regardless of stock.",
    expectation: (available: number, concurrency: number) =>
      `Expected: 1 success, ${concurrency - 1} failures — proves the lock works`,
  },
  realistic: {
    icon: Users,
    label: "Realistic Test",
    color: "border-green-200 bg-green-50",
    activeColor: "border-green-500 bg-green-50 ring-2 ring-green-300",
    description: "Requests fire in small batches with gaps between them — like real customers arriving close together.",
    expectation: (available: number, concurrency: number) =>
      `Expected: ${Math.min(available, concurrency)} successes, ${Math.max(0, concurrency - available)} failures — respects actual stock`,
  },
};

export default function SimulatorPage() {
  const { toast } = useToast();
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [concurrency, setConcurrency] = useState(10);
  const [mode, setMode] = useState<Mode>("race");
  const [result, setResult] = useState<SimResult | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  const simulation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/simulate-concurrency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, warehouseId, concurrency, mode }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Simulation failed");
      }
      return res.json() as Promise<SimResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: "Simulation complete",
        description: `${data.successCount} succeeded, ${data.failureCount} failed in ${data.elapsedMs}ms`,
      });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Simulation failed", description: err.message });
    },
  });

  const selectedProduct = products.find((p) => p.id === productId);
  const selectedInventory = selectedProduct?.inventory.find(
    (i) => i.warehouseId === warehouseId
  );
  const available = selectedInventory?.availableUnits ?? 0;
  const canRun = productId && warehouseId && !simulation.isPending;

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Zap className="h-8 w-8 text-yellow-500" />
            Concurrency Simulator
          </h1>
          <p className="text-muted-foreground mt-1">
            Two test modes — prove the lock works, or simulate real customer traffic.
          </p>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {(["race", "realistic"] as Mode[]).map((m) => {
            const cfg = MODE_CONFIG[m];
            const Icon = cfg.icon;
            const isActive = mode === m;
            return (
              <button
                key={m}
                onClick={() => { setMode(m); setResult(null); }}
                className={cn(
                  "rounded-lg border-2 p-4 text-left transition-all",
                  isActive ? cfg.activeColor : cfg.color + " hover:opacity-80"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4" />
                  <span className="font-semibold text-sm">{cfg.label}</span>
                  {isActive && <Badge variant="outline" className="ml-auto text-xs">Selected</Badge>}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {cfg.description}
                </p>
              </button>
            );
          })}
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Configure Test</CardTitle>
            <CardDescription>
              {mode === "race"
                ? "Pick a warehouse with limited stock. Only 1 request will succeed no matter how many units are available."
                : "Pick a warehouse with enough stock. Successes should match the available units (up to request count)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Product</label>
                <Select
                  value={productId}
                  onValueChange={(v) => { setProductId(v); setWarehouseId(""); setResult(null); }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Warehouse</label>
                <Select
                  value={warehouseId}
                  onValueChange={(v) => { setWarehouseId(v); setResult(null); }}
                  disabled={!productId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProduct?.inventory.map((inv) => (
                      <SelectItem key={inv.warehouseId} value={inv.warehouseId}>
                        {inv.warehouse.name} — {inv.availableUnits} available
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Number of requests</label>
              <Select
                value={String(concurrency)}
                onValueChange={(v) => setConcurrency(Number(v))}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 25, 50].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} requests</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedInventory && (
              <div className="rounded-md bg-muted p-3 text-sm space-y-1.5">
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Available units:</span>
                  <span className="font-semibold">{available}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Requests:</span>
                  <span className="font-semibold">{concurrency}</span>
                </div>
                <div className="flex items-start gap-1.5 pt-1 border-t">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 mt-0.5 shrink-0" />
                  <span className="text-xs text-yellow-700 font-medium">
                    {MODE_CONFIG[mode].expectation(available, concurrency)}
                  </span>
                </div>
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              disabled={!canRun}
              onClick={() => simulation.mutate()}
            >
              {simulation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Running {concurrency} requests ({mode} mode)...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Fire {concurrency} Requests — {MODE_CONFIG[mode].label}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <div className="space-y-4">
            {/* Mode badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Mode:</span>
              <Badge variant={result.mode === "race" ? "destructive" : "success"}>
                {result.mode === "race" ? "Race Test" : "Realistic Test"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="border-green-200">
                <CardContent className="pt-4 pb-4 text-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700">{result.successCount}</p>
                  <p className="text-xs text-muted-foreground">Succeeded</p>
                </CardContent>
              </Card>
              <Card className="border-red-200">
                <CardContent className="pt-4 pb-4 text-center">
                  <XCircle className="h-6 w-6 text-red-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-red-600">{result.failureCount}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <Clock className="h-6 w-6 text-blue-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold">{result.elapsedMs}</p>
                  <p className="text-xs text-muted-foreground">ms total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4 text-center">
                  <Zap className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
                  <p className="text-2xl font-bold">{result.totalRequests}</p>
                  <p className="text-xs text-muted-foreground">Total fired</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">HTTP Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.statusBreakdown).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                      <Badge variant={status === "201" || status === "200" ? "success" : "destructive"}>
                        HTTP {status}
                      </Badge>
                      <span className="text-sm font-semibold">{count}×</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {result.successfulReservations.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-green-700">
                    Successful Reservations ({result.successfulReservations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {result.successfulReservations.map((r) => (
                      <div key={r.reservationId} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        <span className="font-mono text-xs">{r.reservationNumber}</span>
                        <span className="text-muted-foreground text-xs truncate">
                          ({r.reservationId})
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {result.errors.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    Sample Failures (first 10)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {result.errors.map((e, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        <Badge variant="outline" className="text-xs">{e.status}</Badge>
                        <span className="text-xs">{e.message}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </>
  );
}