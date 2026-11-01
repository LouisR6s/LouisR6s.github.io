(() => {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const cursor = document.createElement('div');
  cursor.className = 'liquid-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cursor);
  const hide = () => {
    cursor.classList.remove('is-visible');
    document.documentElement.classList.remove('has-liquid-cursor');
  };
  document.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    const target = event.target instanceof Element ? event.target : null;
    if (target && target.closest('input, textarea, select, [contenteditable="true"]')) { hide(); return; }
    cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;
    cursor.classList.toggle('is-link', Boolean(target && target.closest('a, button, summary, [role="button"]')));
    cursor.classList.add('is-visible');
    document.documentElement.classList.add('has-liquid-cursor');
  }, { passive: true });
  document.addEventListener('pointerout', event => { if (!event.relatedTarget) hide(); });
  window.addEventListener('blur', hide);
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
})();
