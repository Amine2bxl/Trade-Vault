
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS starting_balance numeric NOT NULL DEFAULT 25000;

CREATE TABLE public.missed_opportunities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_date date NOT NULL,
  symbol text NOT NULL DEFAULT '',
  reason_not_taken text NOT NULL DEFAULT '',
  what_happened text NOT NULL DEFAULT '',
  lesson_learned text NOT NULL DEFAULT '',
  next_time_plan text NOT NULL DEFAULT '',
  estimated_r numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.missed_opportunities TO authenticated;
GRANT ALL ON public.missed_opportunities TO service_role;

ALTER TABLE public.missed_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own missed opportunities" ON public.missed_opportunities
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own missed opportunities" ON public.missed_opportunities
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own missed opportunities" ON public.missed_opportunities
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own missed opportunities" ON public.missed_opportunities
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_missed_opportunities_updated_at
  BEFORE UPDATE ON public.missed_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
