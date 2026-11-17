import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, CalendarClock, Clock, FolderOpen, LifeBuoy, Loader2, Search, Sparkles, Timer, Users } from "lucide-react";
import { actions, activeAdvisors, ALMOST_THRESHOLD, catName, deptName, estimateWait, getState, isOpen, orderedQueue, useStore, type DeptId, type Ticket } from "@/lib/store";
import { recommendIntakeCategory } from "@/lib/intake.functions";
import type { IntakeRecommendation } from "@/lib/intake.shared";
import { AppShell, Panel, useNow } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/student")({
  head: () => ({ meta: [
    { title: "My Hub — Herd Helpdesk" },
    { name: "description", content: "Check wait times, join the queue, track your position and review your cases." },
    { property: "og:title", content: "My Hub — Herd Helpdesk" },
    { property: "og:description", content: "Join the Bison Solution Hub queue and track your case." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <AppShell area="student"><StudentHub /></AppShell>,
});

function StudentHub() {
  const session = useStore((s) => s.session)!;
  const tickets = useStore((s) => s.tickets);
  const active = tickets.find((t) => t.studentId === session.userId && ["waiting", "called", "in_progress"].includes(t.status));
  const [intake, setIntake] = useState<{ key: number; dept: DeptId; categoryId?: string; summary?: string } | null>(null);
  useEffect(() => {
    if (intake) document.getElementById("check-in")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [intake]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Hi, {session.name.split(" ")[0]}</h1>
        <p className="text-muted-foreground">Registration, financial aid and bursar — in one place.</p>
      </div>
      {!active && <AssistedIntake onUse={(recommendation) => setIntake({ key: Date.now(), ...recommendation })} />}
      {active ? <LiveTracker ticket={active} /> : <WaitEstimator onJoin={(dept) => setIntake({ key: Date.now(), dept })} />}
      {!active && intake && <IntakeForm key={intake.key} dept={intake.dept} initialCategoryId={intake.categoryId} initialSummary={intake.summary} onDone={() => setIntake(null)} />}
      <div className="grid gap-6 lg:grid-cols-2">
        <MyCases />
        <Availability />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SelfService />
        <CaseLookup />
      </div>
    </div>
  );
}

function WaitEstimator({ onJoin }: { onJoin: (d: DeptId) => void }) {
  const now = useNow(5000);
  const s = useStore((x) => x);
  return (
    <Panel title="Before you join: estimated waits" icon={<Timer className="h-5 w-5" />}>
      <div className="grid gap-4 md:grid-cols-3">
        {s.departments.map((d) => {
          const q = orderedQueue(s, d.id, now).length;
          const adv = activeAdvisors(s, d.id).length;
          const est = estimateWait(q, adv, d.avgHandleMin);
          const open = isOpen(d, new Date(now));
          return (
            <div key={d.id} className="flex flex-col rounded-lg border bg-background p-4">
              <div className="flex items-center justify-between"><h3 className="text-xl font-bold">{d.name}</h3><Badge variant={open ? "default" : "secondary"}>{open ? "Open" : "Closed"}</Badge></div>
              <div className="mt-3 font-display text-4xl font-bold">{est === null ? "—" : `~${est}`}<span className="text-base font-normal text-muted-foreground"> {est === null ? "no advisors" : "min"}</span></div>
              <p className="text-sm text-muted-foreground">{q} in line · {adv} advisor{adv === 1 ? "" : "s"} active</p>
              <div className="mt-4 flex gap-2">
                <Button className="flex-1" onClick={() => onJoin(d.id)}>Join now</Button>
                <Button variant="outline" onClick={() => toast.success(`We'll remind you to check ${d.name} again in 1 hour.`)}>Later</Button>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function AssistedIntake({ onUse }: { onUse: (recommendation: IntakeRecommendation) => void }) {
  const recommend = useServerFn(recommendIntakeCategory);
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [recommendation, setRecommendation] = useState<IntakeRecommendation | null>(null);

  const getRecommendation = async () => {
    setPending(true);
    setError("");
    setRecommendation(null);
    try {
      const result = await recommend({ data: { description } });
      if (result.ok) setRecommendation(result.recommendation);
      else setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't get an AI recommendation. You can still check in manually below.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Panel title="Describe it in your own words" icon={<Sparkles className="h-5 w-5" />} action={<Badge variant="secondary">AI-powered</Badge>}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Tell us what's happening. AI can suggest the right issue category and prepare a short summary for check-in.</p>
        <div className="space-y-2">
          <Label htmlFor="help-description">What do you need help with?</Label>
          <Textarea id="help-description" rows={4} maxLength={1200} value={description} onChange={(e) => { setDescription(e.target.value); setRecommendation(null); setError(""); }} placeholder="e.g. I got an email saying my financial aid can't be finished until I send more tax forms, but I'm not sure what to upload." />
          <div className="flex justify-between gap-4 text-xs text-muted-foreground"><span>Don't include passwords or full account numbers.</span><span>{description.length}/1,200</span></div>
        </div>
        <Button type="button" disabled={pending || description.trim().length < 20} onClick={getRecommendation}>
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {pending ? "Finding the best category…" : "Recommend a category"}
        </Button>
        {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error} You can still choose a department and check in below.</p>}
        {recommendation && (
          <div className="rounded-lg border bg-muted/40 p-4" aria-live="polite">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended category</p>
            <h3 className="mt-1 text-lg font-bold">{recommendation.categoryName}</h3>
            <p className="text-sm text-muted-foreground">{deptName(getState(), recommendation.dept)}</p>
            <p className="mt-3 text-sm"><span className="font-semibold">Check-in summary: </span>{recommendation.summary}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="button" onClick={() => onUse(recommendation)}>Continue to check-in <ArrowRight /></Button>
              <span className="text-xs text-muted-foreground">You can edit both suggestions next.</span>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function IntakeForm({ dept, initialCategoryId, initialSummary = "", onDone }: { dept: DeptId; initialCategoryId: string | undefined; initialSummary: string | undefined; onDone: () => void }) {
  const s = useStore((x) => x);
  const me = s.students.find((x) => x.id === s.session!.userId)!;
  const cats = s.categories.filter((c) => c.dept === dept);
  const [f, setF] = useState({ studentId: me.id, contact: me.phone, categoryId: cats.some((c) => c.id === initialCategoryId) ? initialCategoryId! : cats[0]?.id ?? "", summary: initialSummary, mode: "virtual" as Ticket["mode"] });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.summary.trim() || !f.contact.trim() || !f.categoryId) { toast.error("Please complete every field."); return; }
    try { const t = actions.joinQueue(f); toast.success(`You're in line — case ${t?.caseNo}`); onDone(); }
    catch (err) { toast.error((err as Error).message); }
  };
  return (
    <div id="check-in" className="scroll-mt-6">
      <Panel title={`Check in: ${deptName(s, dept)}`} icon={<Users className="h-5 w-5" />} action={<Button variant="ghost" size="sm" onClick={onDone}>Cancel</Button>}>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Student ID</Label><Input value={f.studentId} readOnly className="bg-muted" /><p className="text-xs text-muted-foreground">Pre-filled from your Howard account</p></div>
        <div className="space-y-2"><Label>Best contact (phone or email)</Label><Input required value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></div>
        <div className="space-y-2"><Label>Issue category</Label>
          <Select value={f.categoryId} onValueChange={(v) => setF({ ...f, categoryId: v })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="space-y-2"><Label>How are you visiting?</Label>
          <RadioGroup value={f.mode} onValueChange={(v) => setF({ ...f, mode: v as Ticket["mode"] })} className="flex gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="virtual" />Virtual hub</label>
            <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="in_person" />In person</label>
          </RadioGroup>
        </div>
        <div className="space-y-2 md:col-span-2"><Label>Briefly describe what you need</Label><Textarea required maxLength={500} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} placeholder="e.g. I have a hold blocking registration for spring." /></div>
        <div className="md:col-span-2"><Button type="submit" size="lg">Join the queue</Button></div>
      </form>
      </Panel>
    </div>
  );
}

function LiveTracker({ ticket }: { ticket: Ticket }) {
  const now = useNow(1000);
  const s = useStore((x) => x);
  const q = orderedQueue(s, ticket.dept, now);
  const ahead = Math.max(0, q.findIndex((t) => t.id === ticket.id));
  const dept = s.departments.find((d) => d.id === ticket.dept)!;
  const est = estimateWait(ahead, activeAdvisors(s, ticket.dept).length, dept.avgHandleMin);
  const advisor = s.staff.find((x) => x.id === ticket.advisorId);
  const [alerted, setAlerted] = useState(false);
  useEffect(() => {
    if (ticket.status === "waiting" && ahead <= ALMOST_THRESHOLD && !alerted) {
      const already = getState().events.some((e) => e.type === "notify_almost" && e.ticketId === ticket.id);
      if (!already) { actions.markAlmost(ticket.id); toast("Almost your turn!", { description: `${ahead} ahead of you.` }); }
      setAlerted(true);
    }
  }, [ahead, ticket.status, ticket.id, alerted]);
  useEffect(() => { if (ticket.status === "called") toast.success("You're being called!", { description: `${advisor?.name} is ready for you.` }); }, [ticket.status]); // eslint-disable-line
  const steps = ["waiting", "called", "in_progress"] as const;
  return (
    <section className="bg-hero overflow-hidden rounded-2xl p-8 text-primary-foreground shadow-card">
      <div className="flex flex-wrap items-start gap-8">
        <div className={`grid h-36 w-36 place-items-center rounded-full border-4 border-accent ${ticket.status === "called" ? "animate-ring" : ""}`}>
          <div className="text-center">
            {ticket.status === "waiting" ? <><div className="font-display text-5xl font-bold">#{ahead + 1}</div><div className="text-xs opacity-75">in line</div></>
              : <div className="px-2 font-display text-xl font-bold">{ticket.status === "called" ? "Your turn" : "In session"}</div>}
          </div>
        </div>
        <div className="min-w-60 flex-1">
          <p className="text-sm uppercase tracking-[0.2em] text-accent">{deptName(s, ticket.dept)} · {catName(s, ticket.categoryId)}</p>
          <h2 className="mt-1 text-3xl font-bold">
            {ticket.status === "waiting" && (ahead === 0 ? "You're next" : `${ahead} ${ahead === 1 ? "person" : "people"} ahead of you`)}
            {ticket.status === "called" && `${advisor?.name} is calling you`}
            {ticket.status === "in_progress" && `Meeting with ${advisor?.name}`}
          </h2>
          {ticket.status === "waiting" && <p className="mt-1 opacity-80">Estimated wait: {est === null ? "waiting for an advisor to come online" : `about ${est} min`} · updates live</p>}
          <p className="mt-1 text-sm opacity-70">Case {ticket.caseNo} · joined {new Date(ticket.joinedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
          <div className="mt-5 flex gap-2">
            {steps.map((st) => <span key={st} className={`rounded-full px-3 py-1 text-xs font-semibold ${ticket.status === st ? "bg-accent text-accent-foreground" : "bg-sidebar-accent opacity-70"}`}>{st === "in_progress" ? "In progress" : st.charAt(0).toUpperCase() + st.slice(1)}</span>)}
          </div>
        </div>
        {ticket.status === "waiting" && <Button variant="secondary" onClick={() => { actions.leaveQueue(ticket.id); toast("You left the queue."); }}>Leave queue</Button>}
      </div>
    </section>
  );
}

function Availability() {
  const now = useNow(30000);
  const s = useStore((x) => x);
  return (
    <Panel title="Who's working & hours" icon={<Clock className="h-5 w-5" />}>
      <div className="space-y-4">
        {s.departments.map((d) => {
          const people = s.staff.filter((x) => x.dept === d.id && x.active && (x.role === "advisor" || x.role === "supervisor"));
          return (
            <div key={d.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{d.name}</span>
                <span className="text-sm text-muted-foreground">Mon–Fri {d.open}–{d.close} · <span className={isOpen(d, new Date(now)) ? "font-semibold text-success" : "font-semibold text-destructive"}>{isOpen(d, new Date(now)) ? "Open now" : "Closed"}</span></span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {people.map((p) => <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs"><span className={`h-2 w-2 rounded-full ${p.available ? "bg-success" : "bg-muted-foreground"}`} />{p.name}<span className="text-muted-foreground">{p.available ? "active" : "unavailable"}</span></span>)}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function CaseCard({ t }: { t: Ticket }) {
  const s = useStore((x) => x);
  return (
    <div className="rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between"><span className="font-mono font-semibold">{t.caseNo}</span>
        <Badge variant={t.status === "done" ? (t.resolved ? "default" : "destructive") : "secondary"}>{t.status === "done" ? (t.resolved ? "Resolved" : "Follow-up pending") : t.status.replace("_", " ")}</Badge></div>
      <p className="text-muted-foreground">{deptName(s, t.dept)} · {catName(s, t.categoryId)} · {new Date(t.joinedAt).toLocaleDateString()}</p>
      {t.notes && <p className="mt-2"><span className="font-semibold">Discussed: </span>{t.notes}</p>}
      {t.nextSteps && <p className="mt-1 rounded bg-warning/30 px-2 py-1"><span className="font-semibold">Your next step: </span>{t.nextSteps}</p>}
    </div>
  );
}

function MyCases() {
  const s = useStore((x) => x);
  const mine = s.tickets.filter((t) => t.studentId === s.session!.userId && t.status !== "left").sort((a, b) => b.joinedAt - a.joinedAt).slice(0, 6);
  return (
    <Panel title="My cases" icon={<FolderOpen className="h-5 w-5" />}>
      <div className="space-y-3">{mine.length ? mine.map((t) => <CaseCard key={t.id} t={t} />) : <p className="text-sm text-muted-foreground">No cases yet.</p>}</div>
    </Panel>
  );
}

function CaseLookup() {
  const [q, setQ] = useState("");
  const [hit, setHit] = useState<Ticket | null | undefined>(undefined);
  const me = useStore((s) => s.session!.userId);
  return (
    <Panel title="Look up a case" icon={<Search className="h-5 w-5" />}>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const t = getState().tickets.find((x) => x.caseNo.toLowerCase() === q.trim().toLowerCase()); setHit(t && t.studentId === me ? t : null); }}>
        <Input placeholder="e.g. HH-000999" value={q} onChange={(e) => setQ(e.target.value)} /><Button type="submit">Check status</Button>
      </form>
      <div className="mt-4">{hit === null && <p className="text-sm text-destructive">No case with that number on your account.</p>}{hit && <CaseCard t={hit} />}</div>
    </Panel>
  );
}

const GUIDES = [
  { q: "How do I clear a registration hold?", dept: "Registration", steps: ["Open BisonWeb → Student Profile → Holds", "Note the office that placed the hold", "Resolve with that office (often Bursar or Advising)", "Holds lift within 24h of resolution"] },
  { q: "I was selected for financial aid verification", dept: "Financial Aid", steps: ["Download the V1 worksheet from the aid portal", "Request your IRS tax return transcript", "Upload both via the secure document portal", "Allow 5–7 business days for review"] },
  { q: "Setting up a payment plan", dept: "Bursar", steps: ["Log in to the payment portal", "Choose Enroll in Payment Plan for the term", "Pay the enrollment fee and first installment", "Plans must start before the purge deadline"] },
];

function SelfService() {
  const now = useNow(60000);
  const deadlines = useMemo(() => [
    { name: "Spring registration opens", days: 3 }, { name: "FAFSA priority deadline", days: 9 },
    { name: "Tuition payment / purge deadline", days: 16 }, { name: "Last day to add/drop", days: 24 },
  ], []);
  const [on, setOn] = useState<Record<string, boolean>>({});
  return (
    <Panel title="Self-service & deadlines" icon={<LifeBuoy className="h-5 w-5" />}>
      <p className="mb-2 text-sm text-muted-foreground">Many questions don't need a queue. Try these first:</p>
      <Accordion type="single" collapsible>
        {GUIDES.map((g) => (
          <AccordionItem key={g.q} value={g.q}><AccordionTrigger className="text-left">{g.q} <Badge variant="outline" className="ml-auto mr-2">{g.dept}</Badge></AccordionTrigger>
            <AccordionContent><ol className="list-decimal space-y-1 pl-5 text-sm">{g.steps.map((x) => <li key={x}>{x}</li>)}</ol></AccordionContent></AccordionItem>
        ))}
      </Accordion>
      <h3 className="mt-5 flex items-center gap-2 font-semibold"><CalendarClock className="h-4 w-4 text-accent" />Upcoming deadlines</h3>
      <ul className="mt-2 divide-y">
        {deadlines.map((d) => (
          <li key={d.name} className="flex items-center gap-3 py-2 text-sm">
            <span className="w-20 font-semibold">{new Date(now + d.days * 86400000).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
            <span className="flex-1">{d.name}</span>
            <span className="text-xs text-muted-foreground">Remind me</span>
            <Switch checked={!!on[d.name]} onCheckedChange={(v) => { setOn({ ...on, [d.name]: v }); if (v) toast.success(`Reminder set for ${d.name}`); }} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
