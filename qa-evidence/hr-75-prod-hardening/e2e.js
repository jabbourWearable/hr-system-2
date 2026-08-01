// HR-75 — FULL independent E2E regression + hardening sweep against LIVE prod.
// Goes beyond the HR-72 harness by adding: a real SIGN-UP flow (new throwaway
// user -> /dashboard, proving auth+profile-creation+session), a full geo
// CHECK-IN -> CHECK-OUT cycle (HR-72 only did check-in), and a rigorous
// REAL-TIME notification test — the manager approves in a second browser
// context while the employee's /dashboard stays OPEN, and we assert the
// notification arrives live (no reload) via Supabase Realtime, then mark-read.
//
// Flow:
//   signup:   /signup new user -> lands /dashboard (no site assigned)
//   employee: login -> geo check-in -> check-out -> People Hub
//             (directory/profile/org/kudos) -> attendance history ->
//             submit leave request -> park on /dashboard (subscription live)
//   manager:  login -> approvals -> APPROVE the exact request (matched by marker)
//   realtime: employee's still-open /dashboard receives the notification LIVE
//             (no reload) -> mark read
//   admin:    login -> admin dashboard/attendance/leave/employees/sites
// Emits e2e.json + full-page dark-mode screenshots + run-meta.json (for cleanup).
const fs = require("fs");
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "https://hr-system-2-iota.vercel.app";
const PW = "TestPass123!";
const EMP = "hr13.employee@example.com";
const MGR = "hr13.manager@example.com";
const ADMIN = "hr13.admin@example.com";
const GEO = { latitude: 32.0853, longitude: 34.7818 }; // inside HR-30 QA Site (r=200m)
const OUTDIR = __dirname;

const STAMP = process.env.RUN_STAMP || String(Date.now());
const SIGNUP_EMAIL = `hr75.signup.${STAMP}@example.com`;
const SIGNUP_NAME = `HR75 Signup ${STAMP}`;
const LEAVE_START = "2026-10-05";
const LEAVE_END = "2026-10-07";
const LEAVE_REASON = `HR-75 realtime E2E verification ${STAMP}`;

const results = [];
function rec(step, ok, detail) {
  results.push({ step, ok, detail: detail || "" });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? " — " + detail : ""}`);
}
const BAD = ["application error", "internal server error", "this page could not be found", "unhandled runtime error", "client-side exception", "500", "something went wrong"];
async function pageText(page) { return (await page.locator("body").innerText().catch(() => "")).toLowerCase(); }
async function assertClean(page, step, extra) {
  const t = await pageText(page);
  // "500" is noisy (dates/ids) — only treat the framework error strings as fatal.
  const fatal = BAD.filter((m) => m !== "500" && t.includes(m));
  rec(step, fatal.length === 0, fatal.length ? "ERROR_MARKERS:" + fatal.join("|") : (extra || "clean"));
  return fatal.length === 0;
}
async function shot(page, name) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: `${OUTDIR}/${name}.png`, fullPage: true }).catch(() => {});
}
async function ctx(browser) {
  return browser.newContext({ viewport: { width: 1360, height: 940 }, colorScheme: "dark", geolocation: GEO, permissions: ["geolocation"] });
}
async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", PW);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 30000 });
}
function attendanceBtn(page) { return page.getByRole("button", { name: /^(Check In|Check Out)$/ }); }
async function btnLabel(page) { return (await attendanceBtn(page).textContent().catch(() => ""))?.trim(); }

(async () => {
  const browser = await chromium.launch();
  let cSignup, cEmp, cMgr, cAdmin;
  try {
    // ===== 1. SIGN-UP (new throwaway user) =====
    {
      cSignup = await ctx(browser); const page = await cSignup.newPage();
      try {
        await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
        await assertClean(page, "signup/form-render");
        await shot(page, "01-signup-form");
        await page.fill("#fullName", SIGNUP_NAME);
        await page.fill("#email", SIGNUP_EMAIL);
        await page.fill("#password", PW);
        await page.click('button[type="submit"]');
        let landed = false;
        try { await page.waitForURL(`${BASE}/dashboard`, { timeout: 30000 }); landed = true; } catch {}
        const err = await page.locator('[role="alert"]').first().textContent().catch(() => null);
        rec("signup/create-and-auth", landed, landed ? `${SIGNUP_EMAIL} -> /dashboard` : `stuck on ${page.url().replace(BASE, "")}${err ? " err=" + err : ""}`);
        await assertClean(page, "signup/dashboard-render");
        await shot(page, "02-signup-dashboard");
      } catch (e) { rec("signup/flow", false, String(e).slice(0, 200)); await shot(page, "01-signup-ERR"); }
    }

    // ===== 2. EMPLOYEE core (context stays open for the realtime phase) =====
    cEmp = await ctx(browser); const emp = await cEmp.newPage();
    await login(emp, EMP); rec("employee/login", true, "/dashboard");
    await assertClean(emp, "employee/dashboard-render");
    await shot(emp, "03-employee-dashboard");

    // geo check-in -> check-out (full cycle; direction inferred from start state)
    const L0 = await btnLabel(emp);
    if (L0 === "Check In" || L0 === "Check Out") {
      await attendanceBtn(emp).click(); await emp.waitForTimeout(4500);
      const L1 = await btnLabel(emp);
      const act1 = L0 === "Check In" ? "check-in" : "check-out";
      rec(`attendance/${act1}`, L1 && L1 !== L0, `"${L0}" -> "${L1}"`);
      await shot(emp, "04-attendance-toggled-1");
      await attendanceBtn(emp).click(); await emp.waitForTimeout(4500);
      const L2 = await btnLabel(emp);
      const act2 = L1 === "Check In" ? "check-in" : "check-out";
      rec(`attendance/${act2}`, L2 === L0, `"${L1}" -> "${L2}"`);
      await shot(emp, "05-attendance-toggled-2");
    } else { rec("attendance/button-present", false, `no check button, label="${L0}"`); }

    // People Hub
    await emp.goto(`${BASE}/dashboard/directory`, { waitUntil: "domcontentloaded" });
    const dirCount = await emp.locator('a[href^="/dashboard/directory/"]').count();
    await assertClean(emp, "people/directory-render", `${dirCount} people`);
    rec("people/directory-populated", dirCount > 0, `${dirCount} people links`);
    await shot(emp, "06-directory");

    await emp.locator('a[href^="/dashboard/directory/"]').first().click();
    await emp.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await assertClean(emp, "people/profile-render", emp.url().replace(BASE, ""));
    await shot(emp, "07-profile");

    await emp.goto(`${BASE}/dashboard/org`, { waitUntil: "domcontentloaded" });
    await assertClean(emp, "people/org-render");
    await shot(emp, "08-org");

    await emp.goto(`${BASE}/dashboard/kudos`, { waitUntil: "domcontentloaded" });
    await assertClean(emp, "people/kudos-render");
    await shot(emp, "09-kudos");

    // attendance history (should include today's check-in row)
    await emp.goto(`${BASE}/dashboard/attendance`, { waitUntil: "domcontentloaded" });
    await assertClean(emp, "attendance/history-render");
    const histRows = await emp.locator("table tbody tr, li").count();
    rec("attendance/history-has-rows", histRows > 0, `${histRows} row-like elements`);
    await shot(emp, "10-attendance-history");

    // submit a fresh leave request (unique marker so the manager targets exactly it)
    await emp.goto(`${BASE}/dashboard/leave`, { waitUntil: "domcontentloaded" });
    await emp.fill("#startDate", LEAVE_START);
    await emp.fill("#endDate", LEAVE_END);
    await emp.selectOption("#leaveType", "vacation");
    await emp.fill("#reason", LEAVE_REASON);
    await emp.click('button[type="submit"]');
    await emp.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await emp.waitForTimeout(1500);
    const lt = await pageText(emp);
    rec("leave/submit", /pending/.test(lt), /pending/.test(lt) ? "pending row present" : "no pending row");
    await shot(emp, "11-leave-submitted");

    // park on /dashboard — this load establishes the live Realtime subscription
    await emp.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await emp.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    const notifLive = emp.locator("li").filter({ hasText: LEAVE_START }).filter({ hasText: /approved/i });
    const baseCount = await notifLive.count();
    rec("notifications/baseline", baseCount === 0, `${baseCount} matching notifications before approval (expect 0)`);
    await shot(emp, "12-notif-baseline");

    // ===== 3. MANAGER approves the exact request =====
    cMgr = await ctx(browser); const mgr = await cMgr.newPage();
    await login(mgr, MGR); rec("manager/login", true, "/dashboard");
    await shot(mgr, "13-manager-dashboard");
    await mgr.goto(`${BASE}/dashboard/leave/approvals`, { waitUntil: "domcontentloaded" });
    await assertClean(mgr, "manager/approvals-render");
    await shot(mgr, "14-approvals-before");
    const card = mgr.locator("li.card").filter({ hasText: LEAVE_REASON });
    const found = await card.count();
    if (found > 0) {
      const cmt = card.first().locator('textarea[name="comment"]');
      if (await cmt.count()) await cmt.fill("Approved — HR-75 realtime verification");
      await card.first().getByRole("button", { name: /^Approve$/ }).click();
      await mgr.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await mgr.waitForTimeout(2000);
      rec("leave/approve", true, "approved the HR-75 request");
    } else {
      rec("leave/approve", false, "HR-75 pending request NOT visible to manager (RLS/manager-link?)");
    }
    await shot(mgr, "15-approvals-after");

    // ===== 4. REALTIME delivery on the employee's STILL-OPEN /dashboard =====
    let delivered = false;
    for (let i = 0; i < 24 && !delivered; i++) { // up to ~24s, NO reload
      if (await notifLive.count() > 0) delivered = true; else await emp.waitForTimeout(1000);
    }
    rec("notifications/realtime-live-delivery", delivered, delivered ? "notification appeared WITHOUT reload (Supabase Realtime)" : "did not arrive live within ~24s");
    await shot(emp, "16-notif-live");

    if (delivered) {
      const markBtn = notifLive.first().getByRole("button", { name: /Mark read/i });
      if (await markBtn.count()) {
        await markBtn.click();
        await emp.waitForTimeout(1500);
        const stillUnread = await notifLive.first().getByRole("button", { name: /Mark read/i }).count();
        rec("notifications/mark-read", stillUnread === 0, stillUnread === 0 ? "marked read (button gone)" : "mark-read button still present");
      } else { rec("notifications/mark-read", false, "no Mark read button on the live notification"); }
      await shot(emp, "17-notif-marked-read");
    } else {
      // Distinguish "realtime broken" from "notification never created": reload & re-check.
      await emp.reload({ waitUntil: "domcontentloaded" });
      await emp.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      const persisted = await notifLive.count();
      rec("notifications/persisted-after-reload", persisted > 0, persisted > 0 ? "present after reload (realtime failed but notif exists)" : "absent even after reload (notification not created)");
      await shot(emp, "17-notif-after-reload");
    }

    // ===== 5. ADMIN (as real admin) =====
    cAdmin = await ctx(browser); const adm = await cAdmin.newPage();
    await login(adm, ADMIN); rec("admin/login", true, "/dashboard");
    for (const [name, path, key] of [
      ["18-admin-dashboard", "/admin", "admin/dashboard"],
      ["19-admin-attendance", "/admin/attendance", "admin/attendance"],
      ["20-admin-leave", "/admin/leave", "admin/leave"],
      ["21-admin-employees", "/admin/employees", "admin/employees"],
      ["22-admin-sites", "/admin/sites", "admin/sites"],
    ]) {
      await adm.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      const landed = adm.url().replace(BASE, "");
      await assertClean(adm, key + "-render", `landed ${landed}`);
      rec(key + "-access", landed.startsWith("/admin"), landed.startsWith("/admin") ? "admin access granted" : `redirected to ${landed}`);
      await shot(adm, name);
    }
  } catch (e) {
    rec("HARNESS", false, String(e).slice(0, 300));
  } finally {
    for (const c of [cSignup, cEmp, cMgr, cAdmin]) { try { if (c) await c.close(); } catch {} }
    await browser.close();
  }

  const pass = results.filter((r) => r.ok).length, fail = results.length - pass;
  fs.writeFileSync(`${OUTDIR}/e2e.json`, JSON.stringify({ base: BASE, stamp: STAMP, pass, fail, results }, null, 2));
  fs.writeFileSync(`${OUTDIR}/run-meta.json`, JSON.stringify({ stamp: STAMP, signupEmail: SIGNUP_EMAIL, leaveReason: LEAVE_REASON, leaveStart: LEAVE_START, leaveEnd: LEAVE_END }, null, 2));
  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  process.exit(fail ? 1 : 0);
})().catch((err) => { console.error("HARNESS_CRASH", err); process.exit(2); });
