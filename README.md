# TradeVault

Journal de trading et espace de performance. Le trader enregistre ou importe
ses trades ; des moteurs déterministes calculent ses statistiques et ses
schémas de comportement ; **Jarvis**, le coach IA, les interprète en diagnostic
et en plan d'action. **La discipline avant le profit** : le produit ne promet
jamais de gagner plus.

React 19 · TanStack Start (SSR, Vercel) · Tailwind v4 · Supabase · Bun.

```bash
bun install
cp .env.example .env     # au minimum les variables Supabase
bun run dev              # http://localhost:8080
bun test                 # + bun run typecheck, lint, build avant tout push
```

- Documentation : [`docs/README.md`](docs/README.md)
- Instructions pour les agents IA et les contributeurs : [`AGENTS.md`](AGENTS.md)
