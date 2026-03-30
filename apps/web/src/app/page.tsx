import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">DropFlow</h1>
      <p className="max-w-md text-center text-muted-foreground">
        Automate your dropshipping business. GST-compliant invoicing, real-time
        workflow tracking, and multi-carrier shipping — built for India.
      </p>
      <div className="flex gap-4">
        <Link
          href="/sign-in"
          className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Sign In
        </Link>
        <Link
          href="/sign-up"
          className="rounded-md border border-input bg-background px-6 py-2.5 text-sm font-medium hover:bg-accent"
        >
          Get Started
        </Link>
      </div>
    </main>
  );
}
