---
name: shipping-carriers
description: >-
  Shipping carrier integrations for DropFlow — Shiprocket (domestic India),
  Delhivery (via Shiprocket), EasyPost (international). Use when building
  shipment creation, label generation, tracking, or carrier webhook handlers.
---

# Shipping Carriers — DropFlow

Packages: `@easypost/api` (international), custom wrappers (domestic)  
Location: `apps/worker/src/integrations/`

## Carrier Selection Logic

```typescript
export function selectCarrier(order: Order, shipment: ShipmentInput): ShipmentCarrier {
  if (shipment.isInternational) {
    return "EASYPOST_DHL"; // default international, can rate-shop
  }
  return "SHIPROCKET"; // aggregator for domestic India
}
```

## Shiprocket Integration (Domestic India)

No official Node.js SDK — build a typed wrapper:

```typescript
// integrations/shiprocket.ts

const BASE_URL = "https://apiv2.shiprocket.in/v1/external";
let authToken: string | null = null;
let tokenExpiry: number = 0;

async function getToken(): Promise<string> {
  if (authToken && Date.now() < tokenExpiry) return authToken;

  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: env.SHIPROCKET_EMAIL,
      password: env.SHIPROCKET_PASSWORD,
    }),
  });
  const data = await res.json();
  authToken = data.token;
  tokenExpiry = Date.now() + 8 * 24 * 60 * 60 * 1000; // 8 days
  return authToken!;
}

async function shiprocketFetch(path: string, opts: RequestInit = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  });
  if (!res.ok) throw new Error(`Shiprocket ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function createShiprocketOrder(order: Order, items: OrderItem[]) {
  return shiprocketFetch("/orders/create/adhoc", {
    method: "POST",
    body: JSON.stringify({
      order_id: order.orderNumber,
      order_date: new Date().toISOString(),
      billing_customer_name: order.buyerName,
      billing_phone: order.buyerPhone.replace("+91", ""),
      billing_address: order.billingAddress.line1,
      billing_city: order.billingAddress.city,
      billing_pincode: order.billingAddress.pin,
      billing_state: order.billingAddress.state,
      billing_country: "India",
      shipping_is_billing: false,
      shipping_customer_name: order.buyerName,
      // ... shipping address fields
      order_items: items.map(i => ({
        name: i.product.name,
        sku: i.product.sku,
        units: i.quantity,
        selling_price: i.unitPricePaise / 100,
        hsn: i.hsnCode,
      })),
      payment_method: "Prepaid",
      sub_total: order.subtotalPaise / 100,
    }),
  });
}

export async function generateAWB(shipmentId: string, courierId: number) {
  return shiprocketFetch("/courier/assign/awb", {
    method: "POST",
    body: JSON.stringify({ shipment_id: shipmentId, courier_id: courierId }),
  });
}

export async function getTracking(awbNumber: string) {
  return shiprocketFetch(`/courier/track/awb/${awbNumber}`);
}
```

## EasyPost Integration (International)

```typescript
import EasyPost from "@easypost/api";

const easypost = new EasyPost(env.EASYPOST_API_KEY);

export async function createInternationalShipment(order: Order, parcel: ParcelDims) {
  const shipment = await easypost.Shipment.create({
    from_address: {
      company: "DropFlow Seller",
      street1: "...", // seller address from tenant config
      city: "Bangalore",
      state: "KA",
      zip: "560001",
      country: "IN",
    },
    to_address: {
      name: order.buyerName,
      street1: order.shippingAddress.line1,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      zip: order.shippingAddress.pin,
      country: order.shippingAddress.country,
    },
    parcel: {
      length: parcel.length_cm,
      width: parcel.width_cm,
      height: parcel.height_cm,
      weight: parcel.weight_grams / 28.35, // grams → ounces
    },
    customs_info: {
      customs_items: [{
        description: "E-commerce goods",
        hs_tariff_number: order.items[0].hsnCode,
        origin_country: "IN",
        quantity: 1,
        value: order.totalPaise / 100,
        currency: "INR",
      }],
    },
  });

  // Rate shop
  const cheapestRate = shipment.lowestRate(["DHL", "FedEx", "UPS"]);
  const purchased = await easypost.Shipment.buy(shipment.id, cheapestRate);

  return {
    trackingNumber: purchased.tracking_code,
    labelUrl: purchased.postage_label.label_url,
    carrier: cheapestRate.carrier,
    trackingUrl: purchased.tracker.public_url,
  };
}
```

## Carrier Webhook (app/api/v1/webhooks/carriers/route.ts)

```typescript
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { carrier, awb, status, eventTime, rawPayload } = body;

  await workerClient.enqueue.mutate({
    queue: "shipping-queue",
    payload: {
      action: "TRACKING_UPDATE",
      carrier,
      awbNumber: awb,
      status,
      eventTime,
      rawPayload,
    },
  });

  return ok({ received: true });
}
```

## Unified Tracking Status Mapping

Map carrier-specific statuses to DropFlow's unified status:

```typescript
const TRACKING_STATUS_MAP: Record<string, string> = {
  // Shiprocket
  "6": "IN_TRANSIT",
  "7": "DELIVERED",
  "8": "CANCELLED",
  // EasyPost
  "in_transit": "IN_TRANSIT",
  "out_for_delivery": "OUT_FOR_DELIVERY",
  "delivered": "DELIVERED",
};
```
