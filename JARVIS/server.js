#!/usr/bin/env node
/* =====================================================================
   JARVIS — SERVEUR LOCAL v0.3
   - Cerveau   : Claude "Intention Engine" avec mémoire contextuelle,
                 3 actions (TRI_NOTION / EXECUTE_APP / CONVERSER) et
                 anti-répétition des réponses vocales.
   - Voix      : endpoint /tts optionnel (ElevenLabs) pour une voix
                 premium ; sinon le client utilise Web Speech.
   - Tri       : API Notion (PROJETS / BUSINESS / NOTES / TÂCHES).
   - Corps     : ouverture d'applications locales, 3 modes de sécurité.
   - Sécurité  : secret partagé (JARVIS_SECRET), comparaison en temps
                 constant, limite de débit, désinfection des cibles.
   - 24/7      : survit aux exceptions non gérées ; voir autostart.bat.

   Démarrage : node server.js        Config : .env (voir .env.example)
   ===================================================================== */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { exec, spawn } = require("child_process");
const { WebSocketServer } = require("ws");

/* ------------------------------------------------------------------ */
/* 0. Chargement .env (sans dépendance externe)                        */
/* ------------------------------------------------------------------ */
(function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
})();

const PORT = Number(process.env.JARVIS_PORT || 7777);
const MODEL = process.env.JARVIS_MODEL || "claude-sonnet-5";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

/* Cerveau : "auto" (CLI abonnement si dispo, sinon API, sinon local) | "cli" | "api" | "local"
   Mode "cli" = utilise le CLI Claude Code connecté (abonnement Pro/Max), SANS crédits API. */
const BRAIN = (process.env.JARVIS_BRAIN || "auto").toLowerCase();
const CLI_MODEL = process.env.JARVIS_CLI_MODEL || "sonnet";
/* Binaire CLI : sur Windows on vise le .exe directement (le .ps1/.cmd ne marche pas en spawn shell:false) */
function resolveCliBin() {
  if (process.env.JARVIS_CLI_BIN) return process.env.JARVIS_CLI_BIN;
  if (process.platform === "win32") {
    const guess = path.join(process.env.APPDATA || "", "npm", "node_modules",
      "@anthropic-ai", "claude-code", "bin", "claude.exe");
    if (fs.existsSync(guess)) return guess;
  }
  return "claude";
}
const CLI_BIN = resolveCliBin();
const CLI_AVAILABLE = CLI_BIN === "claude" || fs.existsSync(CLI_BIN);
const NOTION_TOKEN = process.env.NOTION_TOKEN || "";
const NOTION_VERSION = "2022-06-28";
const JARVIS_SECRET = process.env.JARVIS_SECRET || "";
const APP_MODE = (process.env.JARVIS_APP_MODE || "smart").toLowerCase(); // smart | dict | off
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_VOICE = process.env.ELEVENLABS_VOICE || "onwK4e9ZLuTAKqWW03F9"; // "Daniel" — grave, britannique

const NOTION_DBS = {
  "PROJETS": process.env.NOTION_DB_PROJETS || "",
  "BUSINESS": process.env.NOTION_DB_BUSINESS || "",
  "NOTES": process.env.NOTION_DB_NOTES || "",
  "TÂCHES": process.env.NOTION_DB_TACHES || ""
};

/* ------------------------------------------------------------------ */
/* 1. Sécurité — secret partagé + limite de débit                      */
/* ------------------------------------------------------------------ */
function sha256(s) { return crypto.createHash("sha256").update(String(s)).digest(); }
function safeEqual(a, b) {
  try { return crypto.timingSafeEqual(sha256(a), sha256(b)); } catch (_) { return false; }
}
function isAuthorized(key) {
  return !JARVIS_SECRET || safeEqual(key || "", JARVIS_SECRET);
}

const captureTimestamps = [];
function rateLimited() {
  const now = Date.now();
  while (captureTimestamps.length && now - captureTimestamps[0] > 60000) captureTimestamps.shift();
  if (captureTimestamps.length >= 20) return true;
  captureTimestamps.push(now);
  return false;
}

/* ------------------------------------------------------------------ */
/* 2. Journal système (console + diffusion aux clients autorisés)      */
/* ------------------------------------------------------------------ */
let wss = null;

function broadcast(obj) {
  if (!wss) return;
  const raw = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.authed) client.send(raw);
  }
}

function slog(msg, cls = "") {
  const t = new Date().toLocaleTimeString("fr-FR");
  console.log(`[${t}] ${msg.replace(/<[^>]+>/g, "")}`);
  broadcast({ type: "log", msg, cls });
}

function setState(state) { broadcast({ type: "state", state }); }

/* ------------------------------------------------------------------ */
/* 3. Mémoire contextuelle + anti-répétition                           */
/* ------------------------------------------------------------------ */
const recentCaptures = [];      // 12 dernières entrées, pour le contexte IA
const lastVoiceResponses = [];  // 8 dernières phrases, interdites de répétition

function rememberCapture(entry) {
  recentCaptures.push(entry);
  if (recentCaptures.length > 12) recentCaptures.shift();
}
function rememberVoice(v) {
  lastVoiceResponses.push(v);
  if (lastVoiceResponses.length > 8) lastVoiceResponses.shift();
}

/* ------------------------------------------------------------------ */
/* 4. CERVEAU — Claude "Intention Engine" v2                           */
/* ------------------------------------------------------------------ */
function buildSystemPrompt() {
  const now = new Date().toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
  const context = recentCaptures.length
    ? recentCaptures.map(c => `- [${c.time}] (${c.category || c.action}) ${c.text.slice(0, 120)}`).join("\n")
    : "(aucune)";
  const banned = lastVoiceResponses.length
    ? lastVoiceResponses.map(v => `- "${v}"`).join("\n")
    : "(aucune)";

  return `Tu es JARVIS, le majordome numérique privé d'Amine (tu l'appelles "Monsieur").
Nous sommes le ${now}.
Tu reçois une dictée vocale brute en français : parfois chaotique, avec hésitations, tics de langage et fautes.
Ta mission : détecter l'INTENTION puis répondre EXCLUSIVEMENT avec un objet JSON valide. Aucun texte hors du JSON, aucun markdown.

Schéma STRICT :
{
  "action": "TRI_NOTION" | "EXECUTE_APP" | "CONVERSER",
  "category": "PROJETS" | "BUSINESS" | "NOTES" | "TÂCHES" | null,
  "target": string | null,
  "clean_text": string,
  "voice_response": string
}

Choix de l'action :
1. "EXECUTE_APP" UNIQUEMENT si l'utilisateur demande explicitement d'ouvrir / lancer / démarrer une application ou un logiciel ("ouvre Spotify", "lance Premiere"). "target" = mot-clé simple minuscule de l'application. category = null.
2. "CONVERSER" si l'utilisateur te pose une question, te salue, te remercie ou discute avec toi sans rien vouloir archiver ("quelle heure il est", "qu'est-ce que tu penses de…", "salut Jarvis"). Réponds dans "voice_response" (60 mots max, précis, utile, intelligent). "clean_text" = résumé de l'échange en une ligne. category = null, target = null.
3. Sinon "TRI_NOTION" (target = null) avec "category" :
   - "TÂCHES"  : action à accomplir, rappel, rendez-vous, achat, appel, échéance.
   - "BUSINESS": argent, clients, ventes, offres, factures, stratégie commerciale.
   - "PROJETS" : idées de création, applications, vidéos, fonctionnalités, développement.
   - "NOTES"   : tout le reste (réflexions, citations, informations).

Contexte — dernières captures de la session (pour comprendre les références comme "ça", "le même client", "ajoute aussi") :
${context}

"clean_text" (TRI_NOTION) : la note reformulée en français impeccable — fautes corrigées, tics supprimés ("euh", "genre", "en fait"), TOUT le sens conservé, style concis. Résous les références grâce au contexte. Pour EXECUTE_APP : décris l'action.

"voice_response" : le flegme d'un majordome britannique brillant, façon Iron Man — esprit sec, précision, jamais servile. Une phrase (deux si CONVERSER l'exige). INTERDICTION ABSOLUE de réutiliser ou paraphraser ces formulations récentes :
${banned}
Varie réellement la structure : parfois sobre ("Bien reçu."), parfois une pointe d'esprit, parfois un détail contextuel (heure, charge de travail). Jamais deux fois le même squelette de phrase.

Le JSON doit être PARSABLE : guillemets internes échappés, pas de virgule finale.`;
}

function extractJSON(text) {
  try { return JSON.parse(text); } catch (_) { /* continue */ }
  const m = String(text).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) { /* continue */ } }
  return null;
}

function normalizeIntent(raw, originalText) {
  const intent = raw || {};
  let action = ["TRI_NOTION", "EXECUTE_APP", "CONVERSER"].includes(intent.action)
    ? intent.action : "TRI_NOTION";
  let category = String(intent.category || "").toUpperCase()
    .replace("TACHES", "TÂCHES").replace(/^NOTES.*/, "NOTES");
  if (!NOTION_DBS.hasOwnProperty(category)) category = "NOTES";
  return {
    action,
    category: action === "TRI_NOTION" ? category : null,
    target: action === "EXECUTE_APP" ? String(intent.target || "").trim() : null,
    clean_text: String(intent.clean_text || originalText).trim(),
    voice_response: String(intent.voice_response || "C'est fait, Monsieur.").trim()
  };
}

async function askClaude(text) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 900,
      temperature: 0.5,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: text }]
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API Anthropic ${res.status} : ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const answer = (data.content || []).map(b => b.text || "").join("");
  const parsed = extractJSON(answer);
  if (!parsed) throw new Error("Réponse IA non parsable en JSON : " + answer.slice(0, 200));
  return normalizeIntent(parsed, text);
}

/* CERVEAU via CLI Claude Code — utilise l'abonnement, aucun crédit API consommé.
   Lance `claude -p --output-format json`, prompt système en argument, texte via stdin. */
function askViaCLI(text) {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      "--output-format", "json",
      "--model", CLI_MODEL,
      "--append-system-prompt", buildSystemPrompt()
    ];
    const child = spawn(CLI_BIN, args, { windowsHide: true }); // shell:false => pas d'injection
    let out = "", err = "";
    const timer = setTimeout(() => { try { child.kill(); } catch (_) {} reject(new Error("CLI timeout (30s)")); }, 30000);
    child.stdout.on("data", d => (out += d));
    child.stderr.on("data", d => (err += d));
    child.on("error", e => { clearTimeout(timer); reject(new Error("CLI introuvable : " + e.message)); });
    child.on("close", () => {
      clearTimeout(timer);
      let env;
      try { env = JSON.parse(out); } catch (_) {
        return reject(new Error("Sortie CLI illisible : " + (out || err).slice(0, 200)));
      }
      if (env.is_error) {
        return reject(new Error("CLI : " + (env.result || env.subtype || "erreur inconnue")));
      }
      const parsed = extractJSON(env.result);
      if (!parsed) return reject(new Error("Intention non parsable : " + String(env.result).slice(0, 200)));
      resolve(normalizeIntent(parsed, text));
    });
    child.stdin.write(text);
    child.stdin.end();
  });
}

/* Secours local (pas de clé API / API en panne) — avec variation ------ */
const VOICE_POOLS = {
  "TÂCHES": [
    "Tâche consignée, Monsieur. Je veillerai au grain.",
    "C'est noté dans votre liste, Monsieur. Rien ne m'échappe.",
    "Ajouté à vos obligations, Monsieur. Le devoir vous attend.",
    "Une tâche de plus, Monsieur. Votre agenda vous remercie.",
    "Enregistré. Je vous le rappellerai au moment opportun, Monsieur."
  ],
  "BUSINESS": [
    "Classé dans vos affaires, Monsieur. Les empires se bâtissent ainsi.",
    "Noté au registre commercial, Monsieur.",
    "Votre business s'enrichit d'une entrée, Monsieur.",
    "Consigné, Monsieur. L'argent aime la rigueur.",
    "Archivé côté affaires. Excellente initiative, Monsieur."
  ],
  "PROJETS": [
    "Brillante idée, Monsieur. Ajoutée à vos projets.",
    "Vos projets s'étoffent, Monsieur. J'aime cette direction.",
    "Consigné au laboratoire, Monsieur.",
    "Une idée de plus au chantier, Monsieur. Prometteur.",
    "Projet enregistré. Reste à le rendre inévitable, Monsieur."
  ],
  "NOTES": [
    "Archivé, Monsieur. Rien ne se perd ici.",
    "Noté pour la postérité, Monsieur.",
    "C'est consigné dans vos notes, Monsieur.",
    "Mémorisé, Monsieur. Votre esprit peut passer à autre chose.",
    "Rangé avec soin, Monsieur."
  ],
  "APP": [
    "J'ouvre cela immédiatement, Monsieur.",
    "Lancement en cours, Monsieur.",
    "À votre service, Monsieur. Application en route.",
    "Un instant, Monsieur. Je m'en occupe."
  ]
};
function pickVoice(pool) {
  const candidates = VOICE_POOLS[pool].filter(v => !lastVoiceResponses.includes(v));
  const list = candidates.length ? candidates : VOICE_POOLS[pool];
  return list[Math.floor(Math.random() * list.length)];
}

function fallbackIntent(text) {
  const app = text.match(/\b(?:ouvre|ouvrir|lance|lancer|démarre|démarrer|exécute)\s+(?:le |la |les |l'|mon |ma |une |un )?([\p{L}\d .+-]{2,40})/iu);
  if (app) {
    const target = app[1].trim().toLowerCase();
    return normalizeIntent({
      action: "EXECUTE_APP", target,
      clean_text: `Ouverture de ${target}`,
      voice_response: pickVoice("APP")
    }, text);
  }
  if (/^\s*(salut|bonjour|bonsoir|hey|yo|merci|ça va|quelle heure)/i.test(text)) {
    return normalizeIntent({
      action: "CONVERSER",
      clean_text: "Salutations échangées",
      voice_response: `Bonsoir Monsieur. Il est ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}, et tous mes systèmes sont au vert.`
    }, text);
  }
  const RULES = [
    { cat: "TÂCHES", rx: /\b(faire|appeler|acheter|payer|envoyer|rappeler|réserver|rendez[- ]vous|demain|urgent|deadline)\b/i },
    { cat: "BUSINESS", rx: /\b(client|vente|vendre|marge|prix|tarif|business|marché|revenu|facture|offre|prospect|argent|euros?|monétiser|chiffre)\b/i },
    { cat: "PROJETS", rx: /\b(projet|app|application|site|logiciel|feature|fonctionnalité|prototype|design|coder|développer|jarvis|vidéo|montage|créer|construire)\b/i }
  ];
  let category = "NOTES";
  for (const r of RULES) if (r.rx.test(text)) { category = r.cat; break; }
  return normalizeIntent({
    action: "TRI_NOTION", category,
    clean_text: text.trim(),
    voice_response: pickVoice(category)
  }, text);
}

/* ------------------------------------------------------------------ */
/* 5. DESTINATION — Notion                                             */
/* ------------------------------------------------------------------ */
const titlePropCache = new Map();

async function notionFetch(endpoint, options = {}) {
  const res = await fetch("https://api.notion.com/v1" + endpoint, {
    ...options,
    headers: {
      "content-type": "application/json",
      "authorization": "Bearer " + NOTION_TOKEN,
      "Notion-Version": NOTION_VERSION,
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`API Notion ${res.status} : ${(data.message || "").slice(0, 200)}`);
  return data;
}

async function getTitleProp(dbId) {
  if (titlePropCache.has(dbId)) return titlePropCache.get(dbId);
  const db = await notionFetch("/databases/" + dbId);
  const name = Object.entries(db.properties || {})
    .find(([, p]) => p.type === "title")?.[0] || "Name";
  titlePropCache.set(dbId, name);
  return name;
}

async function createNotionPage(category, cleanText, rawText) {
  const dbId = NOTION_DBS[category];
  if (!NOTION_TOKEN || !dbId) return { simulated: true, category };
  const titleProp = await getTitleProp(dbId);
  const page = await notionFetch("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties: {
        [titleProp]: { title: [{ text: { content: cleanText.slice(0, 200) } }] }
      },
      children: [
        {
          object: "block", type: "paragraph",
          paragraph: { rich_text: [{ text: { content: cleanText.slice(0, 1900) } }] }
        },
        {
          object: "block", type: "quote",
          quote: { rich_text: [{ text: { content: "Dictée brute : " + rawText.slice(0, 1800) } }] }
        }
      ]
    })
  });
  return { simulated: false, category, url: page.url || null, id: page.id };
}

/* ------------------------------------------------------------------ */
/* 6. OMNIPOTENCE LOCALE — ouverture d'applications                    */
/* ------------------------------------------------------------------ */
const IS_WIN = process.platform === "win32";
const IS_MAC = process.platform === "darwin";

const APP_DICTIONARY = IS_WIN ? {
  "notepad": "notepad.exe", "bloc-notes": "notepad.exe", "bloc notes": "notepad.exe",
  "calculatrice": "calc.exe", "calc": "calc.exe",
  "paint": "mspaint.exe",
  "explorateur": "explorer.exe", "explorer": "explorer.exe", "fichiers": "explorer.exe",
  "chrome": "chrome", "navigateur": "chrome",
  "edge": "msedge",
  "spotify": "spotify:",
  "premiere": "\"C:\\Program Files\\Adobe\\Adobe Premiere Pro 2020\\Adobe Premiere Pro.exe\"",
  "premiere pro": "\"C:\\Program Files\\Adobe\\Adobe Premiere Pro 2020\\Adobe Premiere Pro.exe\"",
  "code": "code", "vscode": "code", "vs code": "code",
  "terminal": "wt.exe", "cmd": "cmd.exe",
  "parametres": "ms-settings:", "paramètres": "ms-settings:"
} : IS_MAC ? {
  "safari": "Safari", "notes": "Notes", "musique": "Music", "music": "Music",
  "terminal": "Terminal", "finder": "Finder", "calculatrice": "Calculator",
  "chrome": "Google Chrome", "spotify": "Spotify", "premiere": "Adobe Premiere Pro",
  "code": "Visual Studio Code", "vscode": "Visual Studio Code"
} : {};

function execP(cmd) {
  return new Promise(resolve => {
    exec(cmd, { windowsHide: true, timeout: 15000 }, (err, stdout, stderr) =>
      resolve({ err, stdout: String(stdout || "").trim(), stderr: String(stderr || "").trim() }));
  });
}

/* Neutralise tout caractère dangereux avant interpolation shell */
function sanitizeTarget(t) {
  return String(t || "").replace(/[^\p{L}\p{N} ._+-]/gu, "").trim().slice(0, 64);
}

async function executeLocalApp(rawTarget) {
  if (APP_MODE === "off") {
    return { ok: false, method: "désactivé", detail: "JARVIS_APP_MODE=off — contrôle du PC désactivé" };
  }
  const target = sanitizeTarget(rawTarget);
  if (!target) return { ok: false, method: "aucune", detail: "cible vide ou invalide" };
  const key = target.toLowerCase();

  /* 6a. Dictionnaire fixe */
  if (APP_DICTIONARY[key]) {
    const cmd = APP_DICTIONARY[key];
    const r = IS_WIN
      ? await execP(`start "" ${cmd.startsWith("\"") ? cmd : `"${cmd}"`}`)
      : IS_MAC
        ? await execP(`open -a "${cmd}"`)
        : await execP(`${cmd} >/dev/null 2>&1 &`);
    if (!r.err) return { ok: true, method: "dictionnaire", detail: cmd };
  }
  if (APP_MODE === "dict") {
    return { ok: false, method: "dictionnaire strict", detail: `« ${target} » absent du dictionnaire (JARVIS_APP_MODE=dict)` };
  }

  if (IS_WIN) {
    /* 6b. Exécutable dans le PATH */
    const w = await execP(`where.exe ${key.replace(/ /g, "")} 2>nul`);
    if (!w.err && w.stdout) {
      const exePath = w.stdout.split(/\r?\n/)[0];
      const r = await execP(`start "" "${exePath}"`);
      if (!r.err) return { ok: true, method: "PATH", detail: exePath };
    }

    /* 6c. Applications du menu Démarrer (classiques + UWP) */
    const ps1 = [
      "$a = Get-StartApps | Where-Object { $_.Name -like '*" + key + "*' } | Select-Object -First 1;",
      "if ($a) { Start-Process ('shell:AppsFolder\\' + $a.AppID); Write-Output $a.Name } else { exit 1 }"
    ].join(" ");
    const g = await execP(`powershell -NoProfile -NonInteractive -Command "${ps1.replace(/"/g, '\\"')}"`);
    if (!g.err && g.stdout) return { ok: true, method: "menu Démarrer", detail: g.stdout };

    /* 6d. Raccourcis .lnk du menu Démarrer */
    const ps2 = [
      "$dirs = @(\"$env:ProgramData\\Microsoft\\Windows\\Start Menu\", \"$env:AppData\\Microsoft\\Windows\\Start Menu\");",
      "$l = Get-ChildItem -Path $dirs -Recurse -Filter *.lnk -ErrorAction SilentlyContinue |",
      "Where-Object { $_.BaseName -like '*" + key + "*' } | Select-Object -First 1;",
      "if ($l) { Start-Process $l.FullName; Write-Output $l.BaseName } else { exit 1 }"
    ].join(" ");
    const l = await execP(`powershell -NoProfile -NonInteractive -Command "${ps2.replace(/"/g, '\\"')}"`);
    if (!l.err && l.stdout) return { ok: true, method: "raccourci .lnk", detail: l.stdout };

    /* 6e. Dernier recours : alias / protocole shell */
    const s = await execP(`start "" "${key}"`);
    if (!s.err) return { ok: true, method: "shell start", detail: key };

  } else if (IS_MAC) {
    const o = await execP(`open -a "${target}"`);
    if (!o.err) return { ok: true, method: "open -a", detail: target };
    const md = await execP(`mdfind "kMDItemContentType=='com.apple.application-bundle' && kMDItemDisplayName=='*${target}*'c" | head -1`);
    if (!md.err && md.stdout) {
      const r = await execP(`open "${md.stdout.split("\n")[0]}"`);
      if (!r.err) return { ok: true, method: "Spotlight", detail: md.stdout.split("\n")[0] };
    }
  } else {
    const r = await execP(`nohup ${key.replace(/ /g, "")} >/dev/null 2>&1 & disown`);
    if (!r.err) return { ok: true, method: "shell", detail: key };
  }

  return { ok: false, method: "épuisées", detail: `« ${target} » introuvable sur cette machine` };
}

/* ------------------------------------------------------------------ */
/* 7. PIPELINE DE CAPTURE                                              */
/* ------------------------------------------------------------------ */
async function handleCapture(text) {
  if (rateLimited()) {
    slog("SÉCURITÉ ▸ LIMITE DE DÉBIT ATTEINTE (20/min) — CAPTURE IGNORÉE", "err");
    return;
  }
  setState("processing");
  slog(`RÉCEPTION FLUX BRUT (${text.length} car.)`);

  /* Choix du cerveau : CLI (abonnement) > API (crédits) > local (gratuit, hors-ligne) */
  const useCLI = (BRAIN === "cli") || (BRAIN === "auto" && CLI_AVAILABLE);
  const useAPI = (BRAIN === "api") || (BRAIN === "auto" && !CLI_AVAILABLE && !!ANTHROPIC_API_KEY);

  let intent, engine;
  if (BRAIN === "local") {
    engine = "LOCAL (forcé)";
    intent = fallbackIntent(text);
  } else if (useCLI) {
    try {
      intent = await askViaCLI(text);
      engine = `CLI ABONNEMENT (${CLI_MODEL})`;
    } catch (e) {
      slog("IA CLI ▸ ERREUR : " + e.message, "err");
      if (ANTHROPIC_API_KEY && BRAIN === "auto") {
        try { intent = await askClaude(text); engine = "API (secours)"; }
        catch (e2) { slog("IA API ▸ ERREUR : " + e2.message, "err"); engine = "LOCAL (secours)"; intent = fallbackIntent(text); }
      } else {
        engine = "LOCAL (secours)";
        intent = fallbackIntent(text);
      }
    }
  } else if (useAPI) {
    try {
      intent = await askClaude(text);
      engine = "API (crédits)";
    } catch (e) {
      slog("IA API ▸ ERREUR : " + e.message, "err");
      engine = "LOCAL (secours)";
      intent = fallbackIntent(text);
    }
  } else {
    engine = "LOCAL (aucun cerveau configuré)";
    intent = fallbackIntent(text);
  }
  slog(`IA [${engine}] ▸ ACTION: ${intent.action}` +
    (intent.category ? ` · CATÉGORIE: ${intent.category}` : "") +
    (intent.target ? ` · CIBLE: ${intent.target}` : ""), "cat-line");

  const outcome = { notion: null, app: null };

  if (intent.action === "EXECUTE_APP") {
    slog(`SYSTÈME ▸ TENTATIVE D'OUVERTURE : « ${intent.target} » (mode ${APP_MODE})`);
    outcome.app = await executeLocalApp(intent.target);
    if (outcome.app.ok) {
      slog(`SYSTÈME ▸ OUVERT via ${outcome.app.method} — OK`, "ok-line");
    } else {
      slog(`SYSTÈME ▸ ÉCHEC (${outcome.app.detail})`, "err");
      intent.voice_response = `Navré Monsieur, je ne trouve pas ${intent.target} sur cette machine.`;
    }
  } else if (intent.action === "CONVERSER") {
    slog("CONVERSATION ▸ RÉPONSE DIRECTE, RIEN N'EST ARCHIVÉ", "ok-line");
  } else {
    try {
      outcome.notion = await createNotionPage(intent.category, intent.clean_text, text);
      slog(outcome.notion.simulated
        ? `NOTION ▸ SIMULATION (base « ${intent.category} » non configurée)`
        : `NOTION ▸ PAGE CRÉÉE DANS « ${intent.category} » — OK`,
        outcome.notion.simulated ? "cat-line" : "ok-line");
    } catch (e) {
      slog("NOTION ▸ ERREUR : " + e.message, "err");
      outcome.notion = { simulated: true, category: intent.category, error: e.message };
      intent.voice_response = "La note est analysée Monsieur, mais Notion ne répond pas. Je la garde au chaud.";
    }
  }

  rememberCapture({
    text: intent.clean_text, category: intent.category, action: intent.action,
    time: new Date().toLocaleTimeString("fr-FR")
  });
  rememberVoice(intent.voice_response);

  broadcast({ type: "result", intent, outcome });
  setState("synced");
  setTimeout(() => setState("idle"), 2600);
}

/* ------------------------------------------------------------------ */
/* 8. VOIX PREMIUM — endpoint /tts (ElevenLabs, optionnel)             */
/* ------------------------------------------------------------------ */
async function handleTTS(req, res, urlObj) {
  const key = urlObj.searchParams.get("key") || "";
  if (!isAuthorized(key)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    return res.end("403 — clé invalide");
  }
  const text = (urlObj.searchParams.get("text") || "").slice(0, 500);
  if (!ELEVENLABS_API_KEY || !text) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    return res.end("TTS premium non configuré");
  }
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "content-type": "application/json", "xi-api-key": ELEVENLABS_API_KEY },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true }
      })
    });
    if (!r.ok) throw new Error("ElevenLabs " + r.status);
    const audio = Buffer.from(await r.arrayBuffer());
    res.writeHead(200, { "content-type": "audio/mpeg", "content-length": audio.length, "cache-control": "no-store" });
    res.end(audio);
  } catch (e) {
    slog("TTS ▸ ERREUR ELEVENLABS : " + e.message, "err");
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("TTS premium indisponible");
  }
}

/* ------------------------------------------------------------------ */
/* 9. SERVEUR HTTP                                                     */
/* ------------------------------------------------------------------ */
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json"
};

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (urlObj.pathname === "/tts") return void handleTTS(req, res, urlObj);

  let file = urlObj.pathname;
  if (file === "/" || file === "/index.html") file = "/Jarvis.html";
  const full = path.join(__dirname, path.normalize(file).replace(/^([/\\])+/, ""));
  if (!full.startsWith(__dirname) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    return res.end("404 — JARVIS ne connaît pas cette route.");
  }
  res.writeHead(200, { "content-type": MIME[path.extname(full)] || "application/octet-stream" });
  fs.createReadStream(full).pipe(res);
});

/* ------------------------------------------------------------------ */
/* 10. WEBSOCKET (avec authentification si JARVIS_SECRET défini)       */
/* ------------------------------------------------------------------ */
wss = new WebSocketServer({ server });

function lanAddresses() {
  const out = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const i of ifaces || []) {
      if (i.family === "IPv4" && !i.internal) out.push(i.address);
    }
  }
  return out;
}

function helloPayload() {
  return {
    type: "hello",
    engine: BRAIN === "local" ? "LOCAL (forcé)"
      : (BRAIN === "cli" || (BRAIN === "auto" && CLI_AVAILABLE)) ? `CLI ABONNEMENT (${CLI_MODEL})`
      : ANTHROPIC_API_KEY ? `API (${MODEL})`
      : "LOCAL — NI CLI NI CLÉ",
    notion: NOTION_TOKEN ? "CONNECTÉ" : "SIMULATION",
    premiumTTS: !!ELEVENLABS_API_KEY,
    appMode: APP_MODE,
    lan: lanAddresses().map(ip => `http://${ip}:${PORT}`),
    state: "idle"
  };
}

wss.on("connection", (ws, req) => {
  const from = req.socket.remoteAddress;
  ws.authed = !JARVIS_SECRET;

  if (ws.authed) {
    slog(`LIAISON ▸ CLIENT CONNECTÉ (${from}) — ${wss.clients.size} actif(s)`);
    ws.send(JSON.stringify(helloPayload()));
  } else {
    console.log(`[auth] connexion en attente de clé (${from})`);
    ws.send(JSON.stringify({ type: "auth-required" }));
  }

  ws.on("message", raw => {
    if (raw.length > 16384) return;
    let msg;
    try { msg = JSON.parse(raw); } catch (_) { return; }

    if (msg.type === "auth") {
      if (isAuthorized(msg.key)) {
        ws.authed = true;
        ws.send(JSON.stringify({ type: "auth-ok" }));
        ws.send(JSON.stringify(helloPayload()));
        slog(`LIAISON ▸ CLIENT AUTHENTIFIÉ (${from}) — ${wss.clients.size} actif(s)`, "ok-line");
      } else {
        ws.send(JSON.stringify({ type: "auth-fail" }));
        console.log(`[auth] clé refusée (${from})`);
      }
      return;
    }

    if (!ws.authed) { ws.send(JSON.stringify({ type: "auth-required" })); return; }

    if (msg.type === "capture" && typeof msg.text === "string" && msg.text.trim()) {
      handleCapture(msg.text.trim().slice(0, 4000)).catch(e => {
        slog("PIPELINE ▸ ERREUR FATALE : " + e.message, "err");
        setState("idle");
      });
    } else if (msg.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
    }
  });

  ws.on("close", () => {
    if (ws.authed) slog(`LIAISON ▸ CLIENT DÉCONNECTÉ — ${wss.clients.size} actif(s)`);
  });
});

/* ------------------------------------------------------------------ */
/* 11. ROBUSTESSE 24/7 + DÉMARRAGE                                     */
/* ------------------------------------------------------------------ */
process.on("uncaughtException", e => {
  console.error("[FATAL évité]", e.message);
  try { slog("SYSTÈME ▸ EXCEPTION INTERCEPTÉE : " + e.message, "err"); } catch (_) {}
});
process.on("unhandledRejection", e => {
  console.error("[REJET évité]", e && e.message ? e.message : e);
});

server.listen(PORT, "0.0.0.0", () => {
  const ips = lanAddresses();
  console.log("");
  console.log("  ╔══════════════════════════════════════════════════╗");
  console.log("  ║       J.A.R.V.I.S v0.3 — SERVEUR OPÉRATIONNEL    ║");
  console.log("  ╚══════════════════════════════════════════════════╝");
  console.log(`  PC        : http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  Smartphone: http://${ip}:${PORT}  (même Wi-Fi)`));
  const brainDesc = BRAIN === "local" ? "LOCAL (forcé)"
    : (BRAIN === "cli" || (BRAIN === "auto" && CLI_AVAILABLE)) ? `CLI ABONNEMENT (${CLI_MODEL}) — ${CLI_BIN}`
    : ANTHROPIC_API_KEY ? "API crédits — " + MODEL
    : "MODE DÉGRADÉ (ni CLI ni clé API)";
  console.log(`  Cerveau   : ${brainDesc}`);
  console.log(`  Notion    : ${NOTION_TOKEN ? "token présent" : "SIMULATION (NOTION_TOKEN absent)"}`);
  console.log(`  Voix      : ${ELEVENLABS_API_KEY ? "ElevenLabs (premium)" : "Web Speech (navigateur)"}`);
  console.log(`  Sécurité  : ${JARVIS_SECRET ? "secret requis" : "AUCUN SECRET (JARVIS_SECRET vide)"} · apps: ${APP_MODE}`);
  console.log("");
});
