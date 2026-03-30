import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/v1/webhooks(.*)",
]);

function handleRequest(req: NextRequest) {
  // E2E test bypass: skip Clerk entirely when test header matches in development
  const isE2E =
    process.env.NEXT_PUBLIC_APP_ENV === "development" &&
    process.env.E2E_TEST_KEY &&
    req.headers.get("x-e2e-test-key") === process.env.E2E_TEST_KEY;

  if (isE2E) {
    return NextResponse.next();
  }

  // If Clerk keys aren't configured (placeholder), skip auth for development
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  if (!publishableKey.startsWith("pk_live_") && !publishableKey.startsWith("pk_test_cl")) {
    if (isPublicRoute(req) || process.env.NEXT_PUBLIC_APP_ENV === "development") {
      return NextResponse.next();
    }
  }

  return null;
}

export default function middleware(req: NextRequest) {
  const earlyResponse = handleRequest(req);
  if (earlyResponse) return earlyResponse;

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
