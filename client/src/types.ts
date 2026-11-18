export type Category = 'Economy' | 'Compact' | 'SUV' | 'Luxury' | 'Van';
export type VehicleStatus = 'available' | 'rented' | 'maintenance';
export type RentalStatus = 'active' | 'completed' | 'cancelled';

export interface Vehicle {
  id: number;
  name: string;
  brand: string;
  model: string;
  year: number;
  category: Category;
  plate: string;
  dailyRate: number;
  mileage: number;
  lastServiceMileage: number;
  status: VehicleStatus;
  acquiredAt: string;
  utilization30: number;
  effectiveStatus: VehicleStatus;
  activeRental: { id: number; customerName: string; endDate: string } | null;
}

export interface CustomerRow {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  license: string;
  joinedAt: string;
  rentalsCount: number;
  totalSpend: number;
  lastRental: string | null;
  segment: string;
}

export interface RentalRow {
  id: number;
  vehicleId: number;
  customerId: number;
  vehicleName: string;
  vehicleCategory: Category;
  plate: string;
  customerName: string;
  startDate: string;
  endDate: string;
  days: number;
  dailyRate: number;
  totalAmount: number;
  status: RentalStatus;
  returnedAt: string | null;
  pickupLocation: string;
  dropoffLocation: string;
}

export interface RentalList {
  rentals: RentalRow[];
  total: number;
  stats: {
    activeCount: number;
    completed30: number;
    revenue30: number;
    avgDuration30: number;
  };
}

export interface Overview {
  today: string;
  kpis: {
    revenue30: { value: number; previous: number; delta: number | null };
    activeRentals: number;
    utilization30: number;
    avgRental: { value: number; previous: number; delta: number | null };
    fleetSize: number;
    available: number;
    rented: number;
    maintenance: number;
    customers: number;
  };
  revenueTrend: { date: string; revenue: number; rentals: number }[];
  categoryMix: {
    category: Category;
    vehicles: number;
    utilization30: number;
    revenue30: number;
  }[];
  recentRentals: {
    id: number;
    customerName: string;
    vehicleName: string;
    category: Category;
    startDate: string;
    endDate: string;
    status: RentalStatus;
    totalAmount: number;
  }[];
}

export interface CategoryBreakdown {
  category: Category;
  vehicles: number;
  rentals: number;
  revenue: number;
  avgRate: number;
  avgDuration: number;
  utilization: number;
  revenueShare: number;
}

export interface Descriptive {
  window: { from: string; to: string; days: number };
  kpis: {
    revenue: number;
    rentals: number;
    avgDuration: number;
    avgValue: number;
    uniqueCustomers: number;
    utilization: number;
    revenuePerVehicle: number;
    repeatRate: number;
    fleetSize: number;
  };
  monthly: { month: string; label: string; revenue: number; rentals: number }[];
  weekly: {
    week: string;
    label: string;
    revenue: number;
    rentals: number;
    utilization: number;
  }[];
  categories: CategoryBreakdown[];
  topVehicles: {
    id: number;
    name: string;
    category: Category;
    rentals: number;
    revenue: number;
    utilization: number;
    dailyRate: number;
  }[];
  durationBuckets: { bucket: string; count: number }[];
  segments: {
    segment: string;
    customers: number;
    revenue: number;
    rentals: number;
    avgSpend: number;
  }[];
}

export interface ForecastPoint {
  date: string;
  predicted: number;
  lower: number;
  upper: number;
}

export interface MetricForecast {
  history: { date: string; actual: number }[];
  forecast: ForecastPoint[];
  next30: number;
  model: {
    name: string;
    description: string;
    backtestWeeks: number;
    wape: number;
    accuracy: number;
    r2: number;
  };
}

export interface Predictive {
  generatedAt: string;
  horizon: number;
  revenue: MetricForecast;
  demand: MetricForecast;
  categories: {
    category: Category;
    current30Rentals: number;
    next30Rentals: number;
    next30Revenue: number;
    trendPct: number;
    utilization30: number;
    avgValue: number;
    confidence: 'high' | 'medium' | 'low';
  }[];
  utilization: {
    current30: number;
    projectedNext30: number;
    fleetSize: number;
    avgDuration: number;
  };
  risk: {
    lateReturnRate: number;
    expectedLateNext30: number;
    completed180: number;
  };
}

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

export interface Prescriptive {
  generatedAt: string;
  assumptions: string[];
  summary: {
    pricingActions: number;
    fleetActions: number;
    maintenanceDue: number;
    urgentMaintenance: number;
    promotions: number;
  };
  pricing: PricingRec[];
  fleet: FleetRec[];
  maintenance: MaintenanceRec[];
  promotions: PromoRec[];
  actions: ActionItem[];
}
