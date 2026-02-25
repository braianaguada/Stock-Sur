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
      customers: {
        Row: {
          created_at: string
          cuit: string | null
          email: string | null
          id: string
          is_occasional: boolean
          name: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          cuit?: string | null
          email?: string | null
          id?: string
          is_occasional?: boolean
          name: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          cuit?: string | null
          email?: string | null
          id?: string
          is_occasional?: boolean
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      item_aliases: {
        Row: {
          alias: string
          created_at: string
          created_by: string | null
          id: string
          is_supplier_code: boolean
          item_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_supplier_code?: boolean
          item_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_supplier_code?: boolean
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_aliases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          brand: string | null
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          sku: string
          unit: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sku: string
          unit?: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sku?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      price_list_lines: {
        Row: {
          created_at: string
          currency: string
          id: string
          item_id: string | null
          match_reason: Database["public"]["Enums"]["match_reason"]
          match_status: Database["public"]["Enums"]["match_status"]
          price: number
          raw_description: string
          supplier_code: string | null
          version_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          item_id?: string | null
          match_reason?: Database["public"]["Enums"]["match_reason"]
          match_status?: Database["public"]["Enums"]["match_status"]
          price: number
          raw_description: string
          supplier_code?: string | null
          version_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          item_id?: string | null
          match_reason?: Database["public"]["Enums"]["match_reason"]
          match_status?: Database["public"]["Enums"]["match_status"]
          price?: number
          raw_description?: string
          supplier_code?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_lines_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "price_list_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_versions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          original_file_url: string | null
          price_list_id: string
          version_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          original_file_url?: string | null
          price_list_id: string
          version_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          original_file_url?: string | null
          price_list_id?: string
          version_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_versions_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          created_at: string
          id: string
          name: string
          supplier_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          supplier_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_lists_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_lines: {
        Row: {
          description: string
          id: string
          item_id: string | null
          quantity: number
          quote_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          item_id?: string | null
          quantity?: number
          quote_id: string
          subtotal?: number
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          item_id?: string | null
          quantity?: number
          quote_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          id: string
          notes: string | null
          quote_number: number
          status: Database["public"]["Enums"]["quote_status"]
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          quote_number?: number
          status?: Database["public"]["Enums"]["quote_status"]
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          quote_number?: number
          status?: Database["public"]["Enums"]["quote_status"]
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          notes: string | null
          quantity: number
          reference: string | null
          type: Database["public"]["Enums"]["movement_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          notes?: string | null
          quantity: number
          reference?: string | null
          type: Database["public"]["Enums"]["movement_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          quantity?: number
          reference?: string | null
          type?: Database["public"]["Enums"]["movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_catalog_lines: {
        Row: {
          cost: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          match_status: Database["public"]["Enums"]["match_status"]
          matched_item_id: string | null
          raw_description: string
          supplier_catalog_version_id: string
          supplier_code: string | null
        }
        Insert: {
          cost: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          match_status?: Database["public"]["Enums"]["match_status"]
          matched_item_id?: string | null
          raw_description: string
          supplier_catalog_version_id: string
          supplier_code?: string | null
        }
        Update: {
          cost?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          match_status?: Database["public"]["Enums"]["match_status"]
          matched_item_id?: string | null
          raw_description?: string
          supplier_catalog_version_id?: string
          supplier_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_catalog_lines_matched_item_id_fkey"
            columns: ["matched_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_catalog_lines_supplier_catalog_version_id_fkey"
            columns: ["supplier_catalog_version_id"]
            isOneToOne: false
            referencedRelation: "supplier_catalog_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_catalog_versions: {
        Row: {
          created_by: string | null
          id: string
          imported_at: string
          note: string | null
          supplier_document_id: string
        }
        Insert: {
          created_by?: string | null
          id?: string
          imported_at?: string
          note?: string | null
          supplier_document_id: string
        }
        Update: {
          created_by?: string | null
          id?: string
          imported_at?: string
          note?: string | null
          supplier_document_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_catalog_versions_supplier_document_id_fkey"
            columns: ["supplier_document_id"]
            isOneToOne: false
            referencedRelation: "supplier_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_documents: {
        Row: {
          created_by: string | null
          file_name: string
          file_type: string
          id: string
          notes: string | null
          source_url: string | null
          supplier_id: string
          title: string
          uploaded_at: string
        }
        Insert: {
          created_by?: string | null
          file_name: string
          file_type: string
          id?: string
          notes?: string | null
          source_url?: string | null
          supplier_id: string
          title: string
          uploaded_at?: string
        }
        Update: {
          created_by?: string | null
          file_name?: string
          file_type?: string
          id?: string
          notes?: string | null
          source_url?: string | null
          supplier_id?: string
          title?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          whatsapp: string | null
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          whatsapp?: string | null
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          whatsapp?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      match_reason: "SUPPLIER_CODE" | "ALIAS_TOKEN" | "ALIAS_CONTAINS" | "NONE"
      match_status: "MATCHED" | "PENDING" | "NEW"
      movement_type: "IN" | "OUT" | "ADJUSTMENT"
      quote_status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED"
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
    Enums: {
      app_role: ["admin", "user"],
      match_status: ["MATCHED", "PENDING", "NEW"],
      movement_type: ["IN", "OUT", "ADJUSTMENT"],
      quote_status: ["DRAFT", "SENT", "ACCEPTED", "REJECTED"],
    },
  },
} as const
