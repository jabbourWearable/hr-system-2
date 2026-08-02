import Link from "next/link";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div className="atmosphere" aria-hidden />
      <div className="card relative w-full max-w-sm space-y-5 p-8">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Reset password</h1>
          <p className="text-sm text-mute">
            We&apos;ll email you a link to set a new one.
          </p>
        </div>
        <ResetPasswordForm />
        <p className="text-sm text-mute">
          <Link href="/login" className="font-medium text-link hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}
