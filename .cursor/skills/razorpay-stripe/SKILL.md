---
name: razorpay-stripe
description: >-
  Razorpay (India) + Stripe (international) payment integration for DropFlow.
  Use when implementing payment flows, webhook handlers, refunds, or payment
  verification in orders or webhooks.
---

# Razorpay + Stripe — DropFlow Payments

Packages: `razorpay`, `stripe`

## Razorpay Setup (Indian Payments)

```typescript
import Razorpay from "razorpay";
import { env } from "@/lib/env";

export const razorpay = new Razorpay({
  key_id: env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  key_secret: env.RAZORPAY_KEY_SECRET,
});
```

### Create Payment Order

```typescript
export async function createRazorpayOrder(amountPaise: number, orderId: string) {
  const rpOrder = await razorpay.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: orderId,
    notes: { orderId },
  });

  return {
    razorpayOrderId: rpOrder.id,
    amountPaise: rpOrder.amount,
    currency: rpOrder.currency,
  };
}
```

### Verify Webhook Signature

```typescript
import crypto from "crypto";

export function verifyRazorpaySignature(body: string, signature: string): boolean {
  const expected = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

### Webhook Handler (app/api/v1/webhooks/razorpay/route.ts)

```typescript
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature")!;

  if (!verifyRazorpaySignature(body, signature)) {
    return err("INVALID_SIGNATURE", "Invalid webhook signature", 400);
  }

  const event = JSON.parse(body);

  if (event.event === "payment.captured") {
    const { order_id, id: paymentId, amount } = event.payload.payment.entity;
    await db.payment.update({
      where: { gatewayOrderId: order_id },
      data: { status: "CAPTURED", gatewayPaymentId: paymentId, capturedAt: new Date() },
    });
    // Advance order workflow
    await workerClient.enqueue.mutate({
      queue: "order-queue",
      payload: { orderId: order_id, action: "PAYMENT_CONFIRMED" },
    });
  }

  return ok({ received: true });
}
```

## Stripe Setup (International Payments)

```typescript
import Stripe from "stripe";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
});
```

### Create Checkout Session

```typescript
export async function createStripeCheckout(
  amountPaise: number,
  currency: "USD" | "EUR" | "GBP",
  orderId: string,
) {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: currency.toLowerCase(),
        unit_amount: convertPaiseToCents(amountPaise, currency),
        product_data: { name: `Order ${orderId}` },
      },
      quantity: 1,
    }],
    metadata: { orderId },
    success_url: `${env.NEXT_PUBLIC_APP_URL}/orders/${orderId}?payment=success`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/orders/${orderId}?payment=cancelled`,
  });

  return { checkoutUrl: session.url, stripeSessionId: session.id };
}
```

### Webhook Handler (app/api/v1/webhooks/stripe/route.ts)

```typescript
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return err("INVALID_SIGNATURE", "Invalid signature", 400);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    // Update payment status, advance workflow
  }

  return ok({ received: true });
}
```

## Gateway Selection Logic

```typescript
export function selectPaymentGateway(currency: string): "RAZORPAY" | "STRIPE" {
  return currency === "INR" ? "RAZORPAY" : "STRIPE";
}
```

## Conventions

- All amounts stored in DB as paise (Int), regardless of gateway
- Razorpay uses paise natively; Stripe uses cents — convert at the boundary
- Always verify webhook signatures before processing
- Store raw gateway response in `Payment.metaJson` for debugging
- Idempotency: check `Payment.status` before processing duplicate webhooks
