// Placeholder UI only — HR-10 wires this form to a server action calling
// supabase.auth.signInWithPassword() and redirecting to /dashboard.
// No social/OAuth buttons, no magic link, no "Forgot password?" link
// (spec §2, §11 Q3 default).
export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Log in</h1>
        <form className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Log in
          </button>
        </form>
      </div>
    </main>
  );
}
