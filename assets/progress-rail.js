/* Fixed right-hand portfolio section tracker. */
(() => {
  "use strict";

  const rail = document.querySelector("#progress-rail");
  if (!rail) return;

  const links = [...rail.querySelectorAll("[data-rail-link]")];
  const entries = links
    .map((link) => {
      const section = document.querySelector(link.getAttribute("href"));
      return section ? { link, section } : null;
    })
    .filter(Boolean);

  let pending = false;

  function updateCurrentSection() {
    const marker = window.innerHeight * 0.42;
    let current = entries[0];

    for (const entry of entries) {
      if (entry.section.getBoundingClientRect().top <= marker) current = entry;
      else break;
    }

    for (const entry of entries) {
      const isCurrent = entry === current;
      entry.link.toggleAttribute("aria-current", isCurrent);
      if (isCurrent) entry.link.setAttribute("aria-current", "location");
    }

    pending = false;
  }

  function scheduleUpdate() {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(updateCurrentSection);
  }

  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("hashchange", scheduleUpdate);
  scheduleUpdate();
})();
