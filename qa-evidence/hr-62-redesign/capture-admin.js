// HR-62 admin visual evidence (dark scheme).
// Usage: node capture-admin.js <email> <password> <signup|capture>
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];
const MODE = process.argv[4] || "signup";
const OUTDIR = __dirname;

async function shot(page, name) {
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUTDIR}/${name}.png`, fullPage: true });
  console.log("captured", name);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    colorScheme: "dark",
  });

  if (MODE === "signup") {
    await page.goto(`${BASE}/signup`);
    await page.fill("#fullName", "HR62 Admin QA");
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 20000 });
    console.log("signup ok:", page.url());
  } else {
    await page.goto(`${BASE}/login`);
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 20000 });
    await page.goto(`${BASE}/admin`);
    await shot(page, "09-admin-overview-dark");
    await page.goto(`${BASE}/admin/employees`);
    await shot(page, "10-admin-employees-dark");
    await page.goto(`${BASE}/admin/sites`);
    await shot(page, "11-admin-sites-dark");
    await page.goto(`${BASE}/admin/attendance`);
    await shot(page, "12-admin-attendance-dark");
  }

  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
