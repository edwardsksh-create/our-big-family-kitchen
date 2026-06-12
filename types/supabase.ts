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
      comments: {
        Row: {
          body: string
          contributor_id: string | null
          created_at: string
          id: string
          recipe_id: string
          status: string
          type: string
        }
        Insert: {
          body: string
          contributor_id?: string | null
          created_at?: string
          id?: string
          recipe_id: string
          status?: string
          type?: string
        }
        Update: {
          body?: string
          contributor_id?: string | null
          created_at?: string
          id?: string
          recipe_id?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      contributor_family_lines: {
        Row: {
          contributor_id: string
          family_line_id: string
          rank: string
        }
        Insert: {
          contributor_id: string
          family_line_id: string
          rank?: string
        }
        Update: {
          contributor_id?: string
          family_line_id?: string
          rank?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributor_family_lines_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contributor_family_lines_family_line_id_fkey"
            columns: ["family_line_id"]
            isOneToOne: false
            referencedRelation: "family_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      contributors: {
        Row: {
          bio: string | null
          birth_name: string | null
          can_publish: boolean
          can_sign_in: boolean
          created_at: string
          deceased: boolean
          email: string
          hero_photo_path: string | null
          id: string
          invited_at: string | null
          invited_by_id: string | null
          joined_at: string | null
          name: string | null
          nickname: string | null
          photo_url: string | null
          role: string
        }
        Insert: {
          bio?: string | null
          birth_name?: string | null
          can_publish?: boolean
          can_sign_in?: boolean
          created_at?: string
          deceased?: boolean
          email: string
          hero_photo_path?: string | null
          id?: string
          invited_at?: string | null
          invited_by_id?: string | null
          joined_at?: string | null
          name?: string | null
          nickname?: string | null
          photo_url?: string | null
          role?: string
        }
        Update: {
          bio?: string | null
          birth_name?: string | null
          can_publish?: boolean
          can_sign_in?: boolean
          created_at?: string
          deceased?: boolean
          email?: string
          hero_photo_path?: string | null
          id?: string
          invited_at?: string | null
          invited_by_id?: string | null
          joined_at?: string | null
          name?: string | null
          nickname?: string | null
          photo_url?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributors_invited_by_id_fkey"
            columns: ["invited_by_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      family_lines: {
        Row: {
          description: string | null
          family_type: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description?: string | null
          family_type: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          description?: string | null
          family_type?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      family_members: {
        Row: {
          birth_name: string | null
          contributor_slug: string | null
          created_at: string
          deceased: boolean
          family_line_id: string
          id: string
          name: string
          nickname: string | null
          notes: string | null
          sort_order: number
        }
        Insert: {
          birth_name?: string | null
          contributor_slug?: string | null
          created_at?: string
          deceased?: boolean
          family_line_id: string
          id?: string
          name: string
          nickname?: string | null
          notes?: string | null
          sort_order?: number
        }
        Update: {
          birth_name?: string | null
          contributor_slug?: string | null
          created_at?: string
          deceased?: boolean
          family_line_id?: string
          id?: string
          name?: string
          nickname?: string | null
          notes?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_line_id_fkey"
            columns: ["family_line_id"]
            isOneToOne: false
            referencedRelation: "family_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      family_photo_occasion_types: {
        Row: {
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          name: string
          slug: string
          sort_order: number
        }
        Update: {
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      family_photo_occasions: {
        Row: {
          family_photo_id: string
          occasion_slug: string
        }
        Insert: {
          family_photo_id: string
          occasion_slug: string
        }
        Update: {
          family_photo_id?: string
          occasion_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_photo_occasions_family_photo_id_fkey"
            columns: ["family_photo_id"]
            isOneToOne: false
            referencedRelation: "family_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_photo_occasions_occasion_slug_fkey"
            columns: ["occasion_slug"]
            isOneToOne: false
            referencedRelation: "family_photo_occasion_types"
            referencedColumns: ["slug"]
          },
        ]
      }
      family_photo_people: {
        Row: {
          contributor_id: string | null
          family_member_id: string | null
          family_photo_id: string
          person_type: string
        }
        Insert: {
          contributor_id?: string | null
          family_member_id?: string | null
          family_photo_id: string
          person_type: string
        }
        Update: {
          contributor_id?: string | null
          family_member_id?: string | null
          family_photo_id?: string
          person_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_photo_people_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_photo_people_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_photo_people_family_photo_id_fkey"
            columns: ["family_photo_id"]
            isOneToOne: false
            referencedRelation: "family_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      family_photo_recipes: {
        Row: {
          family_photo_id: string
          recipe_id: string
        }
        Insert: {
          family_photo_id: string
          recipe_id: string
        }
        Update: {
          family_photo_id?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_photo_recipes_family_photo_id_fkey"
            columns: ["family_photo_id"]
            isOneToOne: false
            referencedRelation: "family_photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_photo_recipes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      family_photos: {
        Row: {
          additional_people: string | null
          ai_hints: Json | null
          caption: string | null
          created_at: string
          editing_note: string | null
          id: string
          needs_editing: boolean
          not_for_archive: boolean
          original_storage_path: string | null
          pets: string | null
          place: string | null
          reviewed: boolean
          source: string
          storage_path: string
          submitter_note: string | null
          uploaded_at: string
          uploaded_by_id: string | null
          year: string | null
        }
        Insert: {
          additional_people?: string | null
          ai_hints?: Json | null
          caption?: string | null
          created_at?: string
          editing_note?: string | null
          id?: string
          needs_editing?: boolean
          not_for_archive?: boolean
          original_storage_path?: string | null
          pets?: string | null
          place?: string | null
          reviewed?: boolean
          source?: string
          storage_path: string
          submitter_note?: string | null
          uploaded_at?: string
          uploaded_by_id?: string | null
          year?: string | null
        }
        Update: {
          additional_people?: string | null
          ai_hints?: Json | null
          caption?: string | null
          created_at?: string
          editing_note?: string | null
          id?: string
          needs_editing?: boolean
          not_for_archive?: boolean
          original_storage_path?: string | null
          pets?: string | null
          place?: string | null
          reviewed?: boolean
          source?: string
          storage_path?: string
          submitter_note?: string | null
          uploaded_at?: string
          uploaded_by_id?: string | null
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_photos_uploaded_by_id_fkey"
            columns: ["uploaded_by_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      federated_recipes: {
        Row: {
          contributor_name: string | null
          fetched_at: string
          id: string
          search_tokens: string | null
          section_slug: string | null
          source_url: string
          title: string
        }
        Insert: {
          contributor_name?: string | null
          fetched_at?: string
          id?: string
          search_tokens?: string | null
          section_slug?: string | null
          source_url: string
          title: string
        }
        Update: {
          contributor_name?: string | null
          fetched_at?: string
          id?: string
          search_tokens?: string | null
          section_slug?: string | null
          source_url?: string
          title?: string
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          id: string
          item_text: string
          recipe_id: string
          sort_order: number
          sub_header: string | null
        }
        Insert: {
          id?: string
          item_text: string
          recipe_id: string
          sort_order: number
          sub_header?: string | null
        }
        Update: {
          id?: string
          item_text?: string
          recipe_id?: string
          sort_order?: number
          sub_header?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      instructions: {
        Row: {
          body: string
          id: string
          recipe_id: string
          sort_order: number
          sub_header: string | null
        }
        Insert: {
          body: string
          id?: string
          recipe_id: string
          sort_order: number
          sub_header?: string | null
        }
        Update: {
          body?: string
          id?: string
          recipe_id?: string
          sort_order?: number
          sub_header?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          email: string
          family_line_ids: string[]
          id: string
          invited_by_id: string | null
          sent_at: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          email: string
          family_line_ids?: string[]
          id?: string
          invited_by_id?: string | null
          sent_at?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          email?: string
          family_line_ids?: string[]
          id?: string
          invited_by_id?: string | null
          sent_at?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_id_fkey"
            columns: ["invited_by_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          caption: string | null
          contributor_id: string | null
          id: string
          photo_type: string
          recipe_id: string
          sort_order: number
          storage_path: string | null
          thumb_path: string | null
          uploaded_at: string
          url: string
        }
        Insert: {
          caption?: string | null
          contributor_id?: string | null
          id?: string
          photo_type?: string
          recipe_id: string
          sort_order?: number
          storage_path?: string | null
          thumb_path?: string | null
          uploaded_at?: string
          url: string
        }
        Update: {
          caption?: string | null
          contributor_id?: string | null
          id?: string
          photo_type?: string
          recipe_id?: string
          sort_order?: number
          storage_path?: string | null
          thumb_path?: string | null
          uploaded_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_comments: {
        Row: {
          author_contributor_id: string
          body: string
          created_at: string
          id: string
          recipe_id: string
        }
        Insert: {
          author_contributor_id: string
          body: string
          created_at?: string
          id?: string
          recipe_id: string
        }
        Update: {
          author_contributor_id?: string
          body?: string
          created_at?: string
          id?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_comments_author_contributor_id_fkey"
            columns: ["author_contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_comments_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_occasions: {
        Row: {
          occasion_slug: string
          recipe_id: string
        }
        Insert: {
          occasion_slug: string
          recipe_id: string
        }
        Update: {
          occasion_slug?: string
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_occasions_occasion_slug_fkey"
            columns: ["occasion_slug"]
            isOneToOne: false
            referencedRelation: "family_photo_occasion_types"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "recipe_occasions_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_tags: {
        Row: {
          recipe_id: string
          tag_id: string
        }
        Insert: {
          recipe_id: string
          tag_id: string
        }
        Update: {
          recipe_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_tags_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          added_by_id: string | null
          contributor_id: string
          created_at: string
          id: string
          kitchen_notes: string[]
          last_edited_at: string | null
          last_edited_by_id: string | null
          originally_from: string | null
          primary_family_line_id: string
          published_at: string | null
          secondary_family_line_id: string | null
          section_id: string
          slug: string | null
          status: string
          story: string | null
          title: string
          updated_at: string
        }
        Insert: {
          added_by_id?: string | null
          contributor_id: string
          created_at?: string
          id?: string
          kitchen_notes?: string[]
          last_edited_at?: string | null
          last_edited_by_id?: string | null
          originally_from?: string | null
          primary_family_line_id: string
          published_at?: string | null
          secondary_family_line_id?: string | null
          section_id: string
          slug?: string | null
          status?: string
          story?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          added_by_id?: string | null
          contributor_id?: string
          created_at?: string
          id?: string
          kitchen_notes?: string[]
          last_edited_at?: string | null
          last_edited_by_id?: string | null
          originally_from?: string | null
          primary_family_line_id?: string
          published_at?: string | null
          secondary_family_line_id?: string | null
          section_id?: string
          slug?: string | null
          status?: string
          story?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_added_by_id_fkey"
            columns: ["added_by_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_last_edited_by_id_fkey"
            columns: ["last_edited_by_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_primary_family_line_id_fkey"
            columns: ["primary_family_line_id"]
            isOneToOne: false
            referencedRelation: "family_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_secondary_family_line_id_fkey"
            columns: ["secondary_family_line_id"]
            isOneToOne: false
            referencedRelation: "family_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          color_token: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          color_token: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          color_token?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      submissions: {
        Row: {
          contributor_id: string | null
          created_at: string
          id: string
          raw_payload: Json
          recipe_id_if_published: string | null
          reviewed_at: string | null
          reviewed_by_id: string | null
          source: string
          status: string
        }
        Insert: {
          contributor_id?: string | null
          created_at?: string
          id?: string
          raw_payload: Json
          recipe_id_if_published?: string | null
          reviewed_at?: string | null
          reviewed_by_id?: string | null
          source: string
          status?: string
        }
        Update: {
          contributor_id?: string | null
          created_at?: string
          id?: string
          raw_payload?: Json
          recipe_id_if_published?: string | null
          reviewed_at?: string | null
          reviewed_by_id?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_recipe_id_if_published_fkey"
            columns: ["recipe_id_if_published"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_reviewed_by_id_fkey"
            columns: ["reviewed_by_id"]
            isOneToOne: false
            referencedRelation: "contributors"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_contributor_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
