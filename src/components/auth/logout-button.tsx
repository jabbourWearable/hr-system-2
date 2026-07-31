import { logout } from "@/lib/auth/actions";

// Plain Server Component: logout carries no client-side state (no
// useActionState needed), so this can submit directly to the Server
// Action without a "use client" boundary.
export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
      >
        Log out
      </button>
    </form>
  );
}
