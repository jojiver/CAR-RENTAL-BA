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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed (${response.status})`;
    throw new Error(message);
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
