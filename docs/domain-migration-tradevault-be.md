# Migration vers `tradevault.be`

État au 29/07/2026. Le code est prêt : tout ce qui dépend du domaine passe par
[`src/lib/site.ts`](../src/lib/site.ts) côté client et par `PUBLIC_SITE_URL`
côté serveur. Il reste la configuration **externe**, qui ne peut pas être faite
depuis le repo.

## Ce qui a été fait dans le code

| Élément | Fichier |
|---|---|
| Config centrale (`SITE_URL`, `SITE_DOMAIN`, `CONTACT_EMAIL`, `TRUSTPILOT_REVIEW_URL`) | `src/lib/site.ts` |
| Canonical + `og:url` + images OG absolues | `src/routes/__root.tsx`, `index.tsx`, `terms.tsx`, `privacy.tsx` |
| `robots.txt` (+ ligne `Sitemap:`) | `public/robots.txt` |
| `sitemap.xml` (3 routes publiques) | `public/sitemap.xml` |
| Lien Trustpilot | `src/lib/site.ts` → `TrustpilotWidget.tsx`, `Landing.tsx` |
| Adresse de contact `contact@tradevault.be` | `Landing.tsx` |
| Domaine affiché dans l'aide notifications push | `PushOnboardingBanner.tsx` |
| Domaine sur la page de connexion | `AuthModal.tsx` |
| URLs de retour Stripe / Coinbase + liens emails épinglés au domaine canonique | `billing.server.ts`, `lifecycle-emails.server.ts` |
| Variables d'environnement | `.env.example` |

Les callbacks OAuth utilisent `window.location.origin` : ils suivent
automatiquement le domaine servi, **à condition** que Supabase et Google
autorisent l'URL (voir ci-dessous).

## À faire hors du repo

### 1. Vercel
- Project → Settings → Domains → ajouter `tradevault.be` et `www.tradevault.be`.
- Définir `tradevault.be` comme **Production Domain**.
- Laisser l'ancien domaine `*.vercel.app` en redirection 308 (comportement par
  défaut une fois le domaine primaire changé) pour ne pas casser les liens déjà
  partagés.
- Settings → Environment Variables (Production **et** Preview) :
  ```
  VITE_SITE_URL=https://tradevault.be
  PUBLIC_SITE_URL=https://tradevault.be
  EMAIL_FROM=TradeVault <hello@tradevault.be>
  ```
- Redéployer : `VITE_SITE_URL` est inliné au build, un simple changement de
  variable ne suffit pas.

### 2. Supabase
Dashboard → Authentication → URL Configuration :
- **Site URL** : `https://tradevault.be`
- **Redirect URLs** (ajouter, ne pas remplacer tant que l'ancien domaine sert) :
  ```
  https://tradevault.be
  https://tradevault.be/
  https://tradevault.be/reset-password
  ```
Sans ça, la connexion Google/Discord et le lien de réinitialisation de mot de
passe renvoient une erreur `redirect_to not allowed`.

### 3. Google Cloud Console (OAuth Google)
APIs & Services → Credentials → OAuth 2.0 Client ID :
- **Authorized JavaScript origins** : `https://tradevault.be`
- **Authorized redirect URIs** : l'URI de callback Supabase
  (`https://<project-ref>.supabase.co/auth/v1/callback`) — inchangée, elle ne
  dépend pas du domaine. Seule l'origine JavaScript est à ajouter.

### 4. Discord Developer Portal
OAuth2 → Redirects : même logique que Google, le callback pointe sur Supabase.
Vérifier que l'entrée existe toujours.

### 5. Stripe
- Dashboard → Developers → Webhooks : ajouter l'endpoint
  `https://tradevault.be/api/stripe/webhook`, récupérer le nouveau
  **signing secret** et mettre à jour `STRIPE_WEBHOOK_SECRET` sur Vercel.
- Supprimer l'ancien endpoint une fois le trafic basculé.
- Settings → Branding / Customer portal : mettre à jour l'URL du site.

### 6. Coinbase Commerce
Settings → Webhook subscriptions → `https://tradevault.be/api/crypto/webhook`,
puis mettre à jour `COINBASE_COMMERCE_WEBHOOK_SECRET`.

### 7. Resend
- Domains → ajouter et vérifier `tradevault.be` (SPF + DKIM).
- Basculer `EMAIL_FROM` sur `hello@tradevault.be` **après** vérification, sinon
  les envois échouent.

### 8. Trustpilot
Le business unit est enregistré sous `tradevaultt.vercel.app`. Le code pointe
désormais sur `https://www.trustpilot.com/review/tradevault.be` — ce lien sera
en 404 tant que le domaine n'est pas changé côté Trustpilot :
- Trustpilot Business → Settings → Domain → remplacer par `tradevault.be`.
- Re-vérifier le domaine (la balise
  `trustpilot-one-time-domain-verification-id` est déjà servie dans
  `__root.tsx`).

### 9. Google Search Console
- Ajouter la propriété `tradevault.be` (validation DNS recommandée).
- Soumettre `https://tradevault.be/sitemap.xml`.
- Si l'ancien domaine était indexé : utiliser l'outil **Changement d'adresse**
  depuis la propriété `tradevaultt.vercel.app` vers `tradevault.be`.
- Conserver les deux propriétés ~6 mois le temps que la redirection soit digérée.

## Vérification post-déploiement

```bash
curl -sI https://tradevault.be | head -1
curl -s https://tradevault.be/robots.txt
curl -s https://tradevault.be/sitemap.xml | head -5
curl -s "https://tradevault.be/api/economic-calendar" | head -c 200
curl -s https://tradevault.be/api/cron/economic-calendar
```

Puis, dans le navigateur : connexion e-mail, connexion Google, connexion
Discord, lien « mot de passe oublié », et un checkout Stripe en mode test.
