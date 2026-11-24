import type { ReactNode } from 'react';

/**
 * En-tête de page commun à toutes les vues : même panneau, même filet
 * supérieur, mêmes actions alignées. Les pages qui n'ont pas de badges
 * n'affichent simplement rien à droite.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  badges,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="relative flex flex-wrap items-end justify-between gap-3 overflow-hidden rounded-[12px] border border-[#e3e9f1] bg-white/85 px-4 py-3 shadow-card backdrop-blur-sm sm:px-5 sm:py-4">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-forest-500 via-forest-500/25 to-transparent"
      />
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 font-serif text-xl leading-tight text-slateink-800 sm:text-2xl lg:text-3xl">
          {title}
        </h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-500">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {badges}
        {actions}
      </div>
    </div>
  );
}
