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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      contractor_settings: {
        Row: {
          auto_activate_products: boolean
          clarifying_questions: Json | null
          clarifying_questions_enabled: boolean
          contact_capture_timing: string
          contractor_id: string
          created_at: string
          currency_symbol: string
          decimal_precision: number
          default_product_color: string
          default_unit_type: string
          global_markup_percentage: number
          global_tax_rate: number
          id: string
          price_range_display_format: string
          price_range_lower_percentage: number
          price_range_percentage: number
          price_range_upper_percentage: number
          pricing_visibility: string
          require_address: boolean
          require_email: boolean
          require_phone: boolean
          require_product_photos: boolean
          service_area_center_lat: number | null
          service_area_center_lng: number | null
          service_area_enabled: boolean | null
          service_area_method: string | null
          service_area_radius_miles: number | null
          service_area_zip_codes: string[] | null
          show_markup_in_widget: boolean | null
          updated_at: string
          use_price_ranges: boolean
          widget_theme_color: string | null
        }
        Insert: {
          auto_activate_products?: boolean
          clarifying_questions?: Json | null
          clarifying_questions_enabled?: boolean
          contact_capture_timing?: string
          contractor_id: string
          created_at?: string
          currency_symbol?: string
          decimal_precision?: number
          default_product_color?: string
          default_unit_type?: string
          global_markup_percentage?: number
          global_tax_rate?: number
          id?: string
          price_range_display_format?: string
          price_range_lower_percentage?: number
          price_range_percentage?: number
          price_range_upper_percentage?: number
          pricing_visibility?: string
          require_address?: boolean
          require_email?: boolean
          require_phone?: boolean
          require_product_photos?: boolean
          service_area_center_lat?: number | null
          service_area_center_lng?: number | null
          service_area_enabled?: boolean | null
          service_area_method?: string | null
          service_area_radius_miles?: number | null
          service_area_zip_codes?: string[] | null
          show_markup_in_widget?: boolean | null
          updated_at?: string
          use_price_ranges?: boolean
          widget_theme_color?: string | null
        }
        Update: {
          auto_activate_products?: boolean
          clarifying_questions?: Json | null
          clarifying_questions_enabled?: boolean
          contact_capture_timing?: string
          contractor_id?: string
          created_at?: string
          currency_symbol?: string
          decimal_precision?: number
          default_product_color?: string
          default_unit_type?: string
          global_markup_percentage?: number
          global_tax_rate?: number
          id?: string
          price_range_display_format?: string
          price_range_lower_percentage?: number
          price_range_percentage?: number
          price_range_upper_percentage?: number
          pricing_visibility?: string
          require_address?: boolean
          require_email?: boolean
          require_phone?: boolean
          require_product_photos?: boolean
          service_area_center_lat?: number | null
          service_area_center_lng?: number | null
          service_area_enabled?: boolean | null
          service_area_method?: string | null
          service_area_radius_miles?: number | null
          service_area_zip_codes?: string[] | null
          show_markup_in_widget?: boolean | null
          updated_at?: string
          use_price_ranges?: boolean
          widget_theme_color?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_settings_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: true
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          address: string | null
          brand_color: string | null
          business_name: string
          city: string | null
          created_at: string
          email: string
          id: string
          logo_url: string | null
          phone: string | null
          secondary_color: string | null
          state: string | null
          updated_at: string
          user_id: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          brand_color?: string | null
          business_name: string
          city?: string | null
          created_at?: string
          email: string
          id?: string
          logo_url?: string | null
          phone?: string | null
          secondary_color?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          brand_color?: string | null
          business_name?: string
          city?: string | null
          created_at?: string
          email?: string
          id?: string
          logo_url?: string | null
          phone?: string | null
          secondary_color?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      customer_notes: {
        Row: {
          contractor_id: string
          created_at: string
          customer_id: string
          id: string
          note_text: string
          note_type: string
          updated_at: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          customer_id: string
          id?: string
          note_text: string
          note_type?: string
          updated_at?: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          note_text?: string
          note_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          city: string | null
          contractor_id: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_activity_at: string | null
          last_name: string
          lead_source: string | null
          phone: string | null
          state: string | null
          status: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contractor_id: string
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_activity_at?: string | null
          last_name: string
          lead_source?: string | null
          phone?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contractor_id?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_activity_at?: string | null
          last_name?: string
          lead_source?: string | null
          phone?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_history: {
        Row: {
          batch_id: string | null
          change_reason: string | null
          change_type: string
          changed_by: string
          contractor_id: string
          created_at: string
          id: string
          new_price: number
          old_price: number
          product_id: string
        }
        Insert: {
          batch_id?: string | null
          change_reason?: string | null
          change_type?: string
          changed_by: string
          contractor_id: string
          created_at?: string
          id?: string
          new_price: number
          old_price: number
          product_id: string
        }
        Update: {
          batch_id?: string | null
          change_reason?: string | null
          change_type?: string
          changed_by?: string
          contractor_id?: string
          created_at?: string
          id?: string
          new_price?: number
          old_price?: number
          product_id?: string
        }
        Relationships: []
      }
      product_addons: {
        Row: {
          calculation_formula: string | null
          calculation_type: string
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean
          name: string
          price_type: string
          price_value: number
          product_id: string
          updated_at: string
        }
        Insert: {
          calculation_formula?: string | null
          calculation_type?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          name: string
          price_type: string
          price_value: number
          product_id: string
          updated_at?: string
        }
        Update: {
          calculation_formula?: string | null
          calculation_type?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          name?: string
          price_type?: string
          price_value?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_addons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          color_hex: string
          contractor_id: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color_hex?: string
          contractor_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color_hex?: string
          contractor_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricing_tiers: {
        Row: {
          contractor_id: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          max_quantity: number | null
          min_quantity: number
          product_id: string
          tier_name: string
          tier_price: number
          updated_at: string
        }
        Insert: {
          contractor_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          max_quantity?: number | null
          min_quantity: number
          product_id: string
          tier_name: string
          tier_price: number
          updated_at?: string
        }
        Update: {
          contractor_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          max_quantity?: number | null
          min_quantity?: number
          product_id?: string
          tier_name?: string
          tier_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_product_pricing_tiers_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_subcategories: {
        Row: {
          category_id: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variations: {
        Row: {
          adjustment_type: string
          affects_area_calculation: boolean | null
          created_at: string
          description: string | null
          display_order: number | null
          height_value: number | null
          id: string
          is_active: boolean
          is_default: boolean | null
          is_required: boolean | null
          name: string
          price_adjustment: number
          product_id: string
          unit_of_measurement: string | null
          updated_at: string
        }
        Insert: {
          adjustment_type?: string
          affects_area_calculation?: boolean | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          height_value?: number | null
          id?: string
          is_active?: boolean
          is_default?: boolean | null
          is_required?: boolean | null
          name: string
          price_adjustment?: number
          product_id: string
          unit_of_measurement?: string | null
          updated_at?: string
        }
        Update: {
          adjustment_type?: string
          affects_area_calculation?: boolean | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          height_value?: number | null
          id?: string
          is_active?: boolean
          is_default?: boolean | null
          is_required?: boolean | null
          name?: string
          price_adjustment?: number
          product_id?: string
          unit_of_measurement?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_dimension_editing: boolean | null
          allow_partial_increments: boolean | null
          base_height: number | null
          base_height_unit: string | null
          category: string | null
          color_hex: string
          contractor_id: string
          created_at: string
          default_length: number | null
          default_width: number | null
          description: string | null
          dimension_unit: string | null
          display_order: number | null
          has_fixed_dimensions: boolean
          id: string
          increment_description: string | null
          increment_unit_label: string | null
          is_active: boolean
          min_order_quantity: number
          name: string
          photo_url: string | null
          show_pricing_before_submit: boolean
          sold_in_increments_of: number | null
          subcategory: string | null
          unit_price: number
          unit_type: string
          updated_at: string
          use_height_in_calculation: boolean | null
          use_tiered_pricing: boolean
        }
        Insert: {
          allow_dimension_editing?: boolean | null
          allow_partial_increments?: boolean | null
          base_height?: number | null
          base_height_unit?: string | null
          category?: string | null
          color_hex?: string
          contractor_id: string
          created_at?: string
          default_length?: number | null
          default_width?: number | null
          description?: string | null
          dimension_unit?: string | null
          display_order?: number | null
          has_fixed_dimensions?: boolean
          id?: string
          increment_description?: string | null
          increment_unit_label?: string | null
          is_active?: boolean
          min_order_quantity?: number
          name: string
          photo_url?: string | null
          show_pricing_before_submit?: boolean
          sold_in_increments_of?: number | null
          subcategory?: string | null
          unit_price: number
          unit_type?: string
          updated_at?: string
          use_height_in_calculation?: boolean | null
          use_tiered_pricing?: boolean
        }
        Update: {
          allow_dimension_editing?: boolean | null
          allow_partial_increments?: boolean | null
          base_height?: number | null
          base_height_unit?: string | null
          category?: string | null
          color_hex?: string
          contractor_id?: string
          created_at?: string
          default_length?: number | null
          default_width?: number | null
          description?: string | null
          dimension_unit?: string | null
          display_order?: number | null
          has_fixed_dimensions?: boolean
          id?: string
          increment_description?: string | null
          increment_unit_label?: string | null
          is_active?: boolean
          min_order_quantity?: number
          name?: string
          photo_url?: string | null
          show_pricing_before_submit?: boolean
          sold_in_increments_of?: number | null
          subcategory?: string | null
          unit_price?: number
          unit_type?: string
          updated_at?: string
          use_height_in_calculation?: boolean | null
          use_tiered_pricing?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          measurement_data: Json | null
          notes: string | null
          product_id: string
          quantity: number
          quote_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          measurement_data?: Json | null
          notes?: string | null
          product_id: string
          quantity: number
          quote_id: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          measurement_data?: Json | null
          notes?: string | null
          product_id?: string
          quantity?: number
          quote_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_status_history: {
        Row: {
          changed_by: string
          created_at: string
          id: string
          new_status: string
          notes: string | null
          old_status: string | null
          quote_id: string
        }
        Insert: {
          changed_by: string
          created_at?: string
          id?: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          quote_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          quote_id?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          accepted_at: string | null
          access_token: string | null
          clarifying_answers: Json | null
          contractor_id: string
          created_at: string
          customer_id: string
          expires_at: string | null
          first_viewed_at: string | null
          id: string
          notes: string | null
          parent_quote_id: string | null
          project_address: string | null
          project_city: string | null
          project_state: string | null
          project_zip_code: string | null
          quote_number: string
          status: string
          total_amount: number
          updated_at: string
          version_number: number | null
        }
        Insert: {
          accepted_at?: string | null
          access_token?: string | null
          clarifying_answers?: Json | null
          contractor_id: string
          created_at?: string
          customer_id: string
          expires_at?: string | null
          first_viewed_at?: string | null
          id?: string
          notes?: string | null
          parent_quote_id?: string | null
          project_address?: string | null
          project_city?: string | null
          project_state?: string | null
          project_zip_code?: string | null
          quote_number: string
          status?: string
          total_amount?: number
          updated_at?: string
          version_number?: number | null
        }
        Update: {
          accepted_at?: string | null
          access_token?: string | null
          clarifying_answers?: Json | null
          contractor_id?: string
          created_at?: string
          customer_id?: string
          expires_at?: string | null
          first_viewed_at?: string | null
          id?: string
          notes?: string | null
          parent_quote_id?: string | null
          project_address?: string | null
          project_city?: string | null
          project_state?: string | null
          project_zip_code?: string | null
          quote_number?: string
          status?: string
          total_amount?: number
          updated_at?: string
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
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
      tasks: {
        Row: {
          completed_at: string | null
          contractor_id: string
          created_at: string
          customer_id: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          quote_id: string | null
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          contractor_id: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          quote_id?: string | null
          status?: string
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          contractor_id?: string
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          quote_id?: string | null
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_quote_access_token: { Args: never; Returns: string }
      generate_quote_number: { Args: never; Returns: string }
      get_current_contractor_id: { Args: never; Returns: string }
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
