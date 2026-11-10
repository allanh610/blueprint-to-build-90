import { useSyncExternalStore } from "react";

// ---------- Types ----------
export type Role = "student" | "advisor" | "supervisor" | "sysadmin" | "uniadmin";
export type DeptId = "registration" | "finaid" | "bursar";
export type TicketStatus = "waiting" | "called" | "in_progress" | "done" | "left";

export interface Department { id: DeptId; name: string; open: string; close: string; days: number[]; avgHandleMin: number }
export interface Staff { id: string; name: string; email: string; role: Exclude<Role, "student">; dept: DeptId | null; active: boolean; available: boolean }
export interface Category { id: string; name: string; dept: DeptId; urgency: 0 | 1 | 2 }
export interface Student { id: string; name: string; email: string; phone: string }
export interface Ticket {
  id: string; caseNo: string; studentId: string; studentName: string; contact: string;
  dept: DeptId; categoryId: string; summary: string; mode: "in_person" | "virtual";
  status: TicketStatus; advisorId: string | null;
  joinedAt: number; calledAt?: number; startedAt?: number; endedAt?: number;
  notes: string; actions: string; nextSteps: string; resolved?: boolean;
}
export interface LogEvent { id: string; at: number; type: string; ticketId?: string | undefined; actor: string; detail: string }
export interface Notice { id: string; at: number; to: string; channel: "push" | "sms" | "email"; title: string; body: string; read: boolean }
export interface Service { id: string; name: string; status: "up" | "down"; since: number; downtimeMin: number }
export interface Session { role: Role; userId: string; name: string }

export interface State {
  departments: Department[]; staff: Staff[]; categories: Category[]; students: Student[];
  tickets: Ticket[]; events: LogEvent[]; notices: Notice[]; services: Service[];
  session: Session | null; seq: number;
}

// ---------- Rules (pure; tested) ----------
export const ALMOST_THRESHOLD = 3; // "almost your turn" when this many or fewer ahead
export const URGENCY_WEIGHT_MIN = 15; // each urgency level = 15 min of extra wait credit

/** Priority score: minutes waited + urgency credit. Waiting time always grows, so no one is starved. */
export function priorityScore(t: Pick<Ticket, "joinedAt">, urgency: number, now: number) {
  return (now - t.joinedAt) / 60000 + urgency * URGENCY_WEIGHT_MIN;
}

export function routeCategory(categories: Category[], categoryId: string): DeptId | null {
  return categories.find((c) => c.id === categoryId)?.dept ?? null;
}

export function orderedQueue(s: Pick<State, "tickets" | "categories">, dept: DeptId, now: number) {
  const urg = (id: string) => s.categories.find((c) => c.id === id)?.urgency ?? 0;
  return s.tickets
    .filter((t) => t.dept === dept && t.status === "waiting")
    .sort((a, b) => priorityScore(b, urg(b.categoryId), now) - priorityScore(a, urg(a.categoryId), now) || a.joinedAt - b.joinedAt);
}

export function activeAdvisors(s: Pick<State, "staff">, dept: DeptId) {
  return s.staff.filter((x) => x.dept === dept && x.active && x.available && (x.role === "advisor" || x.role === "supervisor"));
}

/** Estimated minutes for someone with `ahead` people in front of them. */
export function estimateWait(ahead: number, advisors: number, avgHandleMin: number) {
  if (advisors <= 0) return null; // no one working: cannot estimate
  return Math.ceil(((ahead + 1) * avgHandleMin) / advisors);
}

export function isOpen(d: Department, at: Date) {
  if (!d.days.includes(at.getDay())) return false;
  const hm = at.getHours() * 60 + at.getMinutes();
  const [oh = 0, om = 0] = d.open.split(":").map(Number);
  const [ch = 0, cm = 0] = d.close.split(":").map(Number);
  return hm >= oh * 60 + om && hm < ch * 60 + cm;
}

const ACCESS: Record<string, Role[]> = {
  student: ["student"],
  advisor: ["advisor", "supervisor"],
  supervisor: ["supervisor", "uniadmin"],
  admin: ["sysadmin"],
  reports: ["supervisor", "uniadmin", "sysadmin"],
};
export function canAccess(role: Role | undefined, area: keyof typeof ACCESS) {
  return !!role && ACCESS[area].includes(role);
}

// ---------- Seed ----------
const KEY = "herd-helpdesk-v1";
function rng(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

export function seed(now = Date.now()): State {
  const departments: Department[] = [
    { id: "registration", name: "Registration", open: "08:00", close: "18:00", days: [1, 2, 3, 4, 5], avgHandleMin: 9 },
    { id: "finaid", name: "Financial Aid", open: "09:00", close: "17:00", days: [1, 2, 3, 4, 5], avgHandleMin: 14 },
    { id: "bursar", name: "Bursar", open: "09:00", close: "16:30", days: [1, 2, 3, 4, 5], avgHandleMin: 11 },
  ];
  const categories: Category[] = [
    { id: "reg-hold", name: "Registration hold", dept: "registration", urgency: 2 },
    { id: "reg-add", name: "Add / drop course", dept: "registration", urgency: 1 },
    { id: "reg-transcript", name: "Transcript request", dept: "registration", urgency: 0 },
    { id: "fa-verify", name: "Verification documents", dept: "finaid", urgency: 1 },
    { id: "fa-award", name: "Award / package question", dept: "finaid", urgency: 0 },
    { id: "fa-sap", name: "SAP appeal", dept: "finaid", urgency: 2 },
    { id: "bu-plan", name: "Payment plan", dept: "bursar", urgency: 1 },
    { id: "bu-refund", name: "Refund status", dept: "bursar", urgency: 0 },
    { id: "bu-balance", name: "Balance hold / purge risk", dept: "bursar", urgency: 2 },
  ];
  const staff: Staff[] = [
    { id: "a1", name: "Jordan Ellis", email: "j.ellis@howard.edu", role: "advisor", dept: "registration", active: true, available: true },
    { id: "a2", name: "Maya Brooks", email: "m.brooks@howard.edu", role: "advisor", dept: "registration", active: true, available: false },
    { id: "a3", name: "Andre Wallace", email: "a.wallace@howard.edu", role: "advisor", dept: "finaid", active: true, available: true },
    { id: "a4", name: "Kendra Hill", email: "k.hill@howard.edu", role: "advisor", dept: "finaid", active: true, available: true },
    { id: "a5", name: "Marcus Green", email: "m.green@howard.edu", role: "advisor", dept: "bursar", active: true, available: true },
    { id: "a6", name: "Tasha Reed", email: "t.reed@howard.edu", role: "advisor", dept: "bursar", active: false, available: false },
    { id: "s1", name: "Dr. Renee Carter", email: "r.carter@howard.edu", role: "supervisor", dept: "finaid", active: true, available: false },
    { id: "x1", name: "Omar Patel", email: "o.patel@howard.edu", role: "sysadmin", dept: null, active: true, available: false },
    { id: "u1", name: "Provost Office", email: "provost@howard.edu", role: "uniadmin", dept: null, active: true, available: false },
  ];
  const students: Student[] = [
    { id: "@02912345", name: "Saniya Licorish", email: "saniya.l@bison.howard.edu", phone: "(202) 555-0142" },
    { id: "@02988120", name: "Darius King", email: "darius.k@bison.howard.edu", phone: "(202) 555-0188" },
    { id: "@02977341", name: "Imani Scott", email: "imani.s@bison.howard.edu", phone: "(202) 555-0119" },
    { id: "@02955002", name: "Caleb Johnson", email: "caleb.j@bison.howard.edu", phone: "(202) 555-0170" },
    { id: "@02933418", name: "Aaliyah Ford", email: "aaliyah.f@bison.howard.edu", phone: "(202) 555-0131" },
  ];
  const r = rng(42);
  const tickets: Ticket[] = [];
  const events: LogEvent[] = [];
  let n = 1000;
  const advisorsByDept: Record<DeptId, string[]> = { registration: ["a1", "a2"], finaid: ["a3", "a4"], bursar: ["a5", "a6"] };
  // 45 days of history
  for (let d = 45; d >= 1; d--) {
    const day = new Date(now - d * 86400000);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    const count = 8 + Math.floor(r() * 14) + (day.getDay() === 1 ? 8 : 0);
    for (let i = 0; i < count; i++) {
      const cat = categories[Math.floor(r() * categories.length)]!;
      const hourW = [9, 10, 10, 11, 11, 11, 12, 13, 14, 14, 15, 16];
      day.setHours(hourW[Math.floor(r() * hourW.length)]!, Math.floor(r() * 60), 0, 0);
      const joined = day.getTime();
      const wait = (5 + r() * (cat.dept === "finaid" ? 110 : 60)) * 60000;
      const handle = (5 + r() * 18) * 60000;
      const stu = students[Math.floor(r() * students.length)]!;
      const id = `T${n++}`;
      const t: Ticket = {
        id, caseNo: `HH-${String(n).padStart(6, "0")}`, studentId: stu.id, studentName: stu.name, contact: stu.email,
        dept: cat.dept, categoryId: cat.id, summary: `${cat.name} inquiry`, mode: r() > 0.45 ? "virtual" : "in_person",
        status: "done", advisorId: advisorsByDept[cat.dept][Math.floor(r() * 2)] ?? null, joinedAt: joined,
        calledAt: joined + wait, startedAt: joined + wait + 60000, endedAt: joined + wait + 60000 + handle,
        notes: "Reviewed account with student.", actions: "Updated record.", nextSteps: r() > 0.7 ? "Upload signed form to portal" : "", resolved: r() > 0.32,
      };
      tickets.push(t);
    }
  }
  // Prior case for the demo student
  tickets.push({
    id: "T0999", caseNo: "HH-000999", studentId: "@02912345", studentName: "Saniya Licorish", contact: "saniya.l@bison.howard.edu",
    dept: "finaid", categoryId: "fa-verify", summary: "Verification selected; unsure which documents are needed.", mode: "virtual",
    status: "done", advisorId: "a3", joinedAt: now - 6 * 86400000, calledAt: now - 6 * 86400000 + 42 * 60000,
    startedAt: now - 6 * 86400000 + 43 * 60000, endedAt: now - 6 * 86400000 + 61 * 60000,
    notes: "Student selected for V1 verification. Explained tax transcript requirement.", actions: "Sent verification worksheet via email.",
    nextSteps: "Upload IRS tax return transcript and signed V1 worksheet by Friday.", resolved: false,
  });
  // Live queue
  const live: [string, string, number][] = [
    ["@02988120", "reg-add", 34], ["@02977341", "fa-award", 51], ["@02955002", "fa-sap", 22], ["@02933418", "bu-plan", 18],
    ["@02988120", "fa-verify", 12], ["@02977341", "reg-hold", 8], ["@02955002", "bu-refund", 5], ["@02933418", "fa-award", 3],
  ];
  live.forEach(([sid, cid, ago]) => {
    const stu = students.find((s) => s.id === sid)!; const cat = categories.find((c) => c.id === cid)!;
    const id = `T${n++}`;
    tickets.push({ id, caseNo: `HH-${String(n).padStart(6, "0")}`, studentId: sid, studentName: stu.name, contact: stu.phone,
      dept: cat.dept, categoryId: cid, summary: `Needs help with ${cat.name.toLowerCase()}.`, mode: ago % 2 ? "virtual" : "in_person",
      status: "waiting", advisorId: null, joinedAt: now - ago * 60000, notes: "", actions: "", nextSteps: "" });
    events.push({ id: `E${n}`, at: now - ago * 60000, type: "queue_join", ticketId: id, actor: sid, detail: cat.name });
  });
  const services: Service[] = [
    { id: "queue", name: "Queue service", status: "up", since: now - 9 * 86400000, downtimeMin: 12 },
    { id: "notify", name: "Notification service", status: "up", since: now - 3 * 86400000, downtimeMin: 4 },
    { id: "sso", name: "SSO / identity connector", status: "up", since: now - 21 * 86400000, downtimeMin: 0 },
    { id: "sis", name: "SIS / records integration", status: "up", since: now - 2 * 86400000, downtimeMin: 31 },
  ];
  return { departments, staff, categories, students, tickets, events, notices: [], services, session: null, seq: n };
}

// ---------- Store ----------
let state: State | null = null;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function load(): State {
  if (state) return state;
  if (typeof window === "undefined") return (state = seed());
  try {
    const raw = localStorage.getItem(KEY);
    const shared = raw ? (JSON.parse(raw) as State) : seed();
    shared.session = JSON.parse(sessionStorage.getItem(KEY + "-session") || "null");
    state = shared;
  } catch { state = seed(); }
  channel = new BroadcastChannel(KEY);
  channel.onmessage = () => { const s = state!.session; state = { ...JSON.parse(localStorage.getItem(KEY)!), session: s }; emit(); };
  return state!;
}
function emit() { listeners.forEach((l) => l()); }
function commit(next: State) {
  state = next;
  if (typeof window !== "undefined") {
    const { session, ...shared } = next;
    localStorage.setItem(KEY, JSON.stringify({ ...shared, session: null }));
    sessionStorage.setItem(KEY + "-session", JSON.stringify(session));
    channel?.postMessage("sync");
  }
  emit();
}
export function getState() { return load(); }
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => sel(load()), () => sel(load()));
}

function uid(s: State, p: string) { s.seq += 1; return `${p}${s.seq}`; }
function log(s: State, type: string, actor: string, detail: string, ticketId?: string) {
  s.events = [{ id: uid(s, "E"), at: Date.now(), type, ticketId, actor, detail }, ...s.events].slice(0, 500);
}
function notify(s: State, to: string, title: string, body: string, channels: Notice["channel"][] = ["push", "sms"]) {
  channels.forEach((c) => s.notices.unshift({ id: uid(s, "N"), at: Date.now(), to, channel: c, title, body, read: false }));
}
function mutate(fn: (s: State) => void) { const s = structuredClone(load()); fn(s); commit(s); }

export const actions = {
  signIn(role: Role, userId: string) {
    const s = load();
    if (role === "student") {
      const st = s.students.find((x) => x.id === userId); if (!st) throw new Error("Unknown student");
      mutate((d) => { d.session = { role, userId, name: st.name }; log(d, "sso_login", userId, "Student signed in via SSO"); });
    } else {
      const st = s.staff.find((x) => x.id === userId);
      if (!st || !st.active) throw new Error("This staff account is deactivated and cannot access queue data.");
      mutate((d) => { d.session = { role: st.role, userId, name: st.name }; log(d, "sso_login", userId, `${st.role} signed in`); });
    }
  },
  signOut() { mutate((d) => { d.session = null; }); },
  joinQueue(input: { studentId: string; contact: string; categoryId: string; summary: string; mode: Ticket["mode"] }) {
    let created: Ticket | null = null;
    mutate((d) => {
      if (!input.studentId || !input.contact || !input.categoryId || !input.summary.trim()) throw new Error("All fields are required");
      if (d.tickets.some((t) => t.studentId === input.studentId && ["waiting", "called", "in_progress"].includes(t.status)))
        throw new Error("You are already in a queue.");
      const dept = routeCategory(d.categories, input.categoryId)!;
      const stu = d.students.find((x) => x.id === input.studentId)!;
      const n = d.seq + 1;
      const t: Ticket = { id: uid(d, "T"), caseNo: `HH-${String(n).padStart(6, "0")}`, studentId: input.studentId, studentName: stu.name,
        contact: input.contact, dept, categoryId: input.categoryId, summary: input.summary.trim(), mode: input.mode,
        status: "waiting", advisorId: null, joinedAt: Date.now(), notes: "", actions: "", nextSteps: "" };
      d.tickets.push(t); created = t;
      log(d, "queue_join", input.studentId, `Routed to ${dept}`, t.id);
      notify(d, input.studentId, "You're in line", `Case ${t.caseNo} created. We'll alert you when you're close.`, ["email"]);
    });
    return created as Ticket | null;
  },
  leaveQueue(ticketId: string) {
    mutate((d) => { const t = d.tickets.find((x) => x.id === ticketId); if (!t) return; t.status = "left"; t.endedAt = Date.now(); log(d, "queue_leave", t.studentId, "Student left queue", t.id); });
  },
  callNext(advisorId: string, ticketId: string) {
    mutate((d) => {
      const t = d.tickets.find((x) => x.id === ticketId); if (!t || t.status !== "waiting") return;
      t.status = "called"; t.advisorId = advisorId; t.calledAt = Date.now();
      log(d, "call", advisorId, "Student called", t.id);
      notify(d, t.studentId, "You're being called!", `${d.staff.find((s) => s.id === advisorId)?.name} is ready for case ${t.caseNo}.`);
    });
  },
  startSession(ticketId: string) {
    mutate((d) => { const t = d.tickets.find((x) => x.id === ticketId); if (!t) return; t.status = "in_progress"; t.startedAt = Date.now(); log(d, "session_start", t.advisorId ?? "", "Marked in progress", t.id); });
  },
  updateCase(ticketId: string, patch: Partial<Pick<Ticket, "notes" | "actions" | "nextSteps">>) {
    mutate((d) => { const t = d.tickets.find((x) => x.id === ticketId); if (t) Object.assign(t, patch); });
  },
  closeCase(ticketId: string, resolved: boolean) {
    mutate((d) => { const t = d.tickets.find((x) => x.id === ticketId); if (!t) return; t.status = "done"; t.resolved = resolved; t.endedAt = Date.now(); log(d, "session_end", t.advisorId ?? "", resolved ? "Resolved" : "Follow-up needed", t.id); });
  },
  markAlmost(ticketId: string) {
    mutate((d) => { const t = d.tickets.find((x) => x.id === ticketId); if (!t) return; notify(d, t.studentId, "Almost your turn", `Case ${t.caseNo}: ${ALMOST_THRESHOLD} or fewer people ahead of you.`); log(d, "notify_almost", "system", "Almost-turn alert sent", t.id); });
  },
  setAvailability(staffId: string, available: boolean) {
    mutate((d) => { const s = d.staff.find((x) => x.id === staffId); if (s) { s.available = available; log(d, "staffing", staffId, available ? "Available" : "Unavailable"); } });
  },
  reassign(staffId: string, dept: DeptId, actor: string) {
    mutate((d) => { const s = d.staff.find((x) => x.id === staffId); if (s) { s.dept = dept; s.available = true; log(d, "reassign", actor, `${s.name} → ${dept}`); } });
  },
  requestAdvisors(dept: DeptId, actor: string) {
    mutate((d) => { log(d, "request_staff", actor, `Extra advisors requested for ${dept}`); d.staff.filter((s) => s.role === "sysadmin").forEach((a) => notify(d, a.id, "Staffing request", `More advisors needed in ${dept}`, ["email"])); });
  },
  updateDept(id: DeptId, patch: Partial<Department>) { mutate((d) => { Object.assign(d.departments.find((x) => x.id === id)!, patch); log(d, "config", d.session?.userId ?? "", `Updated ${id}`); }); },
  upsertStaff(s: Staff) { mutate((d) => { const i = d.staff.findIndex((x) => x.id === s.id); if (i >= 0) d.staff[i] = s; else d.staff.push({ ...s, id: uid(d, "a") }); log(d, "staff", d.session?.userId ?? "", `Saved ${s.name}`); }); },
  upsertCategory(c: Category) { mutate((d) => { const i = d.categories.findIndex((x) => x.id === c.id); if (i >= 0) d.categories[i] = c; else d.categories.push(c); log(d, "routing_rule", d.session?.userId ?? "", `${c.name} → ${c.dept}`); }); },
  setService(id: string, up: boolean) {
    mutate((d) => {
      const s = d.services.find((x) => x.id === id)!; s.status = up ? "up" : "down"; s.since = Date.now();
      if (!up) d.staff.filter((x) => x.role === "sysadmin").forEach((a) => notify(d, a.id, "Outage detected", `${s.name} is not responding.`, ["sms", "email"]));
      log(d, up ? "service_up" : "outage", "monitor", s.name);
    });
  },
  readAll(to: string) { mutate((d) => d.notices.forEach((n) => { if (n.to === to) n.read = true; })); },
  reset() { const s = seed(); s.session = load().session; commit(s); },
};

export const deptName = (s: State, id: DeptId) => s.departments.find((d) => d.id === id)?.name ?? id;
export const catName = (s: State, id: string) => s.categories.find((c) => c.id === id)?.name ?? id;
