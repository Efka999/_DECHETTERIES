import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';

const navLinkClass = ({ isActive }) =>
  cn(
    'text-sm font-medium transition-colors hover:text-[#5ea226]',
    isActive ? 'text-[#5ea226]' : 'text-muted-foreground'
  );

function GlobalHeader() {
  return (
    <header className="w-full border-b bg-background">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <img
            src="/logo-emmaus-environnement.webp"
            alt="Emmaüs Environnement"
            className="h-5 w-auto opacity-80"
          />
          <div className="text-lg font-semibold text-[#5ea226]">GDR DUMP beta</div>
        </div>
        <nav className="flex items-center gap-4">
          <NavLink to="/" className={navLinkClass}>
            Accueil
          </NavLink>
          <NavLink to="/stats" className={navLinkClass}>
            Statistiques
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export default GlobalHeader;
