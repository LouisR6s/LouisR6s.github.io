/*
 * Hand Slide — navigation gestuelle via MediaPipe Hand Landmarker.
 * - Pincement pouce/index + mouvement vertical : scroll haut/bas.
 * - Main ouverte + swipe gauche : section suivante.
 * - Main ouverte + swipe droite : section précédente.
 */

const MEDIAPIPE_VERSION = "1.0.1";
const MEDIAPIPE_MODULE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const MEDIAPIPE_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const HAND_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const CONFIG = {
  maxFps: 30,
  cameraWidth: 640,
  cameraHeight: 480,
  pinchStartRatio: 0.38,
  pinchReleaseRatio: 0.55,
  scrollDeadZone: 0.0035,
  scrollSensitivity: 2550,
  smoothing: 0.58,
  swipeMinDistance: 0.14,
  swipeMaxDuration: 550,
  swipeVerticalTolerance: 0.11,
  swipeCooldown: 900,
};

let enabled = false;
let starting = false;
let stream = null;
let handLandmarker = null;
let animationFrame = 0;
let lastVideoTime = -1;
let lastDetectionAt = 0;
let handVisible = false;
let pinching = false;
let previousPinchY = null;
let smoothedPinchY = null;
let swipeStart = null;
let lastSwipeAt = 0;
let swipeFeedbackTimer = 0;

const ui = createUi();

function createUi() {
  const style = document.createElement("style");
  style.textContent = `
    .hand-slide-toggle{position:fixed;left:18px;bottom:18px;z-index:10040;display:inline-flex;align-items:center;gap:9px;min-height:42px;padding:10px 14px;border:1px solid rgba(17,17,17,.2);border-radius:999px;background:rgba(243,242,238,.94);color:#111;box-shadow:0 12px 35px rgba(0,0,0,.13);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);font:600 12px/1.1 "DM Mono",ui-monospace,monospace;cursor:pointer;transition:transform .18s ease,background .18s ease}
    .hand-slide-toggle:hover{transform:translateY(-2px)}
    .hand-slide-toggle[aria-pressed="true"]{background:#111;color:#fff;border-color:#111}
    .hand-slide-toggle:disabled{cursor:wait;opacity:.72;transform:none}
    .hand-slide-dot{width:8px;height:8px;border-radius:50%;background:currentColor;opacity:.45}
    .hand-slide-toggle[aria-pressed="true"] .hand-slide-dot{opacity:1}
    .hand-slide-panel{position:fixed;left:18px;bottom:72px;z-index:10039;width:min(310px,calc(100vw - 36px));overflow:hidden;border:1px solid rgba(17,17,17,.16);border-radius:16px;background:rgba(243,242,238,.97);color:#111;box-shadow:0 18px 52px rgba(0,0,0,.18);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);opacity:0;transform:translateY(10px) scale(.98);pointer-events:none;visibility:hidden;transition:opacity .2s ease,transform .2s ease,visibility .2s ease}
    .hand-slide-panel.is-visible{opacity:1;transform:none;pointer-events:auto;visibility:visible}
    .hand-slide-video-wrap{position:relative;aspect-ratio:4/3;overflow:hidden;background:#111}
    .hand-slide-video{width:100%;height:100%;display:block;object-fit:cover;transform:scaleX(-1)}
    .hand-slide-reticle{position:absolute;inset:12px;border:1px solid rgba(255,255,255,.25);border-radius:10px;pointer-events:none}
    .hand-slide-badge{position:absolute;top:10px;left:10px;display:inline-flex;align-items:center;gap:6px;padding:6px 8px;border-radius:999px;background:rgba(0,0,0,.62);color:#fff;font:500 10px/1 "DM Mono",ui-monospace,monospace}
    .hand-slide-badge i{width:6px;height:6px;border-radius:50%;background:#fff;opacity:.55}
    .hand-slide-badge.is-hand i{opacity:1;background:#b8ff63}
    .hand-slide-badge.is-pinching i{opacity:1;background:#ffcf5a}
    .hand-slide-badge.is-swipe i{opacity:1;background:#73b7ff}
    .hand-slide-info{padding:12px 13px 13px}
    .hand-slide-status{display:flex;justify-content:space-between;gap:12px;margin:0 0 7px;font:700 11px/1.2 "DM Mono",ui-monospace,monospace;text-transform:uppercase}
    .hand-slide-status strong{font:inherit;text-align:right}
    .hand-slide-hint{margin:0;color:rgba(17,17,17,.66);font:500 11px/1.45 "Manrope",system-ui,sans-serif}
    .hand-slide-error{margin:8px 0 0;color:#a32828;font:600 11px/1.4 "Manrope",system-ui,sans-serif}
    html[data-theme="dark"] .hand-slide-toggle,html[data-theme="dark"] .hand-slide-panel{background:rgba(18,18,18,.94);color:#f3f2ee;border-color:rgba(255,255,255,.16)}
    html[data-theme="dark"] .hand-slide-toggle[aria-pressed="true"]{background:#f3f2ee;color:#111;border-color:#f3f2ee}
    html[data-theme="dark"] .hand-slide-hint{color:rgba(243,242,238,.67)}
    @media(max-width:720px){.hand-slide-toggle{left:12px;bottom:12px}.hand-slide-panel{left:12px;bottom:64px;width:min(290px,calc(100vw - 24px))}}
    @media(prefers-reduced-motion:reduce){.hand-slide-toggle,.hand-slide-panel{transition:none}}
  `;
  document.head.appendChild(style);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "hand-slide-toggle";
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-controls", "hand-slide-panel");
  button.innerHTML = `<span class="hand-slide-dot" aria-hidden="true"></span><span class="hand-slide-label">Hand slide</span>`;

  const panel = document.createElement("aside");
  panel.id = "hand-slide-panel";
  panel.className = "hand-slide-panel";
  panel.setAttribute("aria-label", "Contrôle gestuel par caméra");
  panel.innerHTML = `
    <div class="hand-slide-video-wrap">
      <video class="hand-slide-video" autoplay muted playsinline></video>
      <div class="hand-slide-reticle" aria-hidden="true"></div>
      <span class="hand-slide-badge"><i></i><span>CAMÉRA</span></span>
    </div>
    <div class="hand-slide-info">
      <p class="hand-slide-status"><span>GESTE</span><strong>Initialisation…</strong></p>
      <p class="hand-slide-hint">🤏 Pince + monte/descends pour scroller. ✋ Main ouverte + swipe gauche/droite pour changer de section.</p>
      <p class="hand-slide-error" hidden></p>
    </div>
  `;
  document.body.append(panel, button);

  const video = panel.querySelector(".hand-slide-video");
  const status = panel.querySelector(".hand-slide-status strong");
  const badge = panel.querySelector(".hand-slide-badge");
  const badgeText = badge.querySelector("span");
  const error = panel.querySelector(".hand-slide-error");
  const label = button.querySelector(".hand-slide-label");
  button.addEventListener("click", () => (enabled || starting ? stop() : start()));
  return { button, label, panel, video, status, badge, badgeText, error };
}

async function loadMediaPipe() {
  if (handLandmarker) return handLandmarker;
  const { FilesetResolver, HandLandmarker } = await import(MEDIAPIPE_MODULE_URL);
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: HAND_MODEL_URL },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.55,
    minTrackingConfidence: 0.55,
  });
  return handLandmarker;
}

async function start() {
  if (enabled || starting) return;
  ui.error.hidden = true;
  ui.error.textContent = "";
  if (!navigator.mediaDevices?.getUserMedia) return showError("Ce navigateur ne permet pas l’accès caméra via getUserMedia().");
  if (!window.isSecureContext) return showError("Le contrôle gestuel nécessite HTTPS.");

  starting = true;
  ui.button.disabled = true;
  ui.panel.classList.add("is-visible");
  ui.status.textContent = "Chargement du modèle…";
  ui.badgeText.textContent = "PRÉPARATION";

  try {
    const modelPromise = loadMediaPipe();
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: CONFIG.cameraWidth },
        height: { ideal: CONFIG.cameraHeight },
        frameRate: { ideal: 30, max: 30 },
      },
    });
    ui.video.srcObject = stream;
    await ui.video.play();
    await modelPromise;

    enabled = true;
    starting = false;
    ui.button.disabled = false;
    ui.button.setAttribute("aria-pressed", "true");
    ui.label.textContent = "Hand slide actif";
    lastVideoTime = -1;
    lastDetectionAt = 0;
    resetGestureTracking();
    setGestureState("searching");
    animationFrame = requestAnimationFrame(processFrame);
  } catch (error) {
    console.error("[Hand Slide]", error);
    stopCamera();
    starting = false;
    ui.button.disabled = false;
    const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
    const missing = error?.name === "NotFoundError" || error?.name === "DevicesNotFoundError";
    if (denied) showError("Accès caméra refusé. Autorise la caméra puis réessaie.");
    else if (missing) showError("Aucune caméra disponible sur cet appareil.");
    else showError("Impossible de démarrer le contrôle gestuel. Recharge la page puis réessaie.");
  }
}

function stop() {
  starting = false;
  enabled = false;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  stopCamera();
  resetGestureTracking();
  ui.button.disabled = false;
  ui.button.setAttribute("aria-pressed", "false");
  ui.label.textContent = "Hand slide";
  ui.panel.classList.remove("is-visible");
  ui.badge.classList.remove("is-hand", "is-pinching", "is-swipe");
}

function stopCamera() {
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  ui.video.srcObject = null;
}

function showError(message) {
  enabled = false;
  starting = false;
  ui.status.textContent = "Indisponible";
  ui.error.textContent = message;
  ui.error.hidden = false;
  ui.panel.classList.add("is-visible");
  ui.button.disabled = false;
  ui.button.setAttribute("aria-pressed", "false");
  ui.label.textContent = "Réessayer";
  ui.badgeText.textContent = "ERREUR";
}

function processFrame(timestamp) {
  if (!enabled) return;
  const minFrameDelay = 1000 / CONFIG.maxFps;
  if (timestamp - lastDetectionAt >= minFrameDelay && ui.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    lastDetectionAt = timestamp;
    if (ui.video.currentTime !== lastVideoTime) {
      lastVideoTime = ui.video.currentTime;
      try {
        const result = handLandmarker.detectForVideo(ui.video, performance.now());
        const landmarks = result?.landmarks?.[0];
        landmarks ? processHand(landmarks, timestamp) : resetHandState();
      } catch (error) {
        console.warn("[Hand Slide] frame ignorée", error);
      }
    }
  }
  animationFrame = requestAnimationFrame(processFrame);
}

function processHand(landmarks, timestamp) {
  handVisible = true;
  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleMcp = landmarks[9];
  const handSize = distance(wrist, middleMcp);
  if (handSize < 0.02) return resetHandState();

  const pinchRatio = distance(thumbTip, indexTip) / handSize;
  const rawY = (thumbTip.y + indexTip.y) / 2;
  smoothedPinchY = smoothedPinchY == null ? rawY : CONFIG.smoothing * rawY + (1 - CONFIG.smoothing) * smoothedPinchY;

  if (!pinching && pinchRatio <= CONFIG.pinchStartRatio) {
    pinching = true;
    previousPinchY = smoothedPinchY;
    swipeStart = null;
    setGestureState("pinching");
    return;
  }

  if (pinching && pinchRatio >= CONFIG.pinchReleaseRatio) {
    pinching = false;
    previousPinchY = null;
    swipeStart = null;
  }

  if (pinching) {
    if (previousPinchY != null) {
      const deltaY = smoothedPinchY - previousPinchY;
      if (Math.abs(deltaY) >= CONFIG.scrollDeadZone) {
        window.scrollBy({ top: deltaY * CONFIG.scrollSensitivity, left: 0, behavior: "auto" });
      }
    }
    previousPinchY = smoothedPinchY;
    setGestureState("pinching");
    return;
  }

  previousPinchY = null;
  processSwipe(landmarks, timestamp);
}

function processSwipe(landmarks, timestamp) {
  if (!isOpenHand(landmarks)) {
    swipeStart = null;
    setGestureState("ready");
    return;
  }

  const palm = palmCenter(landmarks);
  if (timestamp - lastSwipeAt < CONFIG.swipeCooldown) {
    swipeStart = null;
    setGestureState("ready");
    return;
  }

  if (!swipeStart) {
    swipeStart = { x: palm.x, y: palm.y, t: timestamp };
    setGestureState("open");
    return;
  }

  const elapsed = timestamp - swipeStart.t;
  if (elapsed > CONFIG.swipeMaxDuration) {
    swipeStart = { x: palm.x, y: palm.y, t: timestamp };
    setGestureState("open");
    return;
  }

  const visualDx = -(palm.x - swipeStart.x);
  const dy = palm.y - swipeStart.y;
  if (Math.abs(dy) > CONFIG.swipeVerticalTolerance) {
    swipeStart = { x: palm.x, y: palm.y, t: timestamp };
    setGestureState("open");
    return;
  }
  if (Math.abs(visualDx) < CONFIG.swipeMinDistance) {
    setGestureState("open");
    return;
  }

  lastSwipeAt = timestamp;
  swipeStart = null;
  if (visualDx < 0) {
    navigateSection(1);
    flashSwipe("left");
  } else {
    navigateSection(-1);
    flashSwipe("right");
  }
}

function isOpenHand(landmarks) {
  const wrist = landmarks[0];
  const pairs = [[8,6],[12,10],[16,14],[20,18]];
  return pairs.every(([tip, pip]) => distance(wrist, landmarks[tip]) > distance(wrist, landmarks[pip]) * 1.10);
}

function palmCenter(landmarks) {
  const ids = [0,5,9,13,17];
  const sum = ids.reduce((acc, id) => ({ x: acc.x + landmarks[id].x, y: acc.y + landmarks[id].y }), { x: 0, y: 0 });
  return { x: sum.x / ids.length, y: sum.y / ids.length };
}

function navigateSection(direction) {
  const sections = [...document.querySelectorAll("main > section")].filter(section => section.offsetParent !== null);
  if (!sections.length) return;
  const referenceY = window.innerHeight * 0.38;
  let currentIndex = 0;
  let bestDistance = Infinity;

  sections.forEach((section, index) => {
    const rect = section.getBoundingClientRect();
    const anchor = Math.abs(rect.top - referenceY);
    if (rect.top <= referenceY && rect.bottom >= referenceY) {
      currentIndex = index;
      bestDistance = -1;
    } else if (bestDistance !== -1 && anchor < bestDistance) {
      bestDistance = anchor;
      currentIndex = index;
    }
  });

  const targetIndex = Math.max(0, Math.min(sections.length - 1, currentIndex + direction));
  if (targetIndex !== currentIndex) sections[targetIndex].scrollIntoView({ behavior: "smooth", block: "start" });
}

function flashSwipe(direction) {
  clearTimeout(swipeFeedbackTimer);
  ui.badge.classList.remove("is-hand", "is-pinching");
  ui.badge.classList.add("is-swipe");
  ui.badgeText.textContent = direction === "left" ? "SWIPE ←" : "SWIPE →";
  ui.status.textContent = direction === "left" ? "Section suivante" : "Section précédente";
  swipeFeedbackTimer = setTimeout(() => {
    if (enabled && !pinching) setGestureState("ready");
  }, 650);
}

function resetHandState() {
  if (!handVisible && !pinching && !swipeStart) return;
  resetGestureTracking();
  setGestureState("searching");
}

function resetGestureTracking() {
  handVisible = false;
  pinching = false;
  previousPinchY = null;
  smoothedPinchY = null;
  swipeStart = null;
}

function setGestureState(state) {
  ui.badge.classList.remove("is-hand", "is-pinching", "is-swipe");
  if (state === "pinching") {
    ui.status.textContent = "Pincement — scroll actif";
    ui.badgeText.textContent = "SCROLL";
    ui.badge.classList.add("is-pinching");
    return;
  }
  if (state === "open") {
    ui.status.textContent = "Main ouverte — swipe";
    ui.badgeText.textContent = "SWIPE";
    ui.badge.classList.add("is-hand");
    return;
  }
  if (state === "ready") {
    ui.status.textContent = "Main détectée";
    ui.badgeText.textContent = "MAIN";
    ui.badge.classList.add("is-hand");
    return;
  }
  ui.status.textContent = "Montre une main à la caméra";
  ui.badgeText.textContent = "RECHERCHE";
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && (enabled || starting)) stop();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && (enabled || starting)) stop();
});

window.addEventListener("pagehide", stopCamera);
