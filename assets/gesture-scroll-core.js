/*
 * Hand Control — navigation gestuelle via MediaPipe Hand Landmarker.
 * Modes :
 * - Gesture : pincement + mouvement vertical = scroll, main ouverte + swipe = section précédente/suivante.
 * - Mouse : index = curseur virtuel, pincement pouce/index = clic dans la page.
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
  mouseSmoothing: 0.34,
  mouseClickCooldown: 320,
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

let activeMode = loadSavedMode();
let mouseX = null;
let mouseY = null;
let mousePinching = false;
let lastMouseClickAt = 0;
let mouseFeedbackTimer = 0;
let hoveredElement = null;

const ui = createUi();
applyMode(activeMode, false);

function loadSavedMode() {
  try {
    const saved = localStorage.getItem("hand-control-mode");
    if (saved === "gesture" || saved === "mouse") return saved;
  } catch {}
  return "gesture";
}

function createUi() {
  const style = document.createElement("style");
  style.textContent = `
    .hand-slide-toggle{position:fixed;left:18px;bottom:18px;z-index:10040;display:inline-flex;align-items:center;gap:9px;min-height:42px;padding:10px 14px;border:1px solid rgba(17,17,17,.2);border-radius:999px;background:rgba(243,242,238,.94);color:#111;box-shadow:0 12px 35px rgba(0,0,0,.13);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);font:600 12px/1.1 "DM Mono",ui-monospace,monospace;cursor:pointer;transition:transform .18s ease,background .18s ease}
    .hand-slide-toggle:hover{transform:translateY(-2px)}
    .hand-slide-toggle[aria-pressed="true"]{background:#111;color:#fff;border-color:#111}
    .hand-slide-toggle:disabled{cursor:wait;opacity:.72;transform:none}
    .hand-slide-dot{width:8px;height:8px;border-radius:50%;background:currentColor;opacity:.45}
    .hand-slide-toggle[aria-pressed="true"] .hand-slide-dot{opacity:1}

    .hand-slide-panel{position:fixed;left:18px;bottom:72px;z-index:10039;width:min(330px,calc(100vw - 36px));overflow:hidden;border:1px solid rgba(17,17,17,.16);border-radius:16px;background:rgba(243,242,238,.97);color:#111;box-shadow:0 18px 52px rgba(0,0,0,.18);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);opacity:0;transform:translateY(10px) scale(.98);pointer-events:none;visibility:hidden;transition:opacity .2s ease,transform .2s ease,visibility .2s ease}
    .hand-slide-panel.is-visible{opacity:1;transform:none;pointer-events:auto;visibility:visible}
    .hand-slide-video-wrap{position:relative;aspect-ratio:4/3;overflow:hidden;background:#111}
    .hand-slide-video{width:100%;height:100%;display:block;object-fit:cover;transform:scaleX(-1)}
    .hand-slide-reticle{position:absolute;inset:12px;border:1px solid rgba(255,255,255,.25);border-radius:10px;pointer-events:none}
    .hand-slide-badge{position:absolute;top:10px;left:10px;display:inline-flex;align-items:center;gap:6px;padding:6px 8px;border-radius:999px;background:rgba(0,0,0,.62);color:#fff;font:500 10px/1 "DM Mono",ui-monospace,monospace}
    .hand-slide-badge i{width:6px;height:6px;border-radius:50%;background:#fff;opacity:.55}
    .hand-slide-badge.is-hand i{opacity:1;background:#b8ff63}
    .hand-slide-badge.is-pinching i{opacity:1;background:#ffcf5a}
    .hand-slide-badge.is-swipe i{opacity:1;background:#73b7ff}
    .hand-slide-badge.is-mouse i{opacity:1;background:#b993ff}
    .hand-slide-badge.is-click i{opacity:1;background:#ffcf5a}

    .hand-slide-info{padding:12px 13px 13px}
    .hand-mode-switch{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:0 0 11px;padding:4px;border-radius:12px;background:rgba(17,17,17,.07)}
    .hand-mode-option{appearance:none;border:0;border-radius:9px;padding:8px 7px;background:transparent;color:inherit;font:700 10px/1.15 "DM Mono",ui-monospace,monospace;cursor:pointer;transition:background .15s ease,color .15s ease,box-shadow .15s ease}
    .hand-mode-option[aria-pressed="true"]{background:#111;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15)}
    .hand-slide-status{display:flex;justify-content:space-between;gap:12px;margin:0 0 7px;font:700 11px/1.2 "DM Mono",ui-monospace,monospace;text-transform:uppercase}
    .hand-slide-status strong{font:inherit;text-align:right}
    .hand-slide-hint{margin:0;color:rgba(17,17,17,.66);font:500 11px/1.45 "Manrope",system-ui,sans-serif}
    .hand-slide-error{margin:8px 0 0;color:#a32828;font:600 11px/1.4 "Manrope",system-ui,sans-serif}

    .hand-mouse-cursor{position:fixed;left:0;top:0;z-index:10060;width:26px;height:34px;pointer-events:none;opacity:0;visibility:hidden;transform:translate3d(var(--cursor-x,-100px),var(--cursor-y,-100px),0);transform-origin:2px 2px;transition:opacity .12s ease,filter .12s ease,transform .08s ease;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35))}
    .hand-mouse-cursor.is-visible{opacity:1;visibility:visible}
    .hand-mouse-cursor.is-target{filter:drop-shadow(0 0 5px rgba(108,79,255,.85)) drop-shadow(0 2px 2px rgba(0,0,0,.35))}
    .hand-mouse-cursor.is-clicking{transform:translate3d(var(--cursor-x),var(--cursor-y),0) scale(.82)}
    .hand-mouse-cursor svg{display:block;width:100%;height:100%}
    .hand-mouse-ripple{position:fixed;z-index:10059;width:28px;height:28px;border:2px solid rgba(114,87,255,.82);border-radius:50%;pointer-events:none;transform:translate(-50%,-50%) scale(.35);opacity:0}
    .hand-mouse-ripple.is-active{animation:hand-mouse-ripple .42s ease-out}
    @keyframes hand-mouse-ripple{0%{opacity:.9;transform:translate(-50%,-50%) scale(.35)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.65)}}

    html[data-theme="dark"] .hand-slide-toggle,html[data-theme="dark"] .hand-slide-panel{background:rgba(18,18,18,.94);color:#f3f2ee;border-color:rgba(255,255,255,.16)}
    html[data-theme="dark"] .hand-slide-toggle[aria-pressed="true"]{background:#f3f2ee;color:#111;border-color:#f3f2ee}
    html[data-theme="dark"] .hand-slide-hint{color:rgba(243,242,238,.67)}
    html[data-theme="dark"] .hand-mode-switch{background:rgba(255,255,255,.09)}
    html[data-theme="dark"] .hand-mode-option[aria-pressed="true"]{background:#f3f2ee;color:#111}

    @media(max-width:720px){.hand-slide-toggle{left:12px;bottom:12px}.hand-slide-panel{left:12px;bottom:64px;width:min(310px,calc(100vw - 24px))}}
    @media(prefers-reduced-motion:reduce){.hand-slide-toggle,.hand-slide-panel,.hand-mouse-cursor{transition:none}.hand-mouse-ripple.is-active{animation:none}}
  `;
  document.head.appendChild(style);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "hand-slide-toggle";
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-controls", "hand-slide-panel");
  button.innerHTML = `<span class="hand-slide-dot" aria-hidden="true"></span><span class="hand-slide-label">Hand control</span>`;

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
      <div class="hand-mode-switch" role="group" aria-label="Mode de contrôle gestuel">
        <button type="button" class="hand-mode-option" data-hand-mode="gesture">Hand Gesture</button>
        <button type="button" class="hand-mode-option" data-hand-mode="mouse">Hand Mouse</button>
      </div>
      <p class="hand-slide-status"><span>GESTE</span><strong>Initialisation…</strong></p>
      <p class="hand-slide-hint"></p>
      <p class="hand-slide-error" hidden></p>
    </div>
  `;

  const cursor = document.createElement("div");
  cursor.className = "hand-mouse-cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = `<svg viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"><path d="M2 1.5V25l6.2-5.3 4.15 9.05 4.05-1.85-4.12-8.98H21L2 1.5Z" fill="white" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

  const ripple = document.createElement("div");
  ripple.className = "hand-mouse-ripple";
  ripple.setAttribute("aria-hidden", "true");

  document.body.append(panel, button, cursor, ripple);

  const video = panel.querySelector(".hand-slide-video");
  const status = panel.querySelector(".hand-slide-status strong");
  const badge = panel.querySelector(".hand-slide-badge");
  const badgeText = badge.querySelector("span");
  const error = panel.querySelector(".hand-slide-error");
  const label = button.querySelector(".hand-slide-label");
  const hint = panel.querySelector(".hand-slide-hint");
  const modeButtons = [...panel.querySelectorAll("[data-hand-mode]")];

  button.addEventListener("click", () => (enabled || starting ? stop() : start()));
  modeButtons.forEach(modeButton => {
    modeButton.addEventListener("click", () => applyMode(modeButton.dataset.handMode));
  });

  return { button, label, panel, video, status, badge, badgeText, error, hint, modeButtons, cursor, ripple };
}

function applyMode(mode, persist = true) {
  activeMode = mode === "mouse" ? "mouse" : "gesture";
  if (persist) {
    try { localStorage.setItem("hand-control-mode", activeMode); } catch {}
  }

  ui.modeButtons?.forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.handMode === activeMode));
  });

  resetGestureTracking();
  resetMouseTracking();
  updateModeCopy();
  if (enabled) setGestureState("searching");
}

function updateModeCopy() {
  if (!ui?.hint) return;
  if (activeMode === "mouse") {
    ui.hint.textContent = "☝️ Déplace l’index pour piloter le curseur. 🤏 Pince pouce + index pour cliquer.";
    if (enabled) ui.label.textContent = "Hand Mouse actif";
  } else {
    ui.hint.textContent = "🤏 Pince + monte/descends pour scroller. ✋ Main ouverte + swipe gauche/droite pour changer de section.";
    if (enabled) ui.label.textContent = "Hand Gesture actif";
  }
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
    lastVideoTime = -1;
    lastDetectionAt = 0;
    resetGestureTracking();
    resetMouseTracking();
    updateModeCopy();
    setGestureState("searching");
    animationFrame = requestAnimationFrame(processFrame);
  } catch (error) {
    console.error("[Hand Control]", error);
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
  resetMouseTracking();
  ui.button.disabled = false;
  ui.button.setAttribute("aria-pressed", "false");
  ui.label.textContent = "Hand control";
  ui.panel.classList.remove("is-visible");
  ui.badge.classList.remove("is-hand", "is-pinching", "is-swipe", "is-mouse", "is-click");
  ui.cursor.classList.remove("is-visible", "is-target", "is-clicking");
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
  ui.cursor.classList.remove("is-visible");
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
        console.warn("[Hand Control] frame ignorée", error);
      }
    }
  }
  animationFrame = requestAnimationFrame(processFrame);
}

function processHand(landmarks, timestamp) {
  handVisible = true;
  if (activeMode === "mouse") {
    processMouse(landmarks, timestamp);
    return;
  }
  processGesture(landmarks, timestamp);
}

function processGesture(landmarks, timestamp) {
  ui.cursor.classList.remove("is-visible", "is-target", "is-clicking");

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

function processMouse(landmarks, timestamp) {
  resetGestureOnlyTracking();

  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleMcp = landmarks[9];
  const handSize = distance(wrist, middleMcp);
  if (handSize < 0.02) return resetHandState();

  const targetX = clamp((1 - indexTip.x) * window.innerWidth, 0, window.innerWidth - 1);
  const targetY = clamp(indexTip.y * window.innerHeight, 0, window.innerHeight - 1);

  mouseX = mouseX == null ? targetX : mouseX + (targetX - mouseX) * CONFIG.mouseSmoothing;
  mouseY = mouseY == null ? targetY : mouseY + (targetY - mouseY) * CONFIG.mouseSmoothing;
  updateVirtualCursor(mouseX, mouseY);

  const pinchRatio = distance(thumbTip, indexTip) / handSize;
  if (!mousePinching && pinchRatio <= CONFIG.pinchStartRatio) {
    mousePinching = true;
    if (timestamp - lastMouseClickAt >= CONFIG.mouseClickCooldown) {
      lastMouseClickAt = timestamp;
      performVirtualClick(mouseX, mouseY);
    }
    setGestureState("click");
    return;
  }

  if (mousePinching && pinchRatio >= CONFIG.pinchReleaseRatio) {
    mousePinching = false;
    ui.cursor.classList.remove("is-clicking");
  }

  setGestureState(mousePinching ? "click" : "mouse");
}

function updateVirtualCursor(x, y) {
  const tx = `${Math.round(x)}px`;
  const ty = `${Math.round(y)}px`;
  ui.cursor.style.setProperty("--cursor-x", tx);
  ui.cursor.style.setProperty("--cursor-y", ty);
  ui.cursor.classList.add("is-visible");

  const element = getVirtualTarget(x, y);
  if (hoveredElement !== element) hoveredElement = element;
  ui.cursor.classList.toggle("is-target", Boolean(findClickable(element)));
}

function performVirtualClick(x, y) {
  const target = getVirtualTarget(x, y);
  const clickable = findClickable(target) || target;
  if (!clickable) return;

  ui.cursor.classList.add("is-clicking");
  clearTimeout(mouseFeedbackTimer);
  mouseFeedbackTimer = setTimeout(() => ui.cursor.classList.remove("is-clicking"), 130);

  ui.ripple.style.left = `${x}px`;
  ui.ripple.style.top = `${y}px`;
  ui.ripple.classList.remove("is-active");
  void ui.ripple.offsetWidth;
  ui.ripple.classList.add("is-active");

  if (typeof clickable.focus === "function") {
    try { clickable.focus({ preventScroll: true }); } catch { try { clickable.focus(); } catch {} }
  }

  if (typeof clickable.click === "function") clickable.click();
  else clickable.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));
}

function getVirtualTarget(x, y) {
  const wasVisible = ui.cursor.classList.contains("is-visible");
  if (wasVisible) ui.cursor.classList.remove("is-visible");
  const element = document.elementFromPoint(x, y);
  if (wasVisible) ui.cursor.classList.add("is-visible");
  return element;
}

function findClickable(element) {
  if (!(element instanceof Element)) return null;
  return element.closest('a[href],button,input:not([type="hidden"]),select,textarea,label,[role="button"],[tabindex]:not([tabindex="-1"])');
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
  ui.badge.classList.remove("is-hand", "is-pinching", "is-swipe", "is-mouse", "is-click");
  ui.badge.classList.add("is-swipe");
  ui.badgeText.textContent = direction === "left" ? "SWIPE ←" : "SWIPE →";
  ui.status.textContent = direction === "left" ? "Section suivante" : "Section précédente";
  swipeFeedbackTimer = setTimeout(() => {
    if (enabled && activeMode === "gesture" && !pinching) setGestureState("ready");
  }, 650);
}

function resetHandState() {
  handVisible = false;
  resetGestureTracking();
  resetMouseTracking();
  setGestureState("searching");
}

function resetGestureTracking() {
  pinching = false;
  previousPinchY = null;
  smoothedPinchY = null;
  swipeStart = null;
}

function resetGestureOnlyTracking() {
  pinching = false;
  previousPinchY = null;
  smoothedPinchY = null;
  swipeStart = null;
}

function resetMouseTracking() {
  mousePinching = false;
  mouseX = null;
  mouseY = null;
  hoveredElement = null;
  ui?.cursor?.classList.remove("is-visible", "is-target", "is-clicking");
}

function setGestureState(state) {
  ui.badge.classList.remove("is-hand", "is-pinching", "is-swipe", "is-mouse", "is-click");

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
  if (state === "mouse") {
    ui.status.textContent = "Curseur actif — pince pour cliquer";
    ui.badgeText.textContent = "MOUSE";
    ui.badge.classList.add("is-mouse");
    return;
  }
  if (state === "click") {
    ui.status.textContent = "Clic";
    ui.badgeText.textContent = "CLICK";
    ui.badge.classList.add("is-click");
    return;
  }
  if (state === "ready") {
    ui.status.textContent = "Main détectée";
    ui.badgeText.textContent = "MAIN";
    ui.badge.classList.add("is-hand");
    return;
  }

  ui.status.textContent = activeMode === "mouse" ? "Montre ton index à la caméra" : "Montre une main à la caméra";
  ui.badgeText.textContent = "RECHERCHE";
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && (enabled || starting)) stop();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && (enabled || starting)) stop();
});

window.addEventListener("resize", () => {
  if (activeMode === "mouse") {
    mouseX = mouseX == null ? null : clamp(mouseX, 0, window.innerWidth - 1);
    mouseY = mouseY == null ? null : clamp(mouseY, 0, window.innerHeight - 1);
  }
});

window.addEventListener("pagehide", stopCamera);
