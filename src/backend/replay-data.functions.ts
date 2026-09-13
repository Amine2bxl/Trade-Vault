import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchHistoricalBars, type RemoteBarsResult } from "./replay-data.server";

// ============================================================
//  Données historiques du terminal de rejeu — SOURCE UNIQUE du frontend.
// ------------------------------------------------------------
//  Le client ne parle jamais à Databento ni à Polygon : il demande ici, et la
//  clé reste côté serveur. C'est la seule façon de brancher un fournisseur
//  facturé à l'usage sans l'offrir à tous les visiteurs.
//
//  AUTHENTIFIÉE, et pas seulement parce que la donnée est premium : chaque
//  appel déclenche une requête FACTURÉE À L'USAGE chez Databento ou Polygon.
//  Une fonction ouverte laisserait n'importe qui vider le budget du
//  propriétaire du compte sans même créer de compte — le même défaut que
//  `ttsSpeak` et son quota ElevenLabs. Protéger la clé ne suffit pas : il faut
//  aussi protéger ce qu'elle dépense.
// ============================================================

const Input = z.object({
  /** Jour de cotation `YYYY-MM-DD`, heure de New York. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Identifiant d'instrument du registre (`NQ`, `ES`…). */
  symbol: z
    .string()
    .min(1)
    .max(8)
    .regex(/^[A-Z0-9]+$/),
});

export const fetchReplayBars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<RemoteBarsResult> => {
    const out = await fetchHistoricalBars(data.date, data.symbol);
    if (out.error) {
      // On journalise mais on ne fait pas tomber la séance : l'appelant
      // retombera sur le générateur, et le trader gardera son terminal.
      console.error("[replay-data] fournisseur en échec", out.provider, out.error);
    }
    return out;
  });
