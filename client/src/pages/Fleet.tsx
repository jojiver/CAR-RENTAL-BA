import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import { CATEGORY_COLORS } from '../components/charts';
import {
  Badge,
  Card,
  CardHead,
  ErrorState,
  Field,
  Loader,
  Modal,
  Progress,
  StatCard,
  StatusBadge,
} from '../components/ui';
import { IconCar, IconGauge, IconKey, IconPlus, IconSearch, IconWrench } from '../components/icons';
import { money, num, pct, shortDate } from '../lib/format';
import { useApi } from '../lib/useApi';
import type { Category, Vehicle, VehicleStatus } from '../types';

const CATEGORIES: Category[] = ['Economy', 'Compact', 'SUV', 'Luxury', 'Van'];

const EMPTY_FORM = {
  brand: '',
  model: '',
  year: '2025',
  category: 'Economy' as Category,
  plate: '',
  dailyRate: '',
  mileage: '0',
};

export function FleetPage() {
  const { data, loading, error, reload } = useApi(() => api.vehicles());
  const [category, setCategory] = useState<'all' | Category>('all');
  const [status, setStatus] = useState<'all' | VehicleStatus>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const vehicles = data?.vehicles ?? [];
  const avgUtil = useMemo(
    () => (vehicles.length ? vehicles.reduce((acc, v) => acc + v.utilization30, 0) / vehicles.length : 0),
    [vehicles],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return vehicles.filter((vehicle) => {
      if (category !== 'all' && vehicle.category !== category) return false;
      if (status !== 'all' && vehicle.effectiveStatus !== status) return false;
      if (!needle) return true;
      return (
        vehicle.name.toLowerCase().includes(needle) ||
        vehicle.plate.toLowerCase().includes(needle)
      );
    });
  }, [vehicles, category, status, query]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setPending(true);
    try {
      const name = `${form.brand} ${form.model}`.trim();
      await api.createVehicle({
        name,
        brand: form.brand,
        model: form.model,
        year: Number(form.year),
        category: form.category,
        plate: form.plate,
        dailyRate: Number(form.dailyRate),
        mileage: Number(form.mileage),
      });
      setOpen(false);
      setForm(EMPTY_FORM);
      reload();
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not add vehicle');
    } finally {
      setPending(false);
    }
  }

  async function toggleMaintenance(vehicle: Vehicle) {
    setBusyId(vehicle.id);
    setActionError(null);
    try {
      await api.setVehicleStatus(
        vehicle.id,
        vehicle.effectiveStatus === 'maintenance' ? 'available' : 'maintenance',
      );
      reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update vehicle');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Loader label="Loading fleet" />;
  if (error || !data) return <ErrorState message={error ?? 'No fleet data'} onRetry={reload} />;

  const counts = {
    available: vehicles.filter((v) => v.effectiveStatus === 'available').length,
    rented: vehicles.filter((v) => v.effectiveStatus === 'rented').length,
    maintenance: vehicles.filter((v) => v.effectiveStatus === 'maintenance').length,
  };

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <span className="eyebrow">Fleet</span>
          <h1>Vehicles</h1>
          <p>{vehicles.length} units across five classes. Keep an eye on utilization before adding capacity.</p>
        </div>
        <div className="head-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setFormError(null);
              setOpen(true);
            }}
          >
            <IconPlus size={16} /> Add vehicle
          </button>
        </div>
      </header>

      <div className="kpi-grid">
        <StatCard label="In fleet" value={num(vehicles.length)} icon={<IconCar />} hint="All classes" tone="teal" />
        <StatCard label="Available now" value={num(counts.available)} icon={<IconGauge />} hint="Ready to book" tone="accent" />
        <StatCard label="On rent" value={num(counts.rented)} icon={<IconKey />} hint="Active rentals" tone="violet" />
        <StatCard
          label="Avg utilization"
          value={pct(avgUtil)}
          icon={<IconWrench />}
          hint={`${counts.maintenance} in maintenance`}
          tone="amber"
        />
      </div>

      <Card>
        <div className="toolbar">
          <div className="chip-row">
            <button
              type="button"
              className={category === 'all' ? 'chip active' : 'chip'}
              onClick={() => setCategory('all')}
            >
              All classes
            </button>
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                className={category === item ? 'chip active' : 'chip'}
                onClick={() => setCategory(item)}
              >
                <span className="cat-dot" style={{ background: CATEGORY_COLORS[item] }} />
                {item}
              </button>
            ))}
          </div>
          <div className="toolbar-right">
            <label className="search">
              <IconSearch size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name or plate"
              />
            </label>
            <select
              className="select"
              value={status}
              onChange={(event) => setStatus(event.target.value as 'all' | VehicleStatus)}
            >
              <option value="all">Any status</option>
              <option value="available">Available</option>
              <option value="rented">On rent</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>

        {actionError ? <div className="inline-error">{actionError}</div> : null}

        {filtered.length === 0 ? (
          <div className="state">
            <strong>No vehicles match those filters</strong>
            <p className="muted">Try another class or clear the search.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Class</th>
                  <th className="num">Rate</th>
                  <th>Utilization · 30d</th>
                  <th>Mileage</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((vehicle) => {
                  const sinceService = vehicle.mileage - vehicle.lastServiceMileage;
                  return (
                    <tr key={vehicle.id}>
                      <td>
                        <div className="entity">
                          <strong>{vehicle.name}</strong>
                          <span>
                            {vehicle.plate} · {vehicle.year}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="class-tag">
                          <i style={{ background: CATEGORY_COLORS[vehicle.category] }} />
                          {vehicle.category}
                        </span>
                      </td>
                      <td className="num">
                        {money(vehicle.dailyRate)}
                        <span className="cell-sub">/ day</span>
                      </td>
                      <td>
                        <div className="util-cell">
                          <Progress value={vehicle.utilization30} />
                          <span>{pct(vehicle.utilization30)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="entity">
                          <strong>{num(vehicle.mileage)} mi</strong>
                          <span className={sinceService > 10_000 ? 'warn-text' : ''}>
                            {num(sinceService)} mi since service
                          </span>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={vehicle.effectiveStatus} />
                        {vehicle.activeRental ? (
                          <span className="cell-sub">
                            {vehicle.activeRental.customerName} · until{' '}
                            {shortDate(vehicle.activeRental.endDate)}
                          </span>
                        ) : null}
                      </td>
                      <td className="actions">
                        {vehicle.effectiveStatus === 'rented' ? (
                          <Badge tone="info">Out</Badge>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            disabled={busyId === vehicle.id}
                            onClick={() => toggleMaintenance(vehicle)}
                          >
                            {vehicle.effectiveStatus === 'maintenance'
                              ? 'Mark available'
                              : 'To maintenance'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHead
          title="Fleet composition"
          subtitle="Each class carries a different risk and yield profile. Utilization above 80% usually justifies extra capacity."
        />
        <div className="mini-grid">
          {CATEGORIES.map((item) => {
            const own = vehicles.filter((v) => v.category === item);
            const util = own.length
              ? own.reduce((acc, v) => acc + v.utilization30, 0) / own.length
              : 0;
            return (
              <div className="mini-card" key={item}>
                <span className="class-tag">
                  <i style={{ background: CATEGORY_COLORS[item] }} />
                  {item}
                </span>
                <strong>{own.length} units</strong>
                <Progress value={util} />
                <span className="muted">{pct(util)} utilized · avg {money(own.length ? own.reduce((acc, v) => acc + v.dailyRate, 0) / own.length : 0)}/day</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a vehicle"
        subtitle="New units start as available and immediately count toward capacity."
      >
        <form className="form" onSubmit={submit}>
          <div className="form-grid">
            <Field label="Brand">
              <input
                value={form.brand}
                onChange={(event) => setForm({ ...form, brand: event.target.value })}
                placeholder="Toyota"
                required
              />
            </Field>
            <Field label="Model">
              <input
                value={form.model}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
                placeholder="RAV4"
                required
              />
            </Field>
            <Field label="Year">
              <input
                type="number"
                min={1990}
                max={2030}
                value={form.year}
                onChange={(event) => setForm({ ...form, year: event.target.value })}
                required
              />
            </Field>
            <Field label="Class">
              <select
                value={form.category}
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value as Category })
                }
              >
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Plate">
              <input
                value={form.plate}
                onChange={(event) => setForm({ ...form, plate: event.target.value })}
                placeholder="RV-2051"
                required
              />
            </Field>
            <Field label="Daily rate (USD)">
              <input
                type="number"
                min={1}
                step={1}
                value={form.dailyRate}
                onChange={(event) => setForm({ ...form, dailyRate: event.target.value })}
                placeholder="79"
                required
              />
            </Field>
            <Field label="Mileage">
              <input
                type="number"
                min={0}
                step={100}
                value={form.mileage}
                onChange={(event) => setForm({ ...form, mileage: event.target.value })}
                required
              />
            </Field>
          </div>
          {formError ? <div className="inline-error">{formError}</div> : null}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? 'Adding…' : 'Add vehicle'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
