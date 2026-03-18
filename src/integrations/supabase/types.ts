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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      company_settings: {
        Row: {
          accent_color: string
          address: string | null
          app_name: string
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
          app_name?: string
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
          app_name?: string
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
        Relationships: []
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
        Relationships: []
      }
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
          created_at: string
          created_by: string
          description: string
          discount_pct: number
          document_id: string
          id: string
          item_id: string | null
          line_order: number
          line_total: number
          quantity: number
          sku_snapshot: string | null
          tax_pct: number
          unit: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          description: string
          discount_pct?: number
          document_id: string
          id?: string
          item_id?: string | null
          line_order?: number
          line_total?: number
          quantity?: number
          sku_snapshot?: string | null
          tax_pct?: number
          unit?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          discount_pct?: number
          document_id?: string
          id?: string
          item_id?: string | null
          line_order?: number
          line_total?: number
          quantity?: number
          sku_snapshot?: string | null
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
          doc_type: Database["public"]["Enums"]["document_type"]
          id: string
          last_number: number
          point_of_sale: number
          updated_at: string
        }
        Insert: {
          doc_type: Database["public"]["Enums"]["document_type"]
          id?: string
          last_number?: number
          point_of_sale?: number
          updated_at?: string
        }
        Update: {
          doc_type?: Database["public"]["Enums"]["document_type"]
          id?: string
          last_number?: number
          point_of_sale?: number
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          created_by: string
          customer_kind: Database["public"]["Enums"]["document_customer_kind"]
          customer_id: string | null
          customer_name: string | null
          customer_tax_condition: string | null
          customer_tax_id: string | null
          delivery_address: string | null
          discount_total: number
          doc_type: Database["public"]["Enums"]["document_type"]
          document_number: number | null
          id: string
          issue_date: string
          internal_remito_type: Database["public"]["Enums"]["internal_remito_type"] | null
          notes: string | null
          payment_terms: string | null
          point_of_sale: number
          price_list_id: string | null
          salesperson: string | null
          source_document_id: string | null
          source_document_number_snapshot: string | null
          source_document_type: Database["public"]["Enums"]["document_type"] | null
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          customer_kind?: Database["public"]["Enums"]["document_customer_kind"]
          customer_id?: string | null
          customer_name?: string | null
          customer_tax_condition?: string | null
          customer_tax_id?: string | null
          delivery_address?: string | null
          discount_total?: number
          doc_type: Database["public"]["Enums"]["document_type"]
          document_number?: number | null
          id?: string
          issue_date?: string
          internal_remito_type?: Database["public"]["Enums"]["internal_remito_type"] | null
          notes?: string | null
          payment_terms?: string | null
          point_of_sale?: number
          price_list_id?: string | null
          salesperson?: string | null
          source_document_id?: string | null
          source_document_number_snapshot?: string | null
          source_document_type?: Database["public"]["Enums"]["document_type"] | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_kind?: Database["public"]["Enums"]["document_customer_kind"]
          customer_id?: string | null
          customer_name?: string | null
          customer_tax_condition?: string | null
          customer_tax_id?: string | null
          delivery_address?: string | null
          discount_total?: number
          doc_type?: Database["public"]["Enums"]["document_type"]
          document_number?: number | null
          id?: string
          issue_date?: string
          internal_remito_type?: Database["public"]["Enums"]["internal_remito_type"] | null
          notes?: string | null
          payment_terms?: string | null
          point_of_sale?: number
          price_list_id?: string | null
          salesperson?: string | null
          source_document_id?: string | null
          source_document_number_snapshot?: string | null
          source_document_type?: Database["public"]["Enums"]["document_type"] | null
          status?: Database["public"]["Enums"]["document_status"]
          subtotal?: number
          tax_total?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
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
          demand_profile: Database["public"]["Enums"]["item_demand_profile"]
          demand_monthly_estimate: number | null
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
          demand_profile?: Database["public"]["Enums"]["item_demand_profile"]
          demand_monthly_estimate?: number | null
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
          demand_profile?: Database["public"]["Enums"]["item_demand_profile"]
          demand_monthly_estimate?: number | null
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
          flete_pct: number
          id: string
          impuesto_pct: number
          name: string
          round_mode: string
          round_to: number
          supplier_id: string | null
          utilidad_pct: number
        }
        Insert: {
          created_at?: string
          flete_pct?: number
          id?: string
          impuesto_pct?: number
          name: string
          round_mode?: string
          round_to?: number
          supplier_id?: string | null
          utilidad_pct?: number
        }
        Update: {
          created_at?: string
          flete_pct?: number
          id?: string
          impuesto_pct?: number
          name?: string
          round_mode?: string
          round_to?: number
          supplier_id?: string | null
          utilidad_pct?: number
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
      price_list_items: {
        Row: {
          base_cost: number
          created_at: string
          created_by: string | null
          final_price_override: number | null
          flete_pct: number | null
          impuesto_pct: number | null
          is_active: boolean
          item_id: string
          price_list_id: string
          price_override: number | null
          utilidad_pct: number | null
        }
        Insert: {
          base_cost?: number
          created_at?: string
          created_by?: string | null
          final_price_override?: number | null
          flete_pct?: number | null
          impuesto_pct?: number | null
          is_active?: boolean
          item_id: string
          price_list_id: string
          price_override?: number | null
          utilidad_pct?: number | null
        }
        Update: {
          base_cost?: number
          created_at?: string
          created_by?: string | null
          final_price_override?: number | null
          flete_pct?: number | null
          impuesto_pct?: number | null
          is_active?: boolean
          item_id?: string
          price_list_id?: string
          price_override?: number | null
          utilidad_pct?: number | null
        }
        Relationships: [
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
      supplier_catalogs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          supplier_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          supplier_id: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          supplier_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_catalogs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
        Relationships: []
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
      supplier_catalog_lines: {
        Row: {
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
      supplier_import_mappings: {
        Row: {
          created_at: string
          created_by: string
          file_type: string
          id: string
          mapping: Json
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          file_type?: string
          id?: string
          mapping: Json
          supplier_id: string
          updated_at?: string
        }
        Update: {
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
            foreignKeyName: "supplier_import_mappings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
      create_supplier_catalog_import: {
        Args: {
          p_catalog_id?: string | null
          p_catalog_notes?: string | null
          p_catalog_title?: string | null
          p_lines?: Json
          p_supplier_document_id: string
          p_supplier_id: string
          p_version_title?: string | null
        }
        Returns: Json
      }
      issue_document: {
        Args: {
          p_document_id: string
        }
        Returns: {
          created_at: string
          created_by: string
          customer_kind: Database["public"]["Enums"]["document_customer_kind"]
          customer_id: string | null
          customer_name: string | null
          customer_tax_condition: string | null
          customer_tax_id: string | null
          delivery_address: string | null
          discount_total: number
          doc_type: Database["public"]["Enums"]["document_type"]
          document_number: number | null
          id: string
          issue_date: string
          internal_remito_type: Database["public"]["Enums"]["internal_remito_type"] | null
          notes: string | null
          payment_terms: string | null
          point_of_sale: number
          price_list_id: string | null
          salesperson: string | null
          source_document_id: string | null
          source_document_number_snapshot: string | null
          source_document_type: Database["public"]["Enums"]["document_type"] | null
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          valid_until: string | null
        }
      }
      transition_document_status: {
        Args: {
          p_document_id: string
          p_target_status: Database["public"]["Enums"]["document_status"]
        }
        Returns: {
          created_at: string
          created_by: string
          customer_kind: Database["public"]["Enums"]["document_customer_kind"]
          customer_id: string | null
          customer_name: string | null
          customer_tax_condition: string | null
          customer_tax_id: string | null
          delivery_address: string | null
          discount_total: number
          doc_type: Database["public"]["Enums"]["document_type"]
          document_number: number | null
          id: string
          issue_date: string
          internal_remito_type: Database["public"]["Enums"]["internal_remito_type"] | null
          notes: string | null
          payment_terms: string | null
          point_of_sale: number
          price_list_id: string | null
          salesperson: string | null
          source_document_id: string | null
          source_document_number_snapshot: string | null
          source_document_type: Database["public"]["Enums"]["document_type"] | null
          status: Database["public"]["Enums"]["document_status"]
          subtotal: number
          tax_total: number
          total: number
          updated_at: string
          valid_until: string | null
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "superadmin"
      company_status: "ACTIVE" | "INACTIVE"
      company_user_status: "ACTIVE" | "INACTIVE"
      document_customer_kind: "GENERAL" | "INTERNO" | "EMPRESA"
      document_status: "BORRADOR" | "ENVIADO" | "APROBADO" | "RECHAZADO" | "EMITIDO" | "ANULADO"
      document_type: "PRESUPUESTO" | "REMITO"
      internal_remito_type: "CUENTA_CORRIENTE" | "DESCUENTO_SUELDO"
      item_demand_profile: "LOW" | "MEDIUM" | "HIGH"
      match_reason: "SUPPLIER_CODE" | "ALIAS_TOKEN" | "ALIAS_CONTAINS" | "NONE"
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
  public: {
    Enums: {
      app_role: ["admin", "user", "superadmin"],
      company_status: ["ACTIVE", "INACTIVE"],
      company_user_status: ["ACTIVE", "INACTIVE"],
      document_customer_kind: ["GENERAL", "INTERNO", "EMPRESA"],
      document_status: ["BORRADOR", "ENVIADO", "APROBADO", "RECHAZADO", "EMITIDO", "ANULADO"],
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
