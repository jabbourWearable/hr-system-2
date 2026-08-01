import Link from "next/link";
import { SignupForm } from "./signup-form";

// No "Forgot password?" link (spec §11 Q3 default). Email confirmation is
// disabled on the Supabase project, so signup logs the user in immediately.
export default function SignupPage() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div className="atmosphere atmosphere-green" aria-hidden />
      <div className="card relative w-full max-w-sm space-y-5 p-8">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Sign up</h1>
          <p className="text-sm text-mute">Create your account.</p>
        </div>
        <SignupForm />
        <p className="text-sm text-mute">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-link hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
