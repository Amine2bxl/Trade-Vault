/* Le découpage du texte cinétique, partagé par la pub 16:9 (`Copy.tsx`) et
   les déclinaisons 9:16 (`vertical/`). Hors du fichier des composants : le
   rafraîchissement à chaud de Remotion Studio n'accepte que des composants. */

/** « Broken rules *cost you.* » → mots, chacun en segments (accent ou non). */
export type Seg = { t: string; a: boolean };
export const parse = (s: string): Seg[][] => {
  const words: Seg[][] = [];
  let cur: Seg[] = [];
  let buf = "";
  let a = false;
  const flush = () => {
    if (buf) cur.push({ t: buf, a });
    buf = "";
  };
  for (const ch of s) {
    if (ch === "*") {
      flush();
      a = !a;
    } else if (ch === " ") {
      flush();
      if (cur.length) words.push(cur);
      cur = [];
    } else buf += ch;
  }
  flush();
  if (cur.length) words.push(cur);
  return words;
};
