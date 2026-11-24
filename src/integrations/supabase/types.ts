export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      _migration_history_backup_20260806: {
        Row: {
          created_by: string | null;
          idempotency_key: string | null;
          name: string | null;
          rollback: string[] | null;
          statements: string[] | null;
          version: string | null;
        };
        Insert: {
          created_by?: string | null;
          idempotency_key?: string | null;
          name?: string | null;
          rollback?: string[] | null;
          statements?: string[] | null;
          version?: string | null;
        };
        Update: {
          created_by?: string | null;
          idempotency_key?: string | null;
          name?: string | null;
          rollback?: string[] | null;
          statements?: string[] | null;
          version?: string | null;
        };
        Relationships: [];
      };
      account_snapshots: {
        Row: {
          account_id: string;
          balance: number;
          created_at: string;
          currency: string;
          evidence: string | null;
          external_id: string | null;
          id: string;
          observed_at: string;
          source: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          balance: number;
          created_at?: string;
          currency?: string;
          evidence?: string | null;
          external_id?: string | null;
          id?: string;
          observed_at: string;
          source?: string;
          user_id?: string;
        };
        Update: {
          account_id?: string;
          balance?: number;
          created_at?: string;
          currency?: string;
          evidence?: string | null;
          external_id?: string | null;
          id?: string;
          observed_at?: string;
          source?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_snapshots_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      accounts: {
        Row: {
          calibrated_at: string | null;
          calibration_scale: number;
          color: string;
          created_at: string;
          currency: string;
          icon: string | null;
          id: string;
          is_default: boolean;
          name: string;
          original_balance: number | null;
          starting_balance: number;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          calibrated_at?: string | null;
          calibration_scale?: number;
          color?: string;
          created_at?: string;
          currency?: string;
          icon?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          original_balance?: number | null;
          starting_balance?: number;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          calibrated_at?: string | null;
          calibration_scale?: number;
          color?: string;
          created_at?: string;
          currency?: string;
          icon?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          original_balance?: number | null;
          starting_balance?: number;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
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
        Relationships: [
          {
            foreignKeyName: "agent_proposals_pattern_id_fkey";
            columns: ["pattern_id"];
            isOneToOne: false;
            referencedRelation: "detected_patterns";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_agent_runs: {
        Row: {
          agent: string;
          created_at: string;
          error: string | null;
          id: string;
          input_tokens: number | null;
          intent: string;
          latency_ms: number | null;
          model: string | null;
          output_tokens: number | null;
          provider: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          agent: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          input_tokens?: number | null;
          intent?: string;
          latency_ms?: number | null;
          model?: string | null;
          output_tokens?: number | null;
          provider?: string | null;
          status: string;
          user_id: string;
        };
        Update: {
          agent?: string;
          created_at?: string;
          error?: string | null;
          id?: string;
          input_tokens?: number | null;
          intent?: string;
          latency_ms?: number | null;
          model?: string | null;
          output_tokens?: number | null;
          provider?: string | null;
          status?: string;
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
          importance: number;
          key: string | null;
          kind: string;
          source: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          confidence?: number;
          content: string;
          created_at?: string;
          id: string;
          importance?: number;
          key?: string | null;
          kind: string;
          source?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          confidence?: number;
          content?: string;
          created_at?: string;
          id?: string;
          importance?: number;
          key?: string | null;
          kind?: string;
          source?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_rate_limits: {
        Row: {
          count: number;
          scope: string;
          user_id: string;
          window_start: string;
        };
        Insert: {
          count?: number;
          scope?: string;
          user_id: string;
          window_start: string;
        };
        Update: {
          count?: number;
          scope?: string;
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
      broker_accounts: {
        Row: {
          account_id: string | null;
          connection_id: string;
          created_at: string;
          enabled: boolean;
          external_account_id: string;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          connection_id: string;
          created_at?: string;
          enabled?: boolean;
          external_account_id: string;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          account_id?: string | null;
          connection_id?: string;
          created_at?: string;
          enabled?: boolean;
          external_account_id?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "broker_accounts_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "broker_accounts_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "broker_connections";
            referencedColumns: ["id"];
          },
        ];
      };
      broker_connections: {
        Row: {
          api_hosts: Json;
          broker: string;
          created_at: string;
          default_account_id: string | null;
          default_risk: number | null;
          environment: string;
          external_user_id: string | null;
          id: string;
          label: string;
          last_error: string | null;
          last_success_at: string | null;
          last_sync_at: string | null;
          oauth_redirect_uri: string | null;
          oauth_state: string | null;
          refresh_token_ciphertext: string | null;
          status: string;
          sync_cursor: Json;
          timezone: string;
          token_ciphertext: string | null;
          token_expires_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          api_hosts?: Json;
          broker?: string;
          created_at?: string;
          default_account_id?: string | null;
          default_risk?: number | null;
          environment?: string;
          external_user_id?: string | null;
          id?: string;
          label?: string;
          last_error?: string | null;
          last_success_at?: string | null;
          last_sync_at?: string | null;
          oauth_redirect_uri?: string | null;
          oauth_state?: string | null;
          refresh_token_ciphertext?: string | null;
          status?: string;
          sync_cursor?: Json;
          timezone?: string;
          token_ciphertext?: string | null;
          token_expires_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          api_hosts?: Json;
          broker?: string;
          created_at?: string;
          default_account_id?: string | null;
          default_risk?: number | null;
          environment?: string;
          external_user_id?: string | null;
          id?: string;
          label?: string;
          last_error?: string | null;
          last_success_at?: string | null;
          last_sync_at?: string | null;
          oauth_redirect_uri?: string | null;
          oauth_state?: string | null;
          refresh_token_ciphertext?: string | null;
          status?: string;
          sync_cursor?: Json;
          timezone?: string;
          token_ciphertext?: string | null;
          token_expires_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "broker_connections_default_account_id_fkey";
            columns: ["default_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      capture_items: {
        Row: {
          account_id: string | null;
          attempts: number;
          content_hash: string;
          corrections: Json;
          created_at: string;
          error: string | null;
          extraction: Json | null;
          id: string;
          missed_id: string | null;
          model: string | null;
          note: string | null;
          original_extraction: Json | null;
          processed_at: string | null;
          screenshots: string[];
          source: string;
          status: string;
          target: string;
          trade_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          attempts?: number;
          content_hash: string;
          corrections?: Json;
          created_at?: string;
          error?: string | null;
          extraction?: Json | null;
          id?: string;
          missed_id?: string | null;
          model?: string | null;
          note?: string | null;
          original_extraction?: Json | null;
          processed_at?: string | null;
          screenshots?: string[];
          source: string;
          status?: string;
          target?: string;
          trade_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          account_id?: string | null;
          attempts?: number;
          content_hash?: string;
          corrections?: Json;
          created_at?: string;
          error?: string | null;
          extraction?: Json | null;
          id?: string;
          missed_id?: string | null;
          model?: string | null;
          note?: string | null;
          original_extraction?: Json | null;
          processed_at?: string | null;
          screenshots?: string[];
          source?: string;
          status?: string;
          target?: string;
          trade_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "capture_items_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "capture_items_missed_id_fkey";
            columns: ["missed_id"];
            isOneToOne: false;
            referencedRelation: "missed_opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "capture_items_trade_id_fkey";
            columns: ["trade_id"];
            isOneToOne: false;
            referencedRelation: "trades";
            referencedColumns: ["id"];
          },
        ];
      };
      cash_ledger: {
        Row: {
          account_id: string;
          amount: number;
          created_at: string;
          currency: string;
          evidence: string | null;
          external_id: string | null;
          id: string;
          kind: string;
          occurred_at: string;
          source: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          amount: number;
          created_at?: string;
          currency?: string;
          evidence?: string | null;
          external_id?: string | null;
          id?: string;
          kind: string;
          occurred_at: string;
          source?: string;
          user_id?: string;
        };
        Update: {
          account_id?: string;
          amount?: number;
          created_at?: string;
          currency?: string;
          evidence?: string | null;
          external_id?: string | null;
          id?: string;
          kind?: string;
          occurred_at?: string;
          source?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cash_ledger_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      comp_grants: {
        Row: {
          created_at: string;
          email: string;
          expires_at: string | null;
          granted_by: string | null;
          note: string | null;
          plan: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          expires_at?: string | null;
          granted_by?: string | null;
          note?: string | null;
          plan?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          expires_at?: string | null;
          granted_by?: string | null;
          note?: string | null;
          plan?: string;
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
        Relationships: [
          {
            foreignKeyName: "detected_patterns_cluster_id_fkey";
            columns: ["cluster_id"];
            isOneToOne: false;
            referencedRelation: "mistake_clusters";
            referencedColumns: ["id"];
          },
        ];
      };
      discipline_days: {
        Row: {
          checklist_done_at: string | null;
          created_at: string;
          date: string;
          journal_complete: boolean;
          score: number;
          trade_count: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          checklist_done_at?: string | null;
          created_at?: string;
          date: string;
          journal_complete?: boolean;
          score: number;
          trade_count?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          checklist_done_at?: string | null;
          created_at?: string;
          date?: string;
          journal_complete?: boolean;
          score?: number;
          trade_count?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      economic_calendar_backfill: {
        Row: {
          attempted_at: string;
          attempts: number;
          events: number;
          last_error: string | null;
          succeeded: boolean;
          week_start: string;
        };
        Insert: {
          attempted_at?: string;
          attempts?: number;
          events?: number;
          last_error?: string | null;
          succeeded?: boolean;
          week_start: string;
        };
        Update: {
          attempted_at?: string;
          attempts?: number;
          events?: number;
          last_error?: string | null;
          succeeded?: boolean;
          week_start?: string;
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
          account_id: string;
          created_at: string;
          goals: Json;
          horizon_months: number;
          started_at: string;
          tasks_done: Json;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          goals?: Json;
          horizon_months?: number;
          started_at?: string;
          tasks_done?: Json;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          goals?: Json;
          horizon_months?: number;
          started_at?: string;
          tasks_done?: Json;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goal_plans_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      habits: {
        Row: {
          cadence: string;
          created_at: string;
          id: string;
          last_done: string | null;
          name: string;
          streak: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cadence?: string;
          created_at?: string;
          id: string;
          last_done?: string | null;
          name: string;
          streak?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cadence?: string;
          created_at?: string;
          id?: string;
          last_done?: string | null;
          name?: string;
          streak?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      import_batches: {
        Row: {
          accepted: number;
          account_id: string | null;
          completed_at: string | null;
          conflicts: number;
          created_at: string;
          duplicates: number;
          failed: number;
          file_name: string | null;
          file_sha256: string | null;
          id: string;
          probable_duplicates: number;
          rejected: number;
          row_count: number;
          source_kind: string;
          status: string;
          user_id: string;
        };
        Insert: {
          accepted?: number;
          account_id?: string | null;
          completed_at?: string | null;
          conflicts?: number;
          created_at?: string;
          duplicates?: number;
          failed?: number;
          file_name?: string | null;
          file_sha256?: string | null;
          id?: string;
          probable_duplicates?: number;
          rejected?: number;
          row_count?: number;
          source_kind: string;
          status?: string;
          user_id?: string;
        };
        Update: {
          accepted?: number;
          account_id?: string | null;
          completed_at?: string | null;
          conflicts?: number;
          created_at?: string;
          duplicates?: number;
          failed?: number;
          file_name?: string | null;
          file_sha256?: string | null;
          id?: string;
          probable_duplicates?: number;
          rejected?: number;
          row_count?: number;
          source_kind?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "import_batches_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      market_history_assets: {
        Row: {
          category: string;
          last_month: string | null;
          months: number;
          name: string;
          source: string;
          symbol: string;
          updated_at: string;
          verified: boolean;
          witness: string | null;
        };
        Insert: {
          category: string;
          last_month?: string | null;
          months?: number;
          name: string;
          source: string;
          symbol: string;
          updated_at?: string;
          verified?: boolean;
          witness?: string | null;
        };
        Update: {
          category?: string;
          last_month?: string | null;
          months?: number;
          name?: string;
          source?: string;
          symbol?: string;
          updated_at?: string;
          verified?: boolean;
          witness?: string | null;
        };
        Relationships: [];
      };
      market_history_sync: {
        Row: {
          consecutive_failures: number;
          id: boolean;
          last_attempt_at: string | null;
          last_error: string | null;
          last_success_at: string | null;
        };
        Insert: {
          consecutive_failures?: number;
          id?: boolean;
          last_attempt_at?: string | null;
          last_error?: string | null;
          last_success_at?: string | null;
        };
        Update: {
          consecutive_failures?: number;
          id?: boolean;
          last_attempt_at?: string | null;
          last_error?: string | null;
          last_success_at?: string | null;
        };
        Relationships: [];
      };
      market_monthly_closes: {
        Row: {
          close: number;
          month: string;
          source: string;
          symbol: string;
          updated_at: string;
        };
        Insert: {
          close: number;
          month: string;
          source: string;
          symbol: string;
          updated_at?: string;
        };
        Update: {
          close?: number;
          month?: string;
          source?: string;
          symbol?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      missed_opportunities: {
        Row: {
          account_id: string | null;
          classification: string | null;
          created_at: string;
          direction: string | null;
          entry_price: number | null;
          estimated_r: number;
          id: string;
          lesson_learned: string;
          next_time_plan: string;
          opportunity_date: string;
          outcome: string | null;
          reason_code: string | null;
          reason_not_taken: string;
          screenshots: string[];
          stop_price: number | null;
          symbol: string;
          target_price: number | null;
          updated_at: string;
          user_id: string;
          what_happened: string;
        };
        Insert: {
          account_id?: string | null;
          classification?: string | null;
          created_at?: string;
          direction?: string | null;
          entry_price?: number | null;
          estimated_r?: number;
          id?: string;
          lesson_learned?: string;
          next_time_plan?: string;
          opportunity_date: string;
          outcome?: string | null;
          reason_code?: string | null;
          reason_not_taken?: string;
          screenshots?: string[];
          stop_price?: number | null;
          symbol?: string;
          target_price?: number | null;
          updated_at?: string;
          user_id?: string;
          what_happened?: string;
        };
        Update: {
          account_id?: string | null;
          classification?: string | null;
          created_at?: string;
          direction?: string | null;
          entry_price?: number | null;
          estimated_r?: number;
          id?: string;
          lesson_learned?: string;
          next_time_plan?: string;
          opportunity_date?: string;
          outcome?: string | null;
          reason_code?: string | null;
          reason_not_taken?: string;
          screenshots?: string[];
          stop_price?: number | null;
          symbol?: string;
          target_price?: number | null;
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
      mistake_clusters: {
        Row: {
          id: string;
          label_key: string;
          severity: number;
        };
        Insert: {
          id: string;
          label_key: string;
          severity?: number;
        };
        Update: {
          id?: string;
          label_key?: string;
          severity?: number;
        };
        Relationships: [];
      };
      mistake_taxonomy: {
        Row: {
          cluster_id: string;
          mistake: string;
        };
        Insert: {
          cluster_id: string;
          mistake: string;
        };
        Update: {
          cluster_id?: string;
          mistake?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mistake_taxonomy_cluster_id_fkey";
            columns: ["cluster_id"];
            isOneToOne: false;
            referencedRelation: "mistake_clusters";
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
          body: string;
          created_at: string;
          data: Json;
          dedup_key: string | null;
          id: string;
          kind: string;
          read_at: string | null;
          severity: string;
          title: string;
          url: string | null;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          data?: Json;
          dedup_key?: string | null;
          id: string;
          kind: string;
          read_at?: string | null;
          severity?: string;
          title: string;
          url?: string | null;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          data?: Json;
          dedup_key?: string | null;
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
          checklist_config: Json | null;
          confluences: string[];
          created_at: string;
          currency: string;
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
          onboarding_situation: string | null;
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
          checklist_config?: Json | null;
          confluences?: string[];
          created_at?: string;
          currency?: string;
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
          onboarding_situation?: string | null;
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
          checklist_config?: Json | null;
          confluences?: string[];
          created_at?: string;
          currency?: string;
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
          onboarding_situation?: string | null;
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
      progress_experiments: {
        Row: {
          account_id: string | null;
          created_at: string;
          ended_at: string | null;
          final_result: Json | null;
          id: string;
          max_losses: number;
          rule: string;
          seed: number;
          start_day: string;
          status: string;
          supersedes: string | null;
          target_sessions: number;
          user_id: string;
          version: number;
        };
        Insert: {
          account_id?: string | null;
          created_at?: string;
          ended_at?: string | null;
          final_result?: Json | null;
          id?: string;
          max_losses: number;
          rule: string;
          seed: number;
          start_day: string;
          status?: string;
          supersedes?: string | null;
          target_sessions: number;
          user_id?: string;
          version: number;
        };
        Update: {
          account_id?: string | null;
          created_at?: string;
          ended_at?: string | null;
          final_result?: Json | null;
          id?: string;
          max_losses?: number;
          rule?: string;
          seed?: number;
          start_day?: string;
          status?: string;
          supersedes?: string | null;
          target_sessions?: number;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "progress_experiments_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "progress_experiments_supersedes_fkey";
            columns: ["supersedes"];
            isOneToOne: false;
            referencedRelation: "progress_experiments";
            referencedColumns: ["id"];
          },
        ];
      };
      promo_codes: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          discount_percent: number | null;
          expires_at: string | null;
          granted_by: string | null;
          max_uses: number | null;
          note: string | null;
          owner_email: string | null;
          plan: string;
          uses_count: number;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          discount_percent?: number | null;
          expires_at?: string | null;
          granted_by?: string | null;
          max_uses?: number | null;
          note?: string | null;
          owner_email?: string | null;
          plan?: string;
          uses_count?: number;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          discount_percent?: number | null;
          expires_at?: string | null;
          granted_by?: string | null;
          max_uses?: number | null;
          note?: string | null;
          owner_email?: string | null;
          plan?: string;
          uses_count?: number;
        };
        Relationships: [];
      };
      promo_redemptions: {
        Row: {
          code: string;
          created_at: string;
          email: string;
          kind: string;
          plan: string;
          user_id: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          email: string;
          kind: string;
          plan: string;
          user_id: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          email?: string;
          kind?: string;
          plan?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_code_fkey";
            columns: ["code"];
            isOneToOne: false;
            referencedRelation: "promo_codes";
            referencedColumns: ["code"];
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
      raw_ingest_events: {
        Row: {
          account_id: string | null;
          batch_id: string | null;
          diagnostic: string | null;
          id: string;
          payload: Json;
          payload_sha256: string;
          received_at: string;
          source_key: string;
          source_kind: string;
          status: string;
          trade_id: string | null;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          batch_id?: string | null;
          diagnostic?: string | null;
          id?: string;
          payload: Json;
          payload_sha256: string;
          received_at?: string;
          source_key: string;
          source_kind: string;
          status: string;
          trade_id?: string | null;
          user_id?: string;
        };
        Update: {
          account_id?: string | null;
          batch_id?: string | null;
          diagnostic?: string | null;
          id?: string;
          payload?: Json;
          payload_sha256?: string;
          received_at?: string;
          source_key?: string;
          source_kind?: string;
          status?: string;
          trade_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "raw_ingest_events_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "raw_ingest_events_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
        ];
      };
      replay_sessions: {
        Row: {
          account_id: string;
          created_at: string;
          id: string;
          start_date: string;
          start_time: string;
          state: Json;
          status: string;
          symbol: string;
          timeframe: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id: string;
          created_at?: string;
          id?: string;
          start_date: string;
          start_time?: string;
          state?: Json;
          status?: string;
          symbol?: string;
          timeframe?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_id?: string;
          created_at?: string;
          id?: string;
          start_date?: string;
          start_time?: string;
          state?: Json;
          status?: string;
          symbol?: string;
          timeframe?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "replay_sessions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      research_note_results: {
        Row: {
          created_at: string;
          id: string;
          note_id: string;
          result: Json;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          note_id: string;
          result: Json;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          note_id?: string;
          result?: Json;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "research_note_results_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "research_notes";
            referencedColumns: ["id"];
          },
        ];
      };
      research_notes: {
        Row: {
          account_id: string | null;
          archived: boolean;
          cell_key: string;
          created_at: string;
          data_snapshot: Json;
          dimension: string;
          holdout_start: string;
          hypothesis: string;
          id: string;
          method_version: number;
          note: string | null;
          seed: number;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          archived?: boolean;
          cell_key: string;
          created_at?: string;
          data_snapshot: Json;
          dimension: string;
          holdout_start: string;
          hypothesis: string;
          id?: string;
          method_version: number;
          note?: string | null;
          seed: number;
          user_id?: string;
        };
        Update: {
          account_id?: string | null;
          archived?: boolean;
          cell_key?: string;
          created_at?: string;
          data_snapshot?: Json;
          dimension?: string;
          holdout_start?: string;
          hypothesis?: string;
          id?: string;
          method_version?: number;
          note?: string | null;
          seed?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "research_notes_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "simulation_scenarios_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
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
      trade_intent: {
        Row: {
          confidence: number | null;
          created_at: string;
          emotion: string | null;
          id: string;
          initial_stop: number | null;
          initial_target: number | null;
          plan: string | null;
          planned_direction: string | null;
          planned_entry: number | null;
          planned_risk: number | null;
          planned_scenario: string | null;
          planned_stop: number | null;
          planned_target: number | null;
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
          initial_stop?: number | null;
          initial_target?: number | null;
          plan?: string | null;
          planned_direction?: string | null;
          planned_entry?: number | null;
          planned_risk?: number | null;
          planned_scenario?: string | null;
          planned_stop?: number | null;
          planned_target?: number | null;
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
          initial_stop?: number | null;
          initial_target?: number | null;
          plan?: string | null;
          planned_direction?: string | null;
          planned_entry?: number | null;
          planned_risk?: number | null;
          planned_scenario?: string | null;
          planned_stop?: number | null;
          planned_target?: number | null;
          reasoning?: string | null;
          setup?: string | null;
          trade_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trade_intent_trade_id_fkey";
            columns: ["trade_id"];
            isOneToOne: false;
            referencedRelation: "trades";
            referencedColumns: ["id"];
          },
        ];
      };
      trade_reflection: {
        Row: {
          created_at: string;
          execution_override: string | null;
          id: string;
          intensity: number | null;
          note: string | null;
          override_note: string | null;
          plan_respected: string | null;
          reason: string | null;
          reentry_urge: boolean | null;
          trade_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          execution_override?: string | null;
          id?: string;
          intensity?: number | null;
          note?: string | null;
          override_note?: string | null;
          plan_respected?: string | null;
          reason?: string | null;
          reentry_urge?: boolean | null;
          trade_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          execution_override?: string | null;
          id?: string;
          intensity?: number | null;
          note?: string | null;
          override_note?: string | null;
          plan_respected?: string | null;
          reason?: string | null;
          reentry_urge?: boolean | null;
          trade_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trade_reflection_trade_id_fkey";
            columns: ["trade_id"];
            isOneToOne: false;
            referencedRelation: "trades";
            referencedColumns: ["id"];
          },
        ];
      };
      trades: {
        Row: {
          account_id: string | null;
          broker: string | null;
          broker_account: string | null;
          calibration_factor: number;
          confidence: number;
          confluences: string[];
          copied_from: string | null;
          created_at: string;
          direction: string;
          entry_at: string | null;
          entry_price: number | null;
          entry_time: string;
          exit_at: string | null;
          exit_price: number | null;
          exit_time: string;
          external_id: string | null;
          fees: number | null;
          id: string;
          import_key: string | null;
          is_example: boolean;
          mae: number | null;
          mfe: number | null;
          mistakes: string[];
          notes: string;
          pnl: number;
          quantity: number | null;
          r_multiple: number;
          replay_session_id: string | null;
          review_pending: boolean;
          risk_amount: number;
          risk_source: string | null;
          screenshots: string[];
          session_id: string | null;
          setup_quality: number;
          slippage: number | null;
          source: string | null;
          source_timezone: string | null;
          strategy: string;
          symbol: string;
          trade_date: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_id?: string | null;
          broker?: string | null;
          broker_account?: string | null;
          calibration_factor?: number;
          confidence?: number;
          confluences?: string[];
          copied_from?: string | null;
          created_at?: string;
          direction?: string;
          entry_at?: string | null;
          entry_price?: number | null;
          entry_time?: string;
          exit_at?: string | null;
          exit_price?: number | null;
          exit_time?: string;
          external_id?: string | null;
          fees?: number | null;
          id?: string;
          import_key?: string | null;
          is_example?: boolean;
          mae?: number | null;
          mfe?: number | null;
          mistakes?: string[];
          notes?: string;
          pnl?: number;
          quantity?: number | null;
          r_multiple?: number;
          replay_session_id?: string | null;
          review_pending?: boolean;
          risk_amount?: number;
          risk_source?: string | null;
          screenshots?: string[];
          session_id?: string | null;
          setup_quality?: number;
          slippage?: number | null;
          source?: string | null;
          source_timezone?: string | null;
          strategy?: string;
          symbol: string;
          trade_date: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          account_id?: string | null;
          broker?: string | null;
          broker_account?: string | null;
          calibration_factor?: number;
          confidence?: number;
          confluences?: string[];
          copied_from?: string | null;
          created_at?: string;
          direction?: string;
          entry_at?: string | null;
          entry_price?: number | null;
          entry_time?: string;
          exit_at?: string | null;
          exit_price?: number | null;
          exit_time?: string;
          external_id?: string | null;
          fees?: number | null;
          id?: string;
          import_key?: string | null;
          is_example?: boolean;
          mae?: number | null;
          mfe?: number | null;
          mistakes?: string[];
          notes?: string;
          pnl?: number;
          quantity?: number | null;
          r_multiple?: number;
          replay_session_id?: string | null;
          review_pending?: boolean;
          risk_amount?: number;
          risk_source?: string | null;
          screenshots?: string[];
          session_id?: string | null;
          setup_quality?: number;
          slippage?: number | null;
          source?: string | null;
          source_timezone?: string | null;
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
          {
            foreignKeyName: "trades_replay_session_id_fkey";
            columns: ["replay_session_id"];
            isOneToOne: false;
            referencedRelation: "replay_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trades_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "trading_sessions";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "trading_sessions_account_id_fkey";
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
      adjust_memory_confidence: {
        Args: { p_delta: number; p_id: string };
        Returns: number;
      };
      apply_subscription_event: {
        Args: {
          p_cancel_at_period_end: boolean;
          p_crypto_charge_id: string;
          p_current_period_end: string;
          p_event_at: string;
          p_plan: string;
          p_source: string;
          p_status: string;
          p_stripe_customer_id: string;
          p_stripe_subscription_id: string;
          p_user_id: string;
        };
        Returns: string;
      };
      consume_ai_quota: {
        Args: { p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      consume_ai_quota_scoped: {
        Args: { p_limit: number; p_scope: string; p_window_seconds: number };
        Returns: boolean;
      };
      count_trades_in_month: {
        Args: { p_month: string; p_user_id: string };
        Returns: number;
      };
      effective_tier: { Args: { p_user_id: string }; Returns: string };
      find_user_id_by_email: { Args: { p_email: string }; Returns: string };
      owns_account: { Args: { p_account_id: string }; Returns: boolean };
      recalibrate_account: {
        Args: {
          p_account_id: string;
          p_cumulative: number;
          p_cutoff: string;
          p_factor: number;
          p_original_balance: number;
          p_target_balance: number;
        };
        Returns: number;
      };
      recalibrate_account_trades: {
        Args: { p_account_id: string; p_cutoff: string; p_factor: number };
        Returns: number;
      };
      redeem_promo_code: {
        Args: {
          p_code: string;
          p_email: string;
          p_kind: string;
          p_plan: string;
          p_user_id: string;
        };
        Returns: string;
      };
      release_promo_redemption: {
        Args: { p_code: string; p_user_id: string };
        Returns: boolean;
      };
      revoke_lifetime_license: {
        Args: { p_stripe_customer_id: string };
        Returns: number;
      };
      users_with_trades_since: {
        Args: { p_after: string; p_limit: number; p_since: string };
        Returns: {
          user_id: string;
        }[];
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
