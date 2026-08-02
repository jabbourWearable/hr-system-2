import Link from "next/link";
import { LoginForm } from "./login-form";
import { MagicLinkForm } from "./magic-link-form";

// No social/OAuth buttons (spec §2, §11 Q3 default) — password,
// "forgot password" recovery, and passwordless email-link sign-in
// (HR-88) are the three supported methods.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div className="atmosphere" aria-hidden />
      <div className="card relative w-full max-w-sm space-y-5 p-8">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Log in</h1>
          <p className="text-sm text-mute">Welcome back.</p>
        </div>
        {error === "link_expired" && (
          <p role="alert" className="text-sm text-accent-red">
            That sign-in link is invalid or has expired. Request a new one
            below.
          </p>
        )}
        <LoginForm />
        <p className="text-sm">
          <Link href="/reset-password" className="font-medium text-link hover:underline">
            Forgot password?
          </Link>
        </p>
        <div className="flex items-center gap-3 text-xs text-mute">
          <div className="h-px flex-1 bg-hairline" aria-hidden />
          or
          <div className="h-px flex-1 bg-hairline" aria-hidden />
        </div>
        <MagicLinkForm />
        <p className="text-sm text-mute">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-link hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
