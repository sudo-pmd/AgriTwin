import type {
  CreditVerdict,
  GreenScoreResult,
  ParcelDataset,
  TelemetryRecord,
} from '../types/agritwin';

export const MOISTURE_MIN = 20;
export const MOISTURE_MAX = 35;
export const SATELLITE_TOLERANCE = 15;

export interface GreenScoreInput {
  records: TelemetryRecord[];
  ndvi: number;
  ec: number;
  ph: number;
  sealOk: boolean;
  chainValid: boolean;
}

/** C_eau — régularité hydrique (max 35). */
export function waterScore(records: TelemetryRecord[]): { points: number; daysInRange: number; total: number } {
  if (records.length === 0) return { points: 0, daysInRange: 0, total: 0 };
  const daysInRange = records.filter(
    (r) => r.moisture15 >= MOISTURE_MIN && r.moisture15 <= MOISTURE_MAX,
  ).length;
  return {
    points: Math.round((35 * daysInRange) / records.length),
    daysInRange,
    total: records.length,
  };
}

/** C_veg — vigueur végétative (max 25). */
export function vegetationScore(ndvi: number): number {
  return Math.min(25, Math.round(ndvi * 32));
}

/** C_sol — santé et salinité du sol (max 20). */
export function soilScore(ec: number, ph: number): number {
  if (ec <= 1.4 && ph >= 6.0 && ph <= 7.5) return 20;
  if (ec <= 2.0) return 14;
  return 7;
}

export function satelliteGap(record: TelemetryRecord): number {
  return Math.round(Math.abs(record.moisture15 - record.sentinel1Humidity) * 10) / 10;
}

/** C_integrite — intégrité physique et cryptographique (max 20, sinon 0). */
export function integrityScore(record: TelemetryRecord, chainValid: boolean): number {
  const coherent = satelliteGap(record) <= SATELLITE_TOLERANCE;
  return chainValid && record.sealOk && coherent ? 20 : 0;
}

export function computeGreenScore(input: GreenScoreInput): GreenScoreResult {
  const latest = input.records[input.records.length - 1];
  const water = waterScore(input.records);
  const vegetation = vegetationScore(input.ndvi);
  const soil = soilScore(input.ec, input.ph);
  const integrity = latest ? integrityScore(latest, input.chainValid) : 0;
  const gap = latest ? satelliteGap(latest) : 0;
  const total = water.points + vegetation + soil + integrity;
  const fraudDetected = gap > SATELLITE_TOLERANCE;

  return {
    total,
    water: water.points,
    vegetation,
    soil,
    integrity,
    profile: total >= 75 ? 'A' : total >= 50 ? 'B' : 'C',
    fraudDetected: gap > SATELLITE_TOLERANCE,
    satelliteGap: gap,
    chainValid: input.chainValid,
    sealOk: input.sealOk,
    waterDaysInRange: water.daysInRange,
    totalDays: water.total,
  };
}

export function creditVerdict(score: GreenScoreResult, frozen: boolean): CreditVerdict {
  if (frozen) {
    return {
      decision: 'suspendu',
      badge: 'DOSSIER GELÉ — INSPECTION MATÉRIELLE REQUISE',
      tone: 'red',
      rationale:
        "Le boîtier scellé a signalé une ouverture ou un arrachement. Le dossier est gelé jusqu'à la visite d'un technicien AgriTwin.",
      rate: 'Taux dégradé — dossier en revue',
    };
  }
  if (score.fraudDetected || !score.chainValid || score.total < 50) {
    return {
      decision: 'suspendu',
      badge: 'DÉCAISSEMENT SUSPENDU — AUDIT REQUIS',
      tone: 'red',
      rationale:
        "Une incohérence entre la sonde et l'observation satellite Sentinel-1 a été détectée. Le dossier ne peut pas être décaissé avant audit contradictoire.",
      rate: 'Aucun taux accordé',
    };
  }
  if (score.total >= 75) {
    return {
      decision: 'eligible',
      badge: 'ÉLIGIBLE — DÉBLOCAGE TRANCHE 2 AUTORISÉ',
      tone: 'green',
      rationale:
        'Pilotage hydrique régulier, vigueur végétative confirmée par Sentinel-2 et intégrité cryptographique validée. Risque de défaut faible.',
      rate: 'Taux préférentiel — 6,5 % / campagne',
    };
  }
  return {
    decision: 'suivi',
    badge: 'ÉLIGIBLE SOUS SUIVI COOPÉRATIF',
    tone: 'amber',
    rationale:
      'Le profil technique est acceptable mais nécessite une contre-visite du technicien de la coopérative avant le décaissement de la tranche.',
    rate: 'Taux standard — 9,0 % / campagne',
  };
}

export function assuranceStatus(
  dataset: ParcelDataset,
  score: GreenScoreResult,
): { label: string; detail: string; tone: 'green' | 'amber' | 'red' } {
  if (dataset.frozen || score.fraudDetected) {
    return {
      label: 'Couverture suspendue',
      detail:
        "Indemnisation indicielle bloquée : anomalie de cohérence ou scellé rompu. Expertise terrain obligatoire.",
      tone: 'red',
    };
  }
  const latest = dataset.records[dataset.records.length - 1];
  const gap = latest ? satelliteGap(latest) : 0;
  if (latest.moisture15 < 18) {
    return {
      label: 'Déclencheur sécheresse armé',
      detail: `Humidité racinaire à ${latest.moisture15.toFixed(
        1,
      )} % sur 48 h, confirmée par Sentinel-1 (${latest.sentinel1Humidity.toFixed(
        1,
      )} %). Seuil d'indemnisation sécheresse à 17 %.`,
      tone: 'amber',
    };
  }
  return {
    label: 'Couverture active',
    detail: `Écart sonde / radar Sentinel-1 de ${gap.toFixed(
      1,
    )} points, sous la tolérance de ${SATELLITE_TOLERANCE}. Indemnisation sécheresse / excès d'eau armée sur la campagne.`,
    tone: 'green',
  };
}
