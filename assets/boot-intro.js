(() => {
  const root = document.documentElement;
  try { if (localStorage.getItem('portfolio-theme') === 'dark') root.dataset.theme = 'dark'; } catch {}
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sessionKey = 'portfolio-terminal-intro-seen';
  let seen = false;
  try { seen = sessionStorage.getItem(sessionKey) === '1'; } catch {}
  // Direct section links and reduced-motion visits go straight to the content.
  if (seen || motion.matches || location.hash) return;
  root.classList.add('boot-intro-active');
  const finish = () => {
    root.classList.remove('boot-intro-active', 'boot-intro-running');
    motion.removeEventListener('change', finish);
    window.removeEventListener('keydown', finish);
  };
  // A failed or delayed page load must never leave an introduction over the site.
  const safetyTimer = setTimeout(finish, 1600);
  document.addEventListener('DOMContentLoaded', () => {
    if (!root.classList.contains('boot-intro-active')) return;
    try { sessionStorage.setItem(sessionKey, '1'); } catch {}
    root.classList.add('boot-intro-running');
    setTimeout(() => { clearTimeout(safetyTimer); finish(); }, 940);
  }, { once: true });
  motion.addEventListener('change', finish);
  window.addEventListener('keydown', finish, { once: true });
  window.addEventListener('pageshow', event => { if (event.persisted) finish(); });
})();
