export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: {
          address: string;
          category: string;
          created_at: string;
          description: string;
          embedding: string | null;
          hours: string;
          id: string;
          is_24hr: boolean;
          is_advert: boolean;
          is_spirit: boolean;
          name: string;
          phone: string;
          phone_digits: string | null;
          suburb: string;
        };
        ComputedFields: never;
        Insert: {
          address: string;
          category: string;
          created_at?: string;
          description: string;
          embedding?: string | null;
          hours: string;
          id?: string;
          is_24hr?: boolean;
          is_advert?: boolean;
          is_spirit?: boolean;
          name: string;
          phone: string;
          phone_digits?: never;
          suburb: string;
        };
        Update: {
          address?: string;
          category?: string;
          created_at?: string;
          description?: string;
          embedding?: string | null;
          hours?: string;
          id?: string;
          is_24hr?: boolean;
          is_advert?: boolean;
          is_spirit?: boolean;
          name?: string;
          phone?: string;
          phone_digits?: never;
          suburb?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          claude_count: number;
          date: string | null;
          id: string;
          ip_hash: string | null;
          operator_count: number;
          search_count: number;
          updated_at: string;
          window_start: string | null;
        };
        ComputedFields: never;
        Insert: {
          claude_count?: number;
          date?: string | null;
          id: string;
          ip_hash?: string | null;
          operator_count?: number;
          search_count?: number;
          updated_at?: string;
          window_start?: string | null;
        };
        Update: {
          claude_count?: number;
          date?: string | null;
          id?: string;
          ip_hash?: string | null;
          operator_count?: number;
          search_count?: number;
          updated_at?: string;
          window_start?: string | null;
        };
        Relationships: [];
      };
      residents: {
        Row: {
          address: string;
          created_at: string;
          embedding: string | null;
          id: string;
          initials: string;
          phone: string;
          phone_digits: string | null;
          suburb: string;
          surname: string;
        };
        ComputedFields: never;
        Insert: {
          address: string;
          created_at?: string;
          embedding?: string | null;
          id?: string;
          initials: string;
          phone: string;
          phone_digits?: never;
          suburb: string;
          surname: string;
        };
        Update: {
          address?: string;
          created_at?: string;
          embedding?: string | null;
          id?: string;
          initials?: string;
          phone?: string;
          phone_digits?: never;
          suburb?: string;
          surname?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      increment_rate_limit: {
        Args: { p_date?: string; p_field: string; p_id: string; p_window_start?: string };
        Returns: number;
      };
      lookup_number: {
        Args: { digits: string };
        Returns: {
          address: string;
          category: string;
          description: string;
          hours: string;
          id: string;
          is_spirit: boolean;
          kind: string;
          name: string;
          suburb: string;
        }[];
      };
      search_businesses: {
        Args: {
          include_spirit?: boolean;
          match_count?: number;
          query_embedding: string;
          query_text: string;
          spirit_only?: boolean;
          suburb_hint?: string;
        };
        Returns: {
          address: string;
          category: string;
          description: string;
          hours: string;
          id: string;
          is_24hr: boolean;
          is_advert: boolean;
          is_spirit: boolean;
          name: string;
          phone: string;
          score: number;
          suburb: string;
        }[];
      };
      search_residents: {
        Args: {
          initial_hint?: string;
          match_count?: number;
          query_embedding: string;
          suburb_hint?: string;
          surname_hint: string;
        };
        Returns: {
          address: string;
          id: string;
          initials: string;
          phone: string;
          score: number;
          suburb: string;
          surname: string;
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
