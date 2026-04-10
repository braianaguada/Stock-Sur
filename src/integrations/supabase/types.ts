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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      cash_closures: {
        Row: {
          business_date: string
          cash_difference: number | null
          closed_at: string | null
          company_id: string
          counted_cash_total: number | null
          counted_point_total: number | null
          counted_transfer_total: number | null
          created_at: string
          created_by: string
          expected_account_expenses_total: number
          expected_account_sales_total: number
          expected_cash_facturable_total: number
          expected_cash_remito_total: number
          expected_cash_expenses_total: number
          expected_cash_sales_total: number
          expected_cash_to_render: number
          expected_non_cash_total: number
          expected_point_sales_total: number
          expected_sales_total: number
          expected_services_remito_total: number
          expected_transfer_sales_total: number
          id: string
          notes: string | null
          point_difference: number | null
          responsible_id: string
          status: Database["public"]["Enums"]["cash_closure_status"]
          transfer_difference: number | null
          updated_at: string
        }
        Insert: {
          business_date: string
          cash_difference?: number | null
          closed_at?: string | null
          company_id: string
          counted_cash_total?: number | null
          counted_point_total?: number | null
          counted_transfer_total?: number | null
          created_at?: string
          created_by?: string
          expected_account_expenses_total?: number
          expected_account_sales_total?: number
          expected_cash_facturable_total?: number
          expected_cash_remito_total?: number
          expected_cash_expenses_total?: number
          expected_cash_sales_total?: number
          expected_cash_to_render?: number
          expected_non_cash_total?: number
          expected_point_sales_total?: number
          expected_sales_total?: number
          expected_services_remito_total?: number
          expected_transfer_sales_total?: number
          id?: string
          notes?: string | null
          point_difference?: number | null
          responsible_id?: string
          status?: Database["public"]["Enums"]["cash_closure_status"]
          transfer_difference?: number | null
          updated_at?: string
        }
        Update: {
          business_date?: string
          cash_difference?: number | null
          closed_at?: string | null
          company_id?: string
          counted_cash_total?: number | null
          counted_point_total?: number | null
          counted_transfer_total?: number | null
          created_at?: string
          created_by?: string
          expected_account_expenses_total?: number
          expected_account_sales_total?: number
          expected_cash_facturable_total?: number
          expected_cash_remito_total?: number
          expected_cash_expenses_total?: number
          expected_cash_sales_total?: number
          expected_cash_to_render?: number
          expected_non_cash_total?: number
          expected_point_sales_total?: number
          expected_sales_total?: number
          expected_services_remito_total?: number
          expected_transfer_sales_total?: number
          id?: string
          notes?: string | null
          point_difference?: number | null
          responsible_id?: string
          status?: Database["public"]["Enums"]["cash_closure_status"]
          transfer_difference?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_closures_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_events: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["cash_event_entity_type"]
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["cash_event_entity_type"]
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["cash_event_entity_type"]
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_expenses: {
        Row: {
          amount_total: number
          business_date: string
          cancelled_at: string | null
          cancelled_by: string | null
          closure_id: string | null
          company_id: string
          created_at: string
          created_by: string
          description: string
          expense_kind: Database["public"]["Enums"]["cash_expense_kind"]
          id: string
          notes: string | null
          receipt_reference: string | null
          spent_at: string
          updated_at: string
        }
        Insert: {
          amount_total: number
          business_date?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          closure_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string
          description: string
          expense_kind?: Database["public"]["Enums"]["cash_expense_kind"]
          id?: string
          notes?: string | null
          receipt_reference?: string | null
          spent_at?: string
          updated_at?: string
        }
        Update: {
          amount_total?: number
          business_date?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          closure_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string
          expense_kind?: Database["public"]["Enums"]["cash_expense_kind"]
          id?: string
          notes?: string | null
          receipt_reference?: string | null
          spent_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_expenses_closure_id_fkey"
            columns: ["closure_id"]
            isOneToOne: false
            referencedRelation: "cash_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sales: {
        Row: {
          amount_total: number
          business_date: string
          cancelled_at: string | null
          cancelled_by: string | null
          closure_id: string | null
          company_id: string
          created_at: string
          created_by: string
          customer_id: string | null
          customer_name_snapshot: string | null
          document_id: string | null
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["cash_payment_method"]
          receipt_kind: Database["public"]["Enums"]["cash_receipt_kind"]
          receipt_reference: string | null
          sold_at: string
          status: Database["public"]["Enums"]["cash_sale_status"]
          updated_at: string
        }
        Insert: {
          amount_total: number
          business_date?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          closure_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_name_snapshot?: string | null
          document_id?: string | null
          id?: string
          notes?: string | null
          payment_method: Database["public"]["Enums"]["cash_payment_method"]
          receipt_kind?: Database["public"]["Enums"]["cash_receipt_kind"]
          receipt_reference?: string | null
          sold_at?: string
          status?: Database["public"]["Enums"]["cash_sale_status"]
          updated_at?: string
        }
        Update: {
          amount_total?: number
          business_date?: string
          cancelled_at?: string | null
          cancelled_by?: string | null
          closure_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_name_snapshot?: string | null
          document_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["cash_payment_method"]
          receipt_kind?: Database["public"]["Enums"]["cash_receipt_kind"]
          receipt_reference?: string | null
          sold_at?: string
          status?: Database["public"]["Enums"]["cash_sale_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sales_closure_id_fkey"
            columns: ["closure_id"]
            isOneToOne: false
            referencedRelation: "cash_closures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sales_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          status: Database["public"]["Enums"]["company_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          accent_color: string
          address: string | null
          allow_issue_remitos_without_stock: boolean
          app_name: string
          company_id: string
          created_at: string
          default_point_of_sale: number
          document_footer: string | null
          document_tagline: string | null
          email: string | null
          id: number
          legal_name: string | null
          logo_url: string | null
          phone: string | null
          primary_color: string
          secondary_color: string
          tax_id: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          accent_color?: string
          address?: string | null
          allow_issue_remitos_without_stock?: boolean
          app_name?: string
          company_id: string
          created_at?: string
          default_point_of_sale?: number
          document_footer?: string | null
          document_tagline?: string | null
          email?: string | null
          id?: number
          legal_name?: string | null
          logo_url?: string | null
          phone?: string | null
          primary_color?: string
          secondary_color?: string
          tax_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          accent_color?: string
          address?: string | null
          allow_issue_remitos_without_stock?: boolean
          app_name?: string
          company_id?: string
          created_at?: string
          default_point_of_sale?: number
          document_footer?: string | null
          document_tagline?: string | null
          email?: string | null
          id?: number
          legal_name?: string | null
          logo_url?: string | null
          phone?: string | null
          primary_color?: string
          secondary_color?: string
          tax_id?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_user_permissions: {
        Row: {
          company_user_id: string
          created_at: string
          effect: Database["public"]["Enums"]["permission_effect"]
          id: string
          permission_id: string
        }
        Insert: {
          company_user_id: string
          created_at?: string
          effect: Database["public"]["Enums"]["permission_effect"]
          id?: string
          permission_id: string
        }
        Update: {
          company_user_id?: string
          created_at?: string
          effect?: Database["public"]["Enums"]["permission_effect"]
          id?: string
          permission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_user_permissions_company_user_id_fkey"
            columns: ["company_user_id"]
            isOneToOne: false
            referencedRelation: "company_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      company_user_roles: {
        Row: {
          company_user_id: string
          created_at: string
          role_id: string
        }
        Insert: {
          company_user_id: string
          created_at?: string
          role_id: string
        }
        Update: {
          company_user_id?: string
          created_at?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_user_roles_company_user_id_fkey"
            columns: ["company_user_id"]
            isOneToOne: false
            referencedRelation: "company_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_users: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          status: Database["public"]["Enums"]["company_user_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["company_user_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["company_user_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          cuit: string | null
          email: string | null
          id: string
          is_occasional: boolean
          name: string
          phone: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          cuit?: string | null
          email?: string | null
          id?: string
          is_occasional?: boolean
          name: string
          phone?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          cuit?: string | null
          email?: string | null
          id?: string
          is_occasional?: boolean
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_events: {
        Row: {
          created_at: string
          created_by: string
          document_id: string
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          document_id: string
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string
          document_id?: string
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "document_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_lines: {
        Row: {
          base_cost_snapshot: number | null
          created_at: string
          created_by: string
          description: string
          discount_pct: number
          document_id: string
          id: string
          item_id: string | null
          line_order: number
          line_total: number
          list_flete_pct_snapshot: number | null
          list_impuesto_pct_snapshot: number | null
          list_utilidad_pct_snapshot: number | null
          manual_margin_pct: number | null
          price_overridden_at: string | null
          price_overridden_by: string | null
          pricing_mode: string
          quantity: number
          sku_snapshot: string | null
          suggested_unit_price: number
          tax_pct: number
          unit: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          base_cost_snapshot?: number | null
          created_at?: string
          created_by?: string
          description: string
          discount_pct?: number
          document_id: string
          id?: string
          item_id?: string | null
          line_order?: number
          line_total?: number
          list_flete_pct_snapshot?: number | null
          list_impuesto_pct_snapshot?: number | null
          list_utilidad_pct_snapshot?: number | null
          manual_margin_pct?: number | null
          price_overridden_at?: string | null
          price_overridden_by?: string | null
          pricing_mode?: string
          quantity?: number
          sku_snapshot?: string | null
          suggested_unit_price?: number
          tax_pct?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          base_cost_snapshot?: number | null
          created_at?: string
          created_by?: string
          description?: string
          discount_pct?: number
          document_id?: string
          id?: string
          item_id?: string | null
          line_order?: number
          line_total?: number
          list_flete_pct_snapshot?: number | null
          list_impuesto_pct_snapshot?: number | null
          list_utilidad_pct_snapshot?: number | null
          manual_margin_pct?: number | null
          price_overridden_at?: string | null
          price_overridden_by?: string | null
          pricing_mode?: string
          quantity?: number
          sku_snapshot?: string | null
          suggested_unit_price?: number
          tax_pct?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_lines_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sequences: {
        Row: {
          company_id: string
          doc_type: Database["public"]["Enums"]["document_type"]
          id: string
          last_number: number
          point_of_sale: number
          updated_at: string
        }
        Insert: {
          company_id: string
          doc_type: Database["public"]["Enums"]["document_type"]
          id?: string
          last_number?: number
          point_of_sale?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          doc_type?: Database["public"]["Enums"]["document_type"]
          id?: string
          last_number?: number
          point_of_sale?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          customer_id: string | null
          customer_kind: Database["public"]["Enums"]["document_customer_kind"]
          customer_name: string | null
          customer_tax_condition: string | null
          customer_tax_id: string | null
          delivery_address: string | null
          discount_total: number
          doc_type: Database["public"]["Enums"]["document_type"]
          document_number: number | null
          id: string
          internal_remito_type:
            | Database["public"]["Enums"]["internal_remito_type"]
            | null
          issue_date: string
          notes: string | null
          payment_terms: string | null
          point_of_sale: number
          price_list_id: string | null
          salesperson: string | null
          source_document_id: string | null
          source_document_number_snapshot: string | null
          source_document_type:
            | Database["public"]["Enums"]["document_type"]
            | null
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_kind?: Database["public"]["Enums"]["document_customer_kind"]
          customer_name?: string | null
          customer_tax_condition?: string | null
          customer_tax_id?: string | null
          delivery_address?: string | null
          discount_total?: number
          doc_type: Database["public"]["Enums"]["document_type"]
          document_number?: number | null
          id?: string
          internal_remito_type?:
            | Database["public"]["Enums"]["internal_remito_type"]
            | null
          issue_date?: string
          notes?: string | null
          payment_terms?: string | null
          point_of_sale?: number
          price_list_id?: string | null
          salesperson?: string | null
          source_document_id?: string | null
          source_document_number_snapshot?: string | null
          source_document_type?:
            | Database["public"]["Enums"]["document_type"]
            | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_kind?: Database["public"]["Enums"]["document_customer_kind"]
          customer_name?: string | null
          customer_tax_condition?: string | null
          customer_tax_id?: string | null
          delivery_address?: string | null
          discount_total?: number
          doc_type?: Database["public"]["Enums"]["document_type"]
          document_number?: number | null
          id?: string
          internal_remito_type?:
            | Database["public"]["Enums"]["internal_remito_type"]
            | null
          issue_date?: string
          notes?: string | null
          payment_terms?: string | null
          point_of_sale?: number
          price_list_id?: string | null
          salesperson?: string | null
          source_document_id?: string | null
          source_document_number_snapshot?: string | null
          source_document_type?:
            | Database["public"]["Enums"]["document_type"]
            | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      global_user_roles: {
        Row: {
          created_at: string
          role_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      item_aliases: {
        Row: {
          alias: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          is_supplier_code: boolean
          item_id: string
        }
        Insert: {
          alias: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_supplier_code?: boolean
          item_id: string
        }
        Update: {
          alias?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_supplier_code?: boolean
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_aliases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          attributes: string | null
          brand: string | null
          category: string | null
          company_id: string
          created_at: string
          created_by: string | null
          demand_monthly_estimate: number | null
          demand_profile: Database["public"]["Enums"]["item_demand_profile"]
          id: string
          is_active: boolean
          model: string | null
          name: string
          sku: string
          supplier: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          attributes?: string | null
          brand?: string | null
          category?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          demand_monthly_estimate?: number | null
          demand_profile?: Database["public"]["Enums"]["item_demand_profile"]
          id?: string
          is_active?: boolean
          model?: string | null
          name: string
          sku: string
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          attributes?: string | null
          brand?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          demand_monthly_estimate?: number | null
          demand_profile?: Database["public"]["Enums"]["item_demand_profile"]
          id?: string
          is_active?: boolean
          model?: string | null
          name?: string
          sku?: string
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          code: string
          created_at: string
          description: string | null
          id: string
          module: string
        }
        Insert: {
          action: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          module: string
        }
        Update: {
          action?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string
        }
        Relationships: []
      }
      item_pricing_base: {
        Row: {
          base_cost: number
          company_id: string
          item_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_cost?: number
          company_id: string
          item_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_cost?: number
          company_id?: string
          item_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_pricing_base_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_pricing_base_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_pricing_base_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          company_id: string
          id: string
          item_id: string
          new_base_cost: number
          previous_base_cost: number
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          company_id: string
          id?: string
          item_id: string
          new_base_cost?: number
          previous_base_cost?: number
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          company_id?: string
          id?: string
          item_id?: string
          new_base_cost?: number
          previous_base_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_pricing_base_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_pricing_base_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_items: {
        Row: {
          base_cost: number
          calculated_price: number
          company_id: string
          created_at: string
          created_by: string | null
          final_price_override: number | null
          flete_pct: number | null
          impuesto_pct: number | null
          is_active: boolean
          item_id: string
          last_calculated_at: string | null
          last_calculated_by: string | null
          needs_recalculation: boolean
          price_list_id: string
          price_override: number | null
          utilidad_pct: number | null
        }
        Insert: {
          base_cost?: number
          calculated_price?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          final_price_override?: number | null
          flete_pct?: number | null
          impuesto_pct?: number | null
          is_active?: boolean
          item_id: string
          last_calculated_at?: string | null
          last_calculated_by?: string | null
          needs_recalculation?: boolean
          price_list_id: string
          price_override?: number | null
          utilidad_pct?: number | null
        }
        Update: {
          base_cost?: number
          calculated_price?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          final_price_override?: number | null
          flete_pct?: number | null
          impuesto_pct?: number | null
          is_active?: boolean
          item_id?: string
          last_calculated_at?: string | null
          last_calculated_by?: string | null
          needs_recalculation?: boolean
          price_list_id?: string
          price_override?: number | null
          utilidad_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "price_list_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_items_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_history: {
        Row: {
          affected_items_count: number
          company_id: string
          created_at: string
          created_by: string | null
          details: Json
          event_type: string
          id: string
          price_list_id: string
        }
        Insert: {
          affected_items_count?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          details?: Json
          event_type: string
          id?: string
          price_list_id: string
        }
        Update: {
          affected_items_count?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          details?: Json
          event_type?: string
          id?: string
          price_list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_history_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_lines: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          item_id: string | null
          match_status: Database["public"]["Enums"]["match_status"]
          price: number
          raw_description: string
          supplier_code: string | null
          version_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          item_id?: string | null
          match_status?: Database["public"]["Enums"]["match_status"]
          price: number
          raw_description: string
          supplier_code?: string | null
          version_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          item_id?: string | null
          match_status?: Database["public"]["Enums"]["match_status"]
          price?: number
          raw_description?: string
          supplier_code?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          original_file_url: string | null
          price_list_id: string
          version_date: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          original_file_url?: string | null
          price_list_id: string
          version_date?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          original_file_url?: string | null
          price_list_id?: string
          version_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          flete_pct: number
          id: string
          impuesto_pct: number
          last_recalculated_at: string | null
          last_recalculated_by: string | null
          name: string
          round_mode: string
          round_to: number
          status: string
          supplier_id: string | null
          updated_at: string
          updated_by: string | null
          utilidad_pct: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          flete_pct?: number
          id?: string
          impuesto_pct?: number
          last_recalculated_at?: string | null
          last_recalculated_by?: string | null
          name: string
          round_mode?: string
          round_to?: number
          status?: string
          supplier_id?: string | null
          updated_at?: string
          updated_by?: string | null
          utilidad_pct?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          flete_pct?: number
          id?: string
          impuesto_pct?: number
          last_recalculated_at?: string | null
          last_recalculated_by?: string | null
          name?: string
          round_mode?: string
          round_to?: number
          status?: string
          supplier_id?: string | null
          updated_at?: string
          updated_by?: string | null
          utilidad_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_lists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string
          created_by: string | null
          description: string
          id: string
          item_id: string | null
          quantity: number
          quote_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          company_id: string
          created_by?: string | null
          description: string
          id?: string
          item_id?: string | null
          quantity?: number
          quote_id: string
          subtotal?: number
          unit_price?: number
        }
        Update: {
          company_id?: string
          created_by?: string | null
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
            foreignKeyName: "quote_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string
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
          company_id: string
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
          company_id?: string
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
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          scope: Database["public"]["Enums"]["role_scope"]
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          scope: Database["public"]["Enums"]["role_scope"]
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          scope?: Database["public"]["Enums"]["role_scope"]
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          company_id: string
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
          company_id: string
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
          company_id?: string
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
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          company_id: string
          cost: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          match_status: Database["public"]["Enums"]["match_status"]
          matched_item_id: string | null
          normalized_description: string | null
          raw_description: string
          row_index: number | null
          supplier_catalog_version_id: string
          supplier_code: string | null
        }
        Insert: {
          company_id: string
          cost: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          match_status?: Database["public"]["Enums"]["match_status"]
          matched_item_id?: string | null
          normalized_description?: string | null
          raw_description: string
          row_index?: number | null
          supplier_catalog_version_id: string
          supplier_code?: string | null
        }
        Update: {
          company_id?: string
          cost?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          match_status?: Database["public"]["Enums"]["match_status"]
          matched_item_id?: string | null
          normalized_description?: string | null
          raw_description?: string
          row_index?: number | null
          supplier_catalog_version_id?: string
          supplier_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_catalog_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
          catalog_id: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          imported_at: string
          note: string | null
          supplier_document_id: string
          supplier_id: string
          title: string | null
        }
        Insert: {
          catalog_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          imported_at?: string
          note?: string | null
          supplier_document_id: string
          supplier_id: string
          title?: string | null
        }
        Update: {
          catalog_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          imported_at?: string
          note?: string | null
          supplier_document_id?: string
          supplier_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_catalog_versions_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "supplier_catalogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_catalog_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_catalog_versions_supplier_document_id_fkey"
            columns: ["supplier_document_id"]
            isOneToOne: false
            referencedRelation: "supplier_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_catalog_versions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_catalogs: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          supplier_id: string
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          supplier_id: string
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          supplier_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_catalogs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_catalogs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_documents: {
        Row: {
          company_id: string
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
          company_id: string
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
          company_id?: string
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
            foreignKeyName: "supplier_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_import_mappings: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          file_type: string
          id: string
          mapping: Json
          supplier_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string
          file_type?: string
          id?: string
          mapping: Json
          supplier_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          file_type?: string
          id?: string
          mapping?: Json
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_import_mappings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_import_mappings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          company_id: string
          contact_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          whatsapp: string | null
        }
        Insert: {
          company_id: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          whatsapp?: string | null
        }
        Update: {
          company_id?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      attach_cash_sale_receipt: {
        Args: {
          p_document_id?: string
          p_receipt_kind: Database["public"]["Enums"]["cash_receipt_kind"]
          p_receipt_reference?: string
          p_sale_id: string
        }
        Returns: {
          amount_total: number
          business_date: string
          cancelled_at: string | null
          cancelled_by: string | null
          closure_id: string | null
          company_id: string
          created_at: string
          created_by: string
          customer_id: string | null
          customer_name_snapshot: string | null
          document_id: string | null
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["cash_payment_method"]
          receipt_kind: Database["public"]["Enums"]["cash_receipt_kind"]
          receipt_reference: string | null
          sold_at: string
          status: Database["public"]["Enums"]["cash_sale_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cash_sales"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_cash_sale: {
        Args: { p_reason?: string; p_sale_id: string }
        Returns: {
          amount_total: number
          business_date: string
          cancelled_at: string | null
          cancelled_by: string | null
          closure_id: string | null
          company_id: string
          created_at: string
          created_by: string
          customer_id: string | null
          customer_name_snapshot: string | null
          document_id: string | null
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["cash_payment_method"]
          receipt_kind: Database["public"]["Enums"]["cash_receipt_kind"]
          receipt_reference: string | null
          sold_at: string
          status: Database["public"]["Enums"]["cash_sale_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cash_sales"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_cash_closure: {
        Args: {
          p_closure_id: string
          p_counted_cash_total: number
          p_counted_point_total?: number
          p_counted_transfer_total?: number
          p_notes?: string
        }
        Returns: {
          business_date: string
          cash_difference: number | null
          closed_at: string | null
          company_id: string
          counted_cash_total: number | null
          counted_point_total: number | null
          counted_transfer_total: number | null
          created_at: string
          created_by: string
          expected_account_expenses_total: number
          expected_account_sales_total: number
          expected_cash_expenses_total: number
          expected_cash_sales_total: number
          expected_cash_to_render: number
          expected_non_cash_total: number
          expected_point_sales_total: number
          expected_sales_total: number
          expected_transfer_sales_total: number
          id: string
          notes: string | null
          point_difference: number | null
          responsible_id: string
          status: Database["public"]["Enums"]["cash_closure_status"]
          transfer_difference: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cash_closures"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_supplier_catalog_import: {
        Args: {
          p_catalog_id?: string
          p_catalog_notes?: string
          p_catalog_title?: string
          p_lines?: Json
          p_supplier_document_id: string
          p_supplier_id: string
          p_version_title?: string
        }
        Returns: Json
      }
      get_or_create_cash_closure: {
        Args: { p_business_date: string; p_company_id: string }
        Returns: {
          business_date: string
          cash_difference: number | null
          closed_at: string | null
          company_id: string
          counted_cash_total: number | null
          counted_point_total: number | null
          counted_transfer_total: number | null
          created_at: string
          created_by: string
          expected_account_expenses_total: number
          expected_account_sales_total: number
          expected_cash_expenses_total: number
          expected_cash_sales_total: number
          expected_cash_to_render: number
          expected_non_cash_total: number
          expected_point_sales_total: number
          expected_sales_total: number
          expected_transfer_sales_total: number
          id: string
          notes: string | null
          point_difference: number | null
          responsible_id: string
          status: Database["public"]["Enums"]["cash_closure_status"]
          transfer_difference: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cash_closures"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_user_company_ids: { Args: { _user_id: string }; Returns: string[] }
      has_company_permission: {
        Args: {
          _company_id: string
          _permission_code: string
          _user_id: string
        }
        Returns: boolean
      }
      has_company_role: {
        Args: { _company_id: string; _role_code: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
      issue_document: {
        Args: { p_document_id: string }
        Returns: {
          company_id: string
          created_at: string
          created_by: string
          customer_id: string | null
          customer_kind: Database["public"]["Enums"]["document_customer_kind"]
          customer_name: string | null
          customer_tax_condition: string | null
          customer_tax_id: string | null
          delivery_address: string | null
          discount_total: number
          doc_type: Database["public"]["Enums"]["document_type"]
          document_number: number | null
          id: string
          internal_remito_type:
            | Database["public"]["Enums"]["internal_remito_type"]
            | null
          issue_date: string
          notes: string | null
          payment_terms: string | null
          point_of_sale: number
          price_list_id: string | null
          salesperson: string | null
          source_document_id: string | null
          source_document_number_snapshot: string | null
          source_document_type:
            | Database["public"]["Enums"]["document_type"]
            | null
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recalculate_cash_closure_totals: {
        Args: { p_closure_id: string }
        Returns: {
          business_date: string
          cash_difference: number | null
          closed_at: string | null
          company_id: string
          counted_cash_total: number | null
          counted_point_total: number | null
          counted_transfer_total: number | null
          created_at: string
          created_by: string
          expected_account_expenses_total: number
          expected_account_sales_total: number
          expected_cash_expenses_total: number
          expected_cash_sales_total: number
          expected_cash_to_render: number
          expected_non_cash_total: number
          expected_point_sales_total: number
          expected_sales_total: number
          expected_transfer_sales_total: number
          id: string
          notes: string | null
          point_difference: number | null
          responsible_id: string
          status: Database["public"]["Enums"]["cash_closure_status"]
          transfer_difference: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cash_closures"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_document_status: {
        Args: {
          p_document_id: string
          p_target_status: Database["public"]["Enums"]["document_status"]
        }
        Returns: {
          company_id: string
          created_at: string
          created_by: string
          customer_id: string | null
          customer_kind: Database["public"]["Enums"]["document_customer_kind"]
          customer_name: string | null
          customer_tax_condition: string | null
          customer_tax_id: string | null
          delivery_address: string | null
          discount_total: number
          doc_type: Database["public"]["Enums"]["document_type"]
          document_number: number | null
          id: string
          internal_remito_type:
            | Database["public"]["Enums"]["internal_remito_type"]
            | null
          issue_date: string
          notes: string | null
          payment_terms: string | null
          point_of_sale: number
          price_list_id: string | null
          salesperson: string | null
          source_document_id: string | null
          source_document_number_snapshot: string | null
          source_document_type:
            | Database["public"]["Enums"]["document_type"]
            | null
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "user" | "superadmin"
      cash_closure_status: "ABIERTO" | "CERRADO"
      cash_event_entity_type: "VENTA" | "GASTO" | "CIERRE"
      cash_expense_kind: "CAJA" | "CUENTA_CORRIENTE"
      cash_payment_method:
        | "EFECTIVO"
        | "EFECTIVO_REMITO"
        | "EFECTIVO_FACTURABLE"
        | "SERVICIOS_REMITO"
        | "POINT"
        | "TRANSFERENCIA"
        | "CUENTA_CORRIENTE"
      cash_receipt_kind: "PENDIENTE" | "REMITO" | "FACTURA"
      cash_sale_status:
        | "REGISTRADA"
        | "PENDIENTE_COMPROBANTE"
        | "COMPROBANTADA"
        | "ANULADA"
      company_status: "ACTIVE" | "INACTIVE"
      company_user_status: "ACTIVE" | "INACTIVE"
      document_customer_kind: "GENERAL" | "INTERNO" | "EMPRESA"
      document_status:
        | "BORRADOR"
        | "ENVIADO"
        | "APROBADO"
        | "RECHAZADO"
        | "EMITIDO"
        | "ANULADO"
      document_type: "PRESUPUESTO" | "REMITO"
      internal_remito_type: "CUENTA_CORRIENTE" | "DESCUENTO_SUELDO"
      item_demand_profile: "LOW" | "MEDIUM" | "HIGH"
      match_status: "MATCHED" | "PENDING" | "NEW"
      movement_type: "IN" | "OUT" | "ADJUSTMENT"
      permission_effect: "ALLOW" | "DENY"
      quote_status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED"
      role_scope: "GLOBAL" | "COMPANY"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user", "superadmin"],
      cash_closure_status: ["ABIERTO", "CERRADO"],
      cash_event_entity_type: ["VENTA", "GASTO", "CIERRE"],
      cash_expense_kind: ["CAJA", "CUENTA_CORRIENTE"],
      cash_payment_method: [
        "EFECTIVO",
        "EFECTIVO_REMITO",
        "EFECTIVO_FACTURABLE",
        "SERVICIOS_REMITO",
        "POINT",
        "TRANSFERENCIA",
        "CUENTA_CORRIENTE",
      ],
      cash_receipt_kind: ["PENDIENTE", "REMITO", "FACTURA"],
      cash_sale_status: [
        "REGISTRADA",
        "PENDIENTE_COMPROBANTE",
        "COMPROBANTADA",
        "ANULADA",
      ],
      company_status: ["ACTIVE", "INACTIVE"],
      company_user_status: ["ACTIVE", "INACTIVE"],
      document_customer_kind: ["GENERAL", "INTERNO", "EMPRESA"],
      document_status: [
        "BORRADOR",
        "ENVIADO",
        "APROBADO",
        "RECHAZADO",
        "EMITIDO",
        "ANULADO",
      ],
      document_type: ["PRESUPUESTO", "REMITO"],
      internal_remito_type: ["CUENTA_CORRIENTE", "DESCUENTO_SUELDO"],
      item_demand_profile: ["LOW", "MEDIUM", "HIGH"],
      match_status: ["MATCHED", "PENDING", "NEW"],
      movement_type: ["IN", "OUT", "ADJUSTMENT"],
      permission_effect: ["ALLOW", "DENY"],
      quote_status: ["DRAFT", "SENT", "ACCEPTED", "REJECTED"],
      role_scope: ["GLOBAL", "COMPANY"],
    },
  },
} as const
