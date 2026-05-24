"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/features/reservation/status-badge";
import { Countdown } from "@/components/features/reservation/countdown";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import type { Reservation } from "@/types";
import { CheckCircle2, XCircle, ArrowLeft, Package, MapPin, Hash, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

async function fetchReservation(id: string): Promise<Reservation> {
  const res = await fetch(`/api/reservations/${id}`);
  if (!res.ok) throw new Error("Reservation not found");
  return res.json();
}

export default function CheckoutPage({ params }: { params: { id: string } }) {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [hasExpired, setHasExpired] = useState(false);

  const { data: reservation, isLoading, error } = useQuery({
    queryKey: ["reservation", params.id],
    queryFn: () => fetchReservation(params.id),
    refetchInterval: 30_000,
  });

  // Realtime reservation status updates
  useEffect(() => {
    if (!reservation) return;
    const channel = supabase
      .channel(`reservation-${params.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "Reservation",
        filter: `id=eq.${params.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["reservation", params.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [params.id, reservation, queryClient]);

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/reservations/${params.id}/confirm`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw { status: res.status, message: data.error };
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservation", params.id] });
      toast({ title: "Purchase confirmed!", description: "Your order has been placed successfully." });
    },
    onError: (err: { status?: number; message?: string }) => {
      if (err.status === 410) {
        toast({ variant: "destructive", title: "Reservation expired", description: "This reservation has expired. Please reserve again." });
        setHasExpired(true);
      } else {
        toast({ variant: "destructive", title: "Error", description: err.message });
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/reservations/${params.id}/release`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservation", params.id] });
      toast({ title: "Reservation cancelled", description: "Your hold has been released." });
    },
  });

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 py-16 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (error || !reservation) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Reservation not found</h2>
          <p className="text-muted-foreground mt-2 mb-6">This reservation may have expired or been cancelled.</p>
          <Button asChild><Link href="/">Back to Products</Link></Button>
        </div>
      </>
    );
  }

  const isActive = reservation.status === "PENDING";
  const isConfirmed = reservation.status === "CONFIRMED";
  const isTerminal = reservation.status === "RELEASED" || reservation.status === "EXPIRED" || hasExpired;

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Products
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Checkout</h1>
            <StatusBadge status={hasExpired ? "EXPIRED" : reservation.status} />
          </div>
          <p className="text-muted-foreground text-sm mt-1 font-mono">{reservation.reservationNumber}</p>
        </div>

        {isActive && !hasExpired && (
          <Card className="mb-4 border-yellow-200 bg-yellow-50">
            <CardContent className="pt-4 pb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-800">Hold expires in</p>
                <Countdown expiresAt={reservation.expiresAt} onExpire={() => setHasExpired(true)} />
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </CardContent>
          </Card>
        )}

        {isConfirmed && (
          <Card className="mb-4 border-green-200 bg-green-50">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-800">Purchase Confirmed</p>
                <p className="text-sm text-green-700">
                  Confirmed at {format(new Date(reservation.confirmedAt!), "PPp")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isTerminal && !isConfirmed && (
          <Card className="mb-4 border-destructive/20 bg-destructive/5">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <XCircle className="h-8 w-8 text-destructive shrink-0" />
              <div>
                <p className="font-semibold text-destructive">Reservation Ended</p>
                <p className="text-sm text-muted-foreground">
                  This reservation has been {hasExpired ? "expired" : reservation.status.toLowerCase()}.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="relative h-20 w-20 rounded-md overflow-hidden bg-muted shrink-0">
                <Image src={reservation.product.imageUrl} alt={reservation.product.name} fill className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{reservation.product.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{reservation.product.sku}</p>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {reservation.warehouse.name}, {reservation.warehouse.location}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Hash className="h-3 w-3" />
                    Qty: {reservation.quantity} unit{reservation.quantity > 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" />
                    Reserved: {format(new Date(reservation.createdAt), "PPp")}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {isActive && !hasExpired && (
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending || cancelMutation.isPending}
            >
              {confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirm Purchase
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending || confirmMutation.isPending}
            >
              {cancelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Cancel
            </Button>
          </div>
        )}

        {(isTerminal || isConfirmed) && (
          <Button asChild className="w-full">
            <Link href="/">Back to Products</Link>
          </Button>
        )}

        {reservation.events.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold mb-3">Event Timeline</h3>
            <div className="space-y-2">
              {reservation.events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 text-xs">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <span className="font-medium">{event.eventType.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground ml-2">{format(new Date(event.createdAt), "PPp")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
