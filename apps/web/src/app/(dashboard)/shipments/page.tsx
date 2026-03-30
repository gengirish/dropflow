"use client";

import { useState, useEffect, useCallback } from "react";
import { Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface Shipment {
  id: string;
  carrier: string;
  awbNumber: string | null;
  trackingStatus: string;
  isInternational: boolean;
  estimatedDelivery: string | null;
  createdAt: string;
  order: { orderNumber: string; buyerName: string };
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/shipments");
    const json = await res.json();
    if (json.success) setShipments(json.data.items ?? json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Shipments</h1>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>AWB</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : shipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Truck className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No shipments yet.</p>
                </TableCell>
              </TableRow>
            ) : (
              shipments.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm">{s.order?.orderNumber ?? "-"}</TableCell>
                  <TableCell>{s.order?.buyerName ?? "-"}</TableCell>
                  <TableCell>{s.carrier}</TableCell>
                  <TableCell className="font-mono text-sm">{s.awbNumber ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{s.trackingStatus}</Badge>
                  </TableCell>
                  <TableCell>{s.isInternational ? "International" : "Domestic"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{formatDate(s.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
