// Sets data-theme before hydration so there's no flash of the wrong theme
// when a user has previously picked "light" or "dark" (system preference
// is handled purely by CSS `prefers-color-scheme` and needs no JS). A
// plain inline <script> — not next/script — so it runs synchronously
// before paint; next/script's beforeInteractive strategy targets
// pages/_document.js and isn't appropriate here.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (_) {}
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
