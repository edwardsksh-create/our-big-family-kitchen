import type { SectionColorToken } from '@/lib/sections';

export type FederatedRecipe = {
  id: string;
  source_url: string;
  title: string;
  contributor_name: string | null;
  section_slug: string | null;
  search_tokens: string | null;
  fetched_at: string;
};

export type FederatedRecipeBySection = {
  slug: string;
  name: string;
  color: SectionColorToken;
  recipes: FederatedRecipe[];
};
