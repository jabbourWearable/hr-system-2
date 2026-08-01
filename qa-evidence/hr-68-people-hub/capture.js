// HR-68 visual evidence: the "People Hub" (directory, profile, org chart,
// kudos, celebrations). Signs in as an existing seeded user and captures the
// new surfaces in dark (canonical Resend palette).
// Usage: node qa-evidence/hr-68-people-hub/capture.js <email> <password>
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];
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

  await page.goto(`${BASE}/login`);
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 20000 });
  await shot(page, "01-dashboard");

  await page.goto(`${BASE}/dashboard/directory`);
  await shot(page, "02-directory");

  // Open the first person's profile.
  const first = page.locator('a[href^="/dashboard/directory/"]').first();
  await first.click();
  await page.waitForLoadState("networkidle");
  await shot(page, "03-profile");

  await page.goto(`${BASE}/dashboard/org`);
  await shot(page, "04-org-chart");

  await page.goto(`${BASE}/dashboard/kudos`);
  await shot(page, "05-kudos");

  await browser.close();
  console.log("done");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
