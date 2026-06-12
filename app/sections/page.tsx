import { redirect } from 'next/navigation';

// The sections index was a hallway — a page whose only content was more
// navigation. Section LANDING pages (/sections/[slug]) remain; you reach
// them from the colored chips on /recipes, home's pill row, and recipe
// breadcrumbs. One door for recipes.
export default function SectionsIndexPage() {
  redirect('/recipes');
}
