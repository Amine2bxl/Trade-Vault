import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { effectiveTier } from "@/domain/entitlement";
import type { Plan, Tier } from "@/domain/plans";

/**
 * L'ABONNEMENT, VU DEPUIS UNE PAGE PUBLIQUE.
 *
 * `useSubscription` dépend d'`AuthContext`, qui n'est monté que dans l'arbre
 * de l'application. `/pricing` rend en dehors : elle doit donc lire la
 * session elle-même.
 *
 * Le jeton suffit à savoir SI quelqu'un est connecté ; la ligne
 * `subscriptions` dit sur quelle offre. RLS garantit qu'une requête ne peut
 * ramener que la ligne du compte connecté - c'est pour cette raison qu'il n'y
 * a aucun contrôle d'autorisation à écrire ici.
 *
 * Le palier renvoyé est le palier EFFECTIF (`domain/entitlement`), pas le nom
 * du plan acheté : un abonnement crypto dont la période est écoulée porte
 * encore « pro » en base et n'ouvre plus rien. Afficher « Tu es sur Pro » à
 * quelqu'un qui ne l'est plus serait la pire des confusions sur une page de
 * tarifs.
 *
 * Silencieux par construction : une erreur réseau rend `connecte = false`, et
 * la page s'affiche telle qu'elle s'affiche pour un visiteur anonyme. Une
 * page de tarifs ne doit jamais dépendre d'une requête pour être lisible.
 */
export interface EtatPublicAbonnement {
  /** Tant que la session n'est pas résolue, on n'affirme rien. */
  charge: boolean;
  connecte: boolean;
  /** Le plan enregistré, pour marquer la colonne « offre en cours ». */
  plan: Plan | null;
  /** Le palier réellement ouvert aujourd'hui. */
  palier: Tier;
}

export function usePublicSubscription(): EtatPublicAbonnement {
  const [etat, setEtat] = useState<EtatPublicAbonnement>({
    charge: true,
    connecte: false,
    plan: null,
    palier: "free",
  });

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user?.id;
        if (!userId) {
          if (vivant) setEtat({ charge: false, connecte: false, plan: null, palier: "free" });
          return;
        }
        const { data: ligne } = await supabase
          .from("subscriptions")
          .select("plan, status, source, current_period_end")
          .eq("user_id", userId)
          .maybeSingle();
        if (!vivant) return;
        setEtat({
          charge: false,
          connecte: true,
          plan: (ligne?.plan as Plan) ?? "free",
          palier: ligne ? effectiveTier(ligne) : "free",
        });
      } catch {
        if (vivant) setEtat({ charge: false, connecte: false, plan: null, palier: "free" });
      }
    })();
    return () => {
      vivant = false;
    };
  }, []);

  return etat;
}
