# HR-62 — Redesign to the Resend design language (DESIGN.md)

Visual evidence for the HR-62 redesign. The app was rebuilt (`npm run
build`, clean) and served with `next start`; screenshots captured live with
Playwright against the real Supabase backend on 2026-08-01.

- `capture.js` — public pages + fresh signup (`HR62 Design QA`, employee
  role) → dashboard, leave, attendance history; dark scheme first
  (canonical Resend palette), then a light-scheme login pass (derived
  variant, theme toggle preserved).
- `capture-admin.js` — second signup (`HR62 Admin QA`) promoted to admin
  via SQL (`UPDATE profiles SET role='admin'`), then admin overview /
  employees / sites / attendance in dark. Live login through the redesigned
  form is exercised as part of this run.

| # | Screenshot | What it shows |
|---|---|---|
| 01 | landing-dark | hero-stripe: serif headline, badge pill, white primary CTA, blue atmospheric glow |
| 02 | login-dark | auth card (surface-card + hairline), field focus vocabulary, white CTA |
| 03 | signup-dark | signup card, green atmospheric glow |
| 04 | dashboard-dark | serif welcome, mono section labels, profile card, check-in status dot |
| 05 | leave-dark | leave request form in card, mono date fields |
| 06 | attendance-history-dark | table: mono column labels, hairline dividers, mono data cells |
| 07 | landing-light | derived light variant (black CTA, tinted glow) |
| 08 | dashboard-light | light-variant dashboard |
| 09 | admin-overview-dark | serif stat numerals, sub-nav pills |
| 10 | admin-employees-dark | company directory table, mono emails |
| 11 | admin-sites-dark | site CRUD: form card + geodata table |
| 12 | admin-attendance-dark | filters (field/select/date) + company log |

Verdict: PASS — all surfaces render the DESIGN.md vocabulary in both
themes; signup, login, and admin role-gating all work live post-redesign.
