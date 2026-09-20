import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, CalendarPlus, ListOrdered, Users, Car, Sparkles, Package,
  UserCog, Clock3, CreditCard, Receipt, Warehouse, Truck, Wallet, BarChart3,
  Bell, Building2, Plug, Settings, Shield, Activity, Stethoscope, Search,
  LogOut, Moon, Sun, Menu, X, Droplets, MoreHorizontal, Home
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../hooks/useTheme";
import { api } from "../../lib/api";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, group: "ops" },
  { to: "/quick-book", label: "Quick Book", icon: CalendarPlus, group: "ops" },
  { to: "/bookings", label: "Bookings", icon: CalendarPlus, group: "ops" },
  { to: "/queue", label: "Queue", icon: ListOrdered, group: "ops" },
  { to: "/wash-bays", label: "Bays", icon: Droplets, group: "ops" },
  { to: "/calendar", label: "Calendar", icon: CalendarPlus, group: "ops" },
  { to: "/customers", label: "Customers", icon: Users, group: "people" },
  { to: "/vehicles", label: "Vehicles", icon: Car, group: "people" },
  { to: "/employees", label: "Employees", icon: UserCog, group: "people" },
  { to: "/attendance", label: "Attendance", icon: Clock3, group: "people" },
  { to: "/services", label: "Services", icon: Sparkles, group: "catalog" },
  { to: "/packages", label: "Packages", icon: Package, group: "catalog" },
  { to: "/payments", label: "Payments", icon: CreditCard, group: "money" },
  { to: "/invoices", label: "Invoices", icon: Receipt, group: "money" },
  { to: "/cashup", label: "Cash-up", icon: Wallet, group: "money" },
  { to: "/expenses", label: "Expenses", icon: Wallet, group: "money" },
  { to: "/inventory", label: "Inventory", icon: Warehouse, group: "stock" },
  { to: "/suppliers", label: "Suppliers", icon: Truck, group: "stock" },
  { to: "/reports", label: "Reports", icon: BarChart3, group: "system" },
  { to: "/notifications", label: "Notifications", icon: Bell, group: "system" },
  { to: "/branches", label: "Branches", icon: Building2, group: "system" },
  { to: "/integrations", label: "Integrations", icon: Plug, group: "system" },
  { to: "/admin", label: "Admin", icon: Shield, group: "system" },
  { to: "/audit", label: "Audit Log", icon: Activity, group: "system" },
  { to: "/activity", label: "Activity", icon: Activity, group: "system" },
  { to: "/diagnostics", label: "Diagnostics", icon: Stethoscope, group: "system" },
  { to: "/backup", label: "Backup", icon: Package, group: "system" },
  { to: "/settings", label: "Settings", icon: Settings, group: "system" },
  { to: "/help", label: "Help", icon: Activity, group: "system" },
];

const mobilePrimary = [
  { to: "/", label: "Home", icon: Home },
  { to: "/quick-book", label: "Book", icon: CalendarPlus },
  { to: "/queue", label: "Queue", icon: ListOrdered },
  { to: "/wash-bays", label: "Bays", icon: Droplets },
  { to: "/customers", label: "Customers", icon: Users },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const brand = useMemo(() => "Car Wash Manager", []);

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

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      isActive ? "bg-brand-600 text-white shadow-md shadow-brand-600/30" : "text-slate-300 hover:bg-slate-800/80"
    }`;

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Desktop / tablet sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-slate-950 text-slate-100 shadow-xl transition lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800/80">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-sky-400 to-brand-700 flex items-center justify-center font-extrabold shadow-lg shadow-sky-500/30">
            CW
          </div>
          <div className="min-w-0">
            <div className="font-semibold leading-tight truncate">{brand}</div>
            <div className="text-[11px] text-slate-400">v0.2.0 · ZAR</div>
          </div>
          <button className="ml-auto lg:hidden p-2 rounded-lg hover:bg-slate-800" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <nav className="p-2.5 overflow-y-auto h-[calc(100vh-148px)] space-y-0.5">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} onClick={() => setOpen(false)} className={linkClass}>
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 inset-x-0 p-3 border-t border-slate-800 bg-slate-950/95">
          <div className="text-sm font-medium truncate">{user?.full_name}</div>
          <div className="text-[11px] text-slate-500 truncate">{user?.role_name || "Admin"}</div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 min-w-0 flex flex-col pb-20 lg:pb-0">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md px-3 md:px-4 py-2.5 flex items-center gap-2 md:gap-3">
          <button className="lg:hidden btn-secondary !px-2.5 !min-h-[40px]" onClick={() => setOpen(true)} aria-label="Menu">
            <Menu size={18} />
          </button>
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              className="input pl-9 !py-2 !min-h-[40px]"
              placeholder="Search…"
              value={q}
              onChange={(e) => search(e.target.value)}
            />
            {results && (
              <div className="absolute mt-1 w-full card p-2 z-50 max-h-80 overflow-auto shadow-xl">
                {["customers", "vehicles", "bookings"].map((k) => (
                  <div key={k} className="mb-2">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 px-2 py-1">{k}</div>
                    {(results[k] || []).map((r: any) => (
                      <button
                        key={`${k}-${r.id}`}
                        className="w-full text-left px-2 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-sm"
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
            className="btn-secondary !px-2.5 !min-h-[40px]"
            onClick={() => setTheme(theme === "dark" ? "light" : theme === "light" ? "system" : "dark")}
            title="Toggle theme"
          >
            {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button className="btn-secondary !min-h-[40px] hidden sm:inline-flex" onClick={() => logout()}>
            <LogOut size={16} /> Logout
          </button>
        </header>

        <main className="p-3 md:p-6 flex-1 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Phone bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md pb-safe">
        <div className="grid grid-cols-6 gap-0.5 px-1 pt-1">
          {mobilePrimary.map((item) => {
            const active = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-semibold ${
                  active ? "text-sky-600" : "text-slate-500"
                }`}
              >
                <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </NavLink>
            );
          })}
          <button
            type="button"
            className={`flex flex-col items-center gap-0.5 py-2 rounded-xl text-[10px] font-semibold ${
              moreOpen ? "text-sky-600" : "text-slate-500"
            }`}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <MoreHorizontal size={20} />
            More
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-16 inset-x-2 card p-3 max-h-[60vh] overflow-auto shadow-2xl">
            <div className="grid grid-cols-3 gap-2">
              {nav
                .filter((n) => !mobilePrimary.some((m) => m.to === n.to))
                .map((item) => (
                  <button
                    key={item.to}
                    className="flex flex-col items-center gap-1 rounded-xl p-3 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => {
                      setMoreOpen(false);
                      navigate(item.to);
                    }}
                  >
                    <item.icon size={18} />
                    {item.label}
                  </button>
                ))}
              <button
                className="flex flex-col items-center gap-1 rounded-xl p-3 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                onClick={() => {
                  setMoreOpen(false);
                  logout();
                }}
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
