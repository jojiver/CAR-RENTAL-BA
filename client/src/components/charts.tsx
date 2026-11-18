import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Category, Descriptive, ForecastPoint } from '../types';
import { money, moneyCompact, num, pct, shortDate } from '../lib/format';

export const CATEGORY_COLORS: Record<Category, string> = {
  Economy: '#2dd4bf',
  Compact: '#60a5fa',
  SUV: '#fbbf24',
  Luxury: '#f472b6',
  Van: '#a78bfa',
};

const AXIS = { fill: '#7b879d', fontSize: 11 };
const GRID = '#1c2331';

function TooltipShell({
  label,
  rows,
}: {
  label?: string;
  rows: { color: string; name: string; value: string }[];
}) {
  return (
    <div className="chart-tip">
      {label ? <div className="chart-tip-label">{label}</div> : null}
      {rows.map((row) => (
        <div className="chart-tip-row" key={row.name}>
          <span className="tip-dot" style={{ background: row.color }} />
          <span>{row.name}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function RevenueTrendChart({
  data,
}: {
  data: { date: string; revenue: number; rentals: number }[];
}) {
  function Tip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <TooltipShell
        label={shortDate(String(label))}
        rows={[
          { color: '#ff6b2c', name: 'Revenue', value: money(payload[0]?.value ?? 0) },
          { color: '#7b879d', name: 'Bookings', value: num(payload[0]?.payload?.rentals ?? 0) },
        ]}
      />
    );
  }

  return (
    <div className="chart chart-260">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff6b2c" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#ff6b2c" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            minTickGap={36}
          />
          <YAxis
            tickFormatter={(value) => moneyCompact(Number(value))}
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip content={<Tip />} cursor={{ stroke: '#2b3547' }} />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="#ff6b2c"
            strokeWidth={2}
            fill="url(#revFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ForecastChart({
  history,
  forecast,
  kind,
  height = 300,
}: {
  history: { date: string; actual: number }[];
  forecast: ForecastPoint[];
  kind: 'currency' | 'count';
  height?: number;
}) {
  const data = [
    ...history.map((point) => ({ date: point.date, actual: point.actual })),
    ...forecast.map((point) => ({
      date: point.date,
      predicted: point.predicted,
      lower: point.lower,
      band: Math.max(0, point.upper - point.lower),
    })),
  ];
  const formatter = (value: number) => (kind === 'currency' ? money(value) : `${num(value)}`);

  function Tip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload ?? {};
    const rows: { color: string; name: string; value: string }[] = [];
    if (point.actual !== undefined && point.actual !== null) {
      rows.push({ color: '#e8edf6', name: 'Actual', value: formatter(point.actual) });
    }
    if (point.predicted !== undefined && point.predicted !== null) {
      rows.push({ color: '#2dd4bf', name: 'Forecast', value: formatter(point.predicted) });
      if (point.lower !== undefined) {
        rows.push({
          color: '#3b4a5f',
          name: '80% interval',
          value: `${formatter(point.lower)} – ${formatter(point.lower + point.band)}`,
        });
      }
    }
    return <TooltipShell label={shortDate(String(label))} rows={rows} />;
  }

  const lastHistory = history[history.length - 1]?.date;

  return (
    <div className="chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            minTickGap={38}
          />
          <YAxis
            tickFormatter={(value) =>
              kind === 'currency' ? moneyCompact(Number(value)) : num(Number(value))
            }
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip content={<Tip />} cursor={{ stroke: '#2b3547' }} />
          <Area
            dataKey="lower"
            stackId="band"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
          />
          <Area
            dataKey="band"
            stackId="band"
            stroke="none"
            fill="#2dd4bf"
            fillOpacity={0.12}
            isAnimationActive={false}
          />
          {lastHistory ? (
            <ReferenceLine x={lastHistory} stroke="#334155" strokeDasharray="3 4" />
          ) : null}
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke="#e8edf6"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="predicted"
            name="Forecast"
            stroke="#2dd4bf"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyRevenueChart({ data }: { data: Descriptive['monthly'] }) {
  function Tip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <TooltipShell
        label={String(label)}
        rows={[
          { color: '#ff6b2c', name: 'Revenue', value: money(payload[0]?.value ?? 0) },
          { color: '#7b879d', name: 'Bookings', value: num(payload[0]?.payload?.rentals ?? 0) },
        ]}
      />
    );
  }

  return (
    <div className="chart chart-240">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(value) => moneyCompact(Number(value))}
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip content={<Tip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar
            dataKey="revenue"
            name="Revenue"
            fill="#ff6b2c"
            radius={[5, 5, 0, 0]}
            maxBarSize={38}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({
  data,
  centerValue,
  centerLabel,
}: {
  data: { name: string; value: number; color: string }[];
  centerValue: string;
  centerLabel: string;
}) {
  function Tip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const item = payload[0];
    return (
      <TooltipShell
        rows={[
          {
            color: item.payload.color,
            name: item.name,
            value: `${num(item.value)} (${pct(item.value / Math.max(1, data.reduce((acc, row) => acc + row.value, 0)), 0)})`,
          },
        ]}
      />
    );
  }

  return (
    <div className="donut-wrap">
      <div className="chart donut-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={3}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<Tip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="donut-center">
        <strong>{centerValue}</strong>
        <span>{centerLabel}</span>
      </div>
    </div>
  );
}
