const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];
const MODE = process.argv[4] || "signup";
const OUTDIR = __dirname;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  if (MODE === "signup") {
    await page.goto(`${BASE}/signup`);
    await page.fill("#fullName", "HR16 Final QA Admin");
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });
    console.log("signup+login ok:", page.url());
  } else if (MODE === "capture") {
    await page.goto(`${BASE}/login`);
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 });
    console.log("login ok:", page.url());

    await page.goto(`${BASE}/admin/employees`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `${OUTDIR}/27-admin-employees-email-column.png`,
      fullPage: true,
    });
    console.log("captured /admin/employees");

    await page.goto(`${BASE}/admin/sites`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: `${OUTDIR}/28-admin-sites-management.png`,
      fullPage: true,
    });
    console.log("captured /admin/sites");
  }

  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
