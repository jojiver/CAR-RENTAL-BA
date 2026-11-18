import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import {
  CATEGORY_COLORS,
  ForecastChart,
  MonthlyRevenueChart,
} from '../components/charts';
import {
  Badge,
  Card,
  CardHead,
  EmptyState,
  ErrorState,
  Loader,
  Progress,
  Segmented,
  StatCard,
  StatusBadge,
  Tabs,
} from '../components/ui';
import {
  IconBolt,
  IconCalendar,
  IconCar,
  IconChart,
  IconCompass,
  IconGauge,
  IconInfo,
  IconKey,
  IconSpark,
  IconTrend,
  IconWrench,
} from '../components/icons';
import { money, num, pct } from '../lib/format';
import { useApi } from '../lib/useApi';
import type { Descriptive, Predictive, Prescriptive } from '../types';

const ANALYSIS_TABS = [
  { id: 'descriptive', label: 'Descriptive', hint: 'What happened' },
  { id: 'predictive', label: 'Predictive', hint: 'What will happen' },
  { id: 'prescriptive', label: 'Prescriptive', hint: 'What to do' },
];

const DAY_OPTIONS = [
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 365, label: '12 months' },
];

const HORIZON_OPTIONS = [
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
];

function trendChip(value: number) {
  return (
    <span className={`trend-chip ${value >= 0 ? 'up' : 'down'}`}>
      {value >= 0 ? '+' : ''}
      {value}%
    </span>
  );
}

function accuracyTone(accuracy: number): 'success' | 'warn' | 'danger' {
  if (accuracy >= 70) return 'success';
  if (accuracy >= 50) return 'warn';
  return 'danger';
}

export function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const initialTab =
    requestedTab === 'predictive' || requestedTab === 'prescriptive' ? requestedTab : 'descriptive';
  const [tab, setTabState] = useState(initialTab);
  const [days, setDays] = useState(365);
  const [horizon, setHorizon] = useState(14);

  const setTab = (next: string) => {
    setTabState(next);
    setSearchParams({ tab: next }, { replace: true });
  };

  const descriptive = useApi(() => api.descriptive(days), [days]);
  const predictive = useApi(() => api.predictive(horizon), [horizon]);
  const prescriptive = useApi(() => api.prescriptive());

  const loading =
    tab === 'descriptive'
      ? descriptive.loading
      : tab === 'predictive'
        ? predictive.loading
        : prescriptive.loading;
  const error =
    tab === 'descriptive'
      ? descriptive.error
      : tab === 'predictive'
        ? predictive.error
        : prescriptive.error;
  const retry =
    tab === 'descriptive'
      ? descriptive.reload
      : tab === 'predictive'
        ? predictive.reload
        : prescriptive.reload;

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <span className="eyebrow">Decision intelligence</span>
          <h1>Analytics</h1>
          <p>
            Three layers on one rental ledger: describe performance, forecast demand, and
            recommend the next move.
          </p>
        </div>
      </header>

      <div className="analysis-intro">
        <div className="analysis-card">
          <span className="analysis-icon tone-teal">
            <IconChart size={20} />
          </span>
          <div>
            <span className="tag">Descriptive</span>
            <strong>What happened</strong>
            <p>Revenue, utilization, mix and customer behavior for the selected window.</p>
          </div>
        </div>
        <div className="analysis-card">
          <span className="analysis-icon tone-accent">
            <IconTrend size={20} />
          </span>
          <div>
            <span className="tag">Predictive</span>
            <strong>What will happen</strong>
            <p>Trend + weekday-seasonality forecasts, backtested on the trailing four weeks.</p>
          </div>
        </div>
        <div className="analysis-card">
          <span className="analysis-icon tone-violet">
            <IconCompass size={20} />
          </span>
          <div>
            <span className="tag">Prescriptive</span>
            <strong>What to do</strong>
            <p>Pricing, fleet, promotion and maintenance moves ranked by expected impact.</p>
          </div>
        </div>
      </div>

      <div className="analytics-head">
        <Tabs tabs={ANALYSIS_TABS} value={tab} onChange={setTab} />
        {tab === 'descriptive' ? (
          <Segmented options={DAY_OPTIONS} value={days} onChange={setDays} />
        ) : tab === 'predictive' ? (
          <Segmented options={HORIZON_OPTIONS} value={horizon} onChange={setHorizon} />
        ) : (
          <span className="muted small">
            <IconInfo size={13} /> Generated live from the current ledger
          </span>
        )}
      </div>

      {loading ? (
        <Loader label={`Running ${tab} analysis`} />
      ) : error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : tab === 'descriptive' && descriptive.data ? (
        <DescriptiveSection data={descriptive.data} />
      ) : tab === 'predictive' && predictive.data ? (
        <PredictiveSection data={predictive.data} />
      ) : tab === 'prescriptive' && prescriptive.data ? (
        <PrescriptiveSection data={prescriptive.data} />
      ) : null}
    </div>
  );
}

function DescriptiveSection({ data }: { data: Descriptive }) {
  const maxDuration = Math.max(...data.durationBuckets.map((bucket) => bucket.count), 1);

  return (
    <div className="stack">
      <div className="kpi-grid six">
        <StatCard
          label="Revenue"
          value={money(data.kpis.revenue)}
          icon={<IconBolt />}
          hint={money(data.kpis.revenuePerVehicle) + ' per vehicle'}
          tone="accent"
        />
        <StatCard
          label="Rentals"
          value={num(data.kpis.rentals)}
          icon={<IconKey />}
          hint={`${num(data.kpis.uniqueCustomers)} unique customers`}
          tone="teal"
        />
        <StatCard
          label="Avg duration"
          value={`${data.kpis.avgDuration} days`}
          icon={<IconCalendar />}
          hint="Per booking"
          tone="violet"
        />
        <StatCard
          label="Avg rental value"
          value={money(data.kpis.avgValue)}
          icon={<IconCar />}
          hint={`${data.kpis.fleetSize} vehicles in fleet`}
          tone="amber"
        />
        <StatCard
          label="Utilization"
          value={pct(data.kpis.utilization)}
          icon={<IconGauge />}
          hint="Booked vehicle-days / capacity"
          tone="teal"
        />
        <StatCard
          label="Repeat rate"
          value={pct(data.kpis.repeatRate)}
          icon={<IconSpark />}
          hint="Customers with 2+ rentals"
          tone="accent"
        />
      </div>

      <div className="split-main">
        <Card>
          <CardHead
            title="Monthly revenue"
            subtitle={`${data.monthly.length} months of recognized revenue`}
          />
          <MonthlyRevenueChart data={data.monthly} />
        </Card>
        <Card>
          <CardHead title="Category breakdown" subtitle="Utilization and revenue share" />
          <div className="table-wrap">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Utilization</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((row) => (
                  <tr key={row.category}>
                    <td>
                      <span className="class-tag">
                        <i style={{ background: CATEGORY_COLORS[row.category] }} />
                        {row.category}
                      </span>
                      <span className="cell-sub">{row.vehicles} units</span>
                    </td>
                    <td>
                      <div className="util-cell">
                        <Progress value={row.utilization} />
                        <span>{pct(row.utilization)}</span>
                      </div>
                    </td>
                    <td className="num">
                      <div className="entity entity-end">
                        <strong>{money(row.revenue)}</strong>
                        <span>{pct(row.revenueShare)} share</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="split-even">
        <Card>
          <CardHead title="Top vehicles" subtitle="Highest revenue in the window" />
          <ol className="rank-list">
            {data.topVehicles.map((vehicle, index) => (
              <li key={vehicle.id}>
                <span className="rank-index">{String(index + 1).padStart(2, '0')}</span>
                <div className="rank-main">
                  <strong>{vehicle.name}</strong>
                  <span>
                    {vehicle.category} · {vehicle.rentals} rentals · {pct(vehicle.utilization)}{' '}
                    utilized
                  </span>
                </div>
                <strong className="rank-value">{money(vehicle.revenue)}</strong>
              </li>
            ))}
          </ol>
        </Card>
        <Card>
          <CardHead title="Booking profile" subtitle="Duration mix and customer segments" />
          <div className="bar-list">
            {data.durationBuckets.map((bucket) => (
              <div className="bar-row" key={bucket.bucket}>
                <span>{bucket.bucket}</span>
                <div className="bar-track">
                  <span style={{ width: `${(bucket.count / maxDuration) * 100}%` }} />
                </div>
                <strong>{num(bucket.count)}</strong>
              </div>
            ))}
          </div>
          <div className="segment-strip">
            {data.segments.map((segment) => (
              <div className="segment-card" key={segment.segment}>
                <span>{segment.segment}</span>
                <strong>{num(segment.customers)}</strong>
                <small>{money(segment.revenue)} in window</small>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function PredictiveSection({ data }: { data: Predictive }) {
  return (
    <div className="stack">
      <div className="kpi-grid">
        <StatCard
          label="Projected revenue · 30d"
          value={money(data.revenue.next30)}
          icon={<IconBolt />}
          hint={`${data.revenue.model.accuracy}% backtest accuracy`}
          tone="accent"
        />
        <StatCard
          label="Projected bookings · 30d"
          value={num(data.demand.next30)}
          icon={<IconKey />}
          hint={`${data.utilization.avgDuration} days average duration`}
          tone="teal"
        />
        <StatCard
          label="Utilization · next 30d"
          value={pct(data.utilization.projectedNext30)}
          icon={<IconGauge />}
          hint={`Currently ${pct(data.utilization.current30)}`}
          tone="amber"
        />
        <StatCard
          label="Late-return risk"
          value={num(data.risk.expectedLateNext30)}
          icon={<IconCalendar />}
          hint={`${pct(data.risk.lateReturnRate)} historical late rate`}
          tone="violet"
        />
      </div>

      <Card>
        <CardHead
          title="Revenue forecast"
          subtitle="Last 90 days of actuals, then the model's forward path"
          action={
            <Badge tone={accuracyTone(data.revenue.model.accuracy)}>
              {data.revenue.model.accuracy}% accuracy
            </Badge>
          }
        />
        <ForecastChart
          history={data.revenue.history}
          forecast={data.revenue.forecast}
          kind="currency"
          height={310}
        />
        <div className="chart-legend">
          <span>
            <i className="legend-dot" style={{ background: '#e8edf6' }} /> Actual
          </span>
          <span>
            <i className="legend-dot" style={{ background: '#2dd4bf' }} /> Forecast
          </span>
          <span>
            <i className="legend-dot band" /> 80% interval
          </span>
        </div>
      </Card>

      <div className="split-main">
        <Card>
          <CardHead
            title="Demand forecast"
            subtitle="Daily bookings with the same model"
            action={
              <Badge tone={accuracyTone(data.demand.model.accuracy)}>
                {data.demand.model.accuracy}% accuracy
              </Badge>
            }
          />
          <ForecastChart
            history={data.demand.history}
            forecast={data.demand.forecast}
            kind="count"
            height={260}
          />
        </Card>
        <Card>
          <CardHead title="How the forecast works" subtitle={data.revenue.model.name} />
          <p className="prose">{data.revenue.model.description}</p>
          <div className="model-stats">
            <div>
              <span>Backtest</span>
              <strong>{data.revenue.model.backtestWeeks} weeks</strong>
            </div>
            <div>
              <span>WAPE · 4 weeks</span>
              <strong>{data.revenue.model.wape}%</strong>
            </div>
            <div>
              <span>Accuracy</span>
              <strong>{data.revenue.model.accuracy}%</strong>
            </div>
            <div>
              <span>Daily R²</span>
              <strong>{data.revenue.model.r2}</strong>
            </div>
          </div>
          <p className="muted small">
            WAPE weights errors by volume, so one quiet week cannot dominate the score. The
            forecast is directional: use the interval, not just the centre line, for planning.
          </p>
        </Card>
      </div>

      <Card>
        <CardHead
          title="Category forecast · next 30 days"
          subtitle="Weekly trend per class, damped by 40% to avoid over-reacting to noise"
        />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Class</th>
                <th className="num">Current 30d</th>
                <th className="num">Forecast 30d</th>
                <th>Trend</th>
                <th className="num">Forecast revenue</th>
                <th>Utilization</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {data.categories.map((row) => (
                <tr key={row.category}>
                  <td>
                    <span className="class-tag">
                      <i style={{ background: CATEGORY_COLORS[row.category] }} />
                      {row.category}
                    </span>
                  </td>
                  <td className="num">{num(row.current30Rentals)}</td>
                  <td className="num">{num(row.next30Rentals)}</td>
                  <td>{trendChip(row.trendPct)}</td>
                  <td className="num">{money(row.next30Revenue)}</td>
                  <td>
                    <div className="util-cell">
                      <Progress value={row.utilization30} />
                      <span>{pct(row.utilization30)}</span>
                    </div>
                  </td>
                  <td>
                    <Badge
                      tone={
                        row.confidence === 'high'
                          ? 'success'
                          : row.confidence === 'medium'
                            ? 'info'
                            : 'neutral'
                      }
                    >
                      {row.confidence}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PrescriptiveSection({ data }: { data: Prescriptive }) {
  return (
    <div className="stack">
      <Card>
        <CardHead
          title="Priority action plan"
          subtitle="Ranked by estimated monthly impact, with urgent maintenance pulled forward"
          action={<Badge tone="accent">{data.actions.length} moves</Badge>}
        />
        {data.actions.length === 0 ? (
          <EmptyState
            title="No urgent moves right now"
            hint="The fleet is balanced. Recheck after demand shifts."
          />
        ) : (
          <div className="action-list">
            {data.actions.map((action) => (
              <div className="action-card" key={action.priority}>
                <span className={`action-index area-${action.area.toLowerCase()}`}>
                  {action.priority}
                </span>
                <div className="action-main">
                  <div className="action-top">
                    <strong>{action.title}</strong>
                    <Badge tone="neutral">{action.area}</Badge>
                  </div>
                  <p>{action.detail}</p>
                </div>
                <span className="impact-chip">{action.impactLabel}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="split-even">
        <Card>
          <CardHead
            title="Rate recommendations"
            subtitle="Yield pricing by class from 30-day utilization and demand trend"
          />
          <div className="table-wrap">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Utilization</th>
                  <th className="num">Now</th>
                  <th className="num">Suggested</th>
                  <th>Change</th>
                  <th className="num">Est. impact</th>
                </tr>
              </thead>
              <tbody>
                {data.pricing.map((row) => (
                  <tr key={row.category}>
                    <td>
                      <span className="class-tag">
                        <i style={{ background: CATEGORY_COLORS[row.category] }} />
                        {row.category}
                      </span>
                    </td>
                    <td>{pct(row.utilization)}</td>
                    <td className="num">{money(row.currentRate)}</td>
                    <td className="num">{money(row.recommendedRate)}</td>
                    <td>
                      {row.changePct > 0 ? (
                        <span className="trend-chip up">+{row.changePct}%</span>
                      ) : (
                        <span className="trend-chip neutral">Hold</span>
                      )}
                    </td>
                    <td className="num">
                      {row.expectedMonthlyImpact > 0 ? `+${money(row.expectedMonthlyImpact)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHead
            title="Promotion plays"
            subtitle="Discounts only where idle capacity is real"
          />
          {data.promotions.length === 0 ? (
            <EmptyState
              title="No idle classes"
              hint="Every class is above the 60% utilization threshold."
            />
          ) : (
            <div className="rec-stack">
              {data.promotions.map((promo) => (
                <div className="rec-card" key={promo.category}>
                  <div className="rec-top">
                    <span className="class-tag">
                      <i style={{ background: CATEGORY_COLORS[promo.category] }} />
                      {promo.category}
                    </span>
                    <span className="impact-chip">+{money(promo.expectedMonthlyImpact)}/mo</span>
                  </div>
                  <strong className="rec-title">
                    {promo.suggestedDiscount}% off · +{promo.expectedUpliftRentals} bookings
                  </strong>
                  <p>{promo.rationale}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHead title="Fleet moves" subtitle="Where capacity should grow or shrink" />
        {data.fleet.length === 0 ? (
          <EmptyState title="Fleet is balanced" hint="No class is both under-utilized and under-earning." />
        ) : (
          <div className="rec-grid">
            {data.fleet.map((rec) => (
              <div className="rec-card" key={`${rec.action}-${rec.category}`}>
                <div className="rec-top">
                  <Badge tone={rec.action === 'ADD' ? 'success' : 'danger'}>
                    {rec.action === 'ADD' ? 'Add capacity' : 'Reduce capacity'}
                  </Badge>
                  <span className="impact-chip">
                    ${money(rec.expectedMonthlyImpact)}/mo {rec.action === 'ADD' ? 'upside' : 'saved'}
                  </span>
                </div>
                <strong className="rec-title">
                  {rec.units} {rec.category} vehicle{rec.units > 1 ? 's' : ''}
                </strong>
                <p>{rec.rationale}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHead
          title="Maintenance queue"
          subtitle="Vehicles at or past the 12,000-mile service interval, plus near-due units"
          action={<Badge tone="warn">{data.summary.urgentMaintenance} urgent</Badge>}
        />
        {data.maintenance.length === 0 ? (
          <EmptyState title="No service due" hint="All vehicles are inside the service interval." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Class</th>
                  <th className="num">Mileage</th>
                  <th className="num">Since service</th>
                  <th className="num">Due in</th>
                  <th>Priority</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {data.maintenance.map((row) => (
                  <tr key={row.vehicleId}>
                    <td>
                      <div className="entity">
                        <strong>{row.name}</strong>
                        <span>{row.plate}</span>
                      </div>
                    </td>
                    <td>{row.category}</td>
                    <td className="num">{num(row.mileage)} mi</td>
                    <td className="num">{num(row.sinceService)} mi</td>
                    <td className="num">
                      {row.dueInDays === null
                        ? '—'
                        : row.dueInDays === 0
                          ? 'Overdue'
                          : `${row.dueInDays} days`}
                    </td>
                    <td>
                      <StatusBadge status={row.priority} />
                    </td>
                    <td className="muted">{row.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="note-card">
        <CardHead
          title="Assumptions & method"
          subtitle="Transparent inputs behind every recommendation"
          action={<IconInfo size={16} />}
        />
        <ol className="assumption-list">
          {data.assumptions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <div className="method-footer">
          <span>
            <IconWrench size={14} /> Maintenance driven by mileage since last service
          </span>
          <span>
            <IconChart size={14} /> Descriptive figures use recognized rental revenue
          </span>
          <span>
            <IconBolt size={14} /> Prescriptive impacts are directional monthly estimates
          </span>
        </div>
      </Card>
    </div>
  );
}
