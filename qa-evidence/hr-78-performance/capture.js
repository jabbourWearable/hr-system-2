// HR-78 performance reviews & goals/OKRs verification.
// Admin creates a review cycle and generates reviews for everyone; employee
// submits a self-assessment; manager submits the manager assessment +
// rating, completing the review. Employee then creates an objective + key
// result (checking progress roll-up), manager views (read-only) the
// team-goals page, admin views the company-wide goals page. Finally the
// manager schedules a 1:1 with the employee and both sides write shared +
// private notes, confirming private notes never leak to the other party.
//
// Usage: node capture.js <baseUrl> <adminEmail> <adminPass> <employeeEmail>
//   <employeePass> <managerEmail> <managerPass>
const { chromium } = require("playwright");
const BASE = process.argv[2];
const ADMIN = { email: process.argv[3], pass: process.argv[4] };
const EMP = { email: process.argv[5], pass: process.argv[6] };
const MANAGER = { email: process.argv[7], pass: process.argv[8] };
const OUTDIR = __dirname;
const results = [];

function badMarkers(t) {
  t = t.toLowerCase();
  return [
    "application error",
    "internal server error",
    "this page could not be found",
    "unhandled runtime error",
    "client-side exception",
  ].filter((m) => t.includes(m));
}

async function login(ctx, who) {
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(`pageerror@${page.url()}:${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`console@${page.url()}:${m.text()}`);
  });
  page._consoleErrors = consoleErrors;
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", who.email);
  await page.fill("#password", who.pass);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.endsWith("/login"), { timeout: 25000 });
  return page;
}

function check(name, ok, notes = []) {
  results.push({ name, ok, notes });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${notes.join(" ")}`);
}

// Server Action submissions trigger a network round-trip + revalidatePath
// re-render — poll instead of a single timed check (see HR-77's lesson:
// a fixed waitForTimeout + one-shot .count() races the mutation).
async function pollUntil(fn, { timeout = 15000, interval = 300 } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, interval));
  }
  return last;
}

(async () => {
  const browser = await chromium.launch();
  const cycleName = `HR-78 QA Cycle ${Date.now()}`;

  // --- Admin: create cycle + generate reviews --------------------------
  const adminCtx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, colorScheme: "dark" });
  const admin = await login(adminCtx, ADMIN);

  await admin.goto(`${BASE}/admin/reviews`, { waitUntil: "networkidle" });
  check("admin reviews list loads", badMarkers(await admin.locator("body").innerText()).length === 0);
  await admin.screenshot({ path: `${OUTDIR}/01-admin-reviews-list.png`, fullPage: true });

  await admin.goto(`${BASE}/admin/reviews/new`, { waitUntil: "networkidle" });
  await admin.fill("#name", cycleName);
  await admin.click('button[type="submit"]');
  await admin.waitForURL((u) => /\/admin\/reviews\/[0-9a-f-]{36}/.test(u.pathname), { timeout: 15000 });
  const cycleId = admin.url().match(/reviews\/([0-9a-f-]{36})/)[1];
  console.log(`CYCLE_ID=${cycleId}`);
  check("cycle created", (await admin.locator(`text=${cycleName}`).count()) > 0);
  await admin.screenshot({ path: `${OUTDIR}/02-admin-cycle-detail-empty.png`, fullPage: true });

  await admin.click('button:has-text("Generate reviews for everyone")');
  const generated = await pollUntil(async () => {
    const t = await admin.locator("body").innerText();
    return /Generated \d+ review/.test(t) ? t : null;
  });
  check("reviews generated for everyone", Boolean(generated));
  await admin.screenshot({ path: `${OUTDIR}/03-admin-reviews-generated.png`, fullPage: true });

  const employeeReviewLink = admin.locator("a", { hasText: "HR13 QA Employee" }).first();
  await employeeReviewLink.click();
  await admin.waitForURL((u) => /\/dashboard\/reviews\/[0-9a-f-]{36}/.test(u.pathname));
  const reviewId = admin.url().match(/reviews\/([0-9a-f-]{36})/)[1];
  console.log(`REVIEW_ID=${reviewId}`);
  check(
    "admin can open employee's review read-only",
    badMarkers(await admin.locator("body").innerText()).length === 0,
  );
  await admin.screenshot({ path: `${OUTDIR}/04-admin-review-detail.png`, fullPage: true });
  await admin.close();

  // --- Employee: self-assessment ---------------------------------------
  const empCtx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, colorScheme: "dark" });
  const emp = await login(empCtx, EMP);

  await emp.goto(`${BASE}/dashboard/reviews`, { waitUntil: "networkidle" });
  check(
    "employee sees the new cycle in their reviews",
    (await emp.locator(`text=${cycleName}`).count()) > 0,
  );
  await emp.screenshot({ path: `${OUTDIR}/05-employee-reviews-list.png`, fullPage: true });

  await emp.goto(`${BASE}/dashboard/reviews/${reviewId}`, { waitUntil: "networkidle" });
  await emp.fill(
    'textarea[name="selfAssessment"]',
    "Shipped the HR-78 performance module end to end this cycle.",
  );
  await emp.click('button:has-text("Submit self-assessment")');
  // The success message ("Self-assessment submitted.") can flash and then
  // disappear within one poll interval once the parent Server Component
  // re-renders into the read-only branch (status flips away from
  // pending_self) — same revalidatePath-races-a-fixed-check trap HR-77's
  // memory flagged. Poll for the durable end state instead of the transient
  // message.
  const selfSubmitted = await pollUntil(
    async () => (await emp.locator("text=Awaiting manager review").count()) > 0,
  );
  check("employee submitted self-assessment (status -> pending_manager)", Boolean(selfSubmitted));
  await emp.screenshot({ path: `${OUTDIR}/06-employee-self-assessment-submitted.png`, fullPage: true });
  check(
    "self-assessment form no longer editable",
    (await emp.locator('textarea[name="selfAssessment"]').count()) === 0,
  );

  // --- Employee: goals/OKRs ---------------------------------------------
  await emp.goto(`${BASE}/dashboard/goals`, { waitUntil: "networkidle" });
  await emp.selectOption("#goalType", "objective");
  await emp.fill("#title", "Grow into a senior engineer");
  await emp.fill("#description", "Own larger systems end to end.");
  await emp.click('button:has-text("Add goal")');
  // Goal titles render as <input value="..."> (GoalRowForm, same as
  // onboarding's task-row-form) — innerText()/text= locators don't see
  // input values, only real text nodes (same lesson HR-77's memory
  // recorded). Assert via the input's value instead.
  const objectiveAdded = await pollUntil(
    async () =>
      (await emp.locator('input[name="title"][value="Grow into a senior engineer"]').count()) > 0,
  );
  check("objective added", Boolean(objectiveAdded));

  await emp.selectOption("#goalType", "key_result");
  await emp.selectOption("#parentGoalId", { label: "Grow into a senior engineer" });
  await emp.fill("#title", "Ship 3 cross-team projects");
  await emp.click('button:has-text("Add goal")');
  const keyResultAdded = await pollUntil(
    async () =>
      (await emp.locator('input[name="title"][value="Ship 3 cross-team projects"]').count()) > 0,
  );
  check("key result added under objective", Boolean(keyResultAdded));
  await emp.screenshot({ path: `${OUTDIR}/07-employee-goals-created.png`, fullPage: true });

  // Bump the key result's progress and confirm the objective's *rolled-up*
  // progress (not just the key result's own) updates to match.
  const krForm = emp.locator("form", { has: emp.locator('input[value="Ship 3 cross-team projects"]') });
  await krForm.locator('input[name="progress"]').fill("60");
  await krForm.locator('select[name="status"]').selectOption("on_track");
  await krForm.locator('button:has-text("Save")').click();
  await pollUntil(async () => (await emp.locator("text=Goal updated.").count()) > 0);
  await emp.reload({ waitUntil: "networkidle" });
  const goalsBody = await emp.locator("body").innerText();
  check("objective rollup reflects key result's progress (60%)", goalsBody.includes("60%"));
  await emp.screenshot({ path: `${OUTDIR}/08-employee-goals-progress-rollup.png`, fullPage: true });

  // Employee not a manager -> redirected away from admin-only reviews route.
  await emp.goto(`${BASE}/admin/reviews`, { waitUntil: "networkidle" });
  check("employee redirected from /admin/reviews", !emp.url().endsWith("/admin/reviews"), [
    `->${emp.url().replace(BASE, "")}`,
  ]);

  // --- 1:1: manager schedules, both write notes -------------------------
  // (Scheduling itself must come from the manager side — RLS requires
  // manager_id = auth.uid() — so this section resumes after the manager
  // block below creates oneOnOneId; done here only for employee-side reads.)

  // --- Manager: manager assessment + rating -----------------------------
  const mgrCtx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, colorScheme: "dark" });
  const mgr = await login(mgrCtx, MANAGER);

  await mgr.goto(`${BASE}/dashboard/reviews`, { waitUntil: "networkidle" });
  check(
    "manager sees the review they're writing",
    (await mgr.locator("text=Reviews you're writing").count()) > 0 ||
      (await mgr.locator("text=Reviews you’re writing").count()) > 0,
  );
  await mgr.screenshot({ path: `${OUTDIR}/09-manager-reviewing-list.png`, fullPage: true });

  await mgr.goto(`${BASE}/dashboard/reviews/${reviewId}`, { waitUntil: "networkidle" });
  check(
    "manager sees the employee's submitted self-assessment",
    (await mgr.locator("text=Shipped the HR-78 performance module").count()) > 0,
  );
  await mgr.fill(
    'textarea[name="managerAssessment"]',
    "Strong quarter — delivered the full performance module with clean RLS design.",
  );
  await mgr.selectOption("#rating", "5");
  await mgr.click('button:has-text("Complete review")');
  // Same transient-message-vs-durable-state caution as the self-assessment
  // submit above — poll for the Completed badge, not the flash message.
  const completed = await pollUntil(async () => (await mgr.locator("text=Completed").count()) > 0);
  check("manager completed the review (status -> completed)", Boolean(completed));
  await mgr.screenshot({ path: `${OUTDIR}/10-manager-review-completed.png`, fullPage: true });

  // --- Manager: team goals (read-only) -----------------------------------
  await mgr.goto(`${BASE}/dashboard/goals/team`, { waitUntil: "networkidle" });
  const teamGoalsBody = await mgr.locator("body").innerText();
  check(
    "manager sees direct report's goals, read-only",
    badMarkers(teamGoalsBody).length === 0 &&
      teamGoalsBody.includes("Grow into a senior engineer") &&
      (await mgr.locator('button:has-text("Save")').count()) === 0,
  );
  await mgr.screenshot({ path: `${OUTDIR}/11-manager-team-goals.png`, fullPage: true });

  // --- Manager: schedule 1:1, write shared + private notes ---------------
  await mgr.goto(`${BASE}/dashboard/one-on-ones/new`, { waitUntil: "networkidle" });
  await mgr.selectOption("#employeeId", { label: "HR13 QA Employee" });
  const meetingDate = new Date().toISOString().slice(0, 10);
  await mgr.fill("#meetingDate", meetingDate);
  await mgr.click('button[type="submit"]');
  await mgr.waitForURL((u) => /\/dashboard\/one-on-ones\/[0-9a-f-]{36}/.test(u.pathname), { timeout: 15000 });
  const oneOnOneId = mgr.url().match(/one-on-ones\/([0-9a-f-]{36})/)[1];
  console.log(`ONE_ON_ONE_ID=${oneOnOneId}`);
  check("1:1 scheduled", badMarkers(await mgr.locator("body").innerText()).length === 0);
  await mgr.screenshot({ path: `${OUTDIR}/12-manager-1on1-scheduled.png`, fullPage: true });

  // Scope to forms that actually contain a textarea — the meeting page also
  // renders a textarea-less "Mark completed" form above the two note forms,
  // which would otherwise shift the indices below by one.
  const mgrForms = mgr.locator("form:has(textarea)");
  await mgrForms.nth(0).locator("textarea").fill("Agenda: review the performance module launch.");
  await mgrForms.nth(0).locator('button:has-text("Save")').click();
  await pollUntil(async () => (await mgr.locator("text=Saved.").count()) > 0);

  await mgrForms.nth(1).locator("textarea").fill("MANAGER-PRIVATE: consider for promo next cycle.");
  await mgrForms.nth(1).locator('button:has-text("Save")').click();
  await pollUntil(async () => (await mgr.locator("text=Saved.").count()) > 0);
  await mgr.screenshot({ path: `${OUTDIR}/13-manager-1on1-notes-saved.png`, fullPage: true });
  check("manager console clean", mgr._consoleErrors.length === 0, mgr._consoleErrors);

  // --- Employee: sees shared note, never the manager's private note ------
  // Note bodies render inside <textarea defaultValue="...">, which (like
  // the goal-title <input> above) isn't part of innerText() — read each
  // textarea's actual value instead of scanning page text. This also
  // matters for correctness, not just test hygiene: innerText() would
  // trivially "pass" a leak check regardless of whether RLS actually
  // blocked the other party's private note, since textarea content is
  // invisible to it either way.
  await emp.goto(`${BASE}/dashboard/one-on-ones/${oneOnOneId}`, { waitUntil: "networkidle" });
  const empForms = emp.locator("form:has(textarea)");
  const empSharedValue = await empForms.nth(0).locator("textarea").inputValue();
  check(
    "employee sees the shared note",
    empSharedValue.includes("Agenda: review the performance module launch."),
  );
  const empPrivateValueBefore = await empForms.nth(1).locator("textarea").inputValue();
  check(
    "employee never sees the manager's private note",
    !empPrivateValueBefore.includes("MANAGER-PRIVATE"),
  );
  await empForms.nth(1).locator("textarea").fill("EMPLOYEE-PRIVATE: nervous about the promo conversation.");
  await empForms.nth(1).locator('button:has-text("Save")').click();
  await pollUntil(async () => (await emp.locator("text=Saved.").count()) > 0);
  await emp.screenshot({ path: `${OUTDIR}/14-employee-1on1-notes.png`, fullPage: true });
  check("employee console clean", emp._consoleErrors.length === 0, emp._consoleErrors);
  await emp.close();

  // --- Manager: reloads, still never sees employee's private note --------
  await mgr.reload({ waitUntil: "networkidle" });
  const mgrFormsAfter = mgr.locator("form:has(textarea)");
  const mgrSharedValueAfter = await mgrFormsAfter.nth(0).locator("textarea").inputValue();
  check(
    "manager sees the employee's shared-note edit",
    mgrSharedValueAfter.includes("Agenda: review the performance module launch."),
  );
  const mgrPrivateValueAfter = await mgrFormsAfter.nth(1).locator("textarea").inputValue();
  check(
    "manager never sees the employee's private note",
    !mgrPrivateValueAfter.includes("EMPLOYEE-PRIVATE"),
  );
  check(
    "manager still sees their own private note",
    mgrPrivateValueAfter.includes("MANAGER-PRIVATE"),
  );

  await mgr.click('button:has-text("Mark completed")');
  const meetingCompleted = await pollUntil(async () => (await mgr.locator("text=Completed").count()) > 0);
  check("1:1 marked completed", Boolean(meetingCompleted));
  await mgr.screenshot({ path: `${OUTDIR}/15-1on1-completed.png`, fullPage: true });

  // Manager is not admin -> redirected away from admin-only goals route.
  await mgr.goto(`${BASE}/admin/goals`, { waitUntil: "networkidle" });
  check("manager redirected from /admin/goals", !mgr.url().endsWith("/admin/goals"), [
    `->${mgr.url().replace(BASE, "")}`,
  ]);
  await mgr.close();

  // --- Admin: company-wide goals view ------------------------------------
  const adminCtx2 = await browser.newContext({ viewport: { width: 1360, height: 1000 }, colorScheme: "dark" });
  const admin2 = await login(adminCtx2, ADMIN);
  await admin2.goto(`${BASE}/admin/goals`, { waitUntil: "networkidle" });
  const adminGoalsBody = await admin2.locator("body").innerText();
  check(
    "admin sees company-wide goals including the new objective",
    badMarkers(adminGoalsBody).length === 0 && adminGoalsBody.includes("Grow into a senior engineer"),
  );
  await admin2.screenshot({ path: `${OUTDIR}/16-admin-company-goals.png`, fullPage: true });

  await admin2.goto(`${BASE}/admin/reviews/${cycleId}`, { waitUntil: "networkidle" });
  const adminCycleBody = await admin2.locator("body").innerText();
  check(
    "admin cycle detail shows the review as Completed",
    adminCycleBody.includes("Completed") && adminCycleBody.includes("5/5"),
  );
  await admin2.screenshot({ path: `${OUTDIR}/17-admin-cycle-completed.png`, fullPage: true });
  check("admin console clean", admin2._consoleErrors.length === 0, admin2._consoleErrors);
  await admin2.close();

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("FAILURES:", JSON.stringify(failed, null, 2));
    process.exit(1);
  }
})();
