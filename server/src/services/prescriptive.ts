import type { Category } from '../db/schema';
import { addDaysISO, daysBetweenISO, todayISO } from '../lib/dates';
import { clamp, mean } from '../lib/stats';
import { categoryStats } from './derive';
import { getPredictive } from './predictive';
import { loadDataset } from './store';

const PRICE_ELASTICITY = -0.6;
const PROMO_ELASTICITY = -1.6;
const SERVICE_INTERVAL = 12_000;
const MONTHLY_FIXED_COST = 350;

export interface PricingRec {
  category: Category;
  utilization: number;
  currentRate: number;
  recommendedRate: number;
  changePct: number;
  expectedMonthlyImpact: number;
  rationale: string;
}

export interface FleetRec {
  action: 'ADD' | 'REDUCE';
  category: Category;
  units: number;
  expectedMonthlyImpact: number;
  rationale: string;
}

export interface MaintenanceRec {
  vehicleId: number;
  name: string;
  plate: string;
  category: Category;
  mileage: number;
  sinceService: number;
  dueInDays: number | null;
  priority: 'overdue' | 'high' | 'medium' | 'low';
  rationale: string;
}

export interface PromoRec {
  category: Category;
  utilization: number;
  suggestedDiscount: number;
  expectedUpliftRentals: number;
  expectedMonthlyImpact: number;
  rationale: string;
}

export interface ActionItem {
  priority: number;
  area: 'Pricing' | 'Fleet' | 'Maintenance' | 'Promotions';
  title: string;
  detail: string;
  impactLabel: string;
}

const PRIORITY_WEIGHT: Record<MaintenanceRec['priority'], number> = {
  overdue: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function getPrescriptive() {
  const dataset = loadDataset();
  const today = todayISO();
  const from30 = addDaysISO(today, -29);
  const cat30 = categoryStats(dataset, from30, today);
  const predictive = getPredictive(14);
  const forecastByCategory = new Map(predictive.categories.map((row) => [row.category, row]));

  const fleetAvgRate = new Map<Category, number>();
  for (const row of cat30) {
    const rates = dataset.vehicles
      .filter((vehicle) => vehicle.category === row.category)
      .map((vehicle) => vehicle.dailyRate);
    fleetAvgRate.set(row.category, Math.round(mean(rates)));
  }

  const pricing: PricingRec[] = cat30.map((row) => {
    const trendPct = forecastByCategory.get(row.category)?.trendPct ?? 0;
    let changePct = row.utilization >= 0.85 ? 10 : row.utilization >= 0.7 ? 5 : 0;
    if (changePct > 0 && trendPct >= 8) changePct += 2;
    if (changePct > 0 && trendPct < -8) changePct = Math.max(0, changePct - 3);
    changePct = clamp(changePct, 0, 15);

    const currentRate = Math.round(row.avgRate || fleetAvgRate.get(row.category) || 0);
    const recommendedRate =
      changePct > 0 ? Math.round(currentRate * (1 + changePct / 100)) : currentRate;
    const expectedMonthlyImpact = Math.round(
      row.revenue * (changePct / 100) * (1 + PRICE_ELASTICITY),
    );
    const utilizationPct = Math.round(row.utilization * 100);
    const rationale =
      changePct > 0
        ? `Utilization is ${utilizationPct}% over the last 30 days${
            trendPct >= 8 ? ' and demand is rising' : ''
          }. A ${changePct}% increase captures yield without materially reducing bookings, because short-run rental demand is relatively inelastic (ε ≈ ${PRICE_ELASTICITY}).`
        : `Utilization is ${utilizationPct}% — pricing power is limited. Hold the rate and use the promotion play instead of cutting price.`;

    return {
      category: row.category,
      utilization: row.utilization,
      currentRate,
      recommendedRate,
      changePct,
      expectedMonthlyImpact,
      rationale,
    };
  });

  const fleet: FleetRec[] = [];
  const avgRevenuePerVehicle = mean(
    cat30.map((row) => (row.vehicles > 0 ? row.revenue / row.vehicles : 0)),
  );
  for (const row of cat30) {
    const trendPct = forecastByCategory.get(row.category)?.trendPct ?? 0;
    const avgRate = row.avgRate || fleetAvgRate.get(row.category) || 0;
    const revenuePerVehicle = row.vehicles > 0 ? row.revenue / row.vehicles : 0;
    if ((row.utilization >= 0.8 && trendPct >= -10) || row.utilization >= 0.88) {
      const units = clamp(Math.round((row.utilization - 0.7) * row.vehicles), 1, 3);
      const perUnit = Math.round(avgRate * 30 * Math.min(row.utilization, 0.88) * 0.8);
      fleet.push({
        action: 'ADD',
        category: row.category,
        units,
        expectedMonthlyImpact: perUnit * units,
        rationale: `${Math.round(row.utilization * 100)}% utilization at ~$${Math.round(
          avgRate,
        )}/day leaves little slack. Each added vehicle can earn roughly $${perUnit}/mo at current rates, net of a 20% ramp-up allowance.`,
      });
    } else if (
      row.utilization < 0.48 &&
      row.vehicles > 1 &&
      revenuePerVehicle < avgRevenuePerVehicle
    ) {
      fleet.push({
        action: 'REDUCE',
        category: row.category,
        units: 1,
        expectedMonthlyImpact: MONTHLY_FIXED_COST,
        rationale: `Only ${Math.round(
          row.utilization * 100,
        )}% utilization and below-average revenue per unit ($${Math.round(
          revenuePerVehicle,
        )}/vehicle vs $${Math.round(
          avgRevenuePerVehicle,
        )} across the fleet). Retiring or transferring one unit recovers about $${MONTHLY_FIXED_COST}/mo in fixed operating cost and frees capital.`,
      });
    }
  }

  const maintenance: MaintenanceRec[] = [];
  for (const vehicle of dataset.vehicles) {
    const sinceService = Math.max(0, vehicle.mileage - vehicle.lastServiceMileage);
    if (sinceService < 6_000) continue;
    const ageDays = Math.max(90, daysBetweenISO(vehicle.acquiredAt, today));
    const milesPerDay = vehicle.mileage / ageDays;
    const remaining = Math.max(0, SERVICE_INTERVAL - sinceService);
    const dueInDays = milesPerDay > 0 ? Math.round(remaining / milesPerDay) : null;
    const priority: MaintenanceRec['priority'] =
      sinceService >= SERVICE_INTERVAL
        ? 'overdue'
        : dueInDays !== null && dueInDays <= 14
          ? 'high'
          : sinceService >= 9_000
            ? 'medium'
            : 'low';
    maintenance.push({
      vehicleId: vehicle.id,
      name: vehicle.name,
      plate: vehicle.plate,
      category: vehicle.category,
      mileage: vehicle.mileage,
      sinceService,
      dueInDays,
      priority,
      rationale:
        sinceService >= SERVICE_INTERVAL
          ? `${(sinceService - SERVICE_INTERVAL).toLocaleString()} mi past the ${SERVICE_INTERVAL.toLocaleString()} mi service interval.`
          : `Due in roughly ${dueInDays ?? '—'} days at the current mileage rate.`,
    });
  }
  maintenance.sort(
    (a, b) =>
      PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] ||
      b.sinceService - a.sinceService,
  );

  const promotions: PromoRec[] = [];
  for (const row of cat30) {
    if (row.utilization >= 0.6 || row.rentals === 0) continue;
    const trendPct = forecastByCategory.get(row.category)?.trendPct ?? 0;
    let discount = row.utilization < 0.4 ? 15 : row.utilization < 0.48 ? 12 : 10;
    if (trendPct < -5) discount += 2;
    discount = clamp(discount, 5, 20);
    const uplift = (discount / 100) * Math.abs(PROMO_ELASTICITY);
    const upliftRentals = Math.round(row.rentals * uplift);
    const expectedMonthlyImpact = Math.round(
      row.revenue * ((1 + uplift) * (1 - discount / 100) - 1),
    );
    promotions.push({
      category: row.category,
      utilization: row.utilization,
      suggestedDiscount: discount,
      expectedUpliftRentals: upliftRentals,
      expectedMonthlyImpact,
      rationale: `At ${Math.round(
        row.utilization * 100,
      )}% utilization the class has idle capacity. A ${discount}% promo targets the more elastic deal-seeking segment (ε ≈ ${PROMO_ELASTICITY}), adding about ${upliftRentals} bookings per month${
        trendPct < -5 ? ' against a softening demand trend' : ''
      }.`,
    });
  }

  const candidates: {
    area: ActionItem['area'];
    title: string;
    detail: string;
    impactLabel: string;
    score: number;
  }[] = [];

  const bestPricing = [...pricing]
    .filter((row) => row.changePct > 0)
    .sort((a, b) => b.expectedMonthlyImpact - a.expectedMonthlyImpact)[0];
  if (bestPricing) {
    candidates.push({
      area: 'Pricing',
      title: `Raise ${bestPricing.category} rates by ${bestPricing.changePct}%`,
      detail: bestPricing.rationale,
      impactLabel: `+$${bestPricing.expectedMonthlyImpact.toLocaleString()}/mo`,
      score: bestPricing.expectedMonthlyImpact,
    });
  }

  for (const rec of fleet) {
    candidates.push({
      area: 'Fleet',
      title:
        rec.action === 'ADD'
          ? `Add ${rec.units} ${rec.category} vehicle${rec.units > 1 ? 's' : ''}`
          : `Retire 1 ${rec.category} vehicle`,
      detail: rec.rationale,
      impactLabel:
        rec.action === 'ADD'
          ? `+$${rec.expectedMonthlyImpact.toLocaleString()}/mo`
          : `+$${rec.expectedMonthlyImpact.toLocaleString()}/mo saved`,
      score: rec.expectedMonthlyImpact,
    });
  }

  const urgentMaintenance = maintenance.filter(
    (row) => row.priority === 'overdue' || row.priority === 'high',
  );
  if (urgentMaintenance.length > 0) {
    candidates.push({
      area: 'Maintenance',
      title: `Service ${urgentMaintenance.length} vehicle${
        urgentMaintenance.length > 1 ? 's' : ''
      } this week`,
      detail: `Overdue or nearly due: ${urgentMaintenance
        .slice(0, 3)
        .map((row) => `${row.name} (${row.plate})`)
        .join(', ')}. Keeping units road-ready protects availability and avoids emergency downtime.`,
      impactLabel: `${urgentMaintenance.length} unit${urgentMaintenance.length > 1 ? 's' : ''}`,
      score: 8_000 + urgentMaintenance.length * 1_500,
    });
  }

  const bestPromo = [...promotions].sort(
    (a, b) => b.expectedMonthlyImpact - a.expectedMonthlyImpact,
  )[0];
  if (bestPromo && bestPromo.expectedMonthlyImpact > 0) {
    candidates.push({
      area: 'Promotions',
      title: `Launch a ${bestPromo.suggestedDiscount}% ${bestPromo.category} promotion`,
      detail: bestPromo.rationale,
      impactLabel: `+$${bestPromo.expectedMonthlyImpact.toLocaleString()}/mo`,
      score: bestPromo.expectedMonthlyImpact,
    });
  }

  const actions: ActionItem[] = candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((candidate, index) => ({
      priority: index + 1,
      area: candidate.area,
      title: candidate.title,
      detail: candidate.detail,
      impactLabel: candidate.impactLabel,
    }));

  return {
    generatedAt: new Date().toISOString(),
    assumptions: [
      `Price recommendations assume a short-run price elasticity of ${PRICE_ELASTICITY}: a 10% increase costs roughly 6% of volume, so net revenue still rises.`,
      `Promotions target the more elastic deal-seeking segment with elasticity ${PROMO_ELASTICITY}, which is why discounts can add volume and revenue together.`,
      'Utilization = booked vehicle-days ÷ (fleet size × days in window), including units in maintenance.',
      'Revenue is recognized on the rental start date; cancelled rentals are excluded from revenue and demand.',
      `Maintenance interval is ${SERVICE_INTERVAL.toLocaleString()} mi since last service; due dates use each vehicle's average daily mileage.`,
      'Forecasts use a linear trend plus weekday seasonality, backtested on the last 14 days. Impact figures are directional monthly estimates, not guarantees.',
    ],
    summary: {
      pricingActions: pricing.filter((row) => row.changePct > 0).length,
      fleetActions: fleet.length,
      maintenanceDue: maintenance.length,
      urgentMaintenance: urgentMaintenance.length,
      promotions: promotions.length,
    },
    pricing,
    fleet,
    maintenance: maintenance.slice(0, 8),
    promotions,
    actions,
  };
}
