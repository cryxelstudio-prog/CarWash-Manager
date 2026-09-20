export interface User {
  id: number;
  username: string;
  email?: string | null;
  full_name: string;
  phone?: string | null;
  role_id: number;
  role_name?: string | null;
  branch_id?: number | null;
  is_super_admin: boolean;
  theme?: string;
  permissions: string[];
}

export interface Session {
  user: User;
  csrf_token: string;
  setup_required?: boolean;
}

export interface AuthStatus {
  setup_required: boolean;
  authenticated: boolean;
  user: User | null;
  csrf_token: string | null;
}

export interface Dashboard {
  today_bookings: number;
  waiting: number;
  washing: number;
  completed: number;
  ready_for_collection: number;
  cancelled: number;
  no_shows: number;
  revenue_today: number;
  revenue_week: number;
  revenue_month: number;
  cash_today: number;
  card_today: number;
  outstanding: number;
  vehicles_washed: number;
  avg_wash_minutes?: number | null;
  avg_wait_minutes?: number | null;
  customers_total: number;
  customers_new_today: number;
  returning_customers_today: number;
  employees_working: number;
  attendance_today: number;
  low_stock_count: number;
  upcoming_bookings: any[];
  recent_activity: any[];
  stage_counts: Record<string, number>;
  revenue_by_day: { date: string; amount: number }[];
  system_health: string;
  integrations_ok: number;
  integrations_total: number;
}
