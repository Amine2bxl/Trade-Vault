/** Contrat commun à tous les champs et filtres. La géométrie vit dans
 * selection.css ; le comportement flottant appartient à SelectionPanel. */
export const selection = {
  field: "tv-control",
  filter: "tv-pick-pill",
  option: "tv-pick-opt",
  selected: "tv-choice-on",
  mobileQuery: "(max-width: 639px)",
  gutter: 12,
  gap: 6,
  searchThreshold: 8,
} as const;
