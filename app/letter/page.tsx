import { redirect } from 'next/navigation';

// The letter lives at the bottom of /about now.
export default function LetterPage() {
  redirect('/about#letter');
}
