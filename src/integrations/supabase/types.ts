export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          color: string
          created_at: string
          currency: string
          id: string
          is_default: boolean
          name: string
          starting_balance: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
          name?: string
          starting_balance?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
          name?: string
          starting_balance?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_memory: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id: string
          kind: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_rate_limits: {
        Row: {
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      ai_reports: {
        Row: {
          content: Json
          created_at: string
          id: string
          kind: string
          period_key: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id: string
          kind: string
          period_key: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          kind?: string
          period_key?: string
          user_id?: string
        }
        Relationships: []
      }
      email_log: {
        Row: {
          email_key: string
          sent_at: string
          user_id: string
        }
        Insert: {
          email_key: string
          sent_at?: string
          user_id: string
        }
        Update: {
          email_key?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goal_plans: {
        Row: {
          created_at: string
          goals: Json
          horizon_months: number
          started_at: string
          tasks_done: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goals?: Json
          horizon_months?: number
          started_at?: string
          tasks_done?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          goals?: Json
          horizon_months?: number
          started_at?: string
          tasks_done?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      habits: {
        Row: {
          cadence: string
          created_at: string
          id: string
          last_done: string | null
          name: string
          streak: number
          user_id: string
        }
        Insert: {
          cadence?: string
          created_at?: string
          id: string
          last_done?: string | null
          name: string
          streak?: number
          user_id: string
        }
        Update: {
          cadence?: string
          created_at?: string
          id?: string
          last_done?: string | null
          name?: string
          streak?: number
          user_id?: string
        }
        Relationships: []
      }
      missed_opportunities: {
        Row: {
          account_id: string | null
          created_at: string
          estimated_r: number
          id: string
          lesson_learned: string
          next_time_plan: string
          opportunity_date: string
          reason_not_taken: string
          screenshots: string[]
          symbol: string
          updated_at: string
          user_id: string
          what_happened: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          estimated_r?: number
          id?: string
          lesson_learned?: string
          next_time_plan?: string
          opportunity_date: string
          reason_not_taken?: string
          screenshots?: string[]
          symbol?: string
          updated_at?: string
          user_id?: string
          what_happened?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          estimated_r?: number
          id?: string
          lesson_learned?: string
          next_time_plan?: string
          opportunity_date?: string
          reason_not_taken?: string
          screenshots?: string[]
          symbol?: string
          updated_at?: string
          user_id?: string
          what_happened?: string
        }
        Relationships: [
          {
            foreignKeyName: "missed_opportunities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_reports: {
        Row: {
          created_at: string
          id: string
          month: string
          report: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          report: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          report?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json
          id: string
          kind: string
          read_at: string | null
          severity: string
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json
          id: string
          kind: string
          read_at?: string | null
          severity?: string
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          read_at?: string | null
          severity?: string
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      processed_webhook_events: {
        Row: {
          event_id: string
          processed_at: string
          provider: string
        }
        Insert: {
          event_id: string
          processed_at?: string
          provider: string
        }
        Update: {
          event_id?: string
          processed_at?: string
          provider?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_balance: number
          active_account_id: string | null
          confluences: string[]
          created_at: string
          email: string
          id: string
          language: string
          name: string
          onboarded_at: string | null
          onboarding_assets: string[]
          onboarding_brokers: string[]
          onboarding_experience: string | null
          onboarding_goal: string | null
          onboarding_monthly_target: number | null
          onboarding_pain: string | null
          onboarding_skipped: boolean
          onboarding_style: string | null
          onboarding_uses_ict: boolean
          starting_balance: number
          trading_plan: Json
          trading_rules: Json
          trustpilot_prompted_at: string | null
          trustpilot_status: string | null
          updated_at: string
        }
        Insert: {
          account_balance?: number
          active_account_id?: string | null
          confluences?: string[]
          created_at?: string
          email?: string
          id: string
          language?: string
          name?: string
          onboarded_at?: string | null
          onboarding_assets?: string[]
          onboarding_brokers?: string[]
          onboarding_experience?: string | null
          onboarding_goal?: string | null
          onboarding_monthly_target?: number | null
          onboarding_pain?: string | null
          onboarding_skipped?: boolean
          onboarding_style?: string | null
          onboarding_uses_ict?: boolean
          starting_balance?: number
          trading_plan?: Json
          trading_rules?: Json
          trustpilot_prompted_at?: string | null
          trustpilot_status?: string | null
          updated_at?: string
        }
        Update: {
          account_balance?: number
          active_account_id?: string | null
          confluences?: string[]
          created_at?: string
          email?: string
          id?: string
          language?: string
          name?: string
          onboarded_at?: string | null
          onboarding_assets?: string[]
          onboarding_brokers?: string[]
          onboarding_experience?: string | null
          onboarding_goal?: string | null
          onboarding_monthly_target?: number | null
          onboarding_pain?: string | null
          onboarding_skipped?: boolean
          onboarding_style?: string | null
          onboarding_uses_ict?: boolean
          starting_balance?: number
          trading_plan?: Json
          trading_rules?: Json
          trustpilot_prompted_at?: string | null
          trustpilot_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_account_id_fkey"
            columns: ["active_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      six_month_goals: {
        Row: {
          created_at: string
          kind: string
          start_value: number
          started_at: string
          target_value: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          kind: string
          start_value: number
          started_at?: string
          target_value: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          kind?: string
          start_value?: number
          started_at?: string
          target_value?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          crypto_charge_id: string | null
          current_period_end: string | null
          plan: string
          source: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          crypto_charge_id?: string | null
          current_period_end?: string | null
          plan?: string
          source?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          crypto_charge_id?: string | null
          current_period_end?: string | null
          plan?: string
          source?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          account_id: string | null
          confidence: number
          confluences: string[]
          created_at: string
          direction: string
          entry_time: string
          exit_time: string
          id: string
          is_example: boolean
          mae: number | null
          mfe: number | null
          mistakes: string[]
          notes: string
          pnl: number
          r_multiple: number
          risk_amount: number
          screenshots: string[]
          setup_quality: number
          slippage: number | null
          strategy: string
          symbol: string
          trade_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          confidence?: number
          confluences?: string[]
          created_at?: string
          direction?: string
          entry_time?: string
          exit_time?: string
          id?: string
          is_example?: boolean
          mae?: number | null
          mfe?: number | null
          mistakes?: string[]
          notes?: string
          pnl?: number
          r_multiple?: number
          risk_amount?: number
          screenshots?: string[]
          setup_quality?: number
          slippage?: number | null
          strategy?: string
          symbol: string
          trade_date: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          confidence?: number
          confluences?: string[]
          created_at?: string
          direction?: string
          entry_time?: string
          exit_time?: string
          id?: string
          is_example?: boolean
          mae?: number | null
          mfe?: number | null
          mistakes?: string[]
          notes?: string
          pnl?: number
          r_multiple?: number
          risk_amount?: number
          screenshots?: string[]
          setup_quality?: number
          slippage?: number | null
          strategy?: string
          symbol?: string
          trade_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          prefs: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          prefs?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          prefs?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_ai_quota: {
        Args: { p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
