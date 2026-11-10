import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, ListOrdered, BellRing, FolderOpen } from "lucide-react";
import { actions, useStore, type Role } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ROLE_LABEL } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Sign in — Herd Helpdesk" },
    { name: "description", content: "Sign in with Howard SSO to join the Bison Solution Hub queue or track your case." },
    { property: "og:title", content: "Herd Helpdesk — Bison Solution Hub" },
    { property: "og:description", content: "One place for registration, financial aid and bursar help at Howard." },
  ] }),
  component: SignIn,
});

const HOME: Record<Role, string> = { student: "/student", advisor: "/advisor", supervisor: "/supervisor", sysadmin: "/admin", uniadmin: "/reports" };

function SignIn() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const students = useStore((s) => s.students);
  const staff = useStore((s) => s.staff);
  const [role, setRole] = useState<Role>("student");
  const [user, setUser] = useState("@02912345");
  const navigate = useNavigate();
  const options = role === "student" ? students.map((s) => ({ id: s.id, label: `${s.name} (${s.id})` }))
    : staff.filter((s) => s.role === role).map((s) => ({ id: s.id, label: `${s.name}${s.active ? "" : " — deactivated"}` }));

  const go = () => {
    try { actions.signIn(role, user); navigate({ to: HOME[role] }); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="bg-hero relative flex flex-col justify-between p-10 text-primary-foreground lg:p-16">
        <div className="flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-lg bg-accent font-display text-xl font-bold">H</span><span className="font-display text-xl font-bold">Herd Helpdesk</span></div>
        <div className="my-12 max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Bison Solution Hub</p>
          <h1 className="mt-3 text-5xl font-bold leading-[1.05] lg:text-6xl">Stop waiting in the dark.</h1>
          <p className="mt-5 text-lg opacity-80">Registration, financial aid and bursar help — in person or virtual — with a real place in line, honest wait times, and a case record that follows you.</p>
          <ul className="mt-8 grid gap-3 text-sm sm:grid-cols-2">
            {[[Clock, "See the wait before you join"], [ListOrdered, "Live position, no refreshing"], [BellRing, "Get alerted when you're close"], [FolderOpen, "Never start over — case history"]].map(([I, t]) => {
              const Icon = I as typeof Clock;
              return <li key={t as string} className="flex items-center gap-2"><Icon className="h-4 w-4 text-accent" />{t as string}</li>;
            })}
          </ul>
        </div>
        <p className="text-xs opacity-60">Howard University · Prototype</p>
      </div>
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h2 className="text-3xl font-bold">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Howard single sign-on (simulated). Pick a role to explore each view.</p>
          {mounted && (
            <div className="mt-8 space-y-5">
              <div className="space-y-2"><Label>Role</Label>
                <Select value={role} onValueChange={(v) => { const r = v as Role; setRole(r); setUser(r === "student" ? students[0].id : staff.find((s) => s.role === r)?.id ?? ""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Account</Label>
                <Select value={user} onValueChange={setUser}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button className="w-full" size="lg" onClick={go}>Continue with Howard SSO</Button>
              <p className="text-xs text-muted-foreground">Tip: open a second tab as an advisor — queue changes sync live between tabs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
