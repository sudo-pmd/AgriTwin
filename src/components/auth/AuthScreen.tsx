import { useState } from 'react';
import Glyph from '../ui/Glyph';
import { DEMO_LOGINS, signIn, signUp, type Account } from '../../auth/accounts';
import type { AccountRole } from '../../types/agritwin';

interface AuthScreenProps {
  onAuthenticated: (account: Account) => void;
  onStartDemo?: () => void;
}

const ROLE_LABEL: Record<AccountRole, string> = {
  exploitant: 'Exploitant / coopérative',
  financeur: 'Institution financière',
  verificateur: 'Conformité AgriTwin',
};

export default function AuthScreen({ onAuthenticated, onStartDemo }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [role, setRole] = useState<AccountRole>('exploitant');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<{ account?: Account; error?: string }>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.account) onAuthenticated(result.account);
    } catch {
      setError(
        'Connexion impossible : vérifiez que votre navigateur autorise le stockage local et Web Crypto.',
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'login') {
      void run(() => signIn(phone, password));
    } else {
      void run(() => signUp({ name, phone, password, role, organisation }));
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative flex flex-col justify-between overflow-hidden bg-forest-800 px-6 py-6 text-white sm:px-10 lg:px-14 lg:py-12">
        <div className="flex items-center gap-3">
          <img
            src="./agritwin-logo.webp"
            alt="Emblème AgriTwin"
            className="h-11 w-11 border border-white/15 bg-white/5 object-contain p-1"
          />
          <div>
            <p className="font-serif text-2xl leading-none">AgriTwin</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
              Jumeau numérique &amp; Score Vert
            </p>
          </div>
        </div>

        <div className="mt-6 max-w-xl lg:mt-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#86efac] sm:text-[11px]">
            Registre agricole vérifié
          </p>
          <h1 className="mt-2 font-serif text-[1.7rem] leading-[1.1] text-white sm:text-4xl lg:text-5xl">
            La preuve agronomique
            <br className="hidden sm:block" />{' '}
            qui ouvre le crédit.
          </h1>
          <p className="mt-3 hidden max-w-lg text-sm leading-relaxed text-white/70 lg:mt-4 lg:block">
            Chaque parcelle est déclarée, géolocalisée et contrôlée par nos équipes. Les relevés
            capteur et satellite sont scellés, puis transformés en un Score Vert que la banque peut
            consulter sans intermédiaire.
          </p>

          <dl className="mt-8 hidden grid-cols-3 gap-px border border-white/15 bg-white/15 lg:grid">
            {[
              ['90 j', 'de relevés scellés'],
              ['4', 'pièces vérifiées'],
              ['1', 'score auditable'],
            ].map(([value, label]) => (
              <div key={label} className="bg-forest-800 px-3 py-3">
                <dt className="font-serif text-2xl leading-none">{value}</dt>
                <dd className="mt-1 text-[10px] uppercase leading-tight tracking-[0.1em] text-white/55">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="mt-6 hidden text-[11px] leading-relaxed text-white/45 lg:mt-0 lg:block">
          Concours AKTIION 2026 · École Polytechnique de Thiès · Données de démonstration
        </p>
      </section>

      <section className="flex items-start justify-center px-4 py-8 sm:px-8 lg:items-center lg:px-12">
        <div className="w-full max-w-md">
          <div className="flex gap-6 border-b border-[#dde5ee]">
            {(
              [
                ['login', 'Connexion'],
                ['signup', 'Créer un compte'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMode(key);
                  setError(null);
                }}
                className={`-mb-px border-b-2 pb-2.5 text-[13px] font-semibold transition ${
                  mode === key
                    ? 'border-forest-700 text-forest-800'
                    : 'border-transparent text-slate-500 hover:text-slateink-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="field-label" htmlFor="signup-name">
                    Nom complet
                  </label>
                  <input
                    id="signup-name"
                    className="field"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Aminata Seck"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="signup-org">
                    Exploitation ou organisation
                  </label>
                  <input
                    id="signup-org"
                    className="field"
                    value={organisation}
                    onChange={(event) => setOrganisation(event.target.value)}
                    placeholder="Coopérative de Mboro"
                    autoComplete="organization"
                  />
                </div>
                <fieldset>
                  <legend className="field-label">Type de compte</legend>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['exploitant', 'financeur'] as AccountRole[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRole(value)}
                        aria-pressed={role === value}
                        className={`border px-2.5 py-2 text-left text-[12px] font-semibold leading-snug transition ${
                          role === value
                            ? 'border-forest-700 bg-forest-50 text-forest-800'
                            : 'border-[#cfd9e5] bg-white text-slate-600 hover:border-forest-400'
                        }`}
                      >
                        {ROLE_LABEL[value]}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            <div>
              <label className="field-label" htmlFor="auth-phone">
                Téléphone
              </label>
              <div className="flex">
                <span className="flex items-center border border-r-0 border-[#cfd9e5] bg-[#f1f5f9] px-3 text-[13px] font-semibold text-slate-500">
                  +221
                </span>
                <input
                  id="auth-phone"
                  className="field border-l-0"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="77 000 00 01"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="auth-password">
                Mot de passe
              </label>
              <input
                id="auth-password"
                type="password"
                className="field"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="6 caractères minimum"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] font-semibold text-[#b91c1c]"
              >
                <Glyph name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Vérification…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
              <Glyph name="arrowRight" className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-6 border-t border-[#dde5ee] pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              Comptes de démonstration
            </p>
            <ul className="mt-2 divide-y divide-[#e6edf4] border border-[#dde5ee] bg-white">
              {DEMO_LOGINS.map((demo) => (
                <li
                  key={demo.phone}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors duration-200 hover:bg-[#f7fbf8]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-slateink-800">
                      {demo.name}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">{demo.organisation}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary shrink-0 px-2.5 py-1 text-[11px]"
                    disabled={busy}
                    onClick={() => void run(() => signIn(demo.phone, demo.password))}
                  >
                    Entrer
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Démonstration : mot de passe <span className="font-mono">demo1234</span>. Les comptes
              créés et les pièces déposées restent sur cet appareil.
            </p>
            {onStartDemo && (
              <div className="mt-3 border-t border-[#dde5ee] pt-3">
                <button type="button" className="btn-primary w-full" onClick={onStartDemo} disabled={busy}>
                  <Glyph name="play" className="h-4 w-4" />
                  Lancer la démo guidée
                  <Glyph name="arrowRight" className="h-4 w-4" />
                </button>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                  Réinitialise comptes et données locales, puis déroule le parcours complet en huit
                  étapes, sans recherche dans les menus.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
