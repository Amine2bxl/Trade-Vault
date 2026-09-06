import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingLangProvider, useLandingT, tr } from "../src/app/pages/landing/i18n";
import { SSR_LANG } from "../src/shared/lang";

/**
 * `/fr` DOIT RENDRE DU FRANÇAIS AU PREMIER RENDU — celui du SERVEUR.
 *
 * C'est l'invariant dont dépend toute l'ouverture du site au français, et le
 * seul que les tests de structure ne peuvent pas atteindre : ils lisent la
 * source, pas le rendu.
 *
 * Le mode d'échec est particulièrement vicieux, parce qu'un humain ne le voit
 * jamais. Si `pinned` n'était pas appliqué à l'ÉTAT INITIAL — s'il n'arrivait
 * que dans un effet, par exemple — alors :
 *
 *   • un visiteur verrait quand même du français, l'effet s'exécutant avant la
 *     première peinture. La page paraîtrait parfaite.
 *   • un robot d'indexation, lui, recevrait le HTML SERVI : de l'anglais, sous
 *     un `<html lang="fr">`, un canonical `/fr` et un `hreflang="fr"`.
 *
 * Autrement dit : deux pages anglaises identiques déclarées comme des
 * traductions l'une de l'autre. C'est du contenu dupliqué revendiqué comme du
 * multilingue — strictement pire que de n'avoir jamais créé `/fr`.
 *
 * `renderToStaticMarkup` rend exactement ce que le serveur envoie : pas
 * d'effet, pas de `useLayoutEffect`, pas d'hydratation. C'est donc précisément
 * ce que lit un moteur.
 */

function Probe() {
  const { t, lang } = useLandingT();
  return (
    <p data-lang={lang}>
      {t("hero.sub")} · {t("faq.q1")} · {t("footer.r1")}
    </p>
  );
}

const render = (pinned?: "en" | "fr") =>
  renderToStaticMarkup(
    <LandingLangProvider pinned={pinned}>
      <Probe />
    </LandingLangProvider>,
  );

/** Le texte tel qu'il ATTERRIT dans le HTML. React échappe les apostrophes en
 *  `&#x27;` — et le français en est plein (« c'est », « l'offre »). Comparer la
 *  chaîne brute du dictionnaire au balisage rendu échouerait donc sur la
 *  moitié des clés, pour une raison qui n'a rien à voir avec la langue. */
const escaped = (lang: "en" | "fr", key: Parameters<typeof tr>[1]) =>
  tr(lang, key).replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

describe("la langue du rendu SERVEUR de la vitrine", () => {
  test('`pinned="fr"` sert du français, sans attendre le moindre effet', () => {
    const html = render("fr");
    expect(html).toContain('data-lang="fr"');
    expect(html).toContain(escaped("fr", "hero.sub"));
    expect(html).toContain(escaped("fr", "faq.q1"));
  });

  test("sans `pinned`, le rendu serveur reste celui de `SSR_LANG`", () => {
    // `/` ne doit PAS basculer côté serveur : le premier rendu doit être
    // identique des deux côtés, sinon l'hydratation diverge. La préférence
    // enregistrée du visiteur ne s'applique qu'ensuite, dans le navigateur.
    const html = render();
    expect(html).toContain(`data-lang="${SSR_LANG}"`);
    expect(html).toContain(escaped(SSR_LANG, "hero.sub"));
  });

  test("les deux rendus DIFFÈRENT réellement", () => {
    // Le garde-fou du garde-fou : si le dictionnaire français retombait sur
    // l'anglais, les deux tests ci-dessus passeraient tous les deux et `/fr`
    // servirait quand même de l'anglais.
    expect(render("fr")).not.toBe(render("en"));
  });
});
