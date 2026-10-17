import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { numericText } from "../NumericText";

test("les nombres d'une phrase gardent texte, séparateurs, liens et emphase sans double balisage", () => {
  const html = renderToStaticMarkup(
    <p>
      {numericText(
        <>
          NQ : <strong>+$1,234.50</strong> à 09:47, <a href="/journal?day=2026-10-17">17/10/2026</a>{" "}
          ; risque 0,5%.
        </>,
      )}
    </p>,
  );
  expect(html.replace(/<span class="tv-num">(.*?)<\/span>/g, "$1")).toBe(
    '<p>NQ : <strong>+$1,234.50</strong> à 09:47, <a href="/journal?day=2026-10-17">17/10/2026</a> ; risque 0,5%.</p>',
  );
  expect(html).toContain('tv-num">09:47</span>');
  expect(html).toContain('tv-num">0,5%</span>');
  expect(renderToStaticMarkup(<>{numericText(<span className="tv-num">42</span>)}</>)).toBe(
    '<span class="tv-num">42</span>',
  );
});

test("les chiffres et séparateurs localisés restent intacts", () => {
  const html = renderToStaticMarkup(<p>{numericText("المخاطرة ٠٫٥٪ · ١٢:٣٠")}</p>);
  expect(html).toContain('<span class="tv-num">٠٫٥٪</span>');
  expect(html).toContain('tv-num">١٢:٣٠</span>');
  expect(html.replace(/<span class="tv-num">(.*?)<\/span>/g, "$1")).toBe(
    "<p>المخاطرة ٠٫٥٪ · ١٢:٣٠</p>",
  );
});
