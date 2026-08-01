import Link from "next/link";
import { LoginForm } from "./login-form";

// No social/OAuth buttons, no magic link, no "Forgot password?" link
// (spec §2, §11 Q3 default).
export default function LoginPage() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div className="atmosphere" aria-hidden />
      <div className="card relative w-full max-w-sm space-y-5 p-8">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Log in</h1>
          <p className="text-sm text-mute">Welcome back.</p>
        </div>
        <LoginForm />
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
