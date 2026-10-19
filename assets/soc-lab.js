/* Mini-CTF SOC autonome. Données fictives : aucun accès système ou réseau réel. */
(() => {
  "use strict";
  const root = document.querySelector("#soc-lab");
  if (!root) return;

  const output = document.querySelector("#soc-output");
  const input = document.querySelector("#soc-input");
  const form = document.querySelector("#soc-form");
  const prompt = document.querySelector("#soc-prompt");
  const progress = document.querySelector("#soc-flag-progress");
  const containment = document.querySelector("#soc-containment");
  const status = document.querySelector("#soc-status");
  const resetButton = document.querySelector("#soc-reset");

  /* Tous les événements sont inventés pour l'exercice. */
  const files = {
    "/home/analyst/mission.txt": [
      "DOSSIER SOC / INCIDENT 002",
      "Cible : PC-WS-01 (Windows 11) / utilisateur j.dupont",
      "Signalement : connexions RDP anormales, puis comportement inhabituel.",
      "",
      "Retrouve trois flags, sans te fier à une seule alerte :",
      "  FLAG 1 : IP source externe de la connexion RDP réussie ; remplace les points par des underscores.",
      "  FLAG 2 : nom (sans .exe) du binaire inhabituel lancé dans AppData ; écris-le en MAJUSCULES.",
      "  FLAG 3 : nom de la tâche planifiée associée à ce binaire ; écris-le en MAJUSCULES.",
      "",
      "Format attendu : FLAG{VALEUR} (commande : submit FLAG{VALEUR}).",
      "Une fois les 3 flags validés : isole le poste puis lance validate.",
      "Les événements et les réponses sont fictifs ; aucun vrai poste n'est affecté."
    ],
    "/evidence/wazuh/alerts.log": [
      "14:11:12 | level=3  | agent=PC-WS-01 | Windows logon success | src=192.168.10.42 | event=4624",
      "14:16:20 | level=6  | agent=PC-WS-01 | Network scan pattern | src=185.199.110.23",
      "14:17:54 | level=12 | agent=PC-WS-01 | RDP logon type=10 | src=185.199.110.23 | event=4624",
      "14:18:01 | level=10 | agent=PC-WS-01 | Account added to local Administrators | event=4732",
      "14:20:47 | level=8  | agent=PC-WS-01 | Scheduled task created | event=4698",
      "14:21:03 | level=12 | agent=PC-WS-01 | Suspicious process from AppData | sysmon=1",
      "14:22:58 | level=8  | agent=PC-WS-01 | Failed network logons x5 | event=4625",
      "14:23:11 | level=12 | agent=PC-WS-01 | External RDP connection | src=185.199.110.23"
    ],
    "/evidence/windows/security.log": [
      "14:11:12 EventID=4624 Type=2 User=j.dupont SourceIP=192.168.10.42 Result=SUCCESS",
      "14:14:20 EventID=4625 Type=3 User=guest SourceIP=10.0.0.55 Result=FAIL",
      "14:16:51 EventID=4625 Type=10 User=j.dupont SourceIP=185.199.110.23 Result=FAIL",
      "14:17:12 EventID=4625 Type=10 User=j.dupont SourceIP=185.199.110.23 Result=FAIL",
      "14:17:54 EventID=4624 Type=10 User=j.dupont SourceIP=185.199.110.23 Result=SUCCESS",
      "14:18:01 EventID=4732 User=j.dupont MemberAdded=j.dupont Group=Administrators",
      "14:20:47 EventID=4698 User=j.dupont TaskCreated=true"
    ],
    "/evidence/windows/sysmon.log": [
      "14:13:05 EventID=1 Image=C:\\Windows\\System32\\notepad.exe ParentImage=explorer.exe User=j.dupont",
      "14:18:14 EventID=3 Image=C:\\Windows\\System32\\svchost.exe DestinationIp=192.168.10.10",
      "14:21:03 EventID=1 Image=C:\\Users\\j.dupont\\AppData\\Roaming\\update.exe ParentImage=powershell.exe User=j.dupont",
      "14:21:04 EventID=3 Image=C:\\Users\\j.dupont\\AppData\\Roaming\\update.exe DestinationIp=203.0.113.77 DestinationPort=443",
      "14:21:29 EventID=1 Image=C:\\Windows\\System32\\cmd.exe ParentImage=explorer.exe User=SYSTEM"
    ],
    "/evidence/windows/tasks.txt": [
      "TaskName=OneDriveSync User=j.dupont Action=C:\\Program Files\\Microsoft OneDrive\\OneDrive.exe Status=READY",
      "TaskName=DefenderCleanup User=SYSTEM Action=C:\\Windows\\System32\\MpCmdRun.exe Status=READY",
      "TaskName=WinUpdate User=j.dupont Action=C:\\Users\\j.dupont\\AppData\\Roaming\\update.exe Status=READY Created=14:20:47"
    ],
    "/evidence/network/connections.log": [
      "14:11:12 PC-WS-01 TCP 192.168.10.42:51442 -> 192.168.10.15:3389 ESTABLISHED (interne)",
      "14:17:54 PC-WS-01 TCP 185.199.110.23:52810 -> 192.168.10.15:3389 ESTABLISHED (RDP)",
      "14:21:04 PC-WS-01 TCP 192.168.10.15:50222 -> 203.0.113.77:443 ESTABLISHED (sortant)",
      "14:22:58 PC-WS-01 TCP 185.199.110.23:53219 -> 192.168.10.15:3389 CLOSED"
    ]
  };

  const solutions = new Map([
    ["FLAG{185_199_110_23}", 1],
    ["FLAG{UPDATE}", 2],
    ["FLAG{WINUPDATE}", 3]
  ]);
  let cwd = "/home/analyst";
  let found = new Set();
  let isolated = false;
  let completed = false;
  let history = [];
  let historyIndex = 0;

  function print(message = "", kind = "") {
    const line = document.createElement("div");
    line.className = "soc-line" + (kind ? " soc-line-" + kind : "");
    line.textContent = String(message);
    output.append(line);
    while (output.children.length > 170) output.firstElementChild.remove();
    output.scrollTop = output.scrollHeight;
  }

  function pathOf(raw = ".") {
    const path = raw.startsWith("/") ? raw : cwd + "/" + raw;
    const parts = [];
    path.split("/").forEach(part => {
      if (!part || part === ".") return;
      if (part === "..") parts.pop();
      else parts.push(part);
    });
    return "/" + parts.join("/");
  }

  function isDirectory(path) {
    return path === "/" || Object.keys(files).some(file => file.startsWith(path === "/" ? "/" : path + "/"));
  }

  function childrenOf(path) {
    const prefix = path === "/" ? "/" : path + "/";
    const names = new Set();
    Object.keys(files).filter(file => file.startsWith(prefix))
      .forEach(file => names.add(file.slice(prefix.length).split("/")[0]));
    return [...names].sort((a, b) => a.localeCompare(b, "fr"));
  }

  function tokenize(command) {
    const pieces = command.match(/"[^"]*"|'[^']*'|\S+/g) || [];
    return pieces.map(item => ((item[0] === '"' && item.at(-1) === '"') ||
      (item[0] === "'" && item.at(-1) === "'")) ? item.slice(1, -1) : item);
  }

  function updatePrompt() {
    const directory = cwd === "/home/analyst" ? "~" : cwd;
    prompt.textContent = "analyst@soc:" + directory + "$";
  }

  function updateState() {
    progress.textContent = found.size + " / 3 flags";
    containment.textContent = isolated ? "Poste isolé" : "Poste non isolé";
    containment.classList.toggle("contained", isolated);
    status.textContent = completed ? "Incident résolu" : found.size === 3
      ? "Flags validés · confinement attendu"
      : "Investigation en cours";
    root.classList.toggle("soc-completed", completed);
  }

  function reset() {
    cwd = "/home/analyst";
    found = new Set();
    isolated = false;
    completed = false;
    history = [];
    historyIndex = 0;
    output.replaceChildren();
    input.value = "";
    updatePrompt();
    updateState();
    print("SOC LAB / INCIDENT #002", "title");
    print("Session locale · preuves fictives · aucun système réel connecté.", "muted");
    print("");
    print("Une activité anormale a été détectée sur PC-WS-01.");
    print("À toi d'explorer les preuves, trouver 3 flags et contenir le poste.");
    print("");
    print("Commence par help ou ls. Les consignes sont dans mission.txt.", "accent");
    input.focus();
  }

  function run(commandLine) {
    const args = tokenize(commandLine);
    const cmd = (args.shift() || "").toLowerCase();
    if (cmd === "clear") { output.replaceChildren(); return; }

    if (cmd === "help" || cmd === "?") {
      [
        "EXPLORATION",
        "  pwd                      afficher le répertoire courant",
        "  ls [répertoire]          lister les fichiers disponibles",
        "  cd <répertoire>          changer de répertoire",
        "  cat <fichier>            lire un fichier de preuves",
        "  grep [-i] <mot> <fichier> chercher dans un journal",
        "  find [répertoire]        retrouver les fichiers",
        "  history                  revoir les commandes",
        "INVESTIGATION",
        "  submit FLAG{...}         proposer un flag",
        "  status                   afficher l'avancement",
        "  isolate PC-WS-01         confinement simulé du poste",
        "  validate                 vérifier la résolution",
        "  clear                    nettoyer l'écran",
        "",
        "Astuce : on peut lire mission.txt pour connaître les objectifs."
      ].forEach(line => print(line));
      return;
    }
    if (cmd === "whoami") { print("analyst"); return; }
    if (cmd === "pwd") { print(cwd); return; }
    if (cmd === "ls") {
      const target = pathOf(args.find(arg => !arg.startsWith("-")) || ".");
      if (files[target]) { print(target.split("/").at(-1)); return; }
      if (!isDirectory(target)) { print("ls : répertoire introuvable : " + target, "error"); return; }
      const entries = childrenOf(target);
      print(entries.length ? entries.map(entry => isDirectory(pathOf(target + "/" + entry)) ? entry + "/" : entry).join("    ") : "(vide)");
      return;
    }
    if (cmd === "cd") {
      const target = pathOf(args[0] || "/home/analyst");
      if (!isDirectory(target)) { print("cd : répertoire introuvable : " + target, "error"); return; }
      cwd = target;
      updatePrompt();
      return;
    }
    if (cmd === "cat" || cmd === "head" || cmd === "tail") {
      if (!args.length) { print(cmd + " : indique un fichier.", "error"); return; }
      const target = pathOf(args[0]);
      if (!files[target]) { print(cmd + " : fichier introuvable : " + target, "error"); return; }
      const lines = files[target];
      const selected = cmd === "head" ? lines.slice(0, 10) : cmd === "tail" ? lines.slice(-10) : lines;
      selected.forEach(line => print(line));
      return;
    }
    if (cmd === "find") {
      const base = pathOf(args.find(arg => !arg.startsWith("-") && arg !== "*.log") || ".");
      if (!isDirectory(base)) { print("find : chemin introuvable.", "error"); return; }
      Object.keys(files).filter(file => file.startsWith(base === "/" ? "/" : base + "/")).sort().forEach(file => print(file));
      return;
    }
    if (cmd === "grep") {
      const insensitive = args.includes("-i");
      const params = args.filter(arg => arg !== "-i" && arg !== "-n");
      if (params.length < 2) { print("Usage : grep [-i] <mot> <fichier>", "error"); return; }
      const target = pathOf(params.slice(1).join(" "));
      if (!files[target]) { print("grep : fichier introuvable : " + target, "error"); return; }
      const term = insensitive ? params[0].toLowerCase() : params[0];
      let hits = 0;
      files[target].forEach((line, index) => {
        const haystack = insensitive ? line.toLowerCase() : line;
        if (haystack.includes(term)) {
          print((args.includes("-n") ? (index + 1) + ":" : "") + line);
          hits++;
        }
      });
      if (!hits) print("Aucune correspondance.", "muted");
      return;
    }
    if (cmd === "history") {
      history.forEach((entry, index) => print(String(index + 1).padStart(2, " ") + "  " + entry));
      return;
    }
    if (cmd === "status") {
      print("Flags : " + found.size + "/3 · Containment : " + (isolated ? "ACTIF" : "INACTIF") +
        " · Verdict : " + (completed ? "RÉSOLU" : "EN COURS"));
      return;
    }
    if (cmd === "submit") {
      const candidate = args.join("").toUpperCase();
      if (!candidate.startsWith("FLAG{") || !candidate.endsWith("}")) {
        print("Format : submit FLAG{VALEUR}", "error");
        return;
      }
      const number = solutions.get(candidate);
      if (!number) { print("Flag non validé. Recoupe les preuves et vérifie le format.", "error"); return; }
      if (found.has(number)) { print("Flag " + number + " déjà trouvé.", "muted"); return; }
      found.add(number);
      print("Flag " + number + "/3 validé. Continue l'investigation.", "success");
      updateState();
      return;
    }
    if (cmd === "isolate") {
      if ((args[0] || "").toUpperCase() !== "PC-WS-01") {
        print("Usage : isolate PC-WS-01", "error");
        return;
      }
      if (isolated) print("PC-WS-01 est déjà isolé (simulation).", "muted");
      else {
        isolated = true;
        print("Confinement simulé : PC-WS-01 isolé du réseau.", "success");
        print("Aucune connexion réelle n'a été modifiée.", "muted");
      }
      updateState();
      return;
    }
    if (cmd === "validate") {
      if (found.size !== 3 || !isolated) {
        print("Incident non résolu : il faut 3 flags validés et le poste isolé.", "error");
        return;
      }
      completed = true;
      print("INCIDENT #002 RÉSOLU — analyse et confinement validés.", "success");
      print("Bien joué. L'analyse SOC repose sur la corrélation de plusieurs preuves.", "success");
      updateState();
      return;
    }
    print("Commande indisponible dans cette simulation. Tape help.", "error");
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const raw = input.value.trim();
    if (!raw) return;
    if (raw.length > 250) { print("Commande trop longue.", "error"); return; }
    print(prompt.textContent + " " + raw, "command");
    history.push(raw);
    if (history.length > 80) history.shift();
    historyIndex = history.length;
    input.value = "";
    run(raw);
    input.focus();
  });

  input.addEventListener("keydown", event => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    historyIndex = Math.max(0, Math.min(history.length,
      historyIndex + (event.key === "ArrowUp" ? -1 : 1)));
    input.value = history[historyIndex] || "";
  });

  output.addEventListener("click", () => input.focus());
  resetButton.addEventListener("click", reset);
  reset();
})();