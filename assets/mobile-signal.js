(() => {
  const phone = matchMedia('(max-width: 700px) and (pointer: coarse), (max-width: 900px) and (max-height: 500px) and (pointer: coarse)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let overlay, frame = 0, timer, distance = 0, previousY = scrollY, lastBurst = -Infinity;
  const stop = () => {
    clearTimeout(timer);
    if (overlay) overlay.hidden = true;
  };
  const update = () => {
    frame = 0;
    const travel = Math.abs(scrollY - previousY);
    previousY = scrollY;
    if (document.hidden || document.querySelector('dialog[open]') || document.documentElement.classList.contains('boot-intro-active')) {
      distance = 0;
      stop();
      return;
    }
    const now = performance.now();
    if (now - lastBurst < 6000) return;
    distance += Math.min(travel, 120);
    if (distance < 240) return;
    distance = 0;
    lastBurst = now;
    overlay.hidden = false;
    timer = setTimeout(stop, 420);
  };
  const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
  const sync = () => {
    window.removeEventListener('scroll', scroll);
    cancelAnimationFrame(frame);
    frame = 0;
    stop();
    distance = 0;
    previousY = scrollY;
    if (!phone.matches || reduced.matches) {
      overlay?.remove();
      overlay = null;
      return;
    }
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'mobile-signal';
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = '<span class="mobile-signal-noise"></span><span class="mobile-signal-slice"></span><span class="mobile-signal-slice mobile-signal-slice-second"></span><span class="mobile-signal-label"><span class="mobile-signal-bars"><i></i><i></i><i></i></span>LOW SIGNAL<span class="mobile-signal-code">RX · 02</span></span>';
      document.body.append(overlay);
    }
    window.addEventListener('scroll', scroll, { passive: true });
  };
  phone.addEventListener('change', sync);
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', stop);
  document.addEventListener('toggle', event => { if (event.target.matches('dialog[open]')) stop(); }, true);
  sync();
})();
