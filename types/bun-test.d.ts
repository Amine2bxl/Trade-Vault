/**
 * Déclarations de types pour `bun:test` et `import.meta.dir`.
 *
 * POURQUOI CE FICHIER EXISTE. `tsc --noEmit` est l'une des quatre portes de
 * vérification exigées par la charte — et il produisait ~95 erreurs
 * `Cannot find module 'bun:test'` / `Property 'dir' does not exist on type
 * 'ImportMeta'`, sur les 188 du dépôt. Autrement dit : la porte ne pouvait pas
 * être franchie, elle n'était donc pas dans la CI, et le typecheck ne
 * protégeait rien. C'est ce trou qui a laissé passer l'appel à
 * `.onConflict().ignore()` — une méthode inexistante — jusqu'en production.
 *
 * La cause est simple : `tsconfig.json` fixe `"types": ["vite/client"]`, ce qui
 * DÉSACTIVE la découverte automatique des types ambiants, et `@types/bun`
 * n'est pas dans les dépendances. L'y ajouter demanderait de régénérer
 * `bun.lock`, qui résout ses paquets vers un registre privé auquel
 * l'environnement de développement n'a pas accès : la régénération produirait
 * un lockfile différent de celui que la CI utilise.
 *
 * Ce fichier déclare donc, à la main, EXACTEMENT la surface utilisée par la
 * suite de tests — rien de plus. Ce ne sont pas des types complaisants : ils
 * décrivent le comportement réel de `bun:test`, et une utilisation hors de
 * cette surface échouera au typecheck, ce qui est le résultat voulu (il faudra
 * alors étendre ce fichier en connaissance de cause, ou installer
 * `@types/bun`).
 *
 * À SUPPRIMER le jour où `@types/bun` entre dans `package.json` et où
 * `tsconfig.json` l'ajoute à son tableau `types`.
 */

/** `import.meta.dir` — le répertoire du module courant. Spécifique à Bun ;
 *  utilisé par les tests qui lisent des sources du dépôt. */
interface ImportMeta {
  readonly dir: string;
}

declare module "bun:test" {
  /** Les assertions utilisées par la suite. Volontairement génériques sur la
   *  valeur reçue : `expect` accepte n'importe quoi, c'est le matcher qui
   *  contraint. */
  interface Matchers<T = unknown> {
    toBe(expected: T | unknown): void;
    toEqual(expected: unknown): void;
    toMatchObject(expected: object): void;
    toContain(expected: unknown): void;
    toMatch(expected: string | RegExp): void;
    toHaveLength(expected: number): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toBeGreaterThan(expected: number | bigint): void;
    toBeGreaterThanOrEqual(expected: number | bigint): void;
    toBeLessThan(expected: number | bigint): void;
    toBeLessThanOrEqual(expected: number | bigint): void;
    toBeCloseTo(expected: number, precision?: number): void;
    toThrow(expected?: string | RegExp | Error): void;
    /** Négation — mêmes matchers, résultat inversé. */
    readonly not: Matchers<T>;
    /** Pour une promesse : applique le matcher à sa valeur de résolution. */
    readonly resolves: Matchers<unknown>;
    /** Pour une promesse : applique le matcher à son motif de rejet. */
    readonly rejects: Matchers<unknown>;
  }

  /** Le second argument est le message affiché quand l'assertion échoue. */
  export function expect<T>(actual: T, message?: string): Matchers<T>;

  /** Un cas de test paramétré : `test.each(rows)(label, fn)`. Le libellé peut
   *  contenir des marqueurs `%s`/`%o` remplis par la ligne courante. */
  interface EachFn {
    (label: string, fn: () => void | Promise<unknown>): void;
    each<T>(rows: readonly T[]): (label: string, fn: (row: T) => void | Promise<unknown>) => void;
  }

  export function describe(label: string, fn: () => void): void;
  export const test: EachFn;
  export const it: EachFn;

  export function beforeEach(fn: () => void | Promise<unknown>): void;
  export function afterEach(fn: () => void | Promise<unknown>): void;
  export function beforeAll(fn: () => void | Promise<unknown>): void;
  export function afterAll(fn: () => void | Promise<unknown>): void;

  /** Substitution de module — `mock.module(specifier, factory)`. Le module est
   *  remplacé pour tous les imports qui suivent dans le même processus. */
  export const mock: {
    module(specifier: string, factory: () => unknown): void;
  };
}
