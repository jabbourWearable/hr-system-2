import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold">HR Management &amp; Geo-Attendance</h1>
      <p className="max-w-md text-sm text-foreground-muted">
        Sign in to check in/out at your work site, manage leave requests, and
        view your attendance history.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium"
        >
          Sign up
        </Link>
      </div>
    </main>
  );
}
