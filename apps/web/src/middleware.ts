import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/v1/webhooks(.*)",
]);

export default function middleware(req: NextRequest) {
  const e2eKey = (process.env.E2E_TEST_KEY ?? "").trim();
  const incomingKey = req.headers.get("x-e2e-test-key")?.trim();

  if (e2eKey && incomingKey === e2eKey) {
    return NextResponse.next();
  }

  const publishableKey = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").trim();
  const hasValidKeys = publishableKey.startsWith("pk_test_") || publishableKey.startsWith("pk_live_");

  if (!hasValidKeys) {
    return NextResponse.next();
  }

  return clerkMiddleware(async (auth, request) => {
    if (!isPublicRoute(request)) {
      await auth.protect();
    }
  })(req, {} as never);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
