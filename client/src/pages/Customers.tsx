import { useMemo, useState } from 'react';
import { api } from '../api';
import {
  Badge,
  Card,
  CardHead,
  ErrorState,
  Loader,
  StatCard,
} from '../components/ui';
import { IconSearch, IconSpark, IconUsers, IconBolt } from '../components/icons';
import { initials, money, num, pct, shortDate } from '../lib/format';
import { useApi } from '../lib/useApi';

function segmentTone(segment: string) {
  if (segment === 'Loyal') return 'success' as const;
  if (segment === 'Returning') return 'info' as const;
  return 'neutral' as const;
}

export function CustomersPage() {
  const { data, loading, error, reload } = useApi(() => api.customers());
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<'all' | 'Loyal' | 'Returning' | 'One-time'>('all');

  const customers = data?.customers ?? [];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return customers.filter((customer) => {
      if (segment !== 'all' && customer.segment !== segment) return false;
      if (!needle) return true;
      return (
        customer.fullName.toLowerCase().includes(needle) ||
        customer.email.toLowerCase().includes(needle) ||
        customer.phone.toLowerCase().includes(needle)
      );
    });
  }, [customers, query, segment]);

  const totals = useMemo(() => {
    const spend = customers.reduce((acc, customer) => acc + customer.totalSpend, 0);
    const rentals = customers.reduce((acc, customer) => acc + customer.rentalsCount, 0);
    const repeat = customers.filter((customer) => customer.rentalsCount >= 2).length;
    return {
      spend,
      rentals,
      repeat,
      avg: customers.length ? spend / customers.length : 0,
      rate: customers.length ? repeat / customers.length : 0,
    };
  }, [customers]);

  if (loading) return <Loader label="Loading customers" />;
  if (error || !data) return <ErrorState message={error ?? 'No customer data'} onRetry={reload} />;

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <span className="eyebrow">Relationships</span>
          <h1>Customers</h1>
          <p>{customers.length} drivers on file. Spend and segment are computed from completed and active rentals.</p>
        </div>
      </header>

      <div className="kpi-grid">
        <StatCard
          label="Customers"
          value={num(customers.length)}
          icon={<IconUsers />}
          hint={`${num(totals.rentals)} lifetime bookings`}
          tone="teal"
        />
        <StatCard
          label="Repeat rate"
          value={pct(totals.rate)}
          icon={<IconSpark />}
          hint={`${totals.repeat} customers with 2+ rentals`}
          tone="accent"
        />
        <StatCard
          label="Lifetime revenue"
          value={money(totals.spend)}
          icon={<IconBolt />}
          hint="All non-cancelled rentals"
          tone="violet"
        />
        <StatCard
          label="Avg spend / customer"
          value={money(totals.avg)}
          icon={<IconUsers />}
          hint="Lifetime value proxy"
          tone="amber"
        />
      </div>

      <Card>
        <CardHead
          title="Customer book"
          subtitle="Loyal = 5+ rentals · Returning = 2–4 · One-time = a single rental"
          action={
            <div className="toolbar-right">
              <div className="chip-row">
                {(['all', 'Loyal', 'Returning', 'One-time'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={segment === item ? 'chip active' : 'chip'}
                    onClick={() => setSegment(item)}
                  >
                    {item === 'all' ? 'All' : item}
                  </button>
                ))}
              </div>
              <label className="search">
                <IconSearch size={15} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, email or phone"
                />
              </label>
            </div>
          }
        />

        {filtered.length === 0 ? (
          <div className="state">
            <strong>No customers match</strong>
            <p className="muted">Try a different search or segment.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Joined</th>
                  <th className="num">Rentals</th>
                  <th className="num">Total spend</th>
                  <th>Last rental</th>
                  <th>Segment</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="person">
                        <span className="avatar avatar-sm">{initials(customer.fullName)}</span>
                        <div className="entity">
                          <strong>{customer.fullName}</strong>
                          <span>{customer.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="entity">
                        <strong>{customer.phone}</strong>
                        <span>{customer.license}</span>
                      </div>
                    </td>
                    <td className="nowrap">{shortDate(customer.joinedAt)}</td>
                    <td className="num">{customer.rentalsCount}</td>
                    <td className="num">{money(customer.totalSpend)}</td>
                    <td className="nowrap">
                      {customer.lastRental ? shortDate(customer.lastRental) : '—'}
                    </td>
                    <td>
                      <Badge tone={segmentTone(customer.segment)}>{customer.segment}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
