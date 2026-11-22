import { useEffect, useMemo, useState } from 'react';
import Glyph from './components/ui/Glyph';
import TopNavbar, { type NavItem } from './components/layout/TopNavbar';
import IoTSimulatorDrawer from './components/layout/IoTSimulatorDrawer';
import ParcelMap from './components/module1-map/ParcelMap';
import KpiCards from './components/module2-monitoring/KpiCards';
import TelemetryCharts from './components/module2-monitoring/TelemetryCharts';
import VoiceAssistant from './components/module2-monitoring/VoiceAssistant';
import AgroJournalModal from './components/module2-monitoring/AgroJournalModal';
import YieldSimulator from './components/module3-simulator/YieldSimulator';
import GreenScoreCard from './components/module4-finance/GreenScoreCard';
import CryptoAuditTable from './components/module4-finance/CryptoAuditTable';
import LenderPortal from './components/module4-finance/LenderPortal';
import ParcelSetup from './components/parcel/ParcelSetup';
import VerificationQueue from './components/verification/VerificationQueue';
import AuthScreen from './components/auth/AuthScreen';
import {
  buildConfigDataset,
  buildSeedDatasets,
} from './data/seedData';
import { VOICE_ALERTS, type VoicePhrase } from './data/wolofPhrases';
import {
  DEFAULT_PARAMS,
  nitrogenFromProduct,
  projectYield,
  type FertilizerProduct,
} from './utils/agronomyEngine';
import {
  assuranceStatus,
  computeGreenScore,
  creditVerdict,
} from './utils/greenScoreEngine';
import { signAppend, signRecords, verifyChain, type ChainVerification } from './utils/cryptoChain';
import { generateCreditPdf } from './utils/pdfGenerator';
import { formatDate, formatNumber } from './utils/format';
import { ensureAccounts, persistSession, restoreSession, signOut, type Account } from './auth/accounts';
import {
  loadParcelConfigs,
  upsertParcelConfig,
} from './storage/parcels';
import type {
  AlertMessage,
  AlertSeverity,
  GreenScoreResult,
  InjectionKind,
  ParcelConfig,
  ParcelDataset,
  PestReport,
  TelemetryRecord,
  VerificationStatus,
} from './types/agritwin';

const EXPLOITANT_NAV: NavItem[] = [
  { key: 'parcel', label: 'Ma parcelle', short: 'Parcelle', glyph: 'parcel' },
  { key: 'map', label: 'Carte', short: 'Carte', glyph: 'map' },
  { key: 'monitoring', label: 'Capteurs', short: 'Capteurs', glyph: 'sensor' },
  { key: 'simulator', label: 'Simulateur', short: 'Simul.', glyph: 'chart' },
  { key: 'score', label: 'Score Vert', short: 'Score', glyph: 'sprout' },
];

const FINANCEUR_NAV: NavItem[] = [{ key: 'portal', label: 'Dossiers', glyph: 'building' }];
const VERIFICATEUR_NAV: NavItem[] = [
  { key: 'verification', label: 'Vérifications', glyph: 'shieldCheck' },
];

const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  brouillon: 'Brouillon',
  soumis: 'En vérification',
  verifie: 'Certifiée',
  rejete: 'Rejetée',
};

const VERIFICATION_TONE: Record<VerificationStatus, string> = {
  brouillon: 'border-[#cbd5e1] bg-white text-slate-600',
  soumis: 'border-[#fcd34d] bg-[#fffbeb] text-[#b45309]',
  verifie: 'border-[#bbf7d0] bg-[#f0fdf4] text-forest-700',
  rejete: 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]',
};

function alertFrom(
  id: string,
  severity: AlertSeverity,
  title: string,
  message: string,
  phrase: VoicePhrase,
): AlertMessage {
  return {
    id,
    severity,
    title,
    message,
    voiceFr: phrase.fr,
    voiceWolof: phrase.wolof,
    wolofTranslation: phrase.frTranslation,
  };
}

function deriveAlerts(dataset: ParcelDataset): AlertMessage[] {
  const latest = dataset.records[dataset.records.length - 1];
  const alerts: AlertMessage[] = [];
  const gap = Math.abs(latest.moisture15 - latest.sentinel1Humidity);
  const zone = dataset.parcel.zones.find((item) => item.status === 'critique') ?? dataset.parcel.zones[0];

  if (gap > 15) {
    alerts.push(
      alertFrom(
        'ALR-SAT-01',
        'critique',
        'Anomalie de cohérence sonde / satellite',
        `Écart de ${formatNumber(gap)} points entre la sonde (${formatNumber(
          latest.moisture15,
        )} %) et le radar Sentinel-1 (${formatNumber(
          latest.sentinel1Humidity,
        )} %) alors que la pluviométrie locale est de ${formatNumber(
          latest.rainfall,
        )} mm. La composante intégrité du Score Vert est ramenée à 0/20.`,
        VOICE_ALERTS.fraud,
      ),
    );
  }

  if (!latest.sealOk) {
    alerts.push(
      alertFrom(
        'ALR-SEAL-02',
        'critique',
        'Sécurité physique du boîtier',
        `Le scellé du boîtier ${dataset.parcel.kitSerial} est rompu${
          latest.accelerometerMotion
            ? ' et un mouvement d’arrachement a été détecté par l’accéléromètre'
            : ''
        }. Le dossier de crédit est gelé jusqu’à inspection du technicien.`,
        VOICE_ALERTS.tamper,
      ),
    );
  }

  if (latest.airTemp >= 35 && latest.moisture15 < 20) {
    alerts.push(
      alertFrom(
        'ALR-HEAT-03',
        'critique',
        'Vague de chaleur & stress hydrique',
        `Température de l’air à ${formatNumber(latest.airTemp)} °C et humidité racinaire à ${formatNumber(
          latest.moisture15,
        )} % (zone ${zone.label}). Irrigation immédiate et ombrage des jeunes plants recommandés.`,
        VOICE_ALERTS.heat,
      ),
    );
  } else if (latest.moisture15 < 20) {
    alerts.push(
      alertFrom(
        'ALR-HYD-03',
        'critique',
        'Alerte hydrique active',
        `Humidité du sol à 15 cm : ${formatNumber(latest.moisture15)} % sur la zone ${
          zone.label
        }, sous le seuil critique de 20 % depuis 48 h. Radar Sentinel-1 : ${formatNumber(
          latest.sentinel1Humidity,
        )} %. Irriguez sous 6 heures.`,
        VOICE_ALERTS.hydric,
      ),
    );
  } else if (latest.moisture15 < 22) {
    alerts.push(
      alertFrom(
        'ALR-HYD-04',
        'vigilance',
        'Humidité en baisse',
        `Humidité du sol à 15 cm : ${formatNumber(latest.moisture15)} % — zone de vigilance. Prévoyez une irrigation légère de 10 à 12 mm.`,
        VOICE_ALERTS.hydric,
      ),
    );
  }

  if (latest.ec > 1.5 && !dataset.frozen) {
    alerts.push(
      alertFrom(
        'ALR-SAL-05',
        'vigilance',
        'Salinité du sol en hausse',
        `Conductivité électrique à ${formatNumber(latest.ec, 2)} dS/m, au-dessus du seuil de 1,5 dS/m. Privilégiez un lessivage contrôlé et évitez les apports de chlorure.`,
        VOICE_ALERTS.salinity,
      ),
    );
  }

  const recentPest = dataset.pests.find(
    (report) => new Date(latest.timestamp).getTime() - new Date(report.date).getTime() <= 14 * 86_400_000,
  );
  if (recentPest) {
    alerts.push(
      alertFrom(
        'ALR-PHY-06',
        'vigilance',
        `Signalement phytosanitaire — ${recentPest.type}`,
        `Attaque ${recentPest.severity} consignée le ${formatDate(
          recentPest.date,
        )}. Traitement localisé recommandé ; la baisse de NDVI associée est traitée comme un aléa sanitaire.`,
        VOICE_ALERTS.pest,
      ),
    );
  }

  if (alerts.length === 0) {
    alerts.push(
      alertFrom(
        'ALR-OK',
        'info',
        'Aucune alerte critique',
        'La parcelle présente un état hydrique, minéral et sanitaire satisfaisant. Poursuivez le pilotage actuel.',
        VOICE_ALERTS.allClear,
      ),
    );
  }

  const order: Record<AlertSeverity, number> = { critique: 0, vigilance: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

function SourceBadge({ simulation }: { simulation: boolean }) {
  return (
    <span
      className={`chip ${
        simulation
          ? 'border-[#fcd34d] bg-[#fffbeb] text-[#b45309]'
          : 'border-[#bbf7d0] bg-[#f0fdf4] text-forest-700'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 ${simulation ? 'bg-[#d97706]' : 'bg-forest-600'}`}
        aria-hidden="true"
      />
      {simulation ? 'Simulation démo' : 'Données capteur certifiées'}
    </span>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
  badges,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#dde5ee] pb-3">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 font-serif text-2xl leading-tight text-slateink-800 sm:text-3xl">{title}</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-slate-500">{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {badges}
        {actions}
      </div>
    </div>
  );
}

function InfoTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-l-2 border-[#dde5ee] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-0.5 text-[13px] font-semibold leading-snug text-slateink-800 sm:text-sm">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{detail}</p>
    </div>
  );
}

export default function App() {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [configs, setConfigs] = useState<ParcelConfig[]>(() => loadParcelConfigs());
  const [datasets, setDatasets] = useState<Record<string, ParcelDataset> | null>(null);
  const [parcelId, setParcelId] = useState('PARC-BMB-001');
  const [tab, setTab] = useState('map');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [chains, setChains] = useState<Record<string, ChainVerification>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void ensureAccounts().then((list) => {
      if (!alive) return;
      setAccounts(list);
      setAccount(restoreSession(list));
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const seed = buildSeedDatasets();
      const custom: Record<string, ParcelDataset> = {};
      for (const config of configs) custom[config.id] = buildConfigDataset(config);
      const merged = { ...seed, ...custom };
      const signed: Record<string, ParcelDataset> = {};
      for (const key of Object.keys(merged)) {
        signed[key] = { ...merged[key], records: await signRecords(merged[key].records) };
      }
      if (alive) setDatasets(signed);
    })();
    return () => {
      alive = false;
    };
  }, [configs]);

  const availableParcels = useMemo(() => {
    if (!datasets || !account) return [];
    const all = Object.values(datasets);
    if (account.role === 'verificateur') return all.map((item) => item.parcel);
    if (account.role === 'financeur') return all.map((item) => item.parcel);
    return all
      .filter((item) => !item.parcel.ownerAccountId || item.parcel.ownerAccountId === account.id)
      .map((item) => item.parcel);
  }, [datasets, account]);

  useEffect(() => {
    if (availableParcels.length === 0) return;
    if (!availableParcels.some((parcel) => parcel.id === parcelId)) {
      setParcelId(availableParcels[0].id);
    }
  }, [availableParcels, parcelId]);

  const dataset =
    datasets && availableParcels.some((parcel) => parcel.id === parcelId)
      ? (datasets[parcelId] ?? null)
      : null;
  const chain = dataset ? chains[dataset.parcel.id] : undefined;

  useEffect(() => {
    if (!dataset) return;
    let alive = true;
    verifyChain(dataset.records).then((verification) => {
      if (alive) {
        setChains((previous) => ({ ...previous, [dataset.parcel.id]: verification }));
      }
    });
    return () => {
      alive = false;
    };
  }, [dataset]);

  const score = useMemo<GreenScoreResult | null>(() => {
    if (!dataset || !chain) return null;
    const latest = dataset.records[dataset.records.length - 1];
    return computeGreenScore({
      records: dataset.records,
      ndvi: latest.ndvi,
      ec: latest.ec,
      ph: latest.ph,
      sealOk: latest.sealOk,
      chainValid: chain.valid,
    });
  }, [dataset, chain]);

  const verdict = useMemo(
    () => (score && dataset ? creditVerdict(score, dataset.frozen) : null),
    [score, dataset],
  );
  const assurance = useMemo(
    () => (score && dataset ? assuranceStatus(dataset, score) : null),
    [score, dataset],
  );
  const alerts = useMemo(() => (dataset ? deriveAlerts(dataset) : []), [dataset]);

  const pestNote = useMemo(() => {
    if (!dataset) return null;
    const latestRecord = dataset.records[dataset.records.length - 1];
    const recent = dataset.pests.find(
      (report) =>
        new Date(latestRecord.timestamp).getTime() - new Date(report.date).getTime() <=
        14 * 86_400_000,
    );
    if (!recent) return null;
    const days = Math.max(
      1,
      Math.round(
        (new Date(latestRecord.timestamp).getTime() - new Date(recent.date).getTime()) / 86_400_000,
      ),
    );
    return `Signalement ${recent.type} (${recent.severity}) il y a ${days} jour(s) : la baisse de NDVI associée est traitée comme un aléa sanitaire et non comme une négligence d’irrigation.`;
  }, [dataset]);

  if (!accounts) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8fafc] px-6">
        <div className="text-center">
          <img
            src="./agritwin-logo.webp"
            alt="AgriTwin"
            className="mx-auto h-16 w-16 object-contain"
          />
          <p className="mt-4 font-serif text-2xl text-slateink-800">AgriTwin</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Ouverture du registre…
          </p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <AuthScreen
        onAuthenticated={(next) => {
          persistSession(next);
          setAccount(next);
          setTab(next.role === 'verificateur' ? 'verification' : next.role === 'financeur' ? 'portal' : 'map');
        }}
      />
    );
  }

  if (!datasets) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8fafc] px-6">
        <div className="text-center">
          <p className="font-serif text-2xl text-slateink-800">Préparation du dossier</p>
          <p className="mt-2 text-[12px] text-slate-500">
            Signature et vérification des 90 relevés SHA-256…
          </p>
        </div>
      </div>
    );
  }

  const role = account.role;
  const nav = role === 'verificateur' ? VERIFICATEUR_NAV : role === 'financeur' ? FINANCEUR_NAV : EXPLOITANT_NAV;
  const activeTab = role === 'verificateur' ? 'verification' : role === 'financeur' ? 'portal' : tab;

  const parcels = availableParcels;
  const latest = dataset?.records[dataset.records.length - 1];

  const updateDataset = (id: string, updater: (current: ParcelDataset) => ParcelDataset) => {
    setDatasets((previous) =>
      previous ? { ...previous, [id]: updater(previous[id]) } : previous,
    );
  };

  const inject = async (kind: InjectionKind) => {
    if (pending || !dataset) return;
    setPending(true);
    const current = datasets[dataset.parcel.id];
    const currentLatest = current.records[current.records.length - 1];
    const index = current.records.length;
    const record: TelemetryRecord = {
      id: `${current.parcel.id}-SIM-${String(index + 1).padStart(3, '0')}`,
      timestamp: new Date().toISOString(),
      dayIndex: index,
      deviceId: current.parcel.kitSerial,
      moisture15: currentLatest.moisture15,
      moisture35: currentLatest.moisture35,
      soilTemp: currentLatest.soilTemp,
      airTemp: currentLatest.airTemp,
      airHumidity: currentLatest.airHumidity,
      rainfall: 0,
      irrigation: 0,
      ec: currentLatest.ec,
      ph: currentLatest.ph,
      battery: currentLatest.battery,
      sealOk: true,
      accelerometerMotion: false,
      rssi: currentLatest.rssi,
      ndvi: currentLatest.ndvi,
      ndviReference: currentLatest.ndviReference,
      sentinel1Humidity: currentLatest.sentinel1Humidity,
      source: 'simulation',
    };

    let label = 'Relevé normal injecté';
    switch (kind) {
      case 'normal':
        record.moisture15 = 26.5;
        record.moisture35 = 30.1;
        record.ndvi = 0.75;
        record.sentinel1Humidity = 27.2;
        record.airTemp = 31.2;
        record.soilTemp = 27.4;
        record.battery = 96;
        record.rainfall = 0;
        break;
      case 'heat':
        record.airTemp = 39.5;
        record.soilTemp = 34.6;
        record.moisture15 = 14.8;
        record.moisture35 = 16.2;
        record.sentinel1Humidity = 15.6;
        record.airHumidity = 38;
        label = 'Vague de chaleur simulée';
        break;
      case 'fraud':
        record.moisture15 = 44;
        record.moisture35 = 29.4;
        record.sentinel1Humidity = 20.7;
        record.rainfall = 0;
        record.irrigation = 0;
        label = 'Fraude sonde / satellite injectée';
        break;
      case 'tamper':
        record.sealOk = false;
        record.accelerometerMotion = true;
        label = 'Arrachement de boîtier simulé';
        break;
      default:
        break;
    }

    const records = await signAppend(current.records, record);
    updateDataset(dataset.parcel.id, (item) => ({
      ...item,
      records,
      simulationActive: true,
      frozen: kind === 'tamper' ? true : item.frozen,
      lastInjection: label,
    }));
    setPending(false);
  };

  const resetDemo = async () => {
    if (pending || !dataset) return;
    setPending(true);
    const config = configs.find((item) => item.id === dataset.parcel.id);
    const fresh = config ? buildConfigDataset(config) : buildSeedDatasets()[dataset.parcel.id];
    const records = await signRecords(fresh.records);
    updateDataset(dataset.parcel.id, () => ({ ...fresh, records }));
    setPending(false);
  };

  const toggleConsent = (value: boolean) => {
    if (!dataset) return;
    updateDataset(dataset.parcel.id, (item) => ({ ...item, consent: value }));
  };

  const addFertilizer = (input: { type: FertilizerProduct; quantityKg: number; date: string }) => {
    if (!dataset) return;
    updateDataset(dataset.parcel.id, (item) => ({
      ...item,
      fertilizers: [
        {
          id: `FERT-${Date.now()}`,
          date: input.date,
          type: input.type,
          quantityKg: input.quantityKg,
          nitrogenKgHa: nitrogenFromProduct(input.type, input.quantityKg, item.parcel.areaHa),
        },
        ...item.fertilizers,
      ],
    }));
  };

  const addPest = (input: {
    type: PestReport['type'];
    severity: PestReport['severity'];
    note: string;
    date: string;
  }) => {
    if (!dataset) return;
    updateDataset(dataset.parcel.id, (item) => ({
      ...item,
      pests: [{ id: `PEST-${Date.now()}`, ...input }, ...item.pests],
    }));
  };

  const downloadPdf = async () => {
    if (downloading || !dataset || !score || !verdict || !assurance) return;
    const lastRecord = dataset.records[dataset.records.length - 1];
    setDownloading(true);
    setError(null);
    try {
      const projection = projectYield(dataset.parcel, lastRecord.ec, DEFAULT_PARAMS);
      await generateCreditPdf({
        parcel: dataset.parcel,
        dataset,
        score,
        verdict,
        assurance: { label: assurance.label, detail: assurance.detail },
        projection,
        chainHash: chain?.globalHash ?? '',
      });
    } catch (pdfError) {
      console.error(pdfError);
      setError('La génération du PDF a échoué. Vérifiez que le navigateur autorise les téléchargements.');
    } finally {
      setDownloading(false);
    }
  };

  const saveConfig = (config: ParcelConfig) => {
    setConfigs(upsertParcelConfig(config));
    setParcelId(config.id);
  };

  const submitConfig = (config: ParcelConfig) => {
    setConfigs(upsertParcelConfig(config));
    setParcelId(config.id);
  };

  const decideParcel = (id: string, status: VerificationStatus, note: string) => {
    const target = configs.find((config) => config.id === id);
    if (!target) return;
    const next: ParcelConfig = {
      ...target,
      documents:
        status === 'verifie'
          ? target.documents.map((document) => ({ ...document, status: 'verifie' as const }))
          : status === 'rejete'
            ? target.documents.map((document) => ({
                ...document,
                status: 'rejete' as const,
                note,
              }))
            : target.documents,
      verification: {
        ...target.verification,
        status,
        note,
        reviewedAt: new Date().toISOString(),
        reviewer: `${account.name} · ${account.organisation}`,
      },
    };
    setConfigs(upsertParcelConfig(next));
  };

  const appliedNitrogen = dataset
    ? dataset.fertilizers.reduce((sum, entry) => sum + entry.nitrogenKgHa, 0)
    : 0;
  const nitrogenCoverage = dataset
    ? Math.min(100, Math.round((appliedNitrogen / dataset.parcel.crop.nitrogenNeed) * 100))
    : 0;

  const verification = dataset?.parcel.verification;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <TopNavbar
        account={account}
        parcels={role === 'verificateur' ? [] : parcels}
        selectedParcelId={parcelId}
        onSelectParcel={(id) => {
          setParcelId(id);
          setError(null);
        }}
        nav={nav}
        activeTab={activeTab}
        onTab={setTab}
        onOpenSimulator={role === 'exploitant' ? () => setDrawerOpen(true) : undefined}
        score={role === 'verificateur' ? undefined : score?.total}
        simulationActive={Boolean(dataset?.simulationActive)}
        integrityOk={Boolean(score && score.integrity > 0)}
        onSignOut={() => {
          signOut();
          setAccount(null);
        }}
      />

      <main className="mx-auto w-full max-w-[1440px] px-4 py-4 lg:px-8">
        {error && (
          <div className="mb-3 flex items-start gap-2 border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] font-semibold text-[#b91c1c]">
            <Glyph name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {role === 'verificateur' && (
          <VerificationQueue account={account} configs={configs} onDecision={decideParcel} />
        )}

        {role === 'financeur' && dataset && score && verdict && (
          <div className="space-y-4">
            <PageHeader
              eyebrow={`Portail financeur · ${account.organisation}`}
              title="Dossiers de crédit Score Vert"
              description={`Consultation du dossier certifié de ${dataset.parcel.owner} — ${dataset.parcel.shortName}. Le partage reste soumis au consentement de l’exploitant.`}
              badges={<SourceBadge simulation={dataset.simulationActive} />}
            />
            <LenderPortal
              parcel={dataset.parcel}
              dataset={dataset}
              score={score}
              verdict={verdict}
              onDownload={downloadPdf}
              downloading={downloading}
            />
          </div>
        )}

        {role === 'exploitant' && tab === 'parcel' && (
          <ParcelSetup
            account={account}
            configs={configs}
            certified={parcels
              .filter(
                (parcel) =>
                  parcel.ownerAccountId === account.id &&
                  !configs.some((config) => config.id === parcel.id),
              )
              .map((parcel) => ({
                id: parcel.id,
                name: parcel.name,
                areaHa: parcel.areaHa,
                kitSerial: parcel.kitSerial,
                documents: parcel.documents.length,
              }))}
            onOpenParcel={(id) => {
              setParcelId(id);
              setTab('map');
            }}
            onSave={saveConfig}
            onSubmit={submitConfig}
          />
        )}

        {role === 'exploitant' && tab !== 'parcel' && !dataset && (
          <div className="border border-dashed border-[#cbd5e1] bg-white px-6 py-14 text-center">
            <Glyph name="parcel" className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-3 font-serif text-xl text-slateink-800">Aucune parcelle déclarée</p>
            <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-slate-500">
              Déclarez une parcelle et déposez vos pièces pour ouvrir votre jumeau numérique et votre
              Score Vert.
            </p>
            <button type="button" className="btn-primary mt-4" onClick={() => setTab('parcel')}>
              Déclarer ma parcelle
              <Glyph name="arrowRight" className="h-4 w-4" />
            </button>
          </div>
        )}

        {role === 'exploitant' && dataset && latest && score && tab === 'map' && (
          <div className="space-y-4">
            <PageHeader
              eyebrow="Module 1 · Jumeau numérique"
              title={dataset.parcel.name}
              description={`${dataset.parcel.owner} · ${dataset.parcel.crop.name} ${dataset.parcel.crop.variety} · ${formatNumber(dataset.parcel.areaHa, 2)} ha · boîtier ${dataset.parcel.kitSerial}`}
              badges={
                <>
                  {verification && (
                    <span className={`chip ${VERIFICATION_TONE[verification.status]}`}>
                      <Glyph
                        name={verification.status === 'verifie' ? 'shieldCheck' : 'shieldAlert'}
                        className="h-3.5 w-3.5"
                      />
                      {VERIFICATION_LABEL[verification.status]}
                    </span>
                  )}
                  <SourceBadge simulation={dataset.simulationActive} />
                </>
              }
              actions={
                <button type="button" className="btn-secondary" onClick={() => setTab('parcel')}>
                  <Glyph name="pencil" className="h-4 w-4" />
                  Modifier la parcelle
                </button>
              }
            />

            {verification && verification.status !== 'verifie' && (
              <div
                className={`flex flex-wrap items-center justify-between gap-2 border px-3 py-2 text-[12px] font-semibold ${
                  verification.status === 'rejete'
                    ? 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]'
                    : 'border-[#fcd34d] bg-[#fffbeb] text-[#b45309]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Glyph name="shieldAlert" className="h-4 w-4" />
                  {verification.status === 'rejete'
                    ? `Dossier rejeté — ${verification.note ?? 'pièces à compléter'}`
                    : verification.status === 'soumis'
                      ? 'Dossier transmis, en attente de contrôle AgriTwin (72 h ouvrées).'
                      : 'Parcelle non certifiée : les données affichées sont simulées.'}
                </span>
                <button type="button" className="link text-[12px]" onClick={() => setTab('parcel')}>
                  Ouvrir le dossier
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-2 gap-y-3 border-y border-[#eef3f8] py-3 lg:grid-cols-4">
              <InfoTile
                label="Exploitant"
                value={dataset.parcel.owner}
                detail={`${dataset.parcel.ownerRole} · ${dataset.parcel.mode}`}
              />
              <InfoTile
                label="Culture"
                value={`${dataset.parcel.crop.name} — ${dataset.parcel.crop.variety}`}
                detail={`Semis 15/09/2026 · ${formatNumber(dataset.parcel.areaHa)} ha`}
              />
              <InfoTile
                label="Localisation"
                value={dataset.parcel.gpsLabel.split('—')[0].trim()}
                detail={dataset.parcel.gpsLabel.split('—')[1]?.trim() ?? ''}
              />
              <InfoTile
                label="Équipement"
                value={dataset.parcel.kitSerial}
                detail={`Scellé ${latest.sealOk ? 'intact' : 'rompu'} · batterie ${latest.battery} % · ${
                  dataset.parcel.documents.length
                } pièce(s)`}
              />
            </div>

            <ParcelMap key={dataset.parcel.id} parcel={dataset.parcel} records={dataset.records} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {dataset.parcel.zones.map((zone) => (
                <div key={zone.id} className="card flex items-center justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <p className="eyebrow">
                      {zone.label} {zone.isReferenceProbe ? '· témoin' : ''}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-slateink-800">
                      Humidité {formatNumber(zone.moisture)} % · NDVI {formatNumber(zone.ndvi, 2)}
                    </p>
                    <p className="truncate font-mono text-[11px] text-slate-500">{zone.probeLabel}</p>
                  </div>
                  <span
                    className={`chip shrink-0 ${
                      zone.status === 'optimal'
                        ? 'border-[#bbf7d0] bg-[#f0fdf4] text-forest-700'
                        : zone.status === 'vigilance'
                          ? 'border-[#fcd34d] bg-[#fffbeb] text-[#b45309]'
                          : 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]'
                    }`}
                  >
                    {zone.status === 'optimal' ? 'Optimal' : zone.status === 'vigilance' ? 'Vigilance' : 'Critique'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {role === 'exploitant' && dataset && latest && score && tab === 'monitoring' && (
          <div className="space-y-4">
            <PageHeader
              eyebrow="Module 2 · Surveillance continue"
              title="Sol, microclimat et alertes"
              description={`Dernier relevé ${formatDate(latest.timestamp)} · boîtier ${dataset.parcel.kitSerial} · LoRa ${latest.rssi} dBm`}
              badges={<SourceBadge simulation={latest.source === 'simulation'} />}
            />

            <KpiCards parcel={dataset.parcel} latest={latest} />
            <TelemetryCharts parcel={dataset.parcel} records={dataset.records} />

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[0.85fr_1.15fr]">
              <section className="card flex flex-col p-4 lg:p-5">
                <h2 className="font-serif text-lg text-slateink-800">Bilan minéral &amp; phytosanitaire</h2>
                <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
                  Suivi des intrants déclarés, en remplacement des capteurs NPK.
                </p>
                <div className="mt-3 border border-[#dde5ee] bg-[#f8fafc] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Azote apporté
                    </span>
                    <span className="chip bg-white text-forest-700">{nitrogenCoverage} % du besoin</span>
                  </div>
                  <p className="num mt-1 text-2xl font-semibold text-slateink-800">
                    {formatNumber(appliedNitrogen)}
                    <span className="ml-1 text-[12px] font-medium text-slate-500">
                      / {dataset.parcel.crop.nitrogenNeed} kg N/ha
                    </span>
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden bg-[#e2e8f0]">
                    <div
                      className={`h-full ${nitrogenCoverage >= 85 ? 'bg-forest-500' : 'bg-[#d97706]'}`}
                      style={{ width: `${nitrogenCoverage}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {dataset.fertilizers.slice(0, 3).map((entry) => (
                      <span key={entry.id} className="chip bg-white text-slate-600">
                        {entry.type} · {entry.quantityKg} kg
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-2.5 border border-[#dde5ee] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Signalements phytosanitaires
                  </p>
                  {dataset.pests.length > 0 ? (
                    <ul className="mt-1 divide-y divide-[#eef3f8] text-[12px] text-slateink-800">
                      {dataset.pests.slice(0, 3).map((report) => (
                        <li key={report.id} className="flex items-center justify-between gap-2 py-1">
                          <span className="font-semibold">
                            {report.type} · {report.severity}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {formatDate(report.date)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-[12px] text-slate-500">
                      Aucun incident consigné sur la campagne.
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  className="btn-secondary mt-3 w-full"
                  onClick={() => setJournalOpen(true)}
                >
                  <Glyph name="file" className="h-4 w-4" />
                  Ouvrir le journal agronomique
                  <Glyph name="arrowRight" className="ml-auto h-4 w-4" />
                </button>
              </section>

              <VoiceAssistant dataset={dataset} alerts={alerts} score={score.total} />
            </div>
          </div>
        )}

        {role === 'exploitant' && dataset && tab === 'simulator' && (
          <div className="space-y-4">
            <PageHeader
              eyebrow="Module 3 · Décision"
              title="Tester une décision avant de l’appliquer"
              description={`${dataset.parcel.shortName} · ${formatNumber(dataset.parcel.areaHa)} ha · prix de vente ${formatNumber(
                dataset.parcel.crop.pricePerTon,
                0,
              )} FCFA/t`}
              badges={<SourceBadge simulation={dataset.simulationActive} />}
            />
            <YieldSimulator parcel={dataset.parcel} records={dataset.records} />
          </div>
        )}

        {role === 'exploitant' && dataset && latest && score && verdict && assurance && tab === 'score' && (
          <div className="space-y-4">
            <PageHeader
              eyebrow="Module 4 · Financement"
              title="Dossier de crédit et Score Vert"
              description="Historique certifié, contrôle d’intégrité SHA-256 et partage encadré par la loi 2008-12 (CDP)."
              badges={
                <>
                  {verification && (
                    <span className={`chip ${VERIFICATION_TONE[verification.status]}`}>
                      <Glyph
                        name={verification.status === 'verifie' ? 'shieldCheck' : 'shieldAlert'}
                        className="h-3.5 w-3.5"
                      />
                      {VERIFICATION_LABEL[verification.status]}
                    </span>
                  )}
                  <SourceBadge simulation={dataset.simulationActive} />
                </>
              }
            />

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <GreenScoreCard
                score={score}
                parcel={dataset.parcel}
                consent={dataset.consent}
                onConsentChange={toggleConsent}
                onDownload={downloadPdf}
                downloading={downloading}
                frozen={dataset.frozen}
                ec={latest.ec}
                ph={latest.ph}
                pestNote={pestNote}
              />
              <CryptoAuditTable records={dataset.records} />
            </div>

            <section className="card flex flex-wrap items-center justify-between gap-3 p-4 lg:px-5">
              <div className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-600">
                <Glyph name="building" className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" />
                <p className="max-w-3xl">
                  Le Score Vert peut déclencher le déblocage conditionnel des tranches d’intrants et
                  l’indemnisation d’assurance climatique indicielle. Le partage avec l’institution
                  financière reste sous le contrôle exclusif de l’exploitant.
                </p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setTab('parcel')}>
                Gérer mes pièces justificatives
                <Glyph name="arrowRight" className="h-4 w-4" />
              </button>
            </section>
          </div>
        )}
      </main>

      <footer className="mx-auto w-full max-w-[1440px] px-4 pb-6 pt-2 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#dde5ee] pt-3 text-[11px] text-slate-500">
          <p>AgriTwin — démonstrateur fonctionnel · Concours AKTIION 2026, École Polytechnique de Thiès.</p>
          <p>
            {dataset ? `${dataset.records.length} blocs SHA-256 · ` : ''}
            Données Sentinel-1/2 simulées · aucun service payant requis.
          </p>
        </div>
      </footer>

      {role === 'exploitant' && dataset && latest && score && (
        <IoTSimulatorDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onInject={inject}
          onReset={resetDemo}
          pending={pending}
          summary={{
            score: score.total,
            gap: Math.abs(latest.moisture15 - latest.sentinel1Humidity),
            sealOk: latest.sealOk,
            fraud: score.fraudDetected,
            records: dataset.records.length,
            lastInjection: dataset.lastInjection,
          }}
        />
      )}

      {role === 'exploitant' && dataset && (
        <AgroJournalModal
          open={journalOpen}
          onClose={() => setJournalOpen(false)}
          parcel={dataset.parcel}
          fertilizers={dataset.fertilizers}
          pests={dataset.pests}
          onAddFertilizer={addFertilizer}
          onAddPest={addPest}
        />
      )}
    </div>
  );
}
