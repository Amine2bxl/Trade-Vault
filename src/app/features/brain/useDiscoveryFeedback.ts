import { useCallback, useEffect, useState } from "react";
import { loadUserPref, saveUserPref } from "@/app/utils/userPrefs";
import { useUserPrefsChange } from "@/app/hooks/useUserPrefsChange";
import type { Discovery } from "@/modules/knowledge";

/**
 * Le retour du trader sur une découverte — confirmée, rejetée, non concluante,
 * gardée — avec une note.
 *
 * Stocké dans `user_preferences` (RLS owner-only, synchronisé entre appareils)
 * plutôt que dans une table neuve : quelques dizaines d'entrées au plus.
 * shortcut: une clé JSON par compte, à migrer vers une table dédiée si
 * l'historique des revues devait être interrogé côté serveur.
 *
 * L'ÉVOLUTION DE LA CONNAISSANCE : la revue garde l'empreinte et l'écart de
 * la preuve au moment où elle a été faite. Quand de nouvelles données
 * changent la preuve, l'écran le DIT (« la preuve a changé depuis ta revue :
 * −42 € alors, −18 € aujourd'hui ») — rien n'est réécrit en silence.
 */

export type ReviewStatus = "confirmed" | "rejected" | "inconclusive" | "saved";

export interface Review {
  status: ReviewStatus;
  at: string;
  fingerprint: string;
  diff: number;
  n: number;
  note?: string;
}

export const FEEDBACK_KEY = "brain.feedback.v1";

function sanitize(raw: unknown): Record<string, Review> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, Review> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const r = v as Partial<Review> | null;
    if (!r || typeof r !== "object") continue;
    if (!["confirmed", "rejected", "inconclusive", "saved"].includes(String(r.status))) continue;
    out[id] = {
      status: r.status as ReviewStatus,
      at: String(r.at ?? ""),
      fingerprint: String(r.fingerprint ?? ""),
      diff: Number(r.diff) || 0,
      n: Number(r.n) || 0,
      note: typeof r.note === "string" ? r.note.slice(0, 1000) : undefined,
    };
  }
  return out;
}

export function useDiscoveryFeedback(userId: string | undefined) {
  const [reviews, setReviews] = useState<Record<string, Review>>({});

  const reload = useCallback(() => {
    if (!userId) return;
    void loadUserPref<unknown>(userId, FEEDBACK_KEY)
      .then((v) => setReviews(sanitize(v)))
      .catch(() => {});
  }, [userId]);
  useEffect(reload, [reload]);
  useUserPrefsChange(userId, reload);

  const review = useCallback(
    (d: Discovery, status: ReviewStatus | null, note?: string) => {
      if (!userId) return;
      setReviews((prev) => {
        const next = { ...prev };
        if (status === null) delete next[d.id];
        else
          next[d.id] = {
            status,
            at: new Date().toISOString(),
            fingerprint: d.fingerprint,
            diff: d.evidence.diff,
            n: d.evidence.n,
            note: note ?? prev[d.id]?.note,
          };
        saveUserPref(userId, FEEDBACK_KEY, next);
        return next;
      });
    },
    [userId],
  );

  return { reviews, review };
}
