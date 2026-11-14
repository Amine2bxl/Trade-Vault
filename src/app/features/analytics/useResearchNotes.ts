import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/app/contexts/AuthContext";
import { loadResearchNotes } from "@/app/store/research";

/** Les notes de recherche du trader, partagées par React Query. */
export const researchNotesKey = (userId: string | undefined) =>
  ["research-notes", userId ?? null] as const;

export function useResearchNotes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: researchNotesKey(user?.id),
    queryFn: () => loadResearchNotes(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  });
}
