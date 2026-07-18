import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Escape hatch for tables created by the engines-foundation migration
 * (notifications, ai_memory, ai_reports, user_preferences, habits) that
 * are not yet present in the GENERATED Database types.
 *
 * TODO(types): regenerate src/integrations/supabase/types.ts against the
 * migrated schema, then delete this file and use `supabase` directly.
 * RLS still applies — this only relaxes compile-time typing, not security.
 */
export const db = supabase as unknown as SupabaseClient;
