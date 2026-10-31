-- ════════════════════════════════════════════════════════════════════════════
-- CHEMIN DE RECHERCHE FIGÉ POUR LES FONCTIONS DE DÉCLENCHEUR (lots 1, 2, 4).
--
-- L'advisor Supabase « Function Search Path Mutable » signalait trois fonctions
-- de déclencheur créées sans `search_path` : leur comportement pouvait
-- dépendre du `search_path` de la session qui déclenche. Elles ne lisent
-- aucune table, mais on les aligne sur la règle du projet.
--
-- Additif : aucun corps de fonction n'est modifié. ROLLBACK :
-- `alter function … reset search_path`.
-- ════════════════════════════════════════════════════════════════════════════

alter function public.raw_ingest_immutable() set search_path = public;
alter function public.research_note_frozen() set search_path = public;
alter function public.progress_experiment_frozen() set search_path = public;
