import Link from "next/link";

// hero-stripe per DESIGN.md: oversized display serif headline, one white
// primary CTA, a single atmospheric glow, no decorative chrome.
export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
      <div className="atmosphere" aria-hidden />
      <div className="relative flex max-w-2xl flex-col items-center gap-7">
        <span className="inline-flex items-center gap-2 rounded-full border border-hairline-strong bg-elevated px-3 py-1 font-mono text-xs text-body">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green" aria-hidden />
          People · Attendance · Leave · Recognition
        </span>
        <h1 className="display-serif text-5xl sm:text-6xl md:text-7xl">
          Your whole team, in one&nbsp;place.
        </h1>
        <p className="max-w-md text-base text-mute">
          A company directory and org chart, geo-attendance and leave, plus
          kudos and celebrations that keep the team connected — all in one
          place.
        </p>
        <div className="flex gap-3">
          <Link href="/login" className="btn btn-primary">
            Log in
          </Link>
          <Link href="/signup" className="btn btn-ghost">
            Sign up
          </Link>
        </div>
      </div>
    </main>
  );
}
