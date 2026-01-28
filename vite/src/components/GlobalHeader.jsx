import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const navLinkClass = ({ isActive }) =>
  cn(
    'text-sm font-medium transition-colors hover:text-brand',
    isActive ? 'text-brand' : 'text-muted-foreground'
  );

function GlobalHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex w-full items-center justify-between px-3 md:px-4 py-3">
        <div className="flex items-center gap-3">
          <img
            src="/logo-emmaus-environnement.webp"
            alt="Emmaüs Environnement"
            className="h-5 w-auto opacity-80"
          />
          <div className="text-lg font-semibold text-brand">GDR Dump (Beta)</div>
        </div>
        <nav className="flex items-center gap-4">
          <NavLink to="/" className={navLinkClass}>
            Accueil
          </NavLink>
          <NavLink to="/import" className={navLinkClass}>
            Import
          </NavLink>
          <NavLink to="/stats" className={navLinkClass}>
            Statistiques
          </NavLink>
          <NavLink to="/raw-data" className={navLinkClass}>
            Données brutes
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default GlobalHeader;
