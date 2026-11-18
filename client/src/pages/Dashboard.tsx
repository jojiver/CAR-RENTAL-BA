import { Link } from 'react-router-dom';
import { api } from '../api';
import { CATEGORY_COLORS, DonutChart, RevenueTrendChart } from '../components/charts';
import {
  Badge,
  Card,
  CardHead,
  ErrorState,
  Loader,
  Progress,
  StatCard,
  StatusBadge,
} from '../components/ui';
import { IconArrow, IconBolt, IconCar, IconGauge, IconKey } from '../components/icons';
import { fullDate, money, num, pct, shortDate } from '../lib/format';
import { useApi } from '../lib/useApi';

export function DashboardPage() {
  const { data, loading, error, reload } = useApi(() => api.overview());

  if (loading) return <Loader label="Loading operations overview" />;
  if (error || !data) return <ErrorState message={error ?? 'No data'} onRetry={reload} />;

  const k = data.kpis;
  const donut = [
    { name: 'Available', value: k.available, color: '#2dd4bf' },
    { name: 'On rent', value: k.rented, color: '#ff6b2c' },
    { name: 'Maintenance', value: k.maintenance, color: '#64748b' },
  ];

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <span className="eyebrow">Operations overview</span>
          <h1>Good morning, ops team</h1>
          <p>Fleet health, revenue and live bookings for {fullDate(data.today)}.</p>
        </div>
        <div className="head-actions">
          <Link to="/rentals?new=1" className="btn btn-primary">
            <IconKey size={16} /> New rental
          </Link>
          <Link to="/analytics" className="btn btn-ghost">
            Analytics <IconArrow size={15} />
          </Link>
        </div>
      </header>

      <div className="kpi-grid">
        <StatCard
          label="Revenue · 30 days"
          value={money(k.revenue30.value)}
          icon={<IconBolt />}
          delta={k.revenue30.delta}
          hint={`vs ${money(k.revenue30.previous)} prior 30d`}
          tone="accent"
        />
        <StatCard
          label="Active rentals"
          value={num(k.activeRentals)}
          icon={<IconKey />}
          hint={`${k.fleetSize} vehicles · ${k.customers} customers`}
          tone="teal"
        />
        <StatCard
          label="Fleet utilization"
          value={pct(k.utilization30)}
          icon={<IconGauge />}
          hint={`${k.rented} on rent · ${k.available} idle`}
          tone="amber"
        />
        <StatCard
          label="Avg rental value"
          value={money(k.avgRental.value)}
          icon={<IconCar />}
          delta={k.avgRental.delta}
          hint="Last 30 days"
          tone="violet"
        />
      </div>

      <div className="split-main">
        <Card>
          <CardHead
            title="Revenue trend"
            subtitle="Daily revenue, last 60 days"
            action={<Badge tone="accent">Live</Badge>}
          />
          <RevenueTrendChart data={data.revenueTrend} />
        </Card>
        <Card>
          <CardHead title="Fleet status" subtitle={`${k.fleetSize} vehicles in service`} />
          <DonutChart data={donut} centerValue={pct(k.utilization30)} centerLabel="utilized" />
          <div className="legend">
            {donut.map((entry) => (
              <div className="legend-row" key={entry.name}>
                <span className="tip-dot" style={{ background: entry.color }} />
                <span>{entry.name}</span>
                <strong>{num(entry.value)}</strong>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="split-even">
        <Card>
          <CardHead
            title="Category performance"
            subtitle="Utilization and revenue, last 30 days"
            action={
              <Link to="/analytics" className="text-link">
                Details
              </Link>
            }
          />
          <div className="cat-list">
            {data.categoryMix.map((row) => (
              <div className="cat-row" key={row.category}>
                <span
                  className="cat-dot"
                  style={{ background: CATEGORY_COLORS[row.category] }}
                />
                <div className="cat-main">
                  <div className="cat-label">
                    <strong>{row.category}</strong>
                    <span>{row.vehicles} vehicles</span>
                  </div>
                  <Progress value={row.utilization30} />
                </div>
                <div className="cat-nums">
                  <strong>{pct(row.utilization30)}</strong>
                  <span>{money(row.revenue30)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHead
            title="Recent bookings"
            subtitle="Latest rentals across the fleet"
            action={
              <Link to="/rentals" className="text-link">
                View all
              </Link>
            }
          />
          <div className="table-wrap">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Vehicle</th>
                  <th>Dates</th>
                  <th className="num">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentRentals.map((row) => (
                  <tr key={row.id}>
                    <td>{row.customerName}</td>
                    <td>
                      <span className="cell-main">{row.vehicleName}</span>
                      <span className="cell-sub">{row.category}</span>
                    </td>
                    <td className="nowrap">{shortDate(row.startDate)} – {shortDate(row.endDate)}</td>
                    <td className="num">{money(row.totalAmount)}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
