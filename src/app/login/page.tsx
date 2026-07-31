import Link from "next/link";
import { LoginForm } from "./login-form";

// No social/OAuth buttons, no magic link, no "Forgot password?" link
// (spec §2, §11 Q3 default).
export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Log in</h1>
        <LoginForm />
        <p className="text-sm text-foreground-muted">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-primary underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
