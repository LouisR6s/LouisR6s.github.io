/* Fixed right-hand portfolio section tracker and drag-to-scroll control. */
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
  const drag = {
    pointerId: null,
    startY: 0,
    dragging: false,
    holdTimer: null,
    suppressClick: false,
  };

  function setCurrentEntry(current) {
    for (const entry of entries) {
      const isCurrent = entry === current;
      entry.link.toggleAttribute("aria-current", isCurrent);
      if (isCurrent) entry.link.setAttribute("aria-current", "location");
    }
  }

  function updateCurrentSection() {
    const marker = window.innerHeight * 0.42;
    let current = entries[0];

    for (const entry of entries) {
      if (entry.section.getBoundingClientRect().top <= marker) current = entry;
      else break;
    }

    setCurrentEntry(current);
    pending = false;
  }

  function scheduleUpdate() {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(updateCurrentSection);
  }

  function closestEntry(clientY) {
    return entries.reduce((closest, entry) => {
      const center = entry.link.getBoundingClientRect().top
        + entry.link.getBoundingClientRect().height / 2;
      const closestCenter = closest.link.getBoundingClientRect().top
        + closest.link.getBoundingClientRect().height / 2;
      return Math.abs(center - clientY) < Math.abs(closestCenter - clientY)
        ? entry
        : closest;
    });
  }

  function scrollToEntry(entry) {
    const headerHeight = document.querySelector("header")?.getBoundingClientRect().height || 0;
    const destination = Math.max(
      0,
      window.scrollY + entry.section.getBoundingClientRect().top - headerHeight - 20,
    );

    setCurrentEntry(entry);
    window.scrollTo({ top: destination, behavior: "auto" });
  }

  function clearHoldTimer() {
    if (drag.holdTimer) {
      window.clearTimeout(drag.holdTimer);
      drag.holdTimer = null;
    }
  }

  function beginDrag(pointerId, clientY) {
    if (drag.pointerId !== pointerId || drag.dragging) return;
    drag.dragging = true;
    clearHoldTimer();
    rail.classList.add("is-dragging");
    scrollToEntry(closestEntry(clientY));
  }

  function finishDrag(event) {
    if (drag.pointerId !== event.pointerId) return;

    clearHoldTimer();
    if (drag.dragging) {
      event.preventDefault();
      drag.suppressClick = true;
      window.setTimeout(() => { drag.suppressClick = false; }, 0);
    }

    rail.classList.remove("is-dragging");
    if (rail.hasPointerCapture?.(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    drag.pointerId = null;
    drag.dragging = false;
  }

  rail.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || !event.target.closest("[data-rail-link]")) return;

    drag.pointerId = event.pointerId;
    drag.startY = event.clientY;
    rail.setPointerCapture?.(event.pointerId);
    drag.holdTimer = window.setTimeout(
      () => beginDrag(event.pointerId, event.clientY),
      180,
    );
  });

  rail.addEventListener("pointermove", (event) => {
    if (drag.pointerId !== event.pointerId) return;

    if (!drag.dragging && Math.abs(event.clientY - drag.startY) > 7) {
      beginDrag(event.pointerId, event.clientY);
    }

    if (drag.dragging) {
      event.preventDefault();
      scrollToEntry(closestEntry(event.clientY));
    }
  });

  rail.addEventListener("pointerup", finishDrag);
  rail.addEventListener("pointercancel", finishDrag);
  rail.addEventListener("click", (event) => {
    if (!drag.suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("hashchange", scheduleUpdate);
  scheduleUpdate();
})();
