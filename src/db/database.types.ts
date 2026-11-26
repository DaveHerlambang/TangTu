/**
 * The online schema's types (supabase/migrations), in the shape `supabase gen types typescript` writes.
 * Written by hand for 0.5.0; regenerate with the CLI against the development project when the schema changes
 * (`npx supabase gen types typescript --project-id <ref> --schema public`), and keep the two in step.
 */
type CategoryRow = {
  id: string;
  user_id: string;
  name: string | null;
  template_key: string | null;
  kind: string;
  icon: string;
  tint: string;
  position: number;
  archived_at: string | null;
  created_at: string;
};

type TransactionRow = {
  id: string;
  user_id: string;
  kind: string;
  amount: number;
  currency: string;
  category_id: string;
  note: string;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

type ActivityRow = {
  id: string;
  user_id: string;
  kind: string;
  params: Json;
  ref_type: string | null;
  ref_id: string | null;
  dedupe_key: string | null;
  created_at: string;
};

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: CategoryRow;
        Insert: Optional<CategoryRow, 'id' | 'user_id' | 'name' | 'template_key' | 'position' | 'archived_at' | 'created_at'>;
        Update: Partial<CategoryRow>;
        Relationships: [];
      };
      transactions: {
        Row: TransactionRow;
        Insert: Optional<TransactionRow, 'id' | 'user_id' | 'currency' | 'note' | 'created_at' | 'updated_at'>;
        Update: Partial<TransactionRow>;
        Relationships: [
          {
            foreignKeyName: 'transactions_category_fkey';
            columns: ['category_id', 'user_id', 'kind'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id', 'user_id', 'kind'];
          },
        ];
      };
      activity: {
        Row: ActivityRow;
        Insert: Optional<ActivityRow, 'id' | 'user_id' | 'params' | 'ref_type' | 'ref_id' | 'dedupe_key' | 'created_at'>;
        Update: Partial<ActivityRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      categories_by_use: {
        Args: { p_kind: string; p_since: string; p_until: string };
        Returns: CategoryRow[];
        SetofOptions: { from: '*'; to: 'categories'; isOneToOne: false; isSetofReturn: true };
      };
      used_categories: {
        Args: never;
        Returns: CategoryRow[];
        SetofOptions: { from: '*'; to: 'categories'; isOneToOne: false; isSetofReturn: true };
      };
      search_transactions: {
        Args: {
          p_text: string;
          p_name_ids: string[];
          p_category_ids: string[];
          p_start: string | null;
          p_end: string | null;
          p_limit: number;
        };
        Returns: TransactionRow[];
        SetofOptions: { from: '*'; to: 'transactions'; isOneToOne: false; isSetofReturn: true };
      };
      replace_all_data: {
        Args: { p_categories: Json; p_transactions: Json };
        Returns: undefined;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
