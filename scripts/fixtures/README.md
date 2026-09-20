# Exports du compte vitrine

Ce dossier contient ce que le harnais de capture (`scripts/capture-product.mjs`)
ne sait PAS régénérer.

Les trades, eux, se recalculent : le générateur qui a peuplé le compte vitrine
est déterministe (hash md5 de l'index du jour), il se rejoue en JS au centime
près, et le harnais vérifie l'égalité avec la base au démarrage. Les fichiers
ci-dessous n'ont pas cette propriété — leur contenu est du texte écrit à la
main, ou des données de marché. Ils sont donc **exportés de la base**, et c'est
ce qui garde les captures honnêtes : ce qu'elles montrent existe réellement.

| Fichier | Table | Ce qu'il sert |
| --- | --- | --- |
| `missed-opportunities.json` | `missed_opportunities` | Les six setups manqués du compte vitrine |
| `economic-events.json` | `economic_events` | Le calendrier macro d'une fenêtre de deux semaines |

## `supabase-stub.mjs`

Une doublure REST minimale, qui sert `economic-events.json` sur une adresse
locale. Elle existe parce que le calendrier est la SEULE donnée de l'app lue
par une fonction **serveur** : une interception côté navigateur ne la voit
jamais. Plutôt que de réécrire la réponse du framework (sérialisée par seroval,
donc un format interne qui changera), on donne au serveur une base qu'il peut
lire — et le code applicatif s'exécute en entier, inchangé.

## Réexporter

Depuis une machine qui atteint la base, ou via un client SQL :

```sql
-- missed-opportunities.json
select json_agg(r order by r.opportunity_date desc) from (
  select id, user_id, account_id, opportunity_date, symbol, reason_not_taken,
         what_happened, lesson_learned, next_time_plan, estimated_r, screenshots
  from missed_opportunities
  where user_id = 'a5100000-0000-4000-8000-000000000001') r;

-- economic-events.json (fenêtre à ajuster autour de la date de capture)
select json_agg(r order by r.starts_at) from (
  select id, starts_at, currency, country, title, impact, previous, forecast,
         actual, all_day, source
  from economic_events
  where starts_at >= now() - interval '7 days'
    and starts_at <  now() + interval '7 days') r;
```

Le calendrier vieillit : au-delà de quelques semaines, la fenêtre exportée ne
couvre plus la semaine en cours et la page retombe sur son repli. Réexporter
avant une campagne de captures.
