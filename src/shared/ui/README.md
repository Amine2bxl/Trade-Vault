# `shared/ui` — Design System centralisé

Source unique des primitives visuelles de TradeVault. Chaque primitive
**enveloppe les styles/tokens déjà utilisés** dans le produit → adoption
**drop-in, sans régression ni changement de rendu**.

> **Invariant** : `shared/ui` n'importe **jamais** `app/`. Ce sont des primitives
> feuilles → le sens des dépendances (`app → shared`) est préservé. Le serveur
> (`server.ts`) n'importe pas ce dossier.

## Import

```ts
import { Button, Card, Modal, Field, Input, Badge, Table, Heading, Text } from "@/shared/ui";
```

## Primitives

| Catégorie | Exports | Enveloppe |
|---|---|---|
| **Typography** | `Display`, `Heading` (level 1–3), `Text` (body/caption), `Label` | échelle à rôles nommés, plancher 12 px |
| **Buttons** | `Button` (`variant`: primary/ghost/subtle/danger · `size`) | `.btn-primary` / `.btn-ghost` existants |
| **Inputs** | `Input`, `Textarea`, `Select`, `Field`, `FIELD_BASE` | `fieldBase` canonique (dédupliqué de 4 fichiers) |
| **Cards** | `Card` (glass/glass-strong/plain · `hover`), `CardHeader/Title/Body` | `.glass`, `.glass-strong`, `.card-premium` |
| **Tables** | `Table`, `THead`, `TBody`, `TR`, `TH`, `TD`, `TableScroll` | pattern Journal/Analytics (`px-5 py-3`…) |
| **Modals** | `Modal` (`open`, `onClose`, `size`, `labelledBy`) | overlay existant + `Esc`/scroll-lock/`aria-modal` |
| **Badges** | `Badge` (neutral/profit/loss/warning/accent) | tints sémantiques déjà utilisés |
| **Charts** | `ChartContainer` + re-export recharts | thème dans `app/utils/chartTheme` (inchangé) |

## Adoption (non destructive, par lots)

Ces primitives sont **disponibles mais encore adoptées nulle part** : c'est
volontaire pour garantir zéro régression. La migration des appels existants se
fait **par lots vérifiables** (build + QA visuelle preview), pas en big-bang :

1. **`Modal`** → migrer les 6 modales hand-rolled (gain accessibilité).
2. **`Button`** → remplacer `.btn-*` et les boutons inline ; retirer le doublon `.btn-ghost`.
3. **`Field`/`Input`** → supprimer les copies de `fieldBase` (TradeModal, Journal, LotSizeCalculator, TradingPlan).
4. **`Badge`/`Table`/`Card`/Typography** → au fil des écrans touchés.

Voir le plan complet et le diagnostic chiffré : [`docs/DESIGN-SYSTEM.md`](../../../docs/DESIGN-SYSTEM.md).

> **Zone gelée** : ne pas router les composants Trustpilot via ces primitives
> (avis réels en prod).
