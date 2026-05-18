'use client';

import { useEffect } from 'react';

// Opens the browser's print dialog as soon as the print page renders.
// Kept in its own client component so the rest of /recipes/[slug]/print can
// stay server-rendered.
export function PrintTrigger() {
  useEffect(() => {
    // Tiny delay so fonts/layout settle before the dialog opens — otherwise
    // some browsers snapshot mid-flow.
    const t = setTimeout(() => {
      if (typeof window !== 'undefined') window.print();
    }, 250);
    return () => clearTimeout(t);
  }, []);
  return null;
}
