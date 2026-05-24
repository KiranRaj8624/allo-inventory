"use client";

import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { StatCard } from "@/components/features/analytics/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, CheckCircle2, XCircle, Clock } from "lucide-react";

async function fetchAnalytics(days: number) {
  const res = await fetch(`/api/admin/analytics?days=${days}`);
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

const PIE_COLORS = ["#22c55e", "#f59e0b", "#6b7280", "#ef4444"];

export default function AnalyticsPage() {
  const [days, setDays] = useState(7);

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", days],
    queryFn: () => fetchAnalytics(days),
  });

  if (isLoading || !data) {
    return (
      <>
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-lg border bg-muted animate-pulse" />)}
          </div>
        </div>
      </>
    );
  }

  const { summary, trend, warehouseStats } = data;

  const pieData = [
    { name: "Confirmed", value: summary.confirmedReservations },
    { name: "Pending", value: summary.pendingReservations },
    { name: "Released", value: summary.releasedReservations },
    { name: "Expired", value: summary.expiredReservations },
  ].filter((d) => d.value > 0);

  return (
    <>
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground mt-1">Reservation trends and warehouse performance.</p>
          </div>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Confirmation Rate" value={`${summary.confirmationRate}%`} subtitle="reservations confirmed" icon={CheckCircle2} iconColor="text-green-600" />
          <StatCard title="Expiry Rate" value={`${summary.expiryRate}%`} subtitle="expired before confirm" icon={Clock} iconColor="text-yellow-600" />
          <StatCard title="Cancellation Rate" value={`${summary.cancellationRate}%`} subtitle="manually released" icon={XCircle} iconColor="text-red-600" />
          <StatCard title="Total Reservations" value={summary.totalReservations} subtitle={`last ${days} days` } icon={TrendingUp} iconColor="text-blue-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Daily Reservation Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="confirmed" stroke="#22c55e" name="Confirmed" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expired" stroke="#ef4444" name="Expired" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">No data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Warehouse Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={warehouseStats} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="warehouseName" type="category" tick={{ fontSize: 11 }} width={140} />
                <Tooltip />
                <Legend />
                <Bar dataKey="availableUnits" name="Available" stackId="a" fill="#22c55e" />
                <Bar dataKey="reservedUnits" name="Reserved" stackId="a" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
