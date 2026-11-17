import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, LogOut, ShieldCheck } from "lucide-react";
import { actions, canAccess, useStore, type Role } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

const NAV: { to: string; label: string; area: Parameters<typeof canAccess>[1] }[] = [
  { to: "/student", label: "My Hub", area: "student" },
  { to: "/advisor", label: "Advisor Console", area: "advisor" },
  { to: "/supervisor", label: "Capacity", area: "supervisor" },
  { to: "/reports", label: "Reports", area: "reports" },
  { to: "/admin", label: "Admin", area: "admin" },
];

export const ROLE_LABEL: Record<Role, string> = {
  student: "Student", advisor: "Advisor", supervisor: "Supervisor", sysadmin: "System admin", uniadmin: "University admin",
};

export function AppShell({ area, children }: { area: Parameters<typeof canAccess>[1]; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const session = useStore((s) => s.session);
  const navigate = useNavigate();
  useEffect(() => { if (mounted && !session) navigate({ to: "/" }); }, [mounted, session, navigate]);
  if (!mounted || !session) return <div className="min-h-screen bg-background" />;
  const allowed = canAccess(session.role, area);
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-hero text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent font-display text-lg font-bold text-accent-foreground">H</span>
            <span className="leading-tight"><span className="block font-display text-lg font-bold">Herd Helpdesk</span><span className="block text-xs opacity-70">Bison Solution Hub</span></span>
          </Link>
          <nav className="ml-4 flex flex-wrap gap-1">
            {NAV.filter((n) => canAccess(session.role, n.area)).map((n) => (
              <Link key={n.to} to={n.to} className="rounded-md px-3 py-1.5 text-sm font-medium opacity-80 hover:bg-sidebar-accent hover:opacity-100" activeProps={{ className: "bg-sidebar-accent opacity-100" }}>{n.label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell userId={session.userId} />
            <div className="text-right text-sm leading-tight"><div className="font-semibold">{session.name}</div><div className="text-xs opacity-70">{ROLE_LABEL[session.role]}</div></div>
            <Button size="icon" variant="ghost" className="hover:bg-sidebar-accent hover:text-primary-foreground" aria-label="Sign out" onClick={() => { actions.signOut(); navigate({ to: "/" }); }}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        {allowed ? children : (
          <div className="mx-auto max-w-md rounded-xl border bg-card p-8 text-center shadow-card">
            <ShieldCheck className="mx-auto h-10 w-10 text-accent" />
            <h2 className="mt-3 text-2xl font-bold">Access restricted</h2>
            <p className="mt-2 text-sm text-muted-foreground">Your role ({ROLE_LABEL[session.role]}) does not have permission to view this area.</p>
          </div>
        )}
      </main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">Prototype · simulated SSO and campus data · data encrypted in transit (TLS) and at rest in production</footer>
    </div>
  );
}

function NotificationBell({ userId }: { userId: string }) {
  const notices = useStore((s) => s.notices).filter((n) => n.to === userId);
  const unread = notices.filter((n) => !n.read).length;
  return (
    <Popover onOpenChange={(o) => !o && unread && actions.readAll(userId)}>
      <PopoverTrigger asChild>
        <button aria-label="Notifications" className="relative rounded-md p-2 hover:bg-sidebar-accent">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-2 text-sm font-semibold">Notifications</div>
        <div className="max-h-80 overflow-auto">
          {notices.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nothing yet.</p>}
          {notices.slice(0, 20).map((n) => (
            <div key={n.id} className={`border-b px-4 py-2 text-sm ${n.read ? "" : "bg-muted"}`}>
              <div className="flex items-center justify-between"><span className="font-semibold">{n.title}</span><Badge variant="outline" className="text-[10px] uppercase">{n.channel}</Badge></div>
              <p className="text-muted-foreground">{n.body}</p>
              <p className="text-[11px] text-muted-foreground">{new Date(n.at).toLocaleTimeString()}</p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Panel({ title, icon, children, action, className = "" }: { title: string; icon?: ReactNode; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border bg-card p-5 shadow-card ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        {icon && <span className="text-accent">{icon}</span>}
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl font-bold">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export const fmtMin = (ms: number) => `${Math.max(0, Math.round(ms / 60000))} min`;
