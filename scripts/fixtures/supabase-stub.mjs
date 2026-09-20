/**
 * DOUBLURE LOCALE DE L'API REST SUPABASE — pour le calendrier économique
 * uniquement, et uniquement le temps d'une session de capture.
 *
 * ── POURQUOI ELLE EXISTE ──────────────────────────────────────────────────
 *
 * Tout le reste du harnais intercepte Supabase DANS LE NAVIGATEUR
 * (`ctx.route`, voir `scripts/capture-product.mjs`). Le calendrier, lui, ne
 * passe pas par le navigateur : `fetchEconomicCalendar` est une fonction
 * SERVEUR, elle interroge Supabase depuis Node, avec sa propre clé. Une
 * interception côté navigateur ne la voit donc jamais.
 *
 * La première tentative a essayé d'intercepter la réponse de la fonction
 * serveur et d'y glisser les lignes. Deux raisons de l'abandonner :
 *   1. l'appel part en GET avec la charge dans l'URL, pas en POST — le
 *      gabarit ne se déclenchait jamais, et la capture est partie avec un
 *      bandeau « Live calendar unavailable » en travers ;
 *   2. la réponse est sérialisée par seroval, pas en JSON nu. La réécrire
 *      revient à réimplémenter un format interne du framework, qui changera.
 *
 * Cette doublure attaque le problème d'un cran plus bas : on ne touche plus
 * à la réponse, on donne à la fonction serveur une base qu'elle peut LIRE.
 * Le code applicatif s'exécute en entier, inchangé, et rend exactement ce
 * qu'il rendrait en production.
 *
 * ── LES DONNÉES SONT VRAIES ───────────────────────────────────────────────
 *
 * `economic-events.json` est un export de la table `economic_events` de la
 * base de production. Rien n'est inventé : seul le chemin réseau est local,
 * parce que le conteneur qui produit les captures n'a pas le droit de sortir.
 *
 * ── USAGE ─────────────────────────────────────────────────────────────────
 *
 *   node scripts/fixtures/supabase-stub.mjs &            # écoute sur :5199
 *   SUPABASE_URL=http://127.0.0.1:5199 \
 *   SUPABASE_PUBLISHABLE_KEY=stub bunx vite dev --port 5181
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const PORT = Number(process.env.STUB_PORT ?? 5199);
const EVENEMENTS = JSON.parse(
  readFileSync(new URL("./economic-events.json", import.meta.url), "utf-8"),
);

/** `starts_at=gte.2026-09-20T00:00:00.000Z` → { op: "gte", valeur: "…" } */
function filtres(params, colonne) {
  return params.getAll(colonne).map((brut) => {
    const i = brut.indexOf(".");
    return { op: brut.slice(0, i), valeur: brut.slice(i + 1) };
  });
}

const serveur = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const envoyer = (corps) => {
    res.writeHead(200, {
      "content-type": "application/json",
      "content-range": "0-0/*",
      "access-control-allow-origin": "*",
    });
    res.end(JSON.stringify(corps));
  };

  if (url.pathname === "/rest/v1/economic_events") {
    let lignes = EVENEMENTS;
    for (const { op, valeur } of filtres(url.searchParams, "starts_at")) {
      const borne = Date.parse(valeur);
      lignes = lignes.filter((e) => {
        const t = Date.parse(e.starts_at);
        return op === "gte" ? t >= borne : op === "lt" ? t < borne : true;
      });
    }
    lignes = [...lignes].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
    console.log(`[stub] economic_events → ${lignes.length} lignes`);
    return envoyer(lignes);
  }

  if (url.pathname === "/rest/v1/economic_calendar_sync") {
    /* `maybeSingle()` envoie `Accept: application/vnd.pgrst.object+json` et
       attend UN objet, pas un tableau. Répondre un tableau ferait échouer le
       parse et la page afficherait « périmé » sans raison. */
    const seul = (req.headers.accept ?? "").includes("vnd.pgrst.object");
    const ligne = { last_success_at: new Date().toISOString(), last_error: null };
    return envoyer(seul ? ligne : [ligne]);
  }

  console.log(`[stub] 404 ${req.method} ${url.pathname}`);
  res.writeHead(404, { "content-type": "application/json" });
  res.end("{}");
});

serveur.listen(PORT, "127.0.0.1", () => {
  console.log(
    `[stub] doublure Supabase sur http://127.0.0.1:${PORT} (${EVENEMENTS.length} lignes)`,
  );
});
