const skills = {
  cyber: {
    number: "01", kicker: "Protéger · Détecter · Analyser", title: "Cybersécurité",
    description: "Déployer des mécanismes de confiance, durcir les systèmes et observer les signaux faibles pour réduire la surface d’attaque.",
    tags: ["PKI", "TLS", "AES", "RSA", "Hardening", "Fail2ban", "Wazuh", "Wireshark", "Forensic", "Red Team", "Blue Team"],
    proof: "PKI complète, SIEM Wazuh, implant Red Team et environnement d’attaque/défense isolé."
  },
  network: {
    number: "02", kicker: "Connecter · Segmenter · Superviser", title: "Réseaux",
    description: "Concevoir et maintenir des réseaux lisibles, segmentés et résilients, du plan d’adressage jusqu’à la supervision.",
    tags: ["IP", "VLAN", "NAT", "ACL", "DHCP", "DNS", "Firewall", "Proxy", "Routage", "VPN", "QoS", "Trunking"],
    proof: "Gestion de réseau interne, configuration d’équipements et suivi de la sécurité du SI en entreprise."
  },
  systems: {
    number: "03", kicker: "Administrer · Durcir · Maintenir", title: "Systèmes",
    description: "Installer, configurer et maintenir des environnements Linux et Windows fiables, documentés et adaptés aux usages.",
    tags: ["Debian", "Rocky Linux", "Ubuntu", "Kali", "Windows Server", "Nginx", "Apache2", "SSH", "Samba", "OpenSSL"],
    proof: "Déploiement d’un serveur sécurisé exposé sur Internet et maintenance de parcs informatiques."
  },
  automation: {
    number: "04", kicker: "Automatiser · Tester · Déployer", title: "Scripting & DevOps",
    description: "Réduire les opérations manuelles et fiabiliser les mises en production grâce au code, aux conteneurs et aux pipelines.",
    tags: ["Bash", "PowerShell", "Python", "Git", "Jenkins", "Docker Compose", "Flask", "HTML/CSS"],
    proof: "Pipeline CI/CD complet : tests unitaires, build Docker et déploiement automatique sur VM Rocky."
  },
  cloud: {
    number: "05", kicker: "Isoler · Héberger · Orchestrer", title: "Virtualisation & Cloud",
    description: "Créer des laboratoires reproductibles et des infrastructures souples pour tester, héberger et segmenter les services.",
    tags: ["VMware", "Proxmox", "VirtualBox", "KVM", "AWS", "Docker", "Docker Compose"],
    proof: "Hébergement d’un C2 sous Proxmox et création d’un environnement multi-VM Red Team / Blue Team."
  }
};

const tabs = [...document.querySelectorAll("[data-skill]")];
const panel = document.querySelector("#skill-panel");
function selectSkill(key) {
  const skill = skills[key];
  tabs.forEach(tab => tab.setAttribute("aria-selected", String(tab.dataset.skill === key)));
  panel.animate([{ opacity: .25, transform: "translateX(24px)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(.22,.61,.36,1)" });
  document.querySelector(".skill-number").textContent = skill.number;
  document.querySelector("#skill-kicker").textContent = skill.kicker;
  document.querySelector("#skill-title").textContent = skill.title;
  document.querySelector("#skill-description").textContent = skill.description;
  document.querySelector("#skill-proof").textContent = skill.proof;
  document.querySelector("#skill-tags").replaceChildren(...skill.tags.map(tag => Object.assign(document.createElement("span"), { textContent: tag })));
}
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectSkill(tab.dataset.skill));
  tab.addEventListener("pointerenter", () => selectSkill(tab.dataset.skill));
  tab.addEventListener("keydown", event => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
    const next = tabs[(index + direction + tabs.length) % tabs.length];
    next.focus(); selectSkill(next.dataset.skill);
  });
});
selectSkill("cyber");

const signalLine = document.querySelector("#signal-line");
const speedControl = document.querySelector("#signal-speed");
const amplitudeControl = document.querySelector("#signal-amplitude");
const speedValue = document.querySelector("#speed-value");
const amplitudeValue = document.querySelector("#amplitude-value");
let signalPhase = 0;
function drawSignal() {
  if (!signalLine) return;
  const amp = Number(amplitudeControl.value), speed = Number(speedControl.value);
  signalPhase += speed * .035;
  const points = Array.from({length: 65}, (_, i) => `${i * 5},${32 - Math.sin(i * .32 + signalPhase) * amp}`);
  signalLine.setAttribute("points", points.join(" "));
  requestAnimationFrame(drawSignal);
}
if (signalLine) {
  const syncSignal = () => { speedValue.textContent = `${speedControl.value}x`; amplitudeValue.textContent = amplitudeControl.value; };
  speedControl.addEventListener("input", syncSignal); amplitudeControl.addEventListener("input", syncSignal); syncSignal(); drawSignal();
}

const switchLab = document.querySelector("#switch-lab");
const switchTerminalForm = document.querySelector("#switch-terminal-form");
const switchTerminalInput = document.querySelector("#switch-terminal-input");
const switchTerminalOutput = document.querySelector("#switch-terminal-output");
const switchStatus = document.querySelector("#switch-status");
const switchScore = document.querySelector("#switch-score");
const labPreview = document.querySelector("#lab-preview");
const labPreviewTitle = document.querySelector("#lab-preview-title");
const labPreviewMessage = document.querySelector("#lab-preview-message");
let labMode = "exec";
let labPortUp = false;
let labVlan = 20;
let activeLabDevice = "switch";
const labDeviceButtons = {
  switch: document.querySelector("#lab-switch-device"),
  "pc-a": document.querySelector("#lab-pc-a"),
  "pc-b": document.querySelector("#lab-pc-b")
};
function labPrint(text, error = false) {
  const line = document.createElement("p");
  line.textContent = text;
  if (error) line.className = "terminal-error";
  switchTerminalOutput.append(line);
  while (switchTerminalOutput.children.length > 100) switchTerminalOutput.firstElementChild.remove();
  switchTerminalOutput.scrollTop = switchTerminalOutput.scrollHeight;
}
function updateLab() {
  const ready = labPortUp && labVlan === 10;
  switchLab.classList.toggle("port-up", labPortUp);
  switchLab.classList.toggle("connected", ready);
  switchStatus.textContent = labPortUp ? "Gi0/2 UP" : "Gi0/2 DOWN";
  switchScore.textContent = ready ? "VLAN 10 · CONNECTÉ" : labPortUp ? "VLAN INCORRECT" : "HORS LIGNE";
  switchLab.querySelector(".lab-switch small").textContent = "Gi0/2 · VLAN " + labVlan;
  switchTerminalForm.querySelector("span").textContent = activeLabDevice === "pc-a" ? "PC-A>" : activeLabDevice === "pc-b" ? "PC-B>" : labMode === "interface" ? "SW(config-if)#" : labMode === "config" ? "SW(config)#" : "SW#";
  Object.entries(labDeviceButtons).forEach(([device, button]) => button.classList.toggle("active", device === activeLabDevice));
  labPreview.classList.toggle("online", ready);
  labPreviewTitle.textContent = ready ? "intranet.local est accessible" : "Connexion impossible";
  labPreviewMessage.textContent = ready ? "PC-A communique avec PC-B · 192.168.10.20" : "En attente d’un chemin réseau vers intranet.local";
}
function resetSwitchGame() {
  activeLabDevice = "switch"; labMode = "exec"; labPortUp = false; labVlan = 20;
  switchTerminalOutput.replaceChildren();
  labPrint("SW-REIMS-01 — simulation de dépannage");
  labPrint("Incident : PC-A ne peut pas joindre 192.168.10.20.");
  labPrint("Tape help pour consulter les commandes.");
  switchTerminalInput.value = ""; updateLab();
}
function selectLabDevice(device) {
  activeLabDevice = device;
  switchTerminalOutput.replaceChildren();
  if (device === "switch") {
    labMode = "exec"; labPrint("SW-REIMS-01 — console du switch"); labPrint("Tape help pour consulter les commandes.");
  } else {
    const name = device === "pc-a" ? "PC-A" : "PC-B";
    const ip = device === "pc-a" ? "192.168.10.10" : "192.168.10.20";
    labPrint(`${name} — console poste client`); labPrint(`Adresse IP : ${ip} / 24`); labPrint("Tape help pour ipconfig, ping ou clear.");
  }
  updateLab(); switchTerminalInput.focus();
}
if (switchLab) {
  switchTerminalForm.addEventListener("submit", event => {
    event.preventDefault();
    const command = switchTerminalInput.value.trim().toLowerCase().replace(/\s+/g, " ");
    if (!command) return;
    labPrint(switchTerminalForm.querySelector("span").textContent + " " + command);
    switchTerminalInput.value = "";
    if (activeLabDevice !== "switch") {
      const isPcA = activeLabDevice === "pc-a";
      const localIp = isPcA ? "192.168.10.10" : "192.168.10.20";
      const remoteIp = isPcA ? "192.168.10.20" : "192.168.10.10";
      if (command === "help" || command === "?") labPrint("ipconfig | ping " + remoteIp + " | clear");
      else if (command === "ipconfig") { labPrint("IPv4 Address . . . . . : " + localIp); labPrint("Subnet Mask  . . . . . : 255.255.255.0"); }
      else if (command === "ping " + remoteIp) labPrint(labPortUp && labVlan === 10 ? "Reply from " + remoteIp + ": bytes=32 time<1ms TTL=128" : "Request timed out.", !(labPortUp && labVlan === 10));
      else if (command === "clear") switchTerminalOutput.replaceChildren();
      else labPrint("Commande inconnue. Tape help.", true);
      updateLab(); return;
    }
    if (command === "help" || command === "?") {
      labPrint("show interfaces status | show vlan brief | configure terminal");
      labPrint("interface gi0/2 | no shutdown | shutdown | switchport access vlan 10");
      labPrint("exit | end | ping 192.168.10.20 | clear");
    } else if (["show interfaces status", "show interface status", "show interface gi0/2", "show interfaces gi0/2"].includes(command)) {
      labPrint("PORT    ÉTAT                    VLAN");
      labPrint("Gi0/1   connected               10");
      labPrint("Gi0/2   " + (labPortUp ? "connected" : "administratively down") + "       " + labVlan);
    } else if (command === "show vlan brief") {
      labPrint("VLAN 10  USERS   Gi0/1" + (labVlan === 10 ? ", Gi0/2" : ""));
      labPrint("VLAN 20  GUESTS  " + (labVlan === 20 ? "Gi0/2" : "—"));
    } else if (command === "configure terminal" || command === "conf t") {
      if (labMode !== "exec") labPrint("Quitte le mode actuel avec end.", true);
      else labMode = "config";
    } else if (command === "interface gi0/2" || command === "int gi0/2") {
      if (labMode === "exec") labPrint("Entre d’abord dans configure terminal.", true);
      else labMode = "interface";
    } else if (["no shutdown", "no shut", "shutdown"].includes(command)) {
      if (labMode !== "interface") labPrint("Sélectionne interface gi0/2 en mode configuration.", true);
      else { labPortUp = command !== "shutdown"; labPrint("%LINK: Gi0/2 changed state to " + (labPortUp ? "up" : "down")); }
    } else if (command === "switchport access vlan 10") {
      if (labMode !== "interface") labPrint("Cette commande nécessite le mode interface.", true);
      else { labVlan = 10; labPrint("Gi0/2 affectée au VLAN 10."); }
    } else if (command === "end") labMode = "exec";
    else if (command === "exit") labMode = labMode === "interface" ? "config" : "exec";
    else if (command === "ping 192.168.10.20") {
      if (labMode !== "exec") labPrint("Tape end pour lancer le diagnostic.", true);
      else if (labPortUp && labVlan === 10) { labPrint("!!!!! 5/5 réponses — 0 % de perte."); labPrint("Incident résolu : PC-A et PC-B communiquent."); }
      else labPrint("..... 0/5 réponses — vérifie l’état du port et le VLAN.", true);
    } else if (command === "clear") switchTerminalOutput.replaceChildren();
    else labPrint("% Commande inconnue. Tape help.", true);
    updateLab();
  });
  document.querySelector("#switch-game-reset").addEventListener("click", () => { resetSwitchGame(); switchTerminalInput.focus(); });
  Object.entries(labDeviceButtons).forEach(([device, button]) => button.addEventListener("click", () => selectLabDevice(device)));
  resetSwitchGame();
}
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector("nav");
navToggle.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});
nav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
  nav.classList.remove("open"); navToggle.setAttribute("aria-expanded", "false");
}));

const contactLink = document.querySelector(".nav-cta");
const contactPhone = document.querySelector("#contact-phone");
const phoneHome = document.querySelector("#phone-home");
let contactOpener = contactLink;
function openContactPhone(opener = contactLink) {
  contactOpener = opener;
  contactPhone.hidden = false;
  contactPhone.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => requestAnimationFrame(() => contactPhone.classList.add("open")));
  phoneHome.focus();
}
function closeContactPhone() {
  contactPhone.classList.remove("open");
  setTimeout(() => {
    if (!contactPhone.classList.contains("open")) {
      contactPhone.hidden = true;
      contactPhone.setAttribute("aria-hidden", "true");
    }
  }, 650);
  contactOpener.focus();
}
document.querySelectorAll('a[href="#contact"], .open-phone-contact').forEach(trigger => {
  trigger.addEventListener("click", event => { event.preventDefault(); openContactPhone(trigger); });
});
phoneHome.addEventListener("click", closeContactPhone);
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !contactPhone.hidden) closeContactPhone();
});

const weatherEmoji = document.querySelector("#weather-emoji");
const weatherTemperature = document.querySelector("#weather-temperature");
const weatherDescription = document.querySelector("#weather-description");
const weatherStates = { 0: ["☀️", "Ensoleillé"], 1: ["🌤️", "Peu nuageux"], 2: ["⛅", "Partiellement nuageux"], 3: ["☁️", "Nuageux"], 45: ["🌫️", "Brumeux"], 48: ["🌫️", "Brume givrée"], 51: ["🌦️", "Bruine légère"], 61: ["🌧️", "Pluie"], 71: ["🌨️", "Neige"], 80: ["🌦️", "Averses"], 95: ["⛈️", "Orage"] };
async function loadReimsWeather() {
  try {
    const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=49.2583&longitude=4.0317&current=temperature_2m,weather_code&timezone=Europe%2FParis");
    if (!response.ok) throw new Error();
    const { current } = await response.json();
    const [emoji, label] = weatherStates[current.weather_code] || ["🌡️", "Météo à Reims"];
    weatherTemperature.textContent = `${Math.round(current.temperature_2m)}°`;
    weatherDescription.textContent = label;
    weatherEmoji.textContent = emoji;
  } catch { weatherDescription.textContent = "Reims, France"; }
}
function updatePhoneTime() { document.querySelector("#phone-time").textContent = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date()); }
loadReimsWeather();
updatePhoneTime();
setInterval(updatePhoneTime, 30_000);

const observer = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); }
}), { threshold: .12 });
document.querySelectorAll(".reveal").forEach(element => observer.observe(element));
document.querySelector("#year").textContent = new Date().getFullYear();

const portraitImage = document.querySelector(".portrait-wrap img");
const hero = document.querySelector(".hero");
if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let portraitFrame;
  const updatePortraitBlur = () => {
    portraitFrame = undefined;
    const progress = Math.min(Math.max(window.scrollY / (hero.offsetHeight * .72), 0), 1);
    portraitImage.style.setProperty("--portrait-blur", `${(progress * 8).toFixed(2)}px`);
  };
  window.addEventListener("scroll", () => {
    if (!portraitFrame) portraitFrame = requestAnimationFrame(updatePortraitBlur);
  }, { passive: true });
  window.addEventListener("resize", updatePortraitBlur);
  updatePortraitBlur();
}

const githubUser = "LouisR6s";
const githubProfileName = document.querySelector("#github-profile-name");
const githubProfileBio = document.querySelector("#github-profile-bio");
const githubAvatar = document.querySelector("#github-avatar");
const githubRepositories = document.querySelector("#github-repositories");
const formatGithubNumber = value => new Intl.NumberFormat("fr-FR").format(value || 0);
const githubFallback = {
  login: githubUser,
  avatar_url: `https://github.com/${githubUser}.png?size=160`,
  public_repos: 3,
  followers: 2,
  following: 1,
  repositories: [
    { name: "LouisR6s", html_url: "https://github.com/LouisR6s/LouisR6s", description: "Profil GitHub et présentation.", language: "GITHUB" },
    { name: "Omnidev", html_url: "https://github.com/LouisR6s/Omnidev", description: "Projet public disponible sur GitHub.", language: "GITHUB" },
    { name: "python-exam1", html_url: "https://github.com/LouisR6s/python-exam1", description: "Exercice et projet Python.", language: "PYTHON" }
  ]
};

function makeGithubRepository(repository) {
  const link = document.createElement("a");
  link.className = "github-repository";
  link.href = repository.html_url;
  link.target = "_blank";
  link.rel = "noreferrer";
  const meta = document.createElement("span");
  meta.className = "mono";
  meta.textContent = [repository.language, repository.stargazers_count ? `★ ${repository.stargazers_count}` : ""].filter(Boolean).join(" · ") || "DÉPÔT PUBLIC";
  const title = document.createElement("h3");
  title.textContent = repository.name;
  const description = document.createElement("p");
  description.textContent = repository.description || "Voir ce dépôt sur GitHub.";
  link.append(meta, title, description);
  return link;
}

function renderGithubProfile(profile, repositories) {
  githubProfileName.textContent = profile.name || profile.login;
  githubProfileBio.textContent = profile.bio || "Voir mon profil et mes dépôts publics sur GitHub.";
  if (profile.avatar_url) githubAvatar.src = profile.avatar_url;
  githubAvatar.alt = `Photo de profil GitHub de ${profile.name || profile.login}`;
  document.querySelector("#github-repo-count").textContent = formatGithubNumber(profile.public_repos);
  document.querySelector("#github-follower-count").textContent = formatGithubNumber(profile.followers);
  document.querySelector("#github-following-count").textContent = formatGithubNumber(profile.following);
  githubRepositories.replaceChildren(...repositories.slice(0, 3).map(makeGithubRepository));
}

async function loadGithubPreview() {
  try {
    const [profileResponse, repositoriesResponse] = await Promise.all([
      fetch(`https://api.github.com/users/${githubUser}`),
      fetch(`https://api.github.com/users/${githubUser}/repos?sort=updated&per_page=3`)
    ]);
    if (!profileResponse.ok || !repositoriesResponse.ok) throw new Error("GitHub indisponible");
    const profile = await profileResponse.json();
    const repositories = await repositoriesResponse.json();
    renderGithubProfile(profile, repositories);
  } catch {
    renderGithubProfile(githubFallback, githubFallback.repositories);
  }
}

loadGithubPreview();

// Éditeur local du portfolio
const STORAGE_KEY = "louis-jouhannet-portfolio-v1";
const editableElements = [...document.querySelectorAll("[data-editable]")];
const defaults = Object.fromEntries(editableElements.map(element => [element.dataset.editable, element.textContent.trim()]));
const editorDialog = document.querySelector("#editor-dialog");
const projectList = document.querySelector(".project-list");
const manager = document.querySelector("#custom-project-manager");
const toolbar = document.querySelector("#edit-toolbar");
const toast = document.querySelector("#edit-toast");
const projectForm = document.querySelector("#project-form");
const projectSubmit = document.querySelector("#project-submit");
const projectEditCancel = document.querySelector("#project-edit-cancel");
let editSnapshot = {};
let editingProjectId = null;

function readState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed && typeof parsed === "object" ? { texts: parsed.texts || {}, projects: Array.isArray(parsed.projects) ? parsed.projects : [] } : { texts: {}, projects: [] };
  } catch { return { texts: {}, projects: [] }; }
}

function writeState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function notify(message) {
  toast.textContent = message; toast.classList.add("show");
  clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function applyTexts(texts) {
  editableElements.forEach(element => { element.textContent = texts[element.dataset.editable] || defaults[element.dataset.editable]; });
}

function makeTag(label) { const tag = document.createElement("span"); tag.textContent = label; return tag; }
function makeCustomProject(project, index) {
  const card = document.createElement("article");
  card.className = "project-card custom-project visible";
  card.dataset.projectId = project.id;
  const category = document.createElement("div"); category.className = "project-index mono"; category.textContent = `${String(index + 4).padStart(2, "0")} — ${project.category}`;
  const body = document.createElement("div"); body.className = "project-body";
  const title = document.createElement("h3"); title.textContent = project.title;
  const description = document.createElement("p"); description.textContent = project.description;
  const tags = document.createElement("div"); tags.className = "tag-row";
  project.tags.forEach(label => tags.append(makeTag(label)));
  body.append(title, description, tags);
  const art = document.createElement("div"); art.className = "cert-art"; art.setAttribute("aria-hidden", "true");
  const initials = project.title.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  const symbol = document.createElement("span"); symbol.textContent = initials || "P";
  const line = document.createElement("i"); const small = document.createElement("small"); small.textContent = "NOUVEAU PROJET";
  art.append(symbol, line, small); card.append(category, body, art); return card;
}

function renderProjects(projects) {
  projectList.querySelectorAll(".custom-project").forEach(card => card.remove());
  projects.forEach((project, index) => projectList.append(makeCustomProject(project, index)));
  manager.replaceChildren();
  if (!projects.length) { const empty = document.createElement("p"); empty.className = "manager-empty"; empty.textContent = "Aucune carte personnalisée pour le moment."; manager.append(empty); return; }
  projects.forEach(project => {
    const row = document.createElement("div"); row.className = "manager-item";
    const label = document.createElement("span"); label.textContent = project.title;
    const actions = document.createElement("div"); actions.className = "manager-actions";
    const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Modifier";
    edit.addEventListener("click", () => {
      editingProjectId = project.id;
      projectForm.elements.category.value = project.category;
      projectForm.elements.title.value = project.title;
      projectForm.elements.description.value = project.description;
      projectForm.elements.tags.value = project.tags.join(", ");
      projectSubmit.textContent = "Enregistrer la carte"; projectEditCancel.hidden = false;
      projectForm.elements.title.focus();
    });
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Supprimer";
    remove.addEventListener("click", () => {
      const state = readState(); state.projects = state.projects.filter(item => item.id !== project.id); writeState(state); renderProjects(state.projects); notify("Carte supprimée");
    });
    actions.append(edit, remove); row.append(label, actions); manager.append(row);
  });
}

function applyState() { const state = readState(); applyTexts(state.texts); renderProjects(state.projects); }
applyState();

const standbySlides = [
  { index: "01 / PROFIL", title: "Louis Jouhannet", text: "Master 2 Cybersécurité à l’ESGI Reims. Réseaux, systèmes et sécurité au quotidien.", tags: ["CYBERSÉCURITÉ", "RÉSEAUX", "SYSTÈMES"] },
  { index: "02 / COMPÉTENCES", title: "Construire, superviser, sécuriser.", text: "Des environnements fiables, de la configuration réseau à la protection des systèmes.", tags: ["LINUX", "VLAN", "FIREWALL", "WAZUH"] },
  { index: "03 / PROJETS", title: "Six projets techniques, testés sur le terrain.", text: "Supervision, automatisation, infrastructure et sécurité : des réalisations conçues pour être démontrables.", tags: ["RSG", "ENIGMA", "OMNIDEV", "PKI"] },
  { index: "04 / CERTIFICATIONS", title: "Certifier les acquis.", text: "Parcours CCNA et anglais professionnel validés en complément de la pratique.", tags: ["CCNA 1", "CCNA 2", "CCNA 3", "TOEIC"] },
  { index: "05 / EXPÉRIENCES", title: "Du support à l’administration réseau.", text: "Des expériences en entreprise autour des infrastructures, de la supervision et de la sécurité du SI.", tags: ["RSG", "CHASSEURS DE FRANCE", "SANEF"] },
  { index: "06 / PARCOURS", title: "Apprendre, tester, progresser.", text: "Un parcours orienté cybersécurité, avec une base solide en administration des systèmes et réseaux.", tags: ["ESGI REIMS", "BTS SIO", "SISR"] },
  { index: "07 / CONTACT", title: "Restons en contact.", text: "Retrouve mes coordonnées, mon CV et mes liens professionnels directement sur le portfolio.", tags: ["E-MAIL", "LINKEDIN", "GITHUB"] }
];
const standbyDeck = Object.assign(document.createElement("section"), { className: "standby-deck", ariaLabel: "Mode veille" });
standbyDeck.innerHTML = '<div class="standby-deck-head"><strong>LOUIS JOUHANNET / MODE VEILLE</strong><button class="standby-close" type="button">Quitter</button></div><article class="standby-slide" aria-live="polite"></article><div class="standby-deck-foot"><span>Portfolio · 2026</span><span class="standby-progress" aria-hidden="true"></span></div>';
document.body.append(standbyDeck);
const standbySlide = standbyDeck.querySelector(".standby-slide");
const standbyProgress = standbyDeck.querySelector(".standby-progress");
let slideshowTimer;
let standbyInactivityTimer;
let slideshowActive = false;
let slideshowIndex = 0;

function stopSlideshow(showNotice = false) {
  if (!slideshowActive) return;
  slideshowActive = false;
  clearTimeout(slideshowTimer);
  standbyDeck.classList.remove("open");
  if (document.fullscreenElement === standbyDeck) document.exitFullscreen().catch(() => {});
  if (showNotice) notify("Mode veille arrêté");
}

function startSlideshow() {
  clearTimeout(standbyInactivityTimer);
  if (slideshowActive) return;
  slideshowIndex = 0;
  slideshowActive = true;
  standbyDeck.classList.add("open");
  standbyDeck.requestFullscreen?.().catch(() => {});
  showNextSlide();
}

function scheduleStandbyMode() {
  clearTimeout(standbyInactivityTimer);
  if (slideshowActive || editorDialog.open) return;
  standbyInactivityTimer = setTimeout(() => {
    if (document.activeElement === switchTerminalInput || document.hidden) return scheduleStandbyMode();
    startSlideshow();
  }, 10000);
}

function renderStandbySlide() {
  const slide = standbySlides[slideshowIndex];
  standbySlide.classList.add("is-changing");
  setTimeout(() => {
    standbySlide.innerHTML = `<span class="standby-index">${slide.index}</span><h2>${slide.title}</h2><p>${slide.text}</p><div class="standby-tags">${slide.tags.map(tag => `<span>${tag}</span>`).join("")}</div>`;
    standbyProgress.replaceChildren(...standbySlides.map((_, index) => Object.assign(document.createElement("i"), { className: index === slideshowIndex ? "active" : "" })));
    requestAnimationFrame(() => standbySlide.classList.remove("is-changing"));
  }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 360);
}

function showNextSlide() {
  if (!slideshowActive) return;
  renderStandbySlide();
  slideshowIndex = (slideshowIndex + 1) % standbySlides.length;
  slideshowTimer = setTimeout(showNextSlide, 5200);
}

standbyDeck.querySelector(".standby-close").addEventListener("click", () => { stopSlideshow(); scheduleStandbyMode(); });

["wheel", "touchstart", "keydown", "pointerdown"].forEach(eventName => {
  document.addEventListener(eventName, event => {
    if (standbyDeck.contains(event.target)) return;
    if (slideshowActive) stopSlideshow(true);
    scheduleStandbyMode();
  }, { passive: eventName !== "keydown" });
});
document.addEventListener("pointermove", event => {
  if (slideshowActive && standbyDeck.contains(event.target)) { stopSlideshow(); scheduleStandbyMode(); return; }
  if (!slideshowActive) scheduleStandbyMode();
}, { passive: true });
document.addEventListener("keydown", event => { if (event.key === "Escape" && slideshowActive) { stopSlideshow(); scheduleStandbyMode(); } });
document.addEventListener("visibilitychange", () => { if (document.hidden) stopSlideshow(); else scheduleStandbyMode(); });
scheduleStandbyMode();

document.querySelector(".editor-close").addEventListener("click", () => editorDialog.close());
editorDialog.addEventListener("click", event => { if (event.target === editorDialog) editorDialog.close(); });

document.querySelector("#start-inline-edit").addEventListener("click", () => {
  editSnapshot = Object.fromEntries(editableElements.map(element => [element.dataset.editable, element.textContent]));
  editableElements.forEach(element => element.contentEditable = "true");
  document.body.classList.add("editing"); toolbar.hidden = false; editorDialog.close();
  editableElements[0].focus(); notify("Cliquez sur un texte encadré pour le modifier");
});

function endInlineEdit() { editableElements.forEach(element => element.removeAttribute("contenteditable")); document.body.classList.remove("editing"); toolbar.hidden = true; }
document.querySelector("#edit-save").addEventListener("click", () => {
  const state = readState(); state.texts = Object.fromEntries(editableElements.map(element => [element.dataset.editable, element.textContent.trim()]));
  writeState(state); endInlineEdit(); notify("Textes enregistrés sur cet appareil");
});
document.querySelector("#edit-cancel").addEventListener("click", () => { applyTexts(editSnapshot); endInlineEdit(); notify("Modifications annulées"); });

projectForm.addEventListener("submit", event => {
  event.preventDefault(); const data = new FormData(event.currentTarget); const state = readState();
  const nextProject = { id: editingProjectId || `project-${Date.now()}`, category: String(data.get("category")).trim(), title: String(data.get("title")).trim(), description: String(data.get("description")).trim(), tags: String(data.get("tags")).split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 10) };
  if (editingProjectId) state.projects = state.projects.map(project => project.id === editingProjectId ? nextProject : project);
  else state.projects.push(nextProject);
  writeState(state); renderProjects(state.projects); event.currentTarget.reset();
  notify(editingProjectId ? "Carte mise à jour" : "Nouvelle carte ajoutée");
  editingProjectId = null; projectSubmit.textContent = "+ Ajouter la carte"; projectEditCancel.hidden = true;
});
projectEditCancel.addEventListener("click", () => { editingProjectId = null; projectForm.reset(); projectSubmit.textContent = "+ Ajouter la carte"; projectEditCancel.hidden = true; });

document.querySelector("#export-content").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(readState(), null, 2)], { type: "application/json" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "portfolio-louis-sauvegarde.json"; link.click(); URL.revokeObjectURL(link.href); notify("Sauvegarde exportée");
});
document.querySelector("#import-content").addEventListener("change", async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!imported || typeof imported !== "object" || !Array.isArray(imported.projects)) throw new Error();
    writeState({ texts: imported.texts || {}, projects: imported.projects }); applyState(); notify("Sauvegarde importée");
  } catch { notify("Fichier de sauvegarde invalide"); }
  event.target.value = "";
});

const goupilleButton = document.querySelector("#goupille-button");
const goupilleWidget = document.querySelector("#goupille-widget");
const goupilleMessage = document.querySelector("#goupille-message");
const goupilleBlanketToggle = document.querySelector("#goupille-blanket-toggle");
const goupillePhrases = [
  "Je m’appelle Goupille.",
  "Mrrr… encore une caresse ?",
  "Tu as une bonne énergie, humain.",
  "Je surveille le réseau depuis ici.",
  "Ronron.exe est lancé.",
  "C’est mon meilleur endroit pour faire la sieste."
];
let goupillePhraseIndex = -1;
let goupilleSpeechTimer;
let goupilleSpamTimer;
let goupilleSpamCount = 0;

function talkToGoupille(message) {
  clearTimeout(goupilleSpeechTimer);
  goupilleMessage.textContent = message;
  goupilleWidget.classList.add("is-open");
  goupilleSpeechTimer = setTimeout(() => goupilleWidget.classList.remove("is-open"), 5000);
}

if (goupilleButton && goupilleWidget) {
  goupilleButton.addEventListener("click", () => {
    goupilleWidget.classList.remove("is-petted");
    void goupilleWidget.offsetWidth;
    goupilleWidget.classList.add("is-petted");
    goupillePhraseIndex = (goupillePhraseIndex + 1) % goupillePhrases.length;
    talkToGoupille(goupillePhrases[goupillePhraseIndex]);

    goupilleSpamCount += 1;
    clearTimeout(goupilleSpamTimer);
    goupilleSpamTimer = setTimeout(() => { goupilleSpamCount = 0; }, 900);

    if (goupilleSpamCount >= 5) {
      goupilleSpamCount = 0;
      goupilleWidget.classList.remove("is-petted", "is-stretched");
      void goupilleWidget.offsetWidth;
      goupilleWidget.classList.add("is-stretched");
      setTimeout(() => goupilleWidget.classList.remove("is-stretched"), 720);
    }
  });
}

if (goupilleBlanketToggle && goupilleWidget) {
  goupilleBlanketToggle.addEventListener("click", () => {
    const isTucked = goupilleWidget.classList.toggle("is-tucked");
    goupilleBlanketToggle.setAttribute("aria-pressed", String(isTucked));
    goupilleBlanketToggle.textContent = isTucked ? "Découvrir Goupille" : "Couvrir Goupille";
    talkToGoupille(isTucked ? "Mrrr… merci pour la couverture." : "J’étais bien au chaud.");
  });
}
document.querySelector("#reset-content").addEventListener("click", () => {
  if (!confirm("Restaurer tous les textes et supprimer les cartes ajoutées ?")) return;
  localStorage.removeItem(STORAGE_KEY); applyState(); notify("Portfolio restauré");
});

const technologyTooltip = document.createElement("div");
technologyTooltip.className = "technology-tooltip";
technologyTooltip.setAttribute("role", "tooltip");
document.body.append(technologyTooltip);

function positionTechnologyTooltip(icon) {
  const bounds = icon.getBoundingClientRect();
  technologyTooltip.style.left = `${bounds.left + bounds.width / 2}px`;
  technologyTooltip.style.top = `${Math.max(10, bounds.top - 38)}px`;
}

document.addEventListener("pointerover", event => {
  const icon = event.target.closest(".project-logos img[title]");
  if (!icon || !icon.closest(".project-logos")) return;
  technologyTooltip.textContent = icon.title;
  positionTechnologyTooltip(icon);
  technologyTooltip.classList.add("is-visible");
});
document.addEventListener("pointerout", event => {
  const icon = event.target.closest(".project-logos img[title]");
  if (icon) technologyTooltip.classList.remove("is-visible");
});
document.addEventListener("pointermove", event => {
  const icon = event.target.closest(".project-logos img[title]");
  if (icon) positionTechnologyTooltip(icon);
});
