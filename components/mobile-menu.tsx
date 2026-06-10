'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

export function MobileMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="relative ml-auto lg:hidden">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-rule text-ink hover:border-ink"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <nav className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border border-rule bg-paper p-2 shadow-[0_12px_40px_-20px_rgba(42,37,34,0.45)] label">
          {children}
        </nav>
      )}
    </div>
  );
}
