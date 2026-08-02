import { requireUser } from "@/lib/auth/session";
import { UpdatePasswordForm } from "./update-password-form";

export default async function UpdatePasswordPage() {
  await requireUser();

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div className="atmosphere" aria-hidden />
      <div className="card relative w-full max-w-sm space-y-5 p-8">
        <div className="space-y-1">
          <h1 className="display-serif text-3xl">Set a new password</h1>
          <p className="text-sm text-mute">Choose a password for your account.</p>
        </div>
        <UpdatePasswordForm />
      </div>
    </main>
  );
}
