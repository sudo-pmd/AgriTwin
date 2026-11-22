import { useState } from 'react';
import Glyph, { type GlyphName } from '../ui/Glyph';
import type { Account } from '../../auth/accounts';
import type { Parcel } from '../../types/agritwin';

export interface NavItem {
  key: string;
  label: string;
  short?: string;
  glyph: GlyphName;
}

interface TopNavbarProps {
  account: Account;
  parcels: Parcel[];
  selectedParcelId?: string;
  onSelectParcel: (id: string) => void;
  nav: NavItem[];
  activeTab: string;
  onTab: (key: string) => void;
  onOpenSimulator?: () => void;
  score?: number;
  simulationActive: boolean;
  integrityOk: boolean;
  onSignOut: () => void;
}

const ROLE_LABEL: Record<Account['role'], string> = {
  exploitant: 'Exploitant',
  financeur: 'Financeur',
  verificateur: 'Conformité',
};

export default function TopNavbar({
  account,
  parcels,
  selectedParcelId,
  onSelectParcel,
  nav,
  activeTab,
  onTab,
  onOpenSimulator,
  score,
  simulationActive,
  integrityOk,
  onSignOut,
}: TopNavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = account.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const scoreTone =
    score === undefined
      ? ''
      : score >= 75
        ? 'border-[#bbf7d0] bg-[#f0fdf4] text-forest-700'
        : score >= 50
          ? 'border-[#fcd34d] bg-[#fffbeb] text-[#b45309]'
          : 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]';

  return (
    <header className="sticky top-0 z-[1000] border-b border-[#dde5ee] bg-white">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-3 px-4 py-2.5 lg:px-8">
        <div className="flex shrink-0 items-center gap-2">
          <img
            src="./agritwin-logo.webp"
            alt="Emblème AgriTwin"
            className="h-9 w-9 shrink-0 border border-[#e2e8f0] bg-white object-contain p-0.5"
          />
          <div className="min-w-0">
            <p className="font-serif text-[17px] leading-none text-[#0f2f5f] sm:text-lg">AgriTwin</p>
            <p className="mt-0.5 hidden truncate text-[10px] uppercase tracking-[0.14em] text-slate-500 sm:block">
              Jumeau numérique &amp; Score Vert
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {score !== undefined && (
            <span className={`chip ${scoreTone}`} title="Score Vert de la parcelle sélectionnée">
              <Glyph name="sprout" className="h-3.5 w-3.5" />
              <span className="sm:hidden">{score}</span>
              <span className="hidden sm:inline">Score {score}/100</span>
            </span>
          )}
          {simulationActive && (
            <span className="chip hidden border-[#fcd34d] bg-[#fffbeb] text-[#b45309] sm:inline-flex">
              Simulation
            </span>
          )}
          {onOpenSimulator && (
            <button
              type="button"
              className="btn-primary px-2.5 sm:px-3.5"
              onClick={onOpenSimulator}
              aria-label="Ouvrir le simulateur IoT"
            >
              <Glyph name="sensor" className="h-4 w-4" />
              <span className="hidden sm:inline">Simulateur IoT</span>
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 border border-[#dde5ee] px-1.5 py-1 text-left transition hover:border-forest-400 sm:px-2"
            >
              <span className="flex h-7 w-7 items-center justify-center bg-forest-700 text-[11px] font-bold text-white">
                {initials}
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block max-w-[150px] truncate text-[12px] font-semibold leading-tight text-slateink-800">
                  {account.name}
                </span>
                <span className="block text-[10px] uppercase tracking-wide text-slate-500">
                  {ROLE_LABEL[account.role]}
                </span>
              </span>
              <Glyph name="chevronDown" className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
            </button>

            {menuOpen && (
              <>
                <button
                  type="button"
                  aria-hidden="true"
                  tabIndex={-1}
                  className="fixed inset-0 z-[1000] cursor-default"
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+6px)] z-[1001] w-64 border border-[#dde5ee] bg-white p-1 shadow-lift"
                >
                  <div className="border-b border-[#eef3f8] px-3 py-2.5">
                    <p className="text-[13px] font-semibold text-slateink-800">{account.name}</p>
                    <p className="truncate text-[11px] text-slate-500">{account.organisation}</p>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">+221 {account.phone}</p>
                  </div>
                  <ul className="py-1 text-[11px] text-slate-500">
                    <li className="flex items-center justify-between px-3 py-1.5">
                      <span>Chaîne de mesures</span>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          integrityOk ? 'text-forest-700' : 'text-[#b91c1c]'
                        }`}
                      >
                        <Glyph name={integrityOk ? 'shieldCheck' : 'shieldAlert'} className="h-3.5 w-3.5" />
                        {integrityOk ? 'Intègre' : 'Anomalie'}
                      </span>
                    </li>
                    <li className="flex items-center justify-between px-3 py-1.5">
                      <span>Compte</span>
                      <span className="font-semibold text-slateink-800">{ROLE_LABEL[account.role]}</span>
                    </li>
                  </ul>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={onSignOut}
                    className="flex w-full items-center gap-2 border-t border-[#eef3f8] px-3 py-2 text-[12px] font-semibold text-[#b91c1c] hover:bg-[#fef2f2]"
                  >
                    <Glyph name="logout" className="h-4 w-4" />
                    Se déconnecter
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 px-4 pb-0 lg:flex-row lg:items-end lg:justify-between lg:px-8">
        {parcels.length > 0 ? (
          <label className="relative flex items-center border border-[#dde5ee] bg-[#f8fafc] lg:w-[380px] lg:border-0 lg:border-b lg:bg-transparent">
            <Glyph name="parcel" className="pointer-events-none absolute left-2.5 h-4 w-4 text-slate-400" />
            <select
              value={selectedParcelId}
              onChange={(event) => onSelectParcel(event.target.value)}
              aria-label="Sélectionner la parcelle"
              className="w-full appearance-none bg-transparent py-2 pl-8 pr-8 text-[12px] font-semibold text-slateink-800 outline-none sm:text-[13px]"
            >
              {parcels.map((parcel) => (
                <option key={parcel.id} value={parcel.id}>
                  {parcel.shortName} · {parcel.areaHa.toFixed(1).replace('.', ',')} ha
                </option>
              ))}
            </select>
            <Glyph name="chevronDown" className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
          </label>
        ) : (
          <span />
        )}

        <nav
          className={`w-full gap-0 border-t border-[#eef3f8] pt-1 sm:flex sm:w-auto sm:border-0 sm:pt-0 ${
            nav.length > 1 ? 'grid' : 'hidden sm:flex'
          }`}
          style={nav.length > 1 ? { gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` } : undefined}
        >
          {nav.map((item) => {
            const active = item.key === activeTab;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTab(item.key)}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                className={`-mb-px flex shrink-0 flex-col items-center gap-1 border-b-2 px-1 py-1.5 text-[10px] font-semibold leading-tight transition sm:flex-row sm:gap-1.5 sm:px-3 sm:py-2.5 sm:text-[12px] ${
                  active
                    ? 'border-forest-700 text-forest-800'
                    : 'border-transparent text-slate-500 hover:text-slateink-800'
                }`}
              >
                <Glyph name={item.glyph} className="h-4 w-4" />
                <span className="sm:hidden">{item.short ?? item.label}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
