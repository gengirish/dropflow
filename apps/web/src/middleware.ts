import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/v1/webhooks(.*)",
]);

function handleRequest(req: NextRequest) {
  const appEnv = (process.env.NEXT_PUBLIC_APP_ENV ?? "").trim();
  const e2eKey = (process.env.E2E_TEST_KEY ?? "").trim();

  const isE2E =
    appEnv === "development" &&
    e2eKey &&
    req.headers.get("x-e2e-test-key")?.trim() === e2eKey;

  if (isE2E) {
    return NextResponse.next();
  }

  const publishableKey = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").trim();
  if (!publishableKey.startsWith("pk_live_") && !publishableKey.startsWith("pk_test_cl")) {
    if (isPublicRoute(req) || appEnv === "development") {
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
