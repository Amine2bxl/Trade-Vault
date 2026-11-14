# Logos d'instruments

Lus par `src/app/trading/symbolCatalog.ts` (une seule table symbole → logo).

| Fichier | Origine | Licence |
| --- | --- | --- |
| `flag-*.svg` | [circle-flags](https://github.com/HatScripts/circle-flags) | MIT |
| `btc`, `eth`, `sol`, `xrp`, `ltc` | tracés [simple-icons](https://simpleicons.org) | CC0 (marques de leurs propriétaires) |
| `nasdaq.svg` | emblème Nasdaq (Wikimedia Commons) | marque de Nasdaq, Inc. — usage nominatif, pour désigner l'indice |
| `sp500`, `dow`, `russell` | pastilles TradeVault (500 / 30 / 2000) | maison — ces indices n'ont pas d'emblème libre |
| `gold`, `silver`, `copper`, `oil`, `gas` | pictogrammes TradeVault | maison |

Ajouter un instrument : déposer le SVG (disque 48 × 48), puis l'inscrire dans
`symbolCatalog.ts`. Un symbole sans logo retombe sur ses initiales — jamais sur
un logo approchant.
