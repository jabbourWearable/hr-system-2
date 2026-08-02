// HR-88 verification: password sign-in (regression), magic-link sign-in,
// password-reset request, and the hardened /auth/confirm route (bad/missing
// token degrades to a friendly banner instead of a crash or a dead end).
// Usage: node capture.js <baseUrl>
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://localhost:3400";
const STAMP = process.argv[3] || "local";
const REGRESS_EMAIL = `hr88.regress.${STAMP}@example.com`;
const REGRESS_PASSWORD = "TestPass123!";
// gmail.com has real MX records, unlike @example.com — Supabase's OTP/
// recovery senders validate deliverability and reject example.com with
// "Email address is invalid" (signUp/signInWithPassword don't send mail
// here since mailer_autoconfirm is on, so they never hit that check).
const MAILABLE_EMAIL = `hr88.regress.mailable.${STAMP}@gmail.com`;
// Separate address for the reset-password check — Supabase throttles auth
// emails per-address (~60s cooldown), and step 2 already sends one to
// MAILABLE_EMAIL.
const RESET_EMAIL = `hr88.regress.reset.${STAMP}@gmail.com`;

function badMarkers(t) {
  t = t.toLowerCase();
  return ["application error", "internal server error", "this page could not be found", "unhandled runtime error", "client-side exception"].filter((m) => t.includes(m));
}

(async () => {
  const browser = await chromium.launch();
  const results = [];
  const shot = (n) => path.join(__dirname, n);

  // 1. Signup + password login regression (unrelated to HR-88, must not break).
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/signup`);
    await page.fill("#fullName", "HR88 Regress");
    await page.fill("#email", REGRESS_EMAIL);
    await page.fill("#password", REGRESS_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 10000 }).catch(() => {});
    results.push({ name: "signup succeeds", ok: page.url().includes("/dashboard"), notes: [page.url()] });
    await ctx.close();
  }
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`);
    await page.fill("#email", REGRESS_EMAIL);
    await page.fill("#password", REGRESS_PASSWORD);
    await page.click('button[type="submit"]:has-text("Log in")');
    await page.waitForURL("**/dashboard", { timeout: 10000 }).catch(() => {});
    results.push({ name: "password login still works (regression)", ok: page.url().includes("/dashboard"), notes: [page.url()] });
    await page.screenshot({ path: shot("01-password-login.png") });
    await ctx.close();
  }

  // 2. Magic-link request for an existing user succeeds. Needs an account
  //    that both exists (shouldCreateUser: false rejects unknown emails,
  //    verified in step 3) and is on a real, deliverable domain (Supabase's
  //    OTP sender rejects @example.com — verified separately above).
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/signup`);
    await page.fill("#fullName", "HR88 Mailable");
    await page.fill("#email", MAILABLE_EMAIL);
    await page.fill("#password", REGRESS_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 10000 }).catch(() => {});
    await ctx.close();
  }
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`);
    await page.fill("#magic-link-email", MAILABLE_EMAIL);
    await page.click('button:has-text("Email me a sign-in link")');
    await page.waitForSelector("text=Check your email", { timeout: 10000 }).catch(() => {});
    const body = await page.locator("body").innerText();
    results.push({ name: "magic-link request accepted for a mailable address", ok: /check your email/i.test(body), notes: [] });
    await page.screenshot({ path: shot("02-magic-link-sent.png") });
    await ctx.close();
  }

  // 3. Magic-link for a nonexistent user must not silently create a
  //    profile-less ghost account (shouldCreateUser: false).
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`);
    await page.fill("#magic-link-email", `hr88.nonexistent.${STAMP}@gmail.com`);
    await page.click('button:has-text("Email me a sign-in link")');
    await page.waitForTimeout(1500);
    const body = await page.locator("body").innerText();
    results.push({ name: "magic-link blocks signup for unknown address", ok: /signups not allowed/i.test(body), notes: [body.match(/Signups not allowed.*/i)?.[0] ?? ""] });
    await ctx.close();
  }

  // 4. Password-reset request succeeds for an existing user.
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/signup`);
    await page.fill("#fullName", "HR88 Reset");
    await page.fill("#email", RESET_EMAIL);
    await page.fill("#password", REGRESS_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 10000 }).catch(() => {});
    await ctx.close();
  }
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/reset-password`);
    await page.fill("#email", RESET_EMAIL);
    await page.click('button:has-text("Send reset link")');
    await page.waitForSelector("text=Check your email", { timeout: 10000 }).catch(() => {});
    const body = await page.locator("body").innerText();
    results.push({ name: "reset-password request accepted", ok: /check your email/i.test(body), notes: [] });
    await page.screenshot({ path: shot("03-reset-password-sent.png") });
    await ctx.close();
  }

  // 5. /update-password requires an authenticated session.
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/update-password`);
    await page.waitForLoadState("networkidle");
    results.push({ name: "/update-password redirects unauthenticated visitors", ok: page.url().includes("/login"), notes: [page.url()] });
    await ctx.close();
  }

  // 6. The original bug, reproduced and fixed: a bad/expired token no longer
  //    crashes or dead-ends — it redirects to /login with a clear banner.
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${BASE}/auth/confirm?token_hash=bogus-expired-token&type=magiclink`);
    await page.waitForURL(/\/login\?error=link_expired/, { timeout: 10000 }).catch(() => {});
    const body = await page.locator("body").innerText();
    const bad = badMarkers(body);
    results.push({
      name: "bad/expired sign-in link shows a friendly banner (was: raw error)",
      ok: page.url().includes("error=link_expired") && /invalid or has expired/i.test(body) && bad.length === 0 && errors.length === 0,
      notes: [page.url()],
    });
    await page.screenshot({ path: shot("04-expired-link-banner.png") });
    await ctx.close();
  }

  // 7. Bare hit with no params at all degrades cleanly too.
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/auth/confirm`);
    await page.waitForLoadState("networkidle");
    results.push({ name: "/auth/confirm with no params redirects cleanly", ok: page.url().includes("/login"), notes: [page.url()] });
    await ctx.close();
  }

  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  const verdict = { base: BASE, passed, total: results.length, results };
  fs.writeFileSync(path.join(__dirname, "verdict.json"), JSON.stringify(verdict, null, 2));
  console.log(JSON.stringify(verdict, null, 2));
  if (passed !== results.length) process.exit(1);
})();
