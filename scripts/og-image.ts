/**
 * Régénère `public/og-image.png` depuis `public/og-image.svg`.
 *
 *     bun scripts/og-image.ts [chemin/vers/chrome]
 *
 * ── POURQUOI UN PNG ─────────────────────────────────────────────────────────
 *
 * `og:image` doit être une image RASTER : aucun moissonneur social ne rend le
 * SVG — ni Facebook, ni LinkedIn, ni X, ni Slack, ni Discord. Un `og-image.svg`
 * aux bonnes dimensions dormait dans `public/` et n'aurait de toute façon
 * jamais pu s'afficher. Le SVG reste la SOURCE, versionnée à côté du PNG, pour
 * que la carte se remodifie sans repartir d'un éditeur d'image.
 *
 * ── POURQUOI PAS UNE DÉPENDANCE ─────────────────────────────────────────────
 *
 * Ajouter `sharp` ou `resvg` pour produire une image une fois tous les six mois
 * ferait payer à chaque installation, à chaque build et à chaque audit de
 * sécurité le prix d'un outil qui ne sert jamais à l'exécution. Chromium sait
 * déjà rasteriser un SVG, et l'encodeur PNG ci-dessous tient en trente lignes
 * au-dessus de `node:zlib`.
 *
 * ── LE PIÈGE DE LA CAPTURE ──────────────────────────────────────────────────
 *
 * `--screenshot` rend une image de la taille de `--window-size`, mais ne PEINT
 * que la zone d'affichage réelle — la hauteur de fenêtre moins une réserve
 * d'environ 88 px, présente y compris en mode « headless ». Une capture
 * demandée en 1200×630 rendait donc bien un PNG de 1200×630, dont les 88
 * dernières lignes étaient vides : le bas de la carte disparaissait
 * SILENCIEUSEMENT, sans erreur ni avertissement.
 *
 * On capture donc large — assez pour que la réserve ne puisse pas mordre sur le
 * dessin, quelle que soit la version de Chromium — puis on recadre au format
 * exact. Le recadrage vérifie qu'il reste bien du dessin sous l'ancienne limite
 * de coupe, ce qui fait échouer le script si le piège revenait sous une autre
 * forme.
 */
import { spawnSync } from "node:child_process";
import { deflateSync, inflateSync } from "node:zlib";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const SVG = join(ROOT, "public/og-image.svg");
const PNG = join(ROOT, "public/og-image.png");

/** Le format des cartes sociales : 1,91:1, attendu par `summary_large_image`. */
const WIDTH = 1200;
const HEIGHT = 630;
/** Marge de capture. Bien plus large que la réserve observée (~88 px) : cette
 *  valeur n'a pas à être juste, seulement à être suffisante. */
const OVERSCAN = 400;

function findChrome(): string | null {
  const explicit = process.argv[2] ?? process.env.CHROME;
  if (explicit && existsSync(explicit)) return explicit;

  const globbed = spawnSync("sh", [
    "-c",
    "ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1",
  ]);
  const fromPlaywright = globbed.stdout.toString().trim();
  if (fromPlaywright && existsSync(fromPlaywright)) return fromPlaywright;

  for (const name of ["chromium", "chromium-browser", "google-chrome"]) {
    const which = spawnSync("sh", ["-c", `command -v ${name}`]);
    const path = which.stdout.toString().trim();
    if (path && existsSync(path)) return path;
  }
  return null;
}

/* ── Lecture d'un PNG RGB non entrelacé (ce que produit Chromium) ─────────── */

function inflatePng(buf: Buffer): { width: number; height: number; rgb: Buffer } {
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25];
  if (buf[24] !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`PNG inattendu : profondeur ${buf[24]}, type couleur ${colorType}`);
  }
  const channels = colorType === 6 ? 4 : 3;

  const chunks: Buffer[] = [];
  let pos = 8;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    if (type === "IDAT") chunks.push(buf.subarray(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(chunks));

  // Défiltrage PNG : chaque ligne porte un octet de filtre, et les filtres 1 à 4
  // se réfèrent au pixel de gauche et à la ligne du dessus.
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 3);
  let prev = Buffer.alloc(stride);
  let read = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[read++];
    const line = Buffer.from(raw.subarray(read, read + stride));
    read += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      if (filter === 1) line[x] = (line[x] + a) & 0xff;
      else if (filter === 2) line[x] = (line[x] + b) & 0xff;
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
    }
    for (let x = 0; x < width; x++) {
      out[(y * width + x) * 3] = line[x * channels];
      out[(y * width + x) * 3 + 1] = line[x * channels + 1];
      out[(y * width + x) * 3 + 2] = line[x * channels + 2];
    }
    prev = line;
  }
  return { width, height, rgb: out };
}

/* ── Écriture d'un PNG RGB ───────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 2; // RGB
  // Filtre 0 sur chaque ligne : l'image est produite une fois par semestre, les
  // quelques kilo-octets qu'un filtrage adaptatif ferait gagner ne valent pas le
  // code qu'ils coûteraient.
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ── Le script ───────────────────────────────────────────────────────────── */

const chrome = findChrome();
if (!chrome) {
  console.error(
    "Aucun binaire Chromium trouvé. Passe-le en argument :\n  bun scripts/og-image.ts /chemin/vers/chrome",
  );
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), "tv-og-"));
try {
  // Le corps n'a ni marge ni fond propre : la capture doit rendre exactement la
  // zone de dessin, sans liseré ni décalage d'un pixel.
  writeFileSync(
    join(tmp, "og.html"),
    `<!doctype html><meta charset="utf-8">` +
      `<style>html,body{margin:0;padding:0;background:#0a0b0d}svg{display:block}</style>` +
      readFileSync(SVG, "utf8"),
  );

  const shot = join(tmp, "shot.png");
  spawnSync(
    chrome,
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--window-size=${WIDTH},${HEIGHT + OVERSCAN}`,
      `--screenshot=${shot}`,
      `file://${join(tmp, "og.html")}`,
    ],
    { stdio: "ignore" },
  );
  if (!existsSync(shot)) throw new Error("Chromium n'a produit aucune capture.");

  const full = inflatePng(readFileSync(shot));
  if (full.width < WIDTH || full.height < HEIGHT) {
    throw new Error(`Capture trop petite : ${full.width}×${full.height}`);
  }

  // Recadrage au format exact, coin supérieur gauche.
  const cropped = Buffer.alloc(WIDTH * HEIGHT * 3);
  for (let y = 0; y < HEIGHT; y++) {
    full.rgb.copy(cropped, y * WIDTH * 3, y * full.width * 3, y * full.width * 3 + WIDTH * 3);
  }

  // GARDE-FOU. C'est exactement ici que le défaut passait inaperçu : un PNG aux
  // bonnes dimensions dont le bas était vide. On vérifie qu'il reste du dessin
  // sous la ligne où la capture se coupait auparavant.
  //
  // Le seuil ignore délibérément le fond ET la grille : le fond descend à
  // (10,11,13), la grille (blanc à 3,5 % d'opacité) monte à peine à ~(20,21,23),
  // et les traits VERTICAUX de cette grille traversent toute la hauteur. Les
  // compter ferait déclarer « dessinée » la dernière ligne d'une image par
  // ailleurs vide — le garde-fou validerait exactement le défaut qu'il existe
  // pour attraper. Seul du contenu réel (le texte le plus sombre est à
  // (100,116,139)) passe la barre.
  const painted = (row: number) => {
    for (let x = 0; x < WIDTH; x++) {
      const i = (row * WIDTH + x) * 3;
      if (cropped[i] > 0x30 || cropped[i + 1] > 0x30 || cropped[i + 2] > 0x30) return true;
    }
    return false;
  };
  let lastPainted = -1;
  for (let y = HEIGHT - 1; y >= 0; y--) {
    if (painted(y)) {
      lastPainted = y;
      break;
    }
  }
  // La ligne la plus basse de la carte est la mention du domaine, dont les
  // glyphes s'arrêtent vers 565. Sous 550, c'est que le bas a été rogné.
  if (lastPainted < HEIGHT - 80) {
    throw new Error(
      `Le bas de la carte est vide (dernière ligne dessinée : ${lastPainted}/${HEIGHT}). ` +
        `La zone d'affichage de Chromium a probablement encore rogné le rendu — augmente OVERSCAN.`,
    );
  }

  writeFileSync(PNG, encodePng(WIDTH, HEIGHT, cropped));
  console.log(`Écrit ${PNG} — ${WIDTH}×${HEIGHT}, dessiné jusqu'à la ligne ${lastPainted}.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
