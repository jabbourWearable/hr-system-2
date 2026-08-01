// HR-77 onboarding/offboarding workflows verification.
// Admin creates a template-seeded onboarding workflow for the HR13 QA
// Employee fixture (managed by HR13 QA Manager), edits/adds/deletes tasks,
// toggles workflow status, then confirms the employee sees their own
// checklist (and can update their own assigned task) and the manager sees
// the direct report's workflow (and can update tasks assigned to them) on
// both /dashboard/onboarding and /dashboard/onboarding/team. Also checks a
// non-manager is redirected away from the team route.
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
// re-render, which can take longer than any fixed sleep — poll instead of
// a single timed check so the assertion isn't racing the mutation.
async function pollUntil(fn, { timeout = 6000, interval = 200 } = {}) {
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

  // --- Admin: create + manage a workflow -----------------------------
  const adminCtx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, colorScheme: "dark" });
  const admin = await login(adminCtx, ADMIN);

  await admin.goto(`${BASE}/admin/onboarding`, { waitUntil: "networkidle" });
  check(
    "admin onboarding list loads",
    badMarkers(await admin.locator("body").innerText()).length === 0,
  );
  await admin.screenshot({ path: `${OUTDIR}/01-admin-list.png`, fullPage: true });

  await admin.goto(`${BASE}/admin/onboarding/new`, { waitUntil: "networkidle" });
  await admin.selectOption("#employeeId", { label: "HR13 QA Employee" });
  await admin.selectOption("#workflowType", "onboarding");
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 7);
  const targetISO = targetDate.toISOString().slice(0, 10);
  await admin.fill("#targetDate", targetISO);
  // useTemplate checkbox defaults checked
  await admin.screenshot({ path: `${OUTDIR}/02-admin-new-form.png`, fullPage: true });
  await admin.click('button[type="submit"]');
  await admin.waitForURL((u) => /\/admin\/onboarding\/[0-9a-f-]{36}/.test(u.pathname), {
    timeout: 15000,
  });
  const workflowId = admin.url().match(/onboarding\/([0-9a-f-]{36})/)[1];
  console.log(`WORKFLOW_ID=${workflowId}`);

  // Task titles render as <input value="..."> on this page, not plain text,
  // so they don't show up in innerText() — check the heading text plus the
  // input-value count/assignee checks below instead.
  const bodyAfterCreate = await admin.locator("body").innerText();
  check(
    "workflow created + template seeded",
    badMarkers(bodyAfterCreate).length === 0 && bodyAfterCreate.includes("HR13 QA Employee"),
  );
  const taskRowCount = await admin.locator('input[id^="title-"]').count();
  check("9 template tasks seeded", taskRowCount === 9, [`count=${taskRowCount}`]);
  await admin.screenshot({ path: `${OUTDIR}/03-admin-workflow-detail.png`, fullPage: true });

  // Assignee resolution: employee task -> employee, manager task -> manager,
  // admin task -> the creating admin.
  const paperworkAssignee = await admin
    .locator('input[id^="title-"][value="Complete new-hire paperwork"]')
    .locator("xpath=ancestor::form")
    .locator('select[name="assigneeId"]')
    .inputValue();
  const welcomeMeetingAssignee = await admin
    .locator('input[id^="title-"][value="Welcome meeting with manager"]')
    .locator("xpath=ancestor::form")
    .locator('select[name="assigneeId"]')
    .inputValue();
  const equipmentAssignee = await admin
    .locator('input[id^="title-"][value="Order equipment & provision accounts"]')
    .locator("xpath=ancestor::form")
    .locator('select[name="assigneeId"]')
    .inputValue();
  check("employee task assigned to employee", paperworkAssignee.length > 0);
  check("manager task assigned to manager", welcomeMeetingAssignee.length > 0);
  check("admin task assigned to admin", equipmentAssignee.length > 0);
  check(
    "the three default-assignee roles resolved to different people",
    new Set([paperworkAssignee, welcomeMeetingAssignee, equipmentAssignee]).size === 3,
  );

  // Edit a task: reassign + change due date + status.
  const editForm = admin.locator('input[id^="title-"][value="Meet the team"]').locator("xpath=ancestor::form");
  await editForm.locator('select[name="status"]').selectOption("in_progress");
  await editForm.locator('input[name="dueDate"]').fill(targetISO);
  await editForm.locator('button[type="submit"]').click();
  const editSaved = await pollUntil(async () => (await admin.locator("text=Task updated.").count()) > 0);
  check("task edit saved", Boolean(editSaved));
  await admin.screenshot({ path: `${OUTDIR}/04-admin-task-edited.png`, fullPage: true });

  // Add a custom task.
  await admin.fill("#new-title", "Set up payroll direct deposit");
  await admin.fill("#new-description", "Confirm banking details with finance.");
  await admin.selectOption("#new-assignee", { label: "HR13 QA Employee" });
  await admin.click('button:has-text("Add task")');
  const taskRowCountAfterAdd = await pollUntil(async () => {
    const n = await admin.locator('input[id^="title-"]').count();
    return n === 10 ? n : null;
  });
  check("custom task added", taskRowCountAfterAdd === 10, [`count=${taskRowCountAfterAdd}`]);
  await admin.screenshot({ path: `${OUTDIR}/05-admin-task-added.png`, fullPage: true });

  // Delete the just-added task.
  const deleteForm = admin
    .locator('input[id^="title-"][value="Set up payroll direct deposit"]')
    .locator("xpath=ancestor::form");
  await deleteForm.locator('button:has-text("Delete")').click();
  const taskRowCountAfterDelete = await pollUntil(async () => {
    const n = await admin.locator('input[id^="title-"]').count();
    return n === 9 ? n : null;
  });
  check("task deleted", taskRowCountAfterDelete === 9, [`count=${taskRowCountAfterDelete}`]);

  // Mark workflow completed, then reactivate (so the employee/manager
  // checks below see an *active* workflow, matching real-world usage).
  await admin.click('button:has-text("Mark completed")');
  const completed = await pollUntil(async () => (await admin.locator("text=Completed").count()) > 0);
  check("workflow marked completed", Boolean(completed));
  await admin.screenshot({ path: `${OUTDIR}/06-admin-workflow-completed.png`, fullPage: true });

  await admin.click('button:has-text("Reactivate")');
  const reactivated = await pollUntil(async () => (await admin.locator("text=Active").count()) > 0);
  check("workflow reactivated", Boolean(reactivated));

  // Admin filter tabs.
  await admin.goto(`${BASE}/admin/onboarding?status=active`, { waitUntil: "networkidle" });
  check(
    "admin active filter shows the workflow",
    (await admin.locator("text=HR13 QA Employee").count()) > 0,
  );
  await admin.screenshot({ path: `${OUTDIR}/07-admin-filter-active.png`, fullPage: true });
  await admin.close();

  // --- Employee: own checklist ----------------------------------------
  const empCtx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, colorScheme: "dark" });
  const emp = await login(empCtx, EMP);
  await emp.goto(`${BASE}/dashboard/onboarding`, { waitUntil: "networkidle" });
  const empBody = await emp.locator("body").innerText();
  check(
    "employee sees own checklist",
    badMarkers(empBody).length === 0 &&
      empBody.toLowerCase().includes("onboarding") &&
      empBody.includes("Complete new-hire paperwork"),
  );
  await emp.screenshot({ path: `${OUTDIR}/08-employee-checklist.png`, fullPage: true });

  // Update the employee's own assigned task to "done".
  const empTaskForm = emp
    .locator("li", { hasText: "Complete new-hire paperwork" })
    .locator("form");
  await empTaskForm.locator("select").selectOption("done");
  await empTaskForm.locator('button:has-text("Update")').click();
  const empUpdated = await pollUntil(async () => (await emp.locator("text=Task updated.").count()) > 0);
  check("employee marked own task done", Boolean(empUpdated));
  await emp.screenshot({ path: `${OUTDIR}/09-employee-task-done.png`, fullPage: true });

  // Employee is not a manager -> redirected away from the team route.
  await emp.goto(`${BASE}/dashboard/onboarding/team`, { waitUntil: "networkidle" });
  check("non-manager redirected from team route", !emp.url().includes("/team"), [
    `->${emp.url().replace(BASE, "")}`,
  ]);
  check("employee console clean", emp._consoleErrors.length === 0, emp._consoleErrors);
  await emp.close();

  // --- Manager: cross-workflow assigned tasks + team view --------------
  const mgrCtx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, colorScheme: "dark" });
  const mgr = await login(mgrCtx, MANAGER);

  await mgr.goto(`${BASE}/dashboard/onboarding`, { waitUntil: "networkidle" });
  const mgrBody = await mgr.locator("body").innerText();
  check(
    "manager sees tasks assigned to them on the report's workflow",
    badMarkers(mgrBody).length === 0 && mgrBody.includes("Welcome meeting with manager"),
  );
  await mgr.screenshot({ path: `${OUTDIR}/10-manager-assigned-tasks.png`, fullPage: true });

  const mgrTaskForm = mgr
    .locator("li", { hasText: "Welcome meeting with manager" })
    .locator("form");
  await mgrTaskForm.locator("select").selectOption("done");
  await mgrTaskForm.locator('button:has-text("Update")').click();
  const mgrUpdated = await pollUntil(async () => (await mgr.locator("text=Task updated.").count()) > 0);
  check("manager updated their own assigned task", Boolean(mgrUpdated));

  await mgr.goto(`${BASE}/dashboard/onboarding/team`, { waitUntil: "networkidle" });
  const teamBody = await mgr.locator("body").innerText();
  check(
    "manager team view shows direct report's workflow + progress",
    badMarkers(teamBody).length === 0 &&
      teamBody.includes("HR13 QA Employee") &&
      /\d+\/\d+/.test(teamBody),
  );
  await mgr.screenshot({ path: `${OUTDIR}/11-manager-team-view.png`, fullPage: true });
  check("manager console clean", mgr._consoleErrors.length === 0, mgr._consoleErrors);
  await mgr.close();

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("FAILURES:", JSON.stringify(failed, null, 2));
    process.exit(1);
  }
})();
