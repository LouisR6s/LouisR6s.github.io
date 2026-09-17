/*
 * Hand Mouse — scroll à deux doigts.
 * ✌️ Index + majeur levés + mouvement vertical = scroll.
 *
 * Ce module complète gesture-scroll-core.js sans relancer une seconde
 * détection MediaPipe : il intercepte les résultats du HandLandmarker déjà
 * utilisé par le contrôle gestuel principal.
 */

const MEDIAPIPE_VERSION = "1.0.1";
const MEDIAPIPE_MODULE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;

const TWO_FINGER_SCROLL = {
  deadZone: 0.0035,
  sensitivity: 2400,
  smoothing: 0.56,
  pinchGuardRatio: 0.55,
};

let scrolling = false;
let previousY = null;
let smoothedY = null;
let lastHandledResult = null;

const style = document.createElement("style");
style.textContent = `
  body.hand-mouse-two-finger-scroll .hand-mouse-cursor {
    opacity: 0 !important;
    visibility: hidden !important;
  }
`;
document.head.appendChild(style);

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isControlEnabled() {
  return document.querySelector('.hand-slide-toggle[aria-pressed="true"]') !== null;
}

function isMouseMode() {
  return document.querySelector('[data-hand-mode="mouse"][aria-pressed="true"]') !== null;
}

function fingerExtended(landmarks, tip, pip, factor = 1.1) {
  const wrist = landmarks[0];
  return distance(wrist, landmarks[tip]) > distance(wrist, landmarks[pip]) * factor;
}

function fingerFolded(landmarks, tip, pip, factor = 1.08) {
  const wrist = landmarks[0];
  return distance(wrist, landmarks[tip]) < distance(wrist, landmarks[pip]) * factor;
}

function isTwoFingerScrollPose(landmarks) {
  return (
    fingerExtended(landmarks, 8, 6, 1.1) &&
    fingerExtended(landmarks, 12, 10, 1.1) &&
    fingerFolded(landmarks, 16, 14, 1.08) &&
    fingerFolded(landmarks, 20, 18, 1.08)
  );
}

function resetScroll() {
  scrolling = false;
  previousY = null;
  smoothedY = null;
  document.body.classList.remove("hand-mouse-two-finger-scroll");
}

function showScrollState() {
  if (!scrolling || !isControlEnabled() || !isMouseMode()) return;

  const badge = document.querySelector(".hand-slide-badge");
  const badgeText = badge?.querySelector("span");
  const status = document.querySelector(".hand-slide-status strong");

  if (badge) {
    badge.classList.remove("is-hand", "is-swipe", "is-mouse", "is-click");
    badge.classList.add("is-pinching");
  }
  if (badgeText) badgeText.textContent = "SCROLL ✌️";
  if (status) status.textContent = "Deux doigts — scroll actif";
}

function handleHandResult(result) {
  if (result === lastHandledResult) return;
  lastHandledResult = result;

  if (!isControlEnabled() || !isMouseMode()) {
    resetScroll();
    return;
  }

  const landmarks = result?.landmarks?.[0];
  if (!landmarks) {
    resetScroll();
    return;
  }

  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const handSize = distance(wrist, middleMcp);

  if (handSize < 0.02) {
    resetScroll();
    return;
  }

  // Le pincement reste prioritaire : on ne transforme jamais un clic en scroll.
  const pinchRatio = distance(thumbTip, indexTip) / handSize;
  if (pinchRatio <= TWO_FINGER_SCROLL.pinchGuardRatio || !isTwoFingerScrollPose(landmarks)) {
    resetScroll();
    return;
  }

  const rawY = (indexTip.y + middleTip.y) / 2;
  smoothedY = smoothedY == null
    ? rawY
    : TWO_FINGER_SCROLL.smoothing * rawY + (1 - TWO_FINGER_SCROLL.smoothing) * smoothedY;

  document.body.classList.add("hand-mouse-two-finger-scroll");

  if (!scrolling) {
    scrolling = true;
    previousY = smoothedY;
    queueMicrotask(showScrollState);
    return;
  }

  const deltaY = smoothedY - previousY;
  previousY = smoothedY;

  if (Math.abs(deltaY) >= TWO_FINGER_SCROLL.deadZone) {
    window.scrollBy({
      top: deltaY * TWO_FINGER_SCROLL.sensitivity,
      left: 0,
      behavior: "auto",
    });
  }

  // Le module principal met à jour son statut juste après detectForVideo().
  // Une microtask nous permet donc d'afficher l'état scroll en dernier.
  queueMicrotask(showScrollState);
}

function wrapDetect(instance) {
  if (!instance || typeof instance.detectForVideo !== "function") return instance;
  if (instance.detectForVideo.__handMouseTwoFingerWrapped) return instance;

  const original = instance.detectForVideo.bind(instance);
  const wrapped = function (...args) {
    const result = original(...args);
    try { handleHandResult(result); } catch (error) {
      console.warn("[Hand Mouse Scroll] résultat ignoré", error);
    }
    return result;
  };
  wrapped.__handMouseTwoFingerWrapped = true;
  instance.detectForVideo = wrapped;
  return instance;
}

async function installPatch() {
  try {
    const { HandLandmarker } = await import(MEDIAPIPE_MODULE_URL);

    // Cas principal : toute nouvelle instance créée par le module Hand Control
    // est décorée automatiquement.
    if (!HandLandmarker.createFromOptions.__handMouseTwoFingerWrapped) {
      const originalCreate = HandLandmarker.createFromOptions.bind(HandLandmarker);
      const wrappedCreate = async function (...args) {
        const instance = await originalCreate(...args);
        return wrapDetect(instance);
      };
      wrappedCreate.__handMouseTwoFingerWrapped = true;
      HandLandmarker.createFromOptions = wrappedCreate;
    }

    // Filet de sécurité pour les implémentations où detectForVideo vit sur le prototype.
    const proto = HandLandmarker.prototype;
    if (proto && typeof proto.detectForVideo === "function" && !proto.detectForVideo.__handMouseTwoFingerWrapped) {
      const originalDetect = proto.detectForVideo;
      const wrappedDetect = function (...args) {
        const result = originalDetect.apply(this, args);
        try { handleHandResult(result); } catch (error) {
          console.warn("[Hand Mouse Scroll] résultat ignoré", error);
        }
        return result;
      };
      wrappedDetect.__handMouseTwoFingerWrapped = true;
      proto.detectForVideo = wrappedDetect;
    }
  } catch (error) {
    console.warn("[Hand Mouse Scroll] extension non chargée", error);
  }
}

installPatch();

document.addEventListener("visibilitychange", () => {
  if (document.hidden) resetScroll();
});
window.addEventListener("pagehide", resetScroll);
