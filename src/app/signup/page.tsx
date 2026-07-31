import Link from "next/link";
import { SignupForm } from "./signup-form";

// No "Forgot password?" link (spec §11 Q3 default). Email confirmation is
// disabled on the Supabase project, so signup logs the user in immediately.
export default function SignupPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Sign up</h1>
        <SignupForm />
        <p className="text-sm text-foreground-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-primary underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
