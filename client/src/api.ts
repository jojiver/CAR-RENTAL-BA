import type {
  CustomerRow,
  Descriptive,
  Overview,
  Predictive,
  Prescriptive,
  RentalList,
  RentalRow,
  Vehicle,
} from './types';

const configuredBase = (import.meta.env.VITE_API_URL ?? '').trim();
const API_BASE = configuredBase.replace(/\/+$/, '').replace(/\/api$/i, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${API_BASE}/api${path}`, { ...init, headers });
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    const message =
      payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  if (payload === null) {
    throw new Error(
      `Expected JSON from ${API_BASE || window.location.origin}/api${path}. Check VITE_API_URL.`,
    );
  }
  return payload as T;
}

export interface CreateRentalInput {
  customerId: number;
  vehicleId: number;
  startDate: string;
  endDate: string;
}

export interface CreateVehicleInput {
  name: string;
  brand: string;
  model: string;
  year: number;
  category: string;
  plate: string;
  dailyRate: number;
  mileage: number;
}

export const api = {
  overview: () => request<Overview>('/overview'),
  descriptive: (days: number) => request<Descriptive>(`/analytics/descriptive?days=${days}`),
  predictive: (horizon: number) => request<Predictive>(`/analytics/predictive?horizon=${horizon}`),
  prescriptive: () => request<Prescriptive>('/analytics/prescriptive'),
  vehicles: () => request<{ vehicles: Vehicle[] }>('/vehicles'),
  customers: () => request<{ customers: CustomerRow[] }>('/customers'),
  rentals: (query?: { status?: string; q?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);
    if (query?.q) params.set('q', query.q);
    if (query?.limit) params.set('limit', String(query.limit));
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return request<RentalList>(`/rentals${suffix}`);
  },
  createRental: (body: CreateRentalInput) =>
    request<{ rental: RentalRow }>('/rentals', { method: 'POST', body: JSON.stringify(body) }),
  updateRental: (id: number, action: 'return' | 'cancel') =>
    request<{ rental: RentalRow }>(`/rentals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    }),
  createVehicle: (body: CreateVehicleInput) =>
    request<{ vehicle: unknown }>('/vehicles', { method: 'POST', body: JSON.stringify(body) }),
  setVehicleStatus: (id: number, status: 'available' | 'maintenance') =>
    request<{ vehicle: Vehicle }>(`/vehicles/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
