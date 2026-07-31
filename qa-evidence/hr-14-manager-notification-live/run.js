// One-off live verification script for HR-14's previously-BLOCKED manager
// notification path (migration 0006). Not part of the app; run via
// `node run.js` from this directory with NODE_PATH pointed at the npx
// playwright cache. Deleted/ignored after evidence is captured — the
// screenshots are the durable artifact.
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const EMPLOYEE = { email: "hr13.employee@example.com", password: "TestPass123!" };
const MANAGER = { email: "hr13.manager@example.com", password: "TestPass123!" };

async function login(page, { email, password }) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`);
}

(async () => {
  const browser = await chromium.launch();

  // --- Employee: submit a fresh leave request, then sit on /dashboard ---
  const empCtx = await browser.newContext();
  const empPage = await empCtx.newPage();
  await login(empPage, EMPLOYEE);

  await empPage.goto(`${BASE}/dashboard/leave`);
  const stamp = new Date().toISOString();
  await empPage.fill("#startDate", "2026-09-01");
  await empPage.fill("#endDate", "2026-09-02");
  await empPage.selectOption("#leaveType", "vacation");
  await empPage.fill("#reason", `HR-14 live manager-notification verification ${stamp}`);
  await empPage.click('button[type="submit"]');
  await empPage.waitForSelector(`text=HR-14 live manager-notification verification ${stamp}`);
  console.log("Leave request submitted.");

  await empPage.goto(`${BASE}/dashboard`);
  await empPage.screenshot({ path: "01-employee-dashboard-before.png", fullPage: true });

  // --- Manager: approve that request with a comment, in a separate session ---
  const mgrCtx = await browser.newContext();
  const mgrPage = await mgrCtx.newPage();
  await login(mgrPage, MANAGER);
  await mgrPage.goto(`${BASE}/dashboard/leave/approvals`);

  const row = mgrPage.locator("li", { hasText: stamp });
  await row.waitFor({ state: "visible", timeout: 15000 });
  await mgrPage.screenshot({ path: "02-manager-approvals-before-decision.png", fullPage: true });

  const comment = `Approved live for HR-14 verification ${stamp}`;
  await row.locator("textarea").fill(comment);
  await row.locator('button[name="decision"][value="approved"]').click();
  // reviewAsManager calls revalidatePath on success, which refetches the
  // pending-only list server-side and removes this row in the same
  // transition — so "row disappears" (not an inline success message,
  // which never gets a chance to paint) is the real success signal here.
  await row.waitFor({ state: "detached", timeout: 15000 });
  await mgrPage.screenshot({ path: "03-manager-approvals-after-decision.png", fullPage: true });
  console.log("Manager approved the request with a comment (row removed from pending list).");

  // --- Back on the employee's already-open dashboard tab, no reload ---
  const expectedMessage = "was approved.";
  await empPage.waitForFunction(
    (text) => document.body.innerText.includes(text),
    expectedMessage,
    { timeout: 15000 },
  );
  await empPage.screenshot({ path: "04-employee-dashboard-realtime-notification.png", fullPage: true });
  console.log("Real-time notification appeared on employee dashboard WITHOUT a page refresh.");

  // Mark as read
  const unreadButton = empPage.locator("button", { hasText: "Mark read" }).first();
  await unreadButton.click();
  await empPage.waitForTimeout(1000);
  await empPage.screenshot({ path: "05-employee-notification-marked-read.png", fullPage: true });
  console.log("Notification marked read.");

  await browser.close();
  console.log("DONE");
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
