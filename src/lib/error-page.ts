// Branded, self-contained 500 page rendered by the server entry when SSR
// itself fails (so it must not depend on any app bundle). Mirrors the
// in-app 404/500 identity: dark TradeVault backdrop, drifting glow orbs,
// an animated equity line, glitch code and clear navigation.
export function renderErrorPage(status = 500, title?: string, message?: string): string {
  const code = String(status);
  const heading = title ?? "Something broke on our end";
  const sub =
    message ??
    "A gear slipped while loading this page. Your data is safe — refresh, or head back to your dashboard.";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${code} · TradeVault</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { --bg:#060810; --accent:#22d3ee; --accent2:#14b8a6; }
      * { box-sizing: border-box; }
      html,body { margin:0; height:100%; }
      body {
        font: 15px/1.6 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
        color:#e2e8f0; background:
          radial-gradient(1000px 700px at 80% -10%, rgba(34,211,238,.08), transparent 60%),
          linear-gradient(160deg,#05070a 0%,#0a0f1e 55%,#05080c 100%);
        display:grid; place-items:center; min-height:100dvh; padding:1.5rem;
        overflow:hidden; position:relative; -webkit-font-smoothing:antialiased;
      }
      .orb { position:fixed; border-radius:50%; filter:blur(80px); opacity:.5; pointer-events:none; }
      .orb.a { width:460px; height:460px; background:#0891b2; top:-160px; left:-140px; animation:drift 14s ease-in-out infinite; }
      .orb.b { width:380px; height:380px; background:#0d9488; bottom:-140px; right:-120px; animation:drift 18s ease-in-out infinite reverse; }
      @keyframes drift { 0%,100%{transform:translate(0,0)} 50%{transform:translate(40px,30px)} }
      .card { position:relative; z-index:1; text-align:center; max-width:32rem; width:100%; animation:rise .6s cubic-bezier(.16,1,.3,1) both; }
      @keyframes rise { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
      .code {
        font-weight:800; font-size:clamp(5rem,22vw,9rem); line-height:1; letter-spacing:-.04em;
        background:linear-gradient(180deg,#fff,#64748b); -webkit-background-clip:text; background-clip:text; color:transparent;
        position:relative; margin-bottom:.5rem;
      }
      .code::before, .code::after {
        content:"${code}"; position:absolute; inset:0; -webkit-background-clip:text; background-clip:text; color:transparent;
        mix-blend-mode:screen;
      }
      .code::before { background:linear-gradient(180deg,#22d3ee,#0891b2); animation:g1 3s steps(2) infinite; }
      .code::after { background:linear-gradient(180deg,#f43f5e,#be123c); animation:g2 3.4s steps(2) infinite; }
      @keyframes g1 { 0%,92%,100%{opacity:0;transform:translate(0)} 94%{opacity:.5;transform:translate(-3px,1px)} 96%{transform:translate(2px,-1px)} }
      @keyframes g2 { 0%,90%,100%{opacity:0;transform:translate(0)} 93%{opacity:.4;transform:translate(3px,-1px)} 97%{transform:translate(-2px,1px)} }
      svg.spark { width:200px; max-width:60%; height:44px; margin:0 auto 1.5rem; display:block; opacity:.9; }
      svg.spark path { stroke-dasharray:400; stroke-dashoffset:400; animation:draw 2.2s ease forwards .3s; }
      @keyframes draw { to { stroke-dashoffset:0; } }
      h1 { font-size:1.35rem; font-weight:700; color:#fff; margin:0 0 .5rem; letter-spacing:-.02em; }
      p { color:#94a3b8; margin:0 auto 1.75rem; max-width:26rem; font-size:.9rem; }
      .actions { display:flex; gap:.6rem; justify-content:center; flex-wrap:wrap; }
      a,button { font:inherit; font-weight:600; font-size:.875rem; padding:.7rem 1.25rem; border-radius:.75rem; cursor:pointer; text-decoration:none; border:1px solid transparent; transition:all .2s ease; }
      .primary { background:linear-gradient(90deg,var(--accent),var(--accent2)); color:#04121a; box-shadow:0 8px 24px -8px rgba(34,211,238,.5); }
      .primary:hover { filter:brightness(1.08); transform:translateY(-1px); }
      .secondary { background:rgba(255,255,255,.04); color:#e2e8f0; border-color:rgba(255,255,255,.1); }
      .secondary:hover { background:rgba(255,255,255,.08); }
      .brand { display:flex; align-items:center; justify-content:center; gap:.5rem; margin-bottom:2rem; opacity:.85; }
      .brand .dot { width:10px; height:10px; border-radius:50%; background:linear-gradient(135deg,var(--accent),var(--accent2)); box-shadow:0 0 12px rgba(34,211,238,.6); }
      .brand span { font-weight:700; letter-spacing:-.01em; color:#fff; font-size:.95rem; }
    </style>
  </head>
  <body>
    <div class="orb a"></div><div class="orb b"></div>
    <div class="card">
      <div class="brand"><span class="dot"></span><span>TradeVault</span></div>
      <div class="code" aria-hidden="true">${code}</div>
      <svg class="spark" viewBox="0 0 200 44" fill="none" aria-hidden="true">
        <path d="M2 34 L28 30 L46 36 L70 14 L96 22 L120 8 L150 26 L176 12 L198 20"
          stroke="url(#lg)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <defs><linearGradient id="lg" x1="0" y1="0" x2="200" y2="0">
          <stop stop-color="#22d3ee"/><stop offset="1" stop-color="#14b8a6"/>
        </linearGradient></defs>
      </svg>
      <h1>${heading}</h1>
      <p>${sub}</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Back to dashboard</a>
      </div>
    </div>
  </body>
</html>`;
}
