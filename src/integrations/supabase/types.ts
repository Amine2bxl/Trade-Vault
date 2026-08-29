export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      // ── Tables ajoutées à la main ──────────────────────────────────────────
      // Ce fichier est REGÉNÉRÉ depuis le schéma Supabase, mais il avait pris
      // du retard sur les migrations : six tables et deux colonnes existantes
      // en base y manquaient. Conséquence, chaque store qui les touche devait
      // écrire `as unknown as XRow` — et `tsc --noEmit` produisait une centaine
      // d'erreurs, ce qui rendait la porte de typecheck infranchissable et donc
      // absente de la CI. Ces définitions sont transcrites des migrations qui
      // les créent ; une régénération depuis le projet Supabase les produira à
      // l'identique et remplacera ce bloc.
      agent_proposals: {
        Row: {
          action_type: string;
          applied_ref: string | null;
          created_at: string;
          decided_at: string | null;
          expires_at: string;
          id: string;
          pattern_id: string | null;
          payload: Json;
          rationale: string;
          status: string;
          user_id: string;
        };
        Insert: {
          action_type: string;
          applied_ref?: string | null;
          created_at?: string;
          decided_at?: string | null;
          expires_at?: string;
          id?: string;
          pattern_id?: string | null;
          payload: Json;
          rationale: string;
          status?: string;
          user_id: string;
        };
        Update: {
          action_type?: string;
          applied_ref?: string | null;
          created_at?: string;
          decided_at?: string | null;
          expires_at?: string;
          id?: string;
          pattern_id?: string | null;
          payload?: Json;
          rationale?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      detected_patterns: {
        Row: {
          cluster_id: string | null;
          dismissed_at: string | null;
          evidence: Json;
          first_seen: string;
          id: string;
          impact_r: number | null;
          kind: string;
          last_seen: string;
          user_id: string;
        };
        Insert: {
          cluster_id?: string | null;
          dismissed_at?: string | null;
          evidence: Json;
          first_seen?: string;
          id?: string;
          impact_r?: number | null;
          kind: string;
          last_seen?: string;
          user_id: string;
        };
        Update: {
          cluster_id?: string | null;
          dismissed_at?: string | null;
          evidence?: Json;
          first_seen?: string;
          id?: string;
          impact_r?: number | null;
          kind?: string;
          last_seen?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      simulation_scenarios: {
        Row: {
          account_id: string | null;
          created_at: string;
          engine_version: string | null;
          horizon_unit: string;
          horizon_value: number;
          id: string;
          last_pass_probability: number | null;
          last_risk_of_ruin: number | null;
          last_run_at: string | null;
          last_sample_size: number | null;
          name: string;
          risk_multiplier: number;
          rules: Json;
          runs: number;
          seed: number | null;
          stop_after_losses: number | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          created_at?: string;
          engine_version?: string | null;
          horizon_unit?: string;
          horizon_value?: number;
          id?: string;
          last_pass_probability?: number | null;
          last_risk_of_ruin?: number | null;
          last_run_at?: string | null;
          last_sample_size?: number | null;
          name?: string;
          risk_multiplier?: number;
          rules?: Json;
          runs?: number;
          seed?: number | null;
          stop_after_losses?: number | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          created_at?: string;
          engine_version?: string | null;
          horizon_unit?: string;
          horizon_value?: number;
          id?: string;
          last_pass_probability?: number | null;
          last_risk_of_ruin?: number | null;
          last_run_at?: string | null;
          last_sample_size?: number | null;
          name?: string;
          risk_multiplier?: number;
          rules?: Json;
          runs?: number;
          seed?: number | null;
          stop_after_losses?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      trade_intent: {
        Row: {
          confidence: number | null;
          created_at: string;
          emotion: string | null;
          id: string;
          plan: string | null;
          planned_risk: number | null;
          reasoning: string | null;
          setup: string | null;
          trade_id: string;
          user_id: string;
        };
        Insert: {
          confidence?: number | null;
          created_at?: string;
          emotion?: string | null;
          id?: string;
          plan?: string | null;
          planned_risk?: number | null;
          reasoning?: string | null;
          setup?: string | null;
          trade_id: string;
          user_id: string;
        };
        Update: {
          confidence?: number | null;
          created_at?: string;
          emotion?: string | null;
          id?: string;
          plan?: string | null;
          planned_risk?: number | null;
          reasoning?: string | null;
          setup?: string | null;
          trade_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      trade_reflection: {
        Row: {
          created_at: string;
          id: string;
          note: string | null;
          plan_respected: string | null;
          reason: string | null;
          trade_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          note?: string | null;
          plan_respected?: string | null;
          reason?: string | null;
          trade_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string | null;
          plan_respected?: string | null;
          reason?: string | null;
          trade_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      trading_sessions: {
        Row: {
          account_id: string | null;
          active_rules: Json;
          checklist_snapshot: Json;
          created_at: string;
          daily_objective: string | null;
          discipline_score: number | null;
          emotional_state: string | null;
          ended_at: string | null;
          id: string;
          market_context: string | null;
          readiness_inputs: Json;
          readiness_score: number | null;
          review_note: string | null;
          session_date: string;
          started_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          active_rules?: Json;
          checklist_snapshot?: Json;
          created_at?: string;
          daily_objective?: string | null;
          discipline_score?: number | null;
          emotional_state?: string | null;
          ended_at?: string | null;
          id?: string;
          market_context?: string | null;
          readiness_inputs?: Json;
          readiness_score?: number | null;
          review_note?: string | null;
          session_date: string;
          started_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          active_rules?: Json;
          checklist_snapshot?: Json;
          created_at?: string;
          daily_objective?: string | null;
          discipline_score?: number | null;
          emotional_state?: string | null;
          ended_at?: string | null;
          id?: string;
          market_context?: string | null;
          readiness_inputs?: Json;
          readiness_score?: number | null;
          review_note?: string | null;
          session_date?: string;
          started_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          color: string;
          created_at: string;
          currency: string;
          id: string;
          icon: string | null;
          is_default: boolean;
          name: string;
          starting_balance: number;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          icon?: string | null;
          is_default?: boolean;
          name?: string;
          starting_balance?: number;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          icon?: string | null;
          is_default?: boolean;
          name?: string;
          starting_balance?: number;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_memory: {
        Row: {
          confidence: number;
          content: string;
          created_at: string;
          id: string;
          key: string | null;
          kind: string;
          importance: number;
          source: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          confidence?: number;
          content: string;
          created_at?: string;
          id: string;
          key?: string | null;
          kind: string;
          importance?: number;
          source?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          confidence?: number;
          content?: string;
          created_at?: string;
          id?: string;
          key?: string | null;
          kind?: string;
          importance?: number;
          source?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_rate_limits: {
        Row: {
          count: number;
          user_id: string;
          window_start: string;
        };
        Insert: {
          count?: number;
          user_id: string;
          window_start: string;
        };
        Update: {
          count?: number;
          user_id?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      ai_reports: {
        Row: {
          content: Json;
          created_at: string;
          id: string;
          kind: string;
          period_key: string;
          user_id: string;
        };
        Insert: {
          content?: Json;
          created_at?: string;
          id: string;
          kind: string;
          period_key: string;
          user_id: string;
        };
        Update: {
          content?: Json;
          created_at?: string;
          id?: string;
          kind?: string;
          period_key?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      economic_calendar_sync: {
        Row: {
          consecutive_failures: number;
          events_upserted: number | null;
          id: boolean;
          last_attempt_at: string | null;
          last_error: string | null;
          last_success_at: string | null;
        };
        Insert: {
          consecutive_failures?: number;
          events_upserted?: number | null;
          id?: boolean;
          last_attempt_at?: string | null;
          last_error?: string | null;
          last_success_at?: string | null;
        };
        Update: {
          consecutive_failures?: number;
          events_upserted?: number | null;
          id?: boolean;
          last_attempt_at?: string | null;
          last_error?: string | null;
          last_success_at?: string | null;
        };
        Relationships: [];
      };
      economic_events: {
        Row: {
          actual: string | null;
          all_day: boolean;
          country: string;
          currency: string;
          forecast: string | null;
          id: string;
          impact: string;
          previous: string | null;
          source: string;
          starts_at: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          actual?: string | null;
          all_day?: boolean;
          country: string;
          currency: string;
          forecast?: string | null;
          id: string;
          impact: string;
          previous?: string | null;
          source?: string;
          starts_at: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          actual?: string | null;
          all_day?: boolean;
          country?: string;
          currency?: string;
          forecast?: string | null;
          id?: string;
          impact?: string;
          previous?: string | null;
          source?: string;
          starts_at?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      email_log: {
        Row: {
          email_key: string;
          sent_at: string;
          user_id: string;
        };
        Insert: {
          email_key: string;
          sent_at?: string;
          user_id: string;
        };
        Update: {
          email_key?: string;
          sent_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      goal_plans: {
        Row: {
          account_id: string | null;
          created_at: string;
          goals: Json;
          horizon_months: number;
          started_at: string;
          tasks_done: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          created_at?: string;
          goals?: Json;
          horizon_months?: number;
          started_at?: string;
          tasks_done?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string | null;
          created_at?: string;
          goals?: Json;
          horizon_months?: number;
          started_at?: string;
          tasks_done?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      habits: {
        Row: {
          cadence: string;
          created_at: string;
          id: string;
          last_done: string | null;
          name: string;
          streak: number;
          user_id: string;
        };
        Insert: {
          cadence?: string;
          created_at?: string;
          id: string;
          last_done?: string | null;
          name: string;
          streak?: number;
          user_id: string;
        };
        Update: {
          cadence?: string;
          created_at?: string;
          id?: string;
          last_done?: string | null;
          name?: string;
          streak?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      missed_opportunities: {
        Row: {
          account_id: string | null;
          created_at: string;
          estimated_r: number;
          id: string;
          lesson_learned: string;
          next_time_plan: string;
          opportunity_date: string;
          reason_not_taken: string;
          screenshots: string[];
          symbol: string;
          updated_at: string;
          user_id: string;
          what_happened: string;
        };
        Insert: {
          account_id?: string | null;
          created_at?: string;
          estimated_r?: number;
          id?: string;
          lesson_learned?: string;
          next_time_plan?: string;
          opportunity_date: string;
          reason_not_taken?: string;
          screenshots?: string[];
          symbol?: string;
          updated_at?: string;
          user_id?: string;
          what_happened?: string;
        };
        Update: {
          account_id?: string | null;
          created_at?: string;
          estimated_r?: number;
          id?: string;
          lesson_learned?: string;
          next_time_plan?: string;
          opportunity_date?: string;
          reason_not_taken?: string;
          screenshots?: string[];
          symbol?: string;
          updated_at?: string;
          user_id?: string;
          what_happened?: string;
        };
        Relationships: [
          {
            foreignKeyName: "missed_opportunities_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      monthly_reports: {
        Row: {
          created_at: string;
          id: string;
          month: string;
          report: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          month: string;
          report: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          month?: string;
          report?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          session_id: string | null;
          body: string;
          created_at: string;
          data: Json;
          id: string;
          kind: string;
          read_at: string | null;
          severity: string;
          title: string;
          url: string | null;
          user_id: string;
        };
        Insert: {
          session_id?: string | null;
          body: string;
          created_at?: string;
          data?: Json;
          id: string;
          kind: string;
          read_at?: string | null;
          severity?: string;
          title: string;
          url?: string | null;
          user_id: string;
        };
        Update: {
          session_id?: string | null;
          body?: string;
          created_at?: string;
          data?: Json;
          id?: string;
          kind?: string;
          read_at?: string | null;
          severity?: string;
          title?: string;
          url?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      processed_webhook_events: {
        Row: {
          event_id: string;
          processed_at: string;
          provider: string;
        };
        Insert: {
          event_id: string;
          processed_at?: string;
          provider: string;
        };
        Update: {
          event_id?: string;
          processed_at?: string;
          provider?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          account_balance: number;
          active_account_id: string | null;
          confluences: string[];
          created_at: string;
          email: string;
          id: string;
          jarvis_completed_at: string | null;
          jarvis_first_name: string | null;
          jarvis_goal: string | null;
          jarvis_strength: string | null;
          jarvis_style: string | null;
          jarvis_weakness: string | null;
          language: string;
          name: string;
          onboarded_at: string | null;
          onboarding_assets: string[];
          onboarding_brokers: string[];
          onboarding_experience: string | null;
          onboarding_goal: string | null;
          onboarding_monthly_target: number | null;
          onboarding_pain: string | null;
          onboarding_skipped: boolean;
          onboarding_style: string | null;
          onboarding_uses_ict: boolean;
          starting_balance: number;
          trading_plan: Json;
          trading_rules: Json;
          trustpilot_prompted_at: string | null;
          trustpilot_status: string | null;
          updated_at: string;
        };
        Insert: {
          account_balance?: number;
          active_account_id?: string | null;
          confluences?: string[];
          created_at?: string;
          email?: string;
          id: string;
          jarvis_completed_at?: string | null;
          jarvis_first_name?: string | null;
          jarvis_goal?: string | null;
          jarvis_strength?: string | null;
          jarvis_style?: string | null;
          jarvis_weakness?: string | null;
          language?: string;
          name?: string;
          onboarded_at?: string | null;
          onboarding_assets?: string[];
          onboarding_brokers?: string[];
          onboarding_experience?: string | null;
          onboarding_goal?: string | null;
          onboarding_monthly_target?: number | null;
          onboarding_pain?: string | null;
          onboarding_skipped?: boolean;
          onboarding_style?: string | null;
          onboarding_uses_ict?: boolean;
          starting_balance?: number;
          trading_plan?: Json;
          trading_rules?: Json;
          trustpilot_prompted_at?: string | null;
          trustpilot_status?: string | null;
          updated_at?: string;
        };
        Update: {
          account_balance?: number;
          active_account_id?: string | null;
          confluences?: string[];
          created_at?: string;
          email?: string;
          id?: string;
          jarvis_completed_at?: string | null;
          jarvis_first_name?: string | null;
          jarvis_goal?: string | null;
          jarvis_strength?: string | null;
          jarvis_style?: string | null;
          jarvis_weakness?: string | null;
          language?: string;
          name?: string;
          onboarded_at?: string | null;
          onboarding_assets?: string[];
          onboarding_brokers?: string[];
          onboarding_experience?: string | null;
          onboarding_goal?: string | null;
          onboarding_monthly_target?: number | null;
          onboarding_pain?: string | null;
          onboarding_skipped?: boolean;
          onboarding_style?: string | null;
          onboarding_uses_ict?: boolean;
          starting_balance?: number;
          trading_plan?: Json;
          trading_rules?: Json;
          trustpilot_prompted_at?: string | null;
          trustpilot_status?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_active_account_id_fkey";
            columns: ["active_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      six_month_goals: {
        Row: {
          created_at: string;
          kind: string;
          start_value: number;
          started_at: string;
          target_value: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          kind: string;
          start_value: number;
          started_at?: string;
          target_value: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          kind?: string;
          start_value?: number;
          started_at?: string;
          target_value?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          created_at: string;
          crypto_charge_id: string | null;
          current_period_end: string | null;
          plan: string;
          provider_event_at: string | null;
          source: string;
          status: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          trial_ends_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          crypto_charge_id?: string | null;
          current_period_end?: string | null;
          plan?: string;
          provider_event_at?: string | null;
          source?: string;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          crypto_charge_id?: string | null;
          current_period_end?: string | null;
          plan?: string;
          provider_event_at?: string | null;
          source?: string;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      trades: {
        Row: {
          session_id: string | null;
          account_id: string | null;
          confidence: number;
          confluences: string[];
          created_at: string;
          direction: string;
          entry_time: string;
          exit_time: string;
          id: string;
          is_example: boolean;
          mae: number | null;
          mfe: number | null;
          mistakes: string[];
          notes: string;
          pnl: number;
          r_multiple: number;
          risk_amount: number;
          screenshots: string[];
          setup_quality: number;
          slippage: number | null;
          strategy: string;
          symbol: string;
          trade_date: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          session_id?: string | null;
          account_id?: string | null;
          confidence?: number;
          confluences?: string[];
          created_at?: string;
          direction?: string;
          entry_time?: string;
          exit_time?: string;
          id?: string;
          is_example?: boolean;
          mae?: number | null;
          mfe?: number | null;
          mistakes?: string[];
          notes?: string;
          pnl?: number;
          r_multiple?: number;
          risk_amount?: number;
          screenshots?: string[];
          setup_quality?: number;
          slippage?: number | null;
          strategy?: string;
          symbol: string;
          trade_date: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          session_id?: string | null;
          account_id?: string | null;
          confidence?: number;
          confluences?: string[];
          created_at?: string;
          direction?: string;
          entry_time?: string;
          exit_time?: string;
          id?: string;
          is_example?: boolean;
          mae?: number | null;
          mfe?: number | null;
          mistakes?: string[];
          notes?: string;
          pnl?: number;
          r_multiple?: number;
          risk_amount?: number;
          screenshots?: string[];
          setup_quality?: number;
          slippage?: number | null;
          strategy?: string;
          symbol?: string;
          trade_date?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trades_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      user_preferences: {
        Row: {
          prefs: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          prefs?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          prefs?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      // Les fonctions ajoutées par
      // `supabase/migrations/20260829090000_billing_and_quota_hardening.sql`.
      // Ce fichier est REGÉNÉRÉ depuis le schéma réel ; ces entrées sont ce
      // qu'une régénération produirait, ajoutées à la main faute d'accès au
      // projet Supabase depuis l'environnement de développement.
      adjust_memory_confidence: {
        Args: { p_id: string; p_delta: number };
        Returns: number | null;
      };
      apply_subscription_event: {
        Args: {
          p_user_id: string;
          p_plan: string;
          p_status: string;
          p_source: string;
          p_stripe_subscription_id: string | null;
          p_stripe_customer_id: string | null;
          p_crypto_charge_id: string | null;
          p_current_period_end: string | null;
          p_cancel_at_period_end: boolean;
          p_event_at: string;
        };
        Returns: string;
      };
      consume_ai_quota: {
        Args: { p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      consume_ai_quota_scoped: {
        Args: { p_scope: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      count_trades_in_month: {
        Args: { p_user_id: string; p_month: string };
        Returns: number;
      };
      effective_tier: {
        Args: { p_user_id: string };
        Returns: string;
      };
      find_user_id_by_email: {
        Args: { p_email: string };
        Returns: string | null;
      };
      redeem_promo_code: {
        Args: {
          p_code: string;
          p_user_id: string;
          p_email: string;
          p_plan: string;
          p_kind: string;
        };
        Returns: string;
      };
      release_promo_redemption: {
        Args: { p_code: string; p_user_id: string };
        Returns: boolean;
      };
      users_with_trades_since: {
        Args: { p_since: string; p_after: string | null; p_limit: number };
        Returns: { user_id: string }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
