/**
 * Tipos do banco Supabase do Okiva (projeto nbevtdkdzxuebmhvypan).
 * Gerado com generate_typescript_types (Supabase MCP) em 2026-11-24 (etapa 9). NÃO editar à mão:
 * regenere após cada migration (`supabase gen types typescript --project-id nbevtdkdzxuebmhvypan`).
 * Colunas em snake_case; o front usa camelCase (ver docs/supabase.md, seção de mapeamento).
 */
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          position: number
          starting_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["account_kind"]
          name: string
          position?: number
          starting_balance?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["account_kind"]
          name?: string
          position?: number
          starting_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_caps: {
        Row: {
          alert_enabled: boolean
          alert_percent: number
          category: string
          created_at: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          alert_enabled?: boolean
          alert_percent?: number
          category: string
          created_at?: string
          updated_at?: string
          user_id?: string
          value: number
        }
        Update: {
          alert_enabled?: boolean
          alert_percent?: number
          category?: string
          created_at?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_caps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          color: Database["public"]["Enums"]["card_color"]
          created_at: string
          due_day: number
          id: string
          invoice: number
          last4: string
          limit: number
          nickname: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: Database["public"]["Enums"]["card_color"]
          created_at?: string
          due_day: number
          id?: string
          invoice?: number
          last4: string
          limit: number
          nickname: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          color?: Database["public"]["Enums"]["card_color"]
          created_at?: string
          due_day?: number
          id?: string
          invoice?: number
          last4?: string
          limit?: number
          nickname?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      category_rules: {
        Row: {
          category: string
          created_at: string
          id: string
          pattern: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          pattern: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          pattern?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_rules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          id: string
          key: string | null
          label: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          key?: string | null
          label: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          key?: string | null
          label?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_deposits: {
        Row: {
          amount: number
          created_at: string
          date: string
          goal_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          goal_id: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          goal_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_deposits_goal_fkey"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "goal_deposits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          deadline: string | null
          deposited: number
          icon: Database["public"]["Enums"]["goal_icon"]
          id: string
          initial_saved: number
          name: string
          saved: number
          started_at: string
          target: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          deposited?: number
          icon?: Database["public"]["Enums"]["goal_icon"]
          id?: string
          initial_saved?: number
          name: string
          saved?: number
          started_at?: string
          target: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          deposited?: number
          icon?: Database["public"]["Enums"]["goal_icon"]
          id?: string
          initial_saved?: number
          name?: string
          saved?: number
          started_at?: string
          target?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_imports: {
        Row: {
          card_id: string | null
          created_at: string
          file_name: string
          id: string
          imported_at: string
          previous_invoice: number | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          file_name: string
          id?: string
          imported_at?: string
          previous_invoice?: number | null
          total: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          card_id?: string | null
          created_at?: string
          file_name?: string
          id?: string
          imported_at?: string
          previous_invoice?: number | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_imports_card_fkey"
            columns: ["card_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "invoice_imports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          budget_total: number
          created_at: string
          email: string
          featured_goal_id: string | null
          hide_balance: boolean
          id: string
          name: string
          notification_prefs: Json
          stage: number
          starting_balance: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          budget_total?: number
          created_at?: string
          email: string
          featured_goal_id?: string | null
          hide_balance?: boolean
          id: string
          name: string
          notification_prefs?: Json
          stage?: number
          starting_balance?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          budget_total?: number
          created_at?: string
          email?: string
          featured_goal_id?: string | null
          hide_balance?: boolean
          id?: string
          name?: string
          notification_prefs?: Json
          stage?: number
          starting_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_featured_goal_fkey"
            columns: ["featured_goal_id", "id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      recurrences: {
        Row: {
          account_id: string | null
          amount: number
          card_id: string | null
          category: string
          created_at: string
          day: number
          end_date: string | null
          id: string
          kind: Database["public"]["Enums"]["tx_kind"]
          last_run: string | null
          method_type: Database["public"]["Enums"]["payment_method"]
          name: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          card_id?: string | null
          category?: string
          created_at?: string
          day: number
          end_date?: string | null
          id?: string
          kind: Database["public"]["Enums"]["tx_kind"]
          last_run?: string | null
          method_type?: Database["public"]["Enums"]["payment_method"]
          name: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          card_id?: string | null
          category?: string
          created_at?: string
          day?: number
          end_date?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["tx_kind"]
          last_run?: string | null
          method_type?: Database["public"]["Enums"]["payment_method"]
          name?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrences_account_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "recurrences_card_fkey"
            columns: ["card_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "recurrences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          meta: Json
          rating: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          message?: string
          meta?: Json
          rating?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          meta?: Json
          rating?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          card_id: string | null
          category: string | null
          created_at: string
          date: string
          id: string
          installment_group: string | null
          installment_number: number | null
          installment_total: number | null
          invoice_id: string | null
          kind: Database["public"]["Enums"]["tx_kind"]
          method_type: Database["public"]["Enums"]["payment_method"]
          name: string
          posted: boolean
          recurrence_id: string | null
          source: Database["public"]["Enums"]["tx_source"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          card_id?: string | null
          category?: string | null
          created_at?: string
          date?: string
          id?: string
          installment_group?: string | null
          installment_number?: number | null
          installment_total?: number | null
          invoice_id?: string | null
          kind?: Database["public"]["Enums"]["tx_kind"]
          method_type?: Database["public"]["Enums"]["payment_method"]
          name: string
          posted?: boolean
          recurrence_id?: string | null
          source?: Database["public"]["Enums"]["tx_source"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          card_id?: string | null
          category?: string | null
          created_at?: string
          date?: string
          id?: string
          installment_group?: string | null
          installment_number?: number | null
          installment_total?: number | null
          invoice_id?: string | null
          kind?: Database["public"]["Enums"]["tx_kind"]
          method_type?: Database["public"]["Enums"]["payment_method"]
          name?: string
          posted?: boolean
          recurrence_id?: string | null
          source?: Database["public"]["Enums"]["tx_source"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_fkey"
            columns: ["account_id", "user_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transactions_card_fkey"
            columns: ["card_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transactions_invoice_fkey"
            columns: ["invoice_id", "user_id"]
            isOneToOne: false
            referencedRelation: "invoice_imports"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transactions_recurrence_fkey"
            columns: ["recurrence_id", "user_id"]
            isOneToOne: false
            referencedRelation: "recurrences"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      balance_of: { Args: { p_user: string }; Returns: number }
      card_effect: {
        Args: {
          p_amount: number
          p_kind: Database["public"]["Enums"]["tx_kind"]
          p_method: Database["public"]["Enums"]["payment_method"]
          p_posted: boolean
        }
        Returns: number
      }
      clear_my_data: { Args: never; Returns: undefined }
      delete_category: {
        Args: { p_category: string; p_move_to?: string }
        Returns: undefined
      }
      delete_my_account: { Args: never; Returns: undefined }
      ensure_default_account: { Args: { p_user: string }; Returns: string }
      import_invoice: {
        Args: {
          p_card_id: string
          p_file_name: string
          p_items: Json
          p_total: number
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      is_builtin_category: { Args: { p_category: string }; Returns: boolean }
      is_demo: { Args: never; Returns: boolean }
      is_income_category: { Args: { p_category: string }; Returns: boolean }
      is_valid_category: {
        Args: { p_category: string; p_user: string }
        Returns: boolean
      }
      normalize_label: { Args: { p_label: string }; Returns: string }
      process_due: { Args: never; Returns: number }
      profile_exists: { Args: { p_user: string }; Returns: boolean }
      recent_email_verification: { Args: { p_minutes?: number }; Returns: boolean }
      recategorize_transactions: {
        Args: { p_category: string | null; p_ids: string[] }
        Returns: number
      }
      reorder_cards: { Args: { p_order: string[] }; Returns: undefined }
      save_installments: {
        Args: {
          p_card_id: string
          p_category: string
          p_count: number
          p_first_date: string
          p_group: string
          p_name: string
          p_total: number
        }
        Returns: string
      }
      seed_default_categories: { Args: { p_user: string }; Returns: undefined }
      seed_demo_account: { Args: never; Returns: undefined }
      set_balance: { Args: { p_balance: number }; Returns: number }
    }
    Enums: {
      account_kind: "checking" | "savings" | "wallet"
      card_color: "gradient" | "lilac" | "offwhite"
      goal_icon: "plane" | "shield" | "book" | "car" | "target"
      payment_method: "card" | "pix" | "cash"
      tx_kind: "expense" | "income" | "invoice_payment"
      tx_source: "manual" | "fatura"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_kind: ["checking", "savings", "wallet"],
      card_color: ["gradient", "lilac", "offwhite"],
      goal_icon: ["plane", "shield", "book", "car", "target"],
      payment_method: ["card", "pix", "cash"],
      tx_kind: ["expense", "income", "invoice_payment"],
      tx_source: ["manual", "fatura"],
    },
  },
} as const
