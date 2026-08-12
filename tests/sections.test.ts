import { expect, test } from "bun:test";
import { PAGES, SECTIONS, UNSECTIONED_PAGES, type Page } from "../src/app/types";
import {
  PAGE_META,
  SECTION_META,
  defaultPageOfSection,
  sectionForPage,
} from "../src/app/navigation";

// Le regroupement en sections est une couche de PRÉSENTATION au-dessus de
// `PAGES`. Rien ne l'oblige, à l'exécution, à rester complet : ajouter une page
// à `PAGES` sans l'assigner produirait une page vivante mais inatteignable
// depuis la navigation — exactement le défaut silencieux que le commentaire de
// `types.ts` décrit déjà pour la recopie manuelle. D'où ces tests.

test("every page belongs to exactly one section", () => {
  const assigned = SECTIONS.flatMap((s) => [...s.pages]) as Page[];
  const expected = PAGES.filter((p) => !UNSECTIONED_PAGES.includes(p));
  expect([...assigned].sort()).toEqual([...expected].sort());
});

test("no page is assigned twice", () => {
  const assigned = SECTIONS.flatMap((s) => [...s.pages]);
  expect(new Set(assigned).size).toBe(assigned.length);
});

test("sectionForPage finds a section for every page except the unsectioned ones", () => {
  for (const page of PAGES) {
    const section = sectionForPage(page);
    if (UNSECTIONED_PAGES.includes(page)) expect(section).toBeNull();
    else expect(section).not.toBeNull();
  }
});

test("the default page of a section is its first page", () => {
  for (const section of SECTIONS) {
    expect(defaultPageOfSection(section.id)).toBe(section.pages[0]);
  }
});

test("every page and every section has a label and an icon", () => {
  for (const page of PAGES) {
    expect(PAGE_META[page].labelKey.length).toBeGreaterThan(0);
    expect(PAGE_META[page].icon).toBeDefined();
  }
  for (const section of SECTIONS) {
    expect(SECTION_META[section.id].labelKey.length).toBeGreaterThan(0);
    expect(SECTION_META[section.id].icon).toBeDefined();
  }
});
