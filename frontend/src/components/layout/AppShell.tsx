import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CalendarDays, ListOrdered, Users, Car, Sparkles, Package,
  UserCog, Clock3, CreditCard, Receipt, Warehouse, Truck, Wallet, BarChart3,
  Bell, Building2, Plug, Settings, Shield, Activity, Stethoscope, Search,
  LogOut, Moon, Sun, Menu, X, Droplets
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import { api } from "../../lib/api";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/queue", label: "Live Wash Queue", icon: ListOrdered },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/vehicles", label: "Vehicles", icon: Car },
  { to: "/services", label: "Services", icon: Sparkles },
  { to: "/packages", label: "Packages", icon: Package },
  { to: "/employees", label: "Employees", icon: UserCog },
  { to: "/attendance", label: "Attendance", icon: Clock3 },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/invoices", label: "Invoices", icon: Receipt },
  { to: "/cashup", label: "Cash-up", icon: Wallet },
  { to: "/inventory", label: "Inventory", icon: Warehouse },
  { to: "/suppliers", label: "Suppliers", icon: Truck },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/branches", label: "Branches", icon: Building2 },
  { to: "/wash-bays", label: "Wash Bays", icon: Droplets },
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/admin", label: "Admin", icon: Shield },
  { to: "/audit", label: "Audit Log", icon: Activity },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/diagnostics", label: "Diagnostics", icon: Stethoscope },
  { to: "/backup", label: "Backup", icon: Package },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any>(null);
  const navigate = useNavigate();

  const brand = useMemo(() => user?.full_name ? "Car Wash Manager" : "Car Wash Manager", [user]);

  const search = async (value: string) => {
    setQ(value);
    if (value.trim().length < 2) {
      setResults(null);
      return;
    }
    try {
      const data = await api(`/api/v1/search?q=${encodeURIComponent(value)}`);
      setResults(data);
    } catch {
      setResults(null);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-slate-900 text-slate-100 transition lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-800">
          <div className="h-9 w-9 rounded-xl bg-brand-500 flex items-center justify-center font-bold">CW</div>
          <div>
            <div className="font-semibold leading-tight">{brand}</div>
            <div className="text-xs text-slate-400">v0.1.0</div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <nav className="p-2 overflow-y-auto h-[calc(100vh-140px)] space-y-0.5">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${isActive ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-slate-800"}`
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 inset-x-0 p-3 border-t border-slate-800">
          <div className="text-xs text-slate-400 truncate">{user?.full_name}</div>
          <div className="text-[11px] text-slate-500 truncate">{user?.role_name || "Admin"}</div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-3 flex items-center gap-3">
          <button className="lg:hidden btn-secondary !px-2" onClick={() => setOpen(true)}><Menu size={18} /></button>
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input className="input pl-9" placeholder="Search customers, vehicles, bookings…" value={q} onChange={(e) => search(e.target.value)} />
            {results && (
              <div className="absolute mt-1 w-full card p-2 z-50 max-h-80 overflow-auto">
                {["customers", "vehicles", "bookings"].map((k) => (
                  <div key={k} className="mb-2">
                    <div className="text-xs uppercase text-slate-500 px-2 py-1">{k}</div>
                    {(results[k] || []).map((r: any) => (
                      <button
                        key={`${k}-${r.id}`}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
                        onClick={() => {
                          setResults(null);
                          setQ("");
                          navigate(k === "customers" ? `/customers` : k === "vehicles" ? `/vehicles` : `/bookings`);
                        }}
                      >
                        {r.label}
                      </button>
                    ))}
                    {(results[k] || []).length === 0 && <div className="px-2 text-xs text-slate-400">No matches</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            className="btn-secondary !px-2"
            onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
            title="Toggle theme"
          >
            {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button className="btn-secondary" onClick={() => logout()}><LogOut size={16} /> Logout</button>
        </header>
        <main className="p-4 md:p-6 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
