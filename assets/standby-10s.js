/* Restaure le mode veille automatique après 10 secondes d'inactivité. */
const STANDBY_DELAY = 10_000;
let standby10sTimer = 0;

function isStandbyOpen() {
  return document.querySelector(".standby-deck")?.classList.contains("open") ?? false;
}

function canStartStandby() {
  if (document.hidden || isStandbyOpen()) return false;
  if (document.querySelector("#editor-dialog")?.open) return false;

  const terminal = document.querySelector("#switch-terminal-input");
  if (terminal && document.activeElement === terminal) return false;

  return typeof window.startSlideshow === "function";
}

function scheduleStandby10s() {
  clearTimeout(standby10sTimer);

  if (document.hidden || isStandbyOpen()) return;

  standby10sTimer = window.setTimeout(() => {
    if (!canStartStandby()) {
      scheduleStandby10s();
      return;
    }

    window.startSlideshow();
  }, STANDBY_DELAY);
}

["pointermove", "pointerdown", "wheel", "touchstart", "keydown"].forEach(eventName => {
  document.addEventListener(eventName, event => {
    if (event.target instanceof Element && event.target.closest(".standby-deck")) return;
    scheduleStandby10s();
  }, { passive: eventName !== "keydown" });
});

document.addEventListener("visibilitychange", () => {
  clearTimeout(standby10sTimer);
  if (!document.hidden) scheduleStandby10s();
});

// Le script principal est chargé avant ce module : startSlideshow est donc déjà disponible.
scheduleStandby10s();
