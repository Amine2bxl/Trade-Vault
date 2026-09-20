/**
 * LA PAGE D'ERREUR SERVIE QUAND LE SSR LUI-MÊME ÉCHOUE.
 *
 * Elle ne peut dépendre d'AUCUN bundle applicatif : c'est du HTML complet,
 * avec son style en ligne. C'est aussi, par construction, la page que l'on
 * voit au pire moment — celui où quelque chose vient déjà de casser.
 *
 * ── CE QU'ELLE ÉTAIT ──────────────────────────────────────────────────────
 *
 * Cyan et sarcelle sur un fond bleu-noir : `#22d3ee`, `#14b8a6`, deux orbes
 * `#0891b2` / `#0d9488` dérivant en boucle sur un dégradé `#05070a → #0a0f1e`.
 * C'est l'identité d'AVANT la direction émeraude, et c'était la dernière
 * surface publique à la porter. Tomber en panne et changer de marque au
 * passage est la pire chose qu'une page d'erreur puisse faire : elle est
 * censée rassurer sur le fait qu'on est toujours au bon endroit.
 *
 * ── CE QU'ELLE EST ────────────────────────────────────────────────────────
 *
 * Le fond du produit (`#0a0b0d`, la même valeur que `theme-color`), l'accent
 * émeraude `#22e08a` — celui du bouton principal de la vitrine — et rien
 * d'autre. Les deux orbes dérivantes partent : deux masses qui bougent en
 * boucle derrière un message d'échec ajoutent de l'agitation à un moment où
 * l'on veut de la clarté. Reste UNE nappe fixe, très diffuse, qui pose le
 * bloc dans l'espace.
 *
 * ── LES COULEURS SONT EN DUR, ET C'EST OBLIGÉ ─────────────────────────────
 *
 * Aucune variable `--tv-*` n'est disponible ici : la feuille de styles du
 * produit fait partie du bundle qui vient d'échouer. Les valeurs sont donc
 * recopiées de `src/styles.css`, et ce commentaire est le seul lien entre
 * les deux. Changer l'accent du produit demande de repasser ici.
 */
const FOND = "#0a0b0d";
/** `--tv-accent` — l'émeraude du bouton principal de la vitrine. */
const ACCENT = "#22e08a";

export function renderErrorPage(status = 500, title?: string, message?: string): string {
  const code = String(status);
  const heading = title ?? "Something broke on our end";
  const sub =
    message ??
    "A gear slipped while loading this page. Your data is safe - refresh, or head back to TradeVault.";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${code} · TradeVault</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="${FOND}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
    <style>
      :root { --bg:${FOND}; --accent:${ACCENT};
        --font-body:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif; }
      * { box-sizing: border-box; }
      html,body { margin:0; height:100%; }
      body {
        font: 15px/1.6 var(--font-body); letter-spacing:-.01em;
        color:#d7dbe0; background:var(--bg);
        display:grid; place-items:center; min-height:100dvh; padding:1.5rem;
        overflow:hidden; position:relative; -webkit-font-smoothing:antialiased;
      }
      /* UNE nappe, fixe. Les deux orbes dérivantes faisaient bouger le fond
         d'une page qu'on n'atteint que lorsque quelque chose a déjà lâché. */
      .nappe {
        position:fixed; inset:-30% -10% auto; height:70vh; pointer-events:none;
        background:radial-gradient(55% 50% at 50% 0%, rgba(34,224,138,.10), transparent 70%);
        filter:blur(60px);
      }
      .card { position:relative; z-index:1; text-align:center; max-width:30rem; width:100%;
        animation:rise .55s cubic-bezier(.19,1,.22,1) both; }
      @keyframes rise { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      .brand { display:flex; align-items:center; justify-content:center; gap:.55rem; margin-bottom:2.5rem; }
      .brand .dot { width:9px; height:9px; border-radius:50%; background:var(--accent); }
      .brand span { font-weight:700; letter-spacing:-.01em; color:#fff; font-size:.95rem; }
      /* Le code passe de 9rem à 3.5rem. Un « 500 » haut comme la moitié de
         l'écran crie une information qui n'aide personne : ce qu'on veut
         lire, c'est ce qui s'est passé et quoi faire. Il devient une
         étiquette, en émeraude, au-dessus du titre. */
      .code {
        display:inline-block; font-weight:700; font-size:.6875rem; letter-spacing:.14em;
        text-transform:uppercase; color:var(--accent);
        border:1px solid rgba(34,224,138,.28); background:rgba(34,224,138,.07);
        border-radius:999px; padding:.3rem .7rem; margin-bottom:1.25rem;
      }
      svg.spark { width:170px; max-width:55%; height:38px; margin:0 auto 1.75rem; display:block; }
      svg.spark path { stroke-dasharray:400; stroke-dashoffset:400; animation:draw 2s cubic-bezier(.19,1,.22,1) forwards .25s; }
      @keyframes draw { to { stroke-dashoffset:0; } }
      h1 { font-size:1.45rem; font-weight:600; color:#fff; margin:0 0 .6rem; letter-spacing:-.025em; }
      p { color:#8b9099; margin:0 auto 2rem; max-width:24rem; font-size:.9rem; line-height:1.7; }
      .actions { display:flex; gap:.6rem; justify-content:center; flex-wrap:wrap; }
      a,button { font:inherit; font-weight:600; font-size:.875rem; padding:.7rem 1.35rem;
        border-radius:10px; cursor:pointer; text-decoration:none; border:1px solid transparent;
        transition:background-color .16s ease,border-color .16s ease,color .16s ease,transform .16s cubic-bezier(.16,1,.3,1); }
      /* Le MÊME bouton que « Get Started » : aplat émeraude, texte blanc,
         ombre courte sous le texte pour l'ancrer sur un vert clair. */
      .primary { background:var(--accent); color:#fff; text-shadow:0 1px 2px rgba(4,18,11,.55);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.18), 0 8px 26px -12px rgba(34,224,138,.55); }
      .primary:hover { transform:translateY(-1px); }
      .secondary { background:transparent; color:#b8bdc4; border-color:rgba(255,255,255,.14); }
      .secondary:hover { border-color:rgba(34,224,138,.45); background:rgba(34,224,138,.06); color:#fff; }

      @media (prefers-reduced-motion: reduce) {
        .card { animation:fade-in-safe .2s ease-out both; }
        svg.spark path { animation:none; stroke-dashoffset:0; }
        a,button { transition:none; }
        .primary:hover { transform:none; }
      }
      @keyframes fade-in-safe { from{opacity:0} to{opacity:1} }
    </style>
  </head>
  <body>
    <div class="nappe"></div>
    <div class="card">
      <div class="brand"><span class="dot"></span><span>TradeVault</span></div>
      <div class="code">Error ${code}</div>
      <svg class="spark" viewBox="0 0 200 44" fill="none" aria-hidden="true">
        <path d="M2 34 L28 30 L46 36 L70 14 L96 22 L120 8 L150 26 L176 12 L198 20"
          stroke="url(#lg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <defs><linearGradient id="lg" x1="0" y1="0" x2="200" y2="0">
          <stop stop-color="${ACCENT}" stop-opacity=".25"/><stop offset="1" stop-color="${ACCENT}"/>
        </linearGradient></defs>
      </svg>
      <h1>${heading}</h1>
      <p>${sub}</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Back to TradeVault</a>
      </div>
    </div>
  </body>
</html>`;
}
