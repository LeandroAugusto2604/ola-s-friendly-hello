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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      client_photo_invites: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          token_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_photo_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_registration_invites: {
        Row: {
          client_id: string | null
          completed_at: string | null
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          token_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_registration_invites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string
          cpf: string
          created_at: string
          full_name: string
          id: string
          identity_photo_path: string | null
          phone: string | null
          rg: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address: string
          cpf: string
          created_at?: string
          full_name: string
          id?: string
          identity_photo_path?: string | null
          phone?: string | null
          rg: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string
          cpf?: string
          created_at?: string
          full_name?: string
          id?: string
          identity_photo_path?: string | null
          phone?: string | null
          rg?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      identity_verifications: {
        Row: {
          created_at: string
          id: string
          loan_id: string
          photo_url: string | null
          status: string
          token: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          loan_id: string
          photo_url?: string | null
          status?: string
          token: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          loan_id?: string
          photo_url?: string | null
          status?: string
          token?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identity_verifications_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          amount: number
          amount_paid: number
          created_at: string
          due_date: string
          id: string
          installment_number: number
          loan_id: string
          paid: boolean
          paid_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          created_at?: string
          due_date: string
          id?: string
          installment_number: number
          loan_id: string
          paid?: boolean
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          created_at?: string
          due_date?: string
          id?: string
          installment_number?: number
          loan_id?: string
          paid?: boolean
          paid_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      interest_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          loan_id: string
          notes: string | null
          paid_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          loan_id: string
          notes?: string | null
          paid_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          loan_id?: string
          notes?: string | null
          paid_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interest_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          daily_late_fee: number
          id: string
          installments_count: number
          interest_rate: number | null
          original_amount: number
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          daily_late_fee?: number
          id?: string
          installments_count: number
          interest_rate?: number | null
          original_amount: number
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          daily_late_fee?: number
          id?: string
          installments_count?: number
          interest_rate?: number | null
          original_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_daily_deliveries: {
        Row: {
          created_at: string
          delivery_date: string
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_date: string
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_date?: string
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_daily_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
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
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_daily_overdue_push: {
        Args: never
        Returns: {
          auth: string
          endpoint: string
          overdue_count: number
          p256dh: string
          subscription_id: string
        }[]
      }
      clear_client_identity_photo: {
        Args: { p_client_id: string }
        Returns: Json
      }
      client_photo_invite_status: { Args: { p_token: string }; Returns: string }
      client_registration_invite_status: {
        Args: { p_token: string }
        Returns: string
      }
      complete_client_photo: {
        Args: { p_photo_path: string; p_token: string }
        Returns: Json
      }
      complete_client_registration_with_photo: {
        Args: {
          p_address: string
          p_cpf: string
          p_full_name: string
          p_phone: string
          p_photo_path: string
          p_rg: string
          p_token: string
        }
        Returns: undefined
      }
      create_client_photo_invite: {
        Args: { p_client_id: string }
        Returns: Json
      }
      create_client_registration_invite: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      submit_client_registration: {
        Args: {
          p_address: string
          p_cpf: string
          p_full_name: string
          p_phone: string
          p_rg: string
          p_token: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
