import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import {
  Badge,
  Card,
  ErrorState,
  Field,
  Loader,
  Modal,
  StatCard,
  StatusBadge,
} from '../components/ui';
import {
  IconBolt,
  IconCalendar,
  IconGauge,
  IconKey,
  IconPlus,
  IconSearch,
} from '../components/icons';
import { addDays, dateRange, daysBetween, fullDate, money, num, pct, shortDate, todayISO } from '../lib/format';
import { useApi } from '../lib/useApi';
import type { RentalStatus } from '../types';

type StatusFilter = 'all' | RentalStatus;

const TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

export function RentalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, error, reload } = useApi(() => api.rentals({ limit: 2500 }));
  const vehiclesApi = useApi(() => api.vehicles());
  const customersApi = useApi(() => api.customers());

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(searchParams.get('new') === '1');
  const [form, setForm] = useState({
    customerId: '',
    vehicleId: '',
    startDate: todayISO(),
    endDate: addDays(todayISO(), 3),
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (searchParams.get('new') === '1') setOpen(true);
  }, [searchParams]);

  const vehicles = vehiclesApi.data?.vehicles ?? [];
  const customers = customersApi.data?.customers ?? [];

  const filtered = useMemo(() => {
    const rows = data?.rentals ?? [];
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        row.customerName.toLowerCase().includes(needle) ||
        row.vehicleName.toLowerCase().includes(needle) ||
        row.plate.toLowerCase().includes(needle)
      );
    });
  }, [data, statusFilter, query]);

  const counts = useMemo(() => {
    const rows = data?.rentals ?? [];
    return {
      all: data?.total ?? rows.length,
      active: rows.filter((row) => row.status === 'active').length,
      completed: rows.filter((row) => row.status === 'completed').length,
      cancelled: rows.filter((row) => row.status === 'cancelled').length,
    };
  }, [data]);

  const selectedVehicle = vehicles.find((vehicle) => String(vehicle.id) === form.vehicleId);
  const days = Math.max(0, daysBetween(form.startDate, form.endDate));
  const discount = days >= 14 ? 0.15 : days >= 7 ? 0.1 : 0;
  const estimate = selectedVehicle ? Math.round(days * selectedVehicle.dailyRate * (1 - discount)) : 0;
  const bookableVehicles = vehicles.filter((vehicle) => vehicle.effectiveStatus !== 'maintenance');

  function closeModal() {
    setOpen(false);
    if (searchParams.get('new')) {
      setSearchParams({}, { replace: true });
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!form.customerId || !form.vehicleId) {
      setFormError('Choose a customer and a vehicle.');
      return;
    }
    setPending(true);
    try {
      await api.createRental({
        customerId: Number(form.customerId),
        vehicleId: Number(form.vehicleId),
        startDate: form.startDate,
        endDate: form.endDate,
      });
      setForm({
        customerId: '',
        vehicleId: '',
        startDate: todayISO(),
        endDate: addDays(todayISO(), 3),
      });
      closeModal();
      reload();
      vehiclesApi.reload();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not create rental');
    } finally {
      setPending(false);
    }
  }

  async function act(id: number, action: 'return' | 'cancel') {
    if (action === 'cancel' && !window.confirm('Cancel this rental? The vehicle will be freed.')) {
      return;
    }
    setBusyId(id);
    try {
      await api.updateRental(id, action);
      reload();
      vehiclesApi.reload();
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : 'Could not update rental');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Loader label="Loading rentals" />;
  if (error || !data) return <ErrorState message={error ?? 'No rental data'} onRetry={reload} />;

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <span className="eyebrow">Reservations</span>
          <h1>Rentals</h1>
          <p>{data.total} bookings on record. Active rentals and returns update the fleet in real time.</p>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            <IconPlus size={16} /> New rental
          </button>
        </div>
      </header>

      <div className="kpi-grid">
        <StatCard
          label="Active now"
          value={num(data.stats.activeCount)}
          icon={<IconKey />}
          hint="Vehicles currently out"
          tone="accent"
        />
        <StatCard
          label="Revenue · 30 days"
          value={money(data.stats.revenue30)}
          icon={<IconBolt />}
          hint="Recognized at pickup"
          tone="teal"
        />
        <StatCard
          label="Completed · 30 days"
          value={num(data.stats.completed30)}
          icon={<IconCalendar />}
          hint="Returned rentals"
          tone="violet"
        />
        <StatCard
          label="Avg duration"
          value={`${data.stats.avgDuration30} days`}
          icon={<IconGauge />}
          hint="Last 30 days"
          tone="amber"
        />
      </div>

      <Card>
        <div className="toolbar">
          <div className="tabs tabs-inline">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={statusFilter === tab.id ? 'tab active' : 'tab'}
                onClick={() => setStatusFilter(tab.id)}
              >
                {tab.label}
                <span>{counts[tab.id]}</span>
              </button>
            ))}
          </div>
          <label className="search">
            <IconSearch size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search rentals"
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="state">
            <strong>No rentals match</strong>
            <p className="muted">Adjust the status filter or search term.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Vehicle</th>
                  <th>Dates</th>
                  <th className="num">Days</th>
                  <th className="num">Total</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="entity">
                        <strong>{row.customerName}</strong>
                        <span>Rental #{String(row.id).padStart(4, '0')}</span>
                      </div>
                    </td>
                    <td>
                      <div className="entity">
                        <strong>{row.vehicleName}</strong>
                        <span>
                          {row.plate} · {row.vehicleCategory}
                        </span>
                      </div>
                    </td>
                    <td className="nowrap">
                      {dateRange(row.startDate, row.endDate)}
                      {row.returnedAt ? (
                        <span className="cell-sub">returned {shortDate(row.returnedAt)}</span>
                      ) : null}
                    </td>
                    <td className="num">{row.days}</td>
                    <td className="num">
                      {money(row.totalAmount)}
                      <span className="cell-sub">{money(row.dailyRate)}/day</span>
                    </td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="actions nowrap">
                      {row.status === 'active' ? (
                        <div className="action-row">
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            disabled={busyId === row.id}
                            onClick={() => act(row.id, 'return')}
                          >
                            Return
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs danger"
                            disabled={busyId === row.id}
                            onClick={() => act(row.id, 'cancel')}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : row.status === 'completed' ? (
                        <Badge tone="success">Closed</Badge>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={closeModal}
        title="New rental"
        subtitle="Prices are computed from the vehicle's daily rate, with 7-day and 14-day discounts."
        wide
      >
        <form className="form" onSubmit={submit}>
          <div className="form-grid">
            <Field label="Customer">
              <select
                value={form.customerId}
                onChange={(event) => setForm({ ...form, customerId: event.target.value })}
                required
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.fullName} · {customer.rentalsCount} rentals
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Vehicle">
              <select
                value={form.vehicleId}
                onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}
                required
              >
                <option value="">Select a vehicle</option>
                {bookableVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name} · {vehicle.category} · ${vehicle.dailyRate}/day
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pickup date">
              <input
                type="date"
                value={form.startDate}
                min={addDays(todayISO(), -30)}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                required
              />
            </Field>
            <Field label="Return date">
              <input
                type="date"
                value={form.endDate}
                min={addDays(form.startDate, 1)}
                onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                required
              />
            </Field>
          </div>

          <div className="estimate">
            <div>
              <span className="muted">Pickup</span>
              <strong>{form.startDate ? fullDate(form.startDate) : '—'}</strong>
            </div>
            <div>
              <span className="muted">Return</span>
              <strong>{form.endDate ? fullDate(form.endDate) : '—'}</strong>
            </div>
            <div>
              <span className="muted">Duration</span>
              <strong>{days} day{days === 1 ? '' : 's'}</strong>
            </div>
            <div>
              <span className="muted">Discount</span>
              <strong>{discount > 0 ? pct(discount) : 'None'}</strong>
            </div>
            <div className="estimate-total">
              <span className="muted">Estimated total</span>
              <strong>{money(estimate)}</strong>
            </div>
          </div>

          {formError ? <div className="inline-error">{formError}</div> : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? 'Creating…' : 'Create rental'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
