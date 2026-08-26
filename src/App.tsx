import { useEffect, useState, type ChangeEvent } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  BellRing,
  BookOpen,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  CreditCard,
  Gauge,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  Plus,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { getSupabaseClient, hasSupabasePublicConfig } from "./lib/supabase";
import { emptyOnboardingDraft, isStepReady, onboardingProgress, onboardingSteps, type OnboardingDraft, type OnboardingStepId } from "./lib/onboarding";
import { hasCheckoutReturn, isPublicLandingPath, resolveInitialWorkspaceView } from "./lib/routing";
import { canManageInternalSeats, internalSeatRoles, isSeatInviteReady, normaliseSeatInvite, type InternalSeatRole } from "./lib/seatAdmin";

type WorkspaceView = "command" | "onboarding" | "seats" | "work" | "library" | "reports" | "inbox";

type OrganizationContext = {
  claimed: boolean;
  organization?: { id: string; name: string };
  entitlement?: { internal_seat_limit: number; subscription_state: "active" | "payment_attention" | "inactive" };
  onboarding?: { status: string; current_step: number };
  occupiedSeats?: number;
  role?: string;
  seats?: Array<{ id: string; email: string; display_name: string | null; role_name: string; seat_status: "invited" | "active" | "released"; invited_at: string; activated_at: string | null }>;
  activity?: Array<{ title: string; detail: string | null; created_at: string }>;
  workItems?: Array<{ id: string; work_type: "project" | "priority_action"; title: string; detail: string | null; status: "planned" | "in_progress" | "blocked" | "complete"; risk_level: "standard" | "attention" | "critical"; owner_label: string | null; due_date: string | null; created_at: string; updated_at: string }>;
  libraryItems?: Array<{ id: string; resource_type: "policy" | "procedure" | "form"; title: string; lifecycle_status: "draft" | "active" | "retired"; current_version: string; owner_label: string | null; review_date: string | null; created_at: string; updated_at: string }>;
};

const localDraftKey = "solumpm.organization-onboarding.draft";
const enterpriseCheckoutUrl = "https://buy.stripe.com/8x29AMbYG89kaMk0Eq4Vy2c";

const activityPlaceholders = [
  { title: "Subscription activation", detail: "Waiting for the first verified Stripe subscription event.", icon: CreditCard },
  { title: "Organisation onboarding", detail: "Complete the setup sequence to prepare your controlled workspace.", icon: ClipboardList },
  { title: "Internal seat administration", detail: "Seat allocation opens after a confirmed Enterprise entitlement.", icon: UsersRound },
];

function labelForStatus(isSupabaseConfigured: boolean) {
  return isSupabaseConfigured ? "Supabase configured" : "Foundation mode";
}

function PublicLanding() {
  return (
    <main className="public-home">
      <nav className="public-nav" aria-label="Public navigation">
        <a className="brand" href="/">Solum<span>PM</span></a>
        <a className="public-nav-link" href="/onboarding">Already subscribed? <ChevronRight size={15} /></a>
      </nav>
      <section className="public-hero">
        <div className="public-hero-copy">
          <p className="eyebrow">ONE OPERATING SYSTEM · CLEAR ACCOUNTABILITY</p>
          <h1>Bring work, decisions and accountability into one calmer operating rhythm.</h1>
          <p>SolumPM gives organisation leaders a protected command centre, controlled onboarding and a disciplined way to grow internal access without losing governance.</p>
          <div className="public-actions"><a className="public-primary" href={enterpriseCheckoutUrl}>Subscribe to Enterprise <ArrowUpRight size={17} /></a><a className="public-secondary" href="/onboarding">Continue organisation setup <ChevronRight size={16} /></a></div>
          <p className="public-microcopy"><ShieldCheck size={15} /> Access activates only after Stripe confirms the subscription.</p>
        </div>
        <aside className="enterprise-offer" aria-label="Enterprise membership">
          <p className="panel-kicker">SOL UMPM ENTERPRISE</p>
          <div className="price-line"><strong>A$55</strong><span>per month<br />+ GST</span></div>
          <p>For one organisation and its first 25 named internal users.</p>
          <ul><li><BadgeCheck size={16} /> 25 named internal seats</li><li><BadgeCheck size={16} /> Master Licence Holder controls</li><li><BadgeCheck size={16} /> Protected organisation onboarding</li><li><BadgeCheck size={16} /> Command-centre foundation</li></ul>
          <div className="offer-divider" />
          <p className="additional-seat-note">Need more capacity? Add 25 internal seats for <strong>A$25/month + GST</strong> after your organisation is verified.</p>
          <a className="offer-link" href={enterpriseCheckoutUrl}>Start Enterprise <ArrowUpRight size={15} /></a>
        </aside>
      </section>
      <section className="public-steps" aria-label="How SolumPM starts">
        <div><p className="eyebrow">HOW IT STARTS</p><h2>A deliberate path from subscription to operating context.</h2></div>
        <ol><li><span>01</span><h3>Subscribe</h3><p>Begin with Enterprise membership for the organisation and its first 25 internal seats.</p></li><li><span>02</span><h3>Verify</h3><p>SolumPM verifies the subscription through signed Stripe events before access changes.</p></li><li><span>03</span><h3>Set up</h3><p>The Master Licence Holder claims the organisation and establishes its team, systems and controlled library.</p></li><li><span>04</span><h3>Operate</h3><p>Move into the protected command centre with a clear starting view of readiness and priority work.</p></li></ol>
      </section>
      <section className="public-control-strip"><div><p className="eyebrow">BUILT FOR ACCOUNTABLE GROWTH</p><h2>Internal seats are controlled. External access remains separate.</h2></div><p>SolumPM treats named internal staff as governed seats. Client and contractor portal access can be managed separately from Enterprise internal capacity as the workspace grows.</p></section>
    </main>
  );
}

export default function App() {
  const [view, setView] = useState<WorkspaceView>(() => resolveInitialWorkspaceView(window.location.pathname));
  const [activeStep, setActiveStep] = useState<OnboardingStepId>("organisation");
  const [draft, setDraft] = useState<OnboardingDraft>(emptyOnboardingDraft);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSavingSetup, setIsSavingSetup] = useState(false);
  const [organizationContext, setOrganizationContext] = useState<OrganizationContext | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<InternalSeatRole>("member");
  const [isInviting, setIsInviting] = useState(false);
  const [workTitle, setWorkTitle] = useState("");
  const [workType, setWorkType] = useState<"project" | "priority_action">("priority_action");
  const [workRisk, setWorkRisk] = useState<"standard" | "attention" | "critical">("standard");
  const [workOwner, setWorkOwner] = useState("");
  const [workDetail, setWorkDetail] = useState("");
  const [workDueDate, setWorkDueDate] = useState("");
  const [isCreatingWork, setIsCreatingWork] = useState(false);
  const [updatingWorkId, setUpdatingWorkId] = useState<string | null>(null);
  const [libraryTitle, setLibraryTitle] = useState("");
  const [libraryType, setLibraryType] = useState<"policy" | "procedure" | "form">("policy");
  const [libraryVersion, setLibraryVersion] = useState("0.1");
  const [libraryOwner, setLibraryOwner] = useState("");
  const [libraryReviewDate, setLibraryReviewDate] = useState("");
  const [isCreatingLibraryItem, setIsCreatingLibraryItem] = useState(false);
  const [updatingLibraryId, setUpdatingLibraryId] = useState<string | null>(null);
  const isSupabaseConfigured = hasSupabasePublicConfig();
  const progress = onboardingProgress(draft);
  const publicLanding = isPublicLandingPath(window.location.pathname);
  const verifiedSeatLimit = organizationContext?.claimed ? organizationContext.entitlement?.internal_seat_limit ?? 0 : 0;
  const occupiedSeats = organizationContext?.claimed ? organizationContext.occupiedSeats ?? 0 : 0;
  const verifiedSeatText = `${occupiedSeats} / ${verifiedSeatLimit}`;
  const subscriptionIsActive = organizationContext?.entitlement?.subscription_state === "active";
  const canManageSeats = canManageInternalSeats(organizationContext?.role);
  const workItems = organizationContext?.workItems ?? [];
  const libraryItems = organizationContext?.libraryItems ?? [];
  const projectCount = workItems.filter((item) => item.work_type === "project").length;
  const priorityCount = workItems.filter((item) => item.work_type === "priority_action" && item.status !== "complete").length;
  const activeLibraryCount = libraryItems.filter((item) => item.lifecycle_status === "active").length;
  const attentionWork = workItems.filter((item) => item.status !== "complete" && ["attention", "critical"].includes(item.risk_level));
  const upcomingWork = workItems.filter((item) => item.status !== "complete" && item.due_date && new Date(`${item.due_date}T00:00:00`).getTime() <= Date.now() + 14 * 86_400_000).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const reviewDueItems = libraryItems.filter((item) => item.lifecycle_status === "active" && item.review_date && new Date(`${item.review_date}T00:00:00`).getTime() <= Date.now() + 14 * 86_400_000).sort((a, b) => (a.review_date ?? "").localeCompare(b.review_date ?? ""));
  const inboxItems = [
    ...attentionWork.map((item) => ({ id: `risk-${item.id}`, type: "Risk signal", title: item.title, detail: `${item.risk_level} · ${item.owner_label || "Owner not assigned"}`, destination: "work" as WorkspaceView, tone: item.risk_level })),
    ...upcomingWork.map((item) => ({ id: `due-${item.id}`, type: "Due commitment", title: item.title, detail: item.due_date ? `Due ${new Date(`${item.due_date}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : "Date required", destination: "work" as WorkspaceView, tone: "attention" })),
    ...reviewDueItems.map((item) => ({ id: `review-${item.id}`, type: "Library review", title: item.title, detail: item.review_date ? `Review ${new Date(`${item.review_date}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : "Review date required", destination: "library" as WorkspaceView, tone: "standard" })),
  ].slice(0, 12);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(localDraftKey);
      if (saved) setDraft({ ...emptyOnboardingDraft, ...JSON.parse(saved) });
    } catch {
      window.localStorage.removeItem(localDraftKey);
    } finally {
      setDraftLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (draftLoaded) window.localStorage.setItem(localDraftKey, JSON.stringify(draft));
  }, [draft, draftLoaded]);

  useEffect(() => {
    if (hasCheckoutReturn(window.location.search)) {
      setNotice("Payment return received. Stripe will verify the subscription before SolumPM grants internal seats or organisation access.");
    }
  }, []);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    client.auth.getSession().then(({ data }) => setSignedInEmail(data.session?.user.email ?? null));
    const { data: authState } = client.auth.onAuthStateChange((_event, session) => {
      setSignedInEmail(session?.user.email ?? null);
    });
    return () => authState.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !signedInEmail) {
      setOrganizationContext(null);
      return;
    }
    client.functions.invoke("organization-context").then(({ data, error }) => {
      if (!error && data) setOrganizationContext(data as OrganizationContext);
    });
  }, [signedInEmail]);

  const updateDraft = (field: keyof OnboardingDraft) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setDraft((current) => ({ ...current, [field]: event.target.value }));
  };

  const jumpTo = (next: WorkspaceView) => {
    setNotice(null);
    setView(next);
  };

  const sendMagicLink = async () => {
    const client = getSupabaseClient();
    if (!client || !authEmail.trim()) {
      setNotice("Enter the Enterprise billing email to receive a secure sign-in link.");
      return;
    }
    setIsAuthenticating(true);
    const { error } = await client.auth.signInWithOtp({
      email: authEmail.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setIsAuthenticating(false);
    if (error) setNotice(error.message);
    else {
      setNotice("Secure sign-in link sent. Open the email, return here, then save the organisation setup.");
      setShowSignIn(false);
    }
  };

  const persistOrganisationSetup = async () => {
    const client = getSupabaseClient();
    if (!signedInEmail) {
      setShowSignIn(true);
      setNotice("Sign in with the Enterprise billing email before claiming the organisation setup.");
      return;
    }
    if (!isStepReady("launch", draft)) {
      setNotice("Complete the required setup areas before preparing the protected workspace.");
      return;
    }
    if (!client) return;
    setIsSavingSetup(true);
    const { data, error } = await client.functions.invoke("organization-setup", {
      body: { currentStep: 5, complete: true, setupData: draft },
    });
    setIsSavingSetup(false);
    if (error) setNotice(error.message);
    else setNotice(`${data.organization.name} has been claimed and its protected setup is recorded with ${data.internalSeatLimit} verified internal seats.`);
  };

  const inviteInternalUser = async () => {
    const client = getSupabaseClient();
    const normalised = normaliseSeatInvite({ email: inviteEmail, displayName: inviteName, roleName: inviteRole });
    if (!client || !isSeatInviteReady(normalised)) {
      setNotice("Enter a valid internal email and select Administrator or Member access.");
      return;
    }
    setIsInviting(true);
    const { error } = await client.functions.invoke("organization-seat-invite", { body: normalised });
    setIsInviting(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    const { data: refreshedContext, error: refreshError } = await client.functions.invoke("organization-context");
    if (!refreshError && refreshedContext) setOrganizationContext(refreshedContext as OrganizationContext);
    setInviteEmail("");
    setInviteName("");
    setInviteRole("member");
    setNotice(`${normalised.email} has been allocated an internal seat and can activate access with their Magic Link.`);
  };

  const createWorkItem = async () => {
    const client = getSupabaseClient();
    if (!client || workTitle.trim().length < 3) {
      setNotice("Enter a clear work title before recording it.");
      return;
    }
    setIsCreatingWork(true);
    const { error } = await client.functions.invoke("operational-work-items", { body: { workType, title: workTitle.trim(), riskLevel: workRisk, ownerLabel: workOwner.trim(), detail: workDetail.trim(), dueDate: workDueDate } });
    setIsCreatingWork(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    const { data: refreshedContext, error: refreshError } = await client.functions.invoke("organization-context");
    if (!refreshError && refreshedContext) setOrganizationContext(refreshedContext as OrganizationContext);
    setNotice(`${workType === "project" ? "Project" : "Priority action"} recorded in the organisation work register.`);
    setWorkTitle("");
    setWorkOwner("");
    setWorkDetail("");
    setWorkDueDate("");
    setWorkRisk("standard");
  };

  const updateWorkStatus = async (id: string, status: "planned" | "in_progress" | "blocked" | "complete") => {
    const client = getSupabaseClient();
    if (!client) return;
    setUpdatingWorkId(id);
    const { error } = await client.functions.invoke("operational-work-items", { method: "PATCH", body: { id, status } });
    setUpdatingWorkId(null);
    if (error) {
      setNotice(error.message);
      return;
    }
    const { data: refreshedContext, error: refreshError } = await client.functions.invoke("organization-context");
    if (!refreshError && refreshedContext) setOrganizationContext(refreshedContext as OrganizationContext);
    setNotice("Work status updated and recorded in the organisation activity feed.");
  };

  const refreshOrganizationContext = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    const { data, error } = await client.functions.invoke("organization-context");
    if (!error && data) setOrganizationContext(data as OrganizationContext);
  };

  const createLibraryItem = async () => {
    const client = getSupabaseClient();
    if (!client || libraryTitle.trim().length < 3) {
      setNotice("Enter a clear controlled-library title before recording it.");
      return;
    }
    setIsCreatingLibraryItem(true);
    const { error } = await client.functions.invoke("controlled-library-items", { body: { resourceType: libraryType, title: libraryTitle.trim(), currentVersion: libraryVersion.trim(), ownerLabel: libraryOwner.trim(), reviewDate: libraryReviewDate } });
    setIsCreatingLibraryItem(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    await refreshOrganizationContext();
    setLibraryTitle("");
    setLibraryVersion("0.1");
    setLibraryOwner("");
    setLibraryReviewDate("");
    setNotice("Controlled-library item recorded as a draft.");
  };

  const updateLibraryLifecycle = async (id: string, lifecycleStatus: "draft" | "active" | "retired") => {
    const client = getSupabaseClient();
    if (!client) return;
    setUpdatingLibraryId(id);
    const { error } = await client.functions.invoke("controlled-library-items", { method: "PATCH", body: { id, lifecycleStatus } });
    setUpdatingLibraryId(null);
    if (error) {
      setNotice(error.message);
      return;
    }
    await refreshOrganizationContext();
    setNotice("Controlled-library lifecycle updated and recorded in the activity feed.");
  };

  if (publicLanding) return <PublicLanding />;

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar" aria-label="SolumPM workspace navigation">
        <div className="brand-lockup">
          <a className="brand" href="/" onClick={() => jumpTo("command")}>Solum<span>PM</span></a>
          <p>Operational intelligence</p>
        </div>

        <nav className="workspace-nav" aria-label="Workspace sections">
          <button className={view === "command" ? "nav-item nav-item--active" : "nav-item"} onClick={() => jumpTo("command")}>
            <LayoutDashboard size={18} aria-hidden="true" /> Command centre
          </button>
          <button className={view === "onboarding" ? "nav-item nav-item--active" : "nav-item"} onClick={() => jumpTo("onboarding")}>
            <Building2 size={18} aria-hidden="true" /> Organisation setup
          </button>
          <button className={view === "seats" ? "nav-item nav-item--active" : "nav-item"} onClick={() => jumpTo("seats")}>
            <UsersRound size={18} aria-hidden="true" /> Internal seats
          </button>
          <button className={view === "work" ? "nav-item nav-item--active" : "nav-item"} onClick={() => jumpTo("work")}>
            <ListTodo size={18} aria-hidden="true" /> Work register
          </button>
          <button className={view === "library" ? "nav-item nav-item--active" : "nav-item"} onClick={() => jumpTo("library")}>
            <BookOpen size={18} aria-hidden="true" /> Controlled library
          </button>
          <button className={view === "reports" ? "nav-item nav-item--active" : "nav-item"} onClick={() => jumpTo("reports")}>
            <ChartNoAxesCombined size={18} aria-hidden="true" /> Decision brief
          </button>
          <button className={view === "inbox" ? "nav-item nav-item--active" : "nav-item"} onClick={() => jumpTo("inbox")}>
            <BellRing size={18} aria-hidden="true" /> Action inbox {inboxItems.length ? <em>{inboxItems.length}</em> : null}
          </button>
        </nav>

        <div className="sidebar-footnote">
          <LockKeyhole size={15} aria-hidden="true" />
          <span>Protected workspace foundation</span>
        </div>
      </aside>

      <section className="workspace-main">
        <header className="workspace-topbar">
          <div className="topbar-context">
            <span className={`status-dot ${isSupabaseConfigured ? "status-dot--ready" : ""}`} aria-hidden="true" />
            <span>{labelForStatus(isSupabaseConfigured)}</span>
          </div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Action inbox" onClick={() => jumpTo("inbox")}><BellRing size={18} /></button>
            <button className="profile-chip" onClick={() => setShowSignIn(true)}><CircleUserRound size={19} /> {signedInEmail ?? "Secure sign in"} <ChevronRight size={15} /></button>
          </div>
        </header>

        {notice && <div className="workspace-notice" role="status"><BadgeCheck size={18} /> {notice}</div>}
        {showSignIn && <section className="sign-in-panel" aria-label="Secure sign in"><div><p className="panel-kicker">MASTER LICENCE HOLDER ACCESS</p><h2>Claim your verified organisation securely.</h2><p>Use the billing email that completed the Enterprise subscription. SolumPM will send a secure Magic Link and matches it to the verified Stripe organisation.</p></div><div className="sign-in-controls"><input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="billing@organisation.com.au" /><button className="primary-button" onClick={sendMagicLink} disabled={isAuthenticating}>{isAuthenticating ? "Sending link…" : "Send secure link"}</button><button className="text-button" onClick={() => setShowSignIn(false)}>Cancel</button></div></section>}

        {view === "command" && (
          <section className="content-view command-centre" aria-labelledby="command-title">
            <div className="page-intro">
              <div>
                <p className="eyebrow">LIVE OPERATIONS · FOUNDATION</p>
                <h1 id="command-title">A calmer view of what needs your attention.</h1>
                <p className="lead-copy">{organizationContext?.organization?.name ? `${organizationContext.organization.name} is ready to move from setup into operational delivery as verified data arrives.` : "Start with organisation readiness, then move into operational delivery as confirmed subscription, team and project data arrives."}</p>
              </div>
              <button className="primary-button" onClick={() => jumpTo("onboarding")}>Set up organisation <ArrowUpRight size={17} /></button>
            </div>

            <section className="readiness-panel" aria-label="Organisation readiness">
              <div className="readiness-copy">
                <p className="panel-kicker">ORGANISATION READINESS</p>
                <h2>{progress.completed} of {progress.total} setup areas prepared</h2>
                <p>{subscriptionIsActive ? "Your verified entitlement is active. Complete onboarding to establish the protected operating context." : "Your setup draft is saved locally on this device until the first verified organisation entitlement is available."}</p>
              </div>
              <div className="readiness-progress" aria-label={`${progress.percentage}% onboarding progress`}>
                <span>{progress.percentage}%</span>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${progress.percentage}%` }} /></div>
              </div>
              <button className="outline-button" onClick={() => jumpTo("onboarding")}>Continue setup <ChevronRight size={16} /></button>
            </section>

            <section className="metric-grid" aria-label="Operational health">
              <article className="metric-card"><div className="metric-icon metric-icon--sage"><ClipboardList size={20} /></div><p>Projects</p><strong>{projectCount || "—"}</strong><span>{projectCount ? "Organisation-scoped work register" : "Awaiting initial project records"}</span></article>
              <article className="metric-card"><div className="metric-icon metric-icon--gold"><ShieldCheck size={20} /></div><p>Safety readiness</p><strong>—</strong><span>Awaiting WHS baseline</span></article>
              <article className="metric-card"><div className="metric-icon metric-icon--blue"><UsersRound size={20} /></div><p>Internal seats</p><strong>{verifiedSeatText}</strong><span>{subscriptionIsActive ? "Verified organisational capacity" : "Waiting for entitlement confirmation"}</span></article>
              <article className="metric-card"><div className="metric-icon metric-icon--rose"><Gauge size={20} /></div><p>Priority actions</p><strong>{priorityCount}</strong><span>{priorityCount ? "Open organisation actions" : "No verified operational events yet"}</span></article>
            </section>

            <section className="command-grid">
              <article className="surface-card activity-card">
                <div className="surface-heading"><div><p className="panel-kicker">UNIFIED ACTIVITY</p><h2>Operational feed</h2></div><button className="text-button">View all <ChevronRight size={15} /></button></div>
                <div className="activity-list">
                  {(organizationContext?.activity?.length ? organizationContext.activity.map((item) => ({ title: item.title, detail: item.detail ?? "Organisation activity recorded", icon: ClipboardList })) : activityPlaceholders).map(({ title, detail, icon: Icon }) => (
                    <div className="activity-item" key={title}><div className="activity-icon"><Icon size={17} /></div><div><h3>{title}</h3><p>{detail}</p></div><span>Pending</span></div>
                  ))}
                </div>
              </article>
              <article className="surface-card membership-card">
                <p className="panel-kicker">ENTERPRISE MEMBERSHIP</p>
                <h2>Access is controlled at the organisation level.</h2>
                <p className="membership-copy">A confirmed Enterprise subscription provides 25 named internal seats. Additional verified blocks add 25 seats at a time. Client and contractor portal accounts are managed separately.</p>
                <div className="membership-list"><span><CreditCard size={16} /> Stripe verification required</span><span><UsersRound size={16} /> Seat allocation protected</span><span><LockKeyhole size={16} /> Master Licence Holder controls</span></div>
                <button className="outline-button" onClick={() => jumpTo("seats")}>Review seat controls <ChevronRight size={16} /></button>
              </article>
            </section>
          </section>
        )}

        {view === "onboarding" && (
          <section className="content-view onboarding-view" aria-labelledby="onboarding-title">
            <div className="page-intro compact-intro"><div><p className="eyebrow">ORGANISATION ONBOARDING</p><h1 id="onboarding-title">Build a working operating context before opening the platform.</h1><p className="lead-copy">This guided setup collects the organisation, team, systems and controlled-library decisions required for a dependable first workspace.</p></div></div>
            <div className="onboarding-layout">
              <ol className="setup-rail" aria-label="Onboarding steps">
                {onboardingSteps.map((step, index) => {
                  const isActive = step.id === activeStep;
                  const isReady = isStepReady(step.id, draft);
                  return <li key={step.id}><button className={isActive ? "setup-step setup-step--active" : "setup-step"} onClick={() => setActiveStep(step.id)}><span className={isReady ? "step-number step-number--ready" : "step-number"}>{isReady ? <BadgeCheck size={14} /> : index + 1}</span><span><strong>{step.label}</strong><small>{step.helper}</small></span></button></li>;
                })}
              </ol>
              <article className="setup-card">
                {activeStep === "organisation" && <><div className="form-heading"><Building2 size={22} /><div><h2>Organisation profile</h2><p>Set the identity that anchors access, records and reporting.</p></div></div><div className="field-grid"><label>Organisation name<input value={draft.organisationName} onChange={updateDraft("organisationName")} placeholder="e.g. Solum PM Pty Ltd" /></label><label>Primary industry<select value={draft.industry} onChange={updateDraft("industry")}><option value="">Select an industry</option><option>Professional services</option><option>Construction and field operations</option><option>Health and community services</option><option>Other</option></select></label><label>Team size<select value={draft.teamSize} onChange={updateDraft("teamSize")}><option value="">Select team size</option><option>1–10</option><option>11–25</option><option>26–50</option><option>51+</option></select></label></div></>}
                {activeStep === "team" && <><div className="form-heading"><UsersRound size={22} /><div><h2>Leadership and access</h2><p>Identify the people accountable for organisation control and first-stage decisions.</p></div></div><div className="field-grid"><label>Master Licence Holder<input value={draft.masterLicenceHolder} onChange={updateDraft("masterLicenceHolder")} placeholder="Full name" /></label><label>Leadership contact email<input type="email" value={draft.leadershipContact} onChange={updateDraft("leadershipContact")} placeholder="leader@organisation.com.au" /></label></div><div className="callout"><ShieldCheck size={18} /><p>The Master Licence Holder will control the organisation’s internal-seat allocation and governance settings once the entitlement is active.</p></div></>}
                {activeStep === "systems" && <><div className="form-heading"><Gauge size={22} /><div><h2>Systems and records</h2><p>Document the first systems that SolumPM will organise or later integrate.</p></div></div><div className="field-grid"><label>Finance system<select value={draft.financeSystem} onChange={updateDraft("financeSystem")}><option>Not selected</option><option>Xero</option><option>MYOB</option><option>QuickBooks</option><option>Other / later</option></select></label><label>Project system<select value={draft.projectSystem} onChange={updateDraft("projectSystem")}><option>Not selected</option><option>Asana</option><option>Microsoft Project</option><option>Procore</option><option>Other / later</option></select></label><label>First project or operating area<input value={draft.firstProject} onChange={updateDraft("firstProject")} placeholder="e.g. Operations readiness" /></label></div><div className="callout"><LockKeyhole size={18} /><p>Credentials are never collected in this workspace. Verified connections are configured later in protected integration settings.</p></div></>}
                {activeStep === "library" && <><div className="form-heading"><ClipboardList size={22} /><div><h2>Controlled library</h2><p>Choose how your initial policies, procedures and forms will be structured.</p></div></div><div className="field-grid"><label>Starting library<select value={draft.controlledLibrary} onChange={updateDraft("controlledLibrary")}><option>Use SolumPM starter library</option><option>Import our existing controlled documents</option><option>Build a new controlled library</option></select></label></div><div className="callout"><ShieldCheck size={18} /><p>Version ownership, retirement and controlled-review workflows will be applied before operational forms are released.</p></div></>}
                {activeStep === "launch" && <><div className="form-heading"><BadgeCheck size={22} /><div><h2>Review and prepare launch</h2><p>Check that the essential operating context has been captured.</p></div></div><div className="review-list"><span className={isStepReady("organisation", draft) ? "review-item review-item--ready" : "review-item"}>Organisation profile</span><span className={isStepReady("team", draft) ? "review-item review-item--ready" : "review-item"}>Leadership and access</span><span className={isStepReady("systems", draft) ? "review-item review-item--ready" : "review-item"}>Systems and records</span><span className={isStepReady("library", draft) ? "review-item review-item--ready" : "review-item"}>Controlled library</span></div><div className="callout"><CalendarDays size={18} /><p>Once a verified Enterprise entitlement is present, this setup will be persisted to the organisation and made available to the Master Licence Holder.</p></div></>}
                <div className="form-footer"><span>{signedInEmail ? `Signed in as ${signedInEmail}` : "Draft saved locally"}</span><div><button className="outline-button" onClick={() => setNotice("Organisation setup draft saved on this device.")}>Save draft</button>{activeStep !== "launch" ? <button className="primary-button" onClick={() => setActiveStep(onboardingSteps[Math.min(onboardingSteps.findIndex((item) => item.id === activeStep) + 1, onboardingSteps.length - 1)].id)}>Continue <ChevronRight size={16} /></button> : <button className="primary-button" onClick={persistOrganisationSetup} disabled={isSavingSetup}>{isSavingSetup ? "Preparing…" : "Prepare workspace"} <ArrowUpRight size={16} /></button>}</div></div>
              </article>
            </div>
          </section>
        )}

        {view === "seats" && (
          <section className="content-view seats-view" aria-labelledby="seats-title">
            <div className="page-intro compact-intro"><div><p className="eyebrow">INTERNAL ACCESS ADMINISTRATION</p><h1 id="seats-title">Seat allocation stays inside verified organisational capacity.</h1><p className="lead-copy">Only named internal staff consume the Enterprise seat allowance. Client, contractor and limited external portal access are governed separately.</p></div><button className="primary-button" onClick={() => document.getElementById("invite-internal-user")?.scrollIntoView({ behavior: "smooth" })} disabled={!subscriptionIsActive || !canManageSeats}>Invite internal user <Plus size={17} /></button></div>
            <section className="seat-summary-grid"><article className="seat-summary seat-summary--primary"><p>Verified internal capacity</p><strong>{occupiedSeats} <span>/ {verifiedSeatLimit}</span></strong><small>{subscriptionIsActive ? "Active verified capacity" : "Waiting for confirmed Enterprise subscription"}</small></article><article className="seat-summary"><p>Enterprise allowance</p><strong>25</strong><small>Available after first confirmed subscription</small></article><article className="seat-summary"><p>Additional blocks</p><strong>+25</strong><small>Each verified add-on expands internal capacity</small></article></section>
            <article className="surface-card seat-policy-card"><div className="surface-heading"><div><p className="panel-kicker">ALLOCATION GUARDRAILS</p><h2>How SolumPM keeps access accountable</h2></div><LockKeyhole size={21} /></div><div className="guardrail-grid"><div><span>01</span><h3>Verified subscription</h3><p>Internal-seat invitations are blocked until the signed Stripe event confirms an active Enterprise entitlement.</p></div><div><span>02</span><h3>Named internal users</h3><p>Each invitation consumes one seat until the user is released. External portal users do not consume paid internal capacity.</p></div><div><span>03</span><h3>Controlled expansion</h3><p>Each verified Additional 25 Internal Seats subscription increases the organisational limit by exactly 25 seats.</p></div></div></article>
            <section className="seat-admin-grid">
              <article className="surface-card invite-seat-card" id="invite-internal-user"><div className="surface-heading"><div><p className="panel-kicker">ALLOCATE INTERNAL SEAT</p><h2>Invite a named team member</h2></div><UsersRound size={21} /></div><p className="membership-copy">Invited people occupy one verified internal seat. They activate access only after signing in with the invited email address.</p><div className="invite-grid"><label>Full name<input value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="e.g. Taylor Green" disabled={!canManageSeats || !subscriptionIsActive} /></label><label>Work email<input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="team.member@organisation.com.au" disabled={!canManageSeats || !subscriptionIsActive} /></label><label>Access role<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as InternalSeatRole)} disabled={!canManageSeats || !subscriptionIsActive}>{internalSeatRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></label></div><button className="primary-button" onClick={inviteInternalUser} disabled={!canManageSeats || !subscriptionIsActive || !isSeatInviteReady({ email: inviteEmail, roleName: inviteRole }) || isInviting}>{isInviting ? "Allocating…" : "Allocate internal seat"} <ArrowUpRight size={16} /></button>{!canManageSeats && <p className="seat-helper">Only the Master Licence Holder or an administrator can allocate internal seats.</p>}</article>
              <article className="surface-card seat-register-card"><div className="surface-heading"><div><p className="panel-kicker">CURRENT ALLOCATION</p><h2>Named internal access</h2></div><span className="seat-count-pill">{verifiedSeatText}</span></div><div className="seat-register">{organizationContext?.seats?.filter((seat) => seat.seat_status !== "released").map((seat) => <div className="seat-register-item" key={seat.id}><div><strong>{seat.display_name || seat.email}</strong><p>{seat.email} · {seat.role_name.replace("_", " ")}</p></div><span className={seat.seat_status === "active" ? "seat-status seat-status--active" : "seat-status"}>{seat.seat_status}</span></div>) ?? <p className="seat-helper">Sign in and claim the organisation to view allocated internal seats.</p>}</div></article>
            </section>
          </section>
        )}

        {view === "work" && (
          <section className="content-view work-view" aria-labelledby="work-title">
            <div className="page-intro compact-intro"><div><p className="eyebrow">ORGANISATION WORK REGISTER</p><h1 id="work-title">Record the work that turns readiness into operating rhythm.</h1><p className="lead-copy">Projects and priority actions are held within the verified organisation context, then surfaced in the command centre for accountable follow-through.</p></div></div>
            <section className="work-register-grid">
              <article className="surface-card work-entry-card"><div className="surface-heading"><div><p className="panel-kicker">NEW REGISTER ITEM</p><h2>Capture a project or priority action</h2></div><ListTodo size={21} /></div><div className="invite-grid"><label>Record type<select value={workType} onChange={(event) => setWorkType(event.target.value as "project" | "priority_action")} disabled={!organizationContext?.claimed}><option value="priority_action">Priority action</option><option value="project">Project</option></select></label><label>Risk signal<select value={workRisk} onChange={(event) => setWorkRisk(event.target.value as "standard" | "attention" | "critical")} disabled={!organizationContext?.claimed}><option value="standard">Standard</option><option value="attention">Attention</option><option value="critical">Critical</option></select></label><label>Title<input value={workTitle} onChange={(event) => setWorkTitle(event.target.value)} placeholder="e.g. Review operational readiness" disabled={!organizationContext?.claimed} /></label><label>Accountable owner<input value={workOwner} onChange={(event) => setWorkOwner(event.target.value)} placeholder="e.g. Operations Manager" disabled={!organizationContext?.claimed} /></label><label>Due date<input type="date" value={workDueDate} onChange={(event) => setWorkDueDate(event.target.value)} disabled={!organizationContext?.claimed} /></label><label>Operating note<input value={workDetail} onChange={(event) => setWorkDetail(event.target.value)} placeholder="Context, decision or next step" disabled={!organizationContext?.claimed} /></label></div><button className="primary-button" onClick={createWorkItem} disabled={!organizationContext?.claimed || isCreatingWork || workTitle.trim().length < 3}>{isCreatingWork ? "Recording…" : "Record work item"} <ArrowUpRight size={16} /></button>{!organizationContext?.claimed && <p className="seat-helper">Claim or activate your verified organisation access before recording work.</p>}</article>
              <article className="surface-card work-list-card"><div className="surface-heading"><div><p className="panel-kicker">CURRENT REGISTER</p><h2>Organisation work</h2></div><span className="seat-count-pill">{workItems.length}</span></div><div className="work-list">{workItems.length ? workItems.map((item) => <div className="work-item" key={item.id}><div><span className={`risk-dot risk-dot--${item.risk_level}`} /><strong>{item.title}</strong><p>{item.work_type.replace("_", " ")} · {item.owner_label || "Owner not assigned"}{item.due_date ? ` · Due ${new Date(`${item.due_date}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : ""}</p>{item.detail && <p className="work-detail">{item.detail}</p>}</div>{canManageSeats ? <select className="work-status-select" value={item.status} disabled={updatingWorkId === item.id} onChange={(event) => updateWorkStatus(item.id, event.target.value as "planned" | "in_progress" | "blocked" | "complete")}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="complete">Complete</option></select> : <span className="work-status">{item.status.replace("_", " ")}</span>}</div>) : <p className="seat-helper">No projects or priority actions have been recorded yet.</p>}</div></article>
            </section>
          </section>
        )}

        {view === "library" && (
          <section className="content-view library-view" aria-labelledby="library-title">
            <div className="page-intro compact-intro"><div><p className="eyebrow">CONTROLLED LIBRARY</p><h1 id="library-title">Keep the operating system’s evidence governed from the start.</h1><p className="lead-copy">Record policies, procedures and forms with a visible lifecycle, version and accountable owner before the library expands into controlled release workflows.</p></div></div>
            <section className="work-register-grid">
              <article className="surface-card work-entry-card"><div className="surface-heading"><div><p className="panel-kicker">NEW CONTROLLED ITEM</p><h2>Register a policy, procedure or form</h2></div><BookOpen size={21} /></div><div className="invite-grid"><label>Item type<select value={libraryType} onChange={(event) => setLibraryType(event.target.value as "policy" | "procedure" | "form")} disabled={!canManageSeats}><option value="policy">Policy</option><option value="procedure">Procedure</option><option value="form">Form</option></select></label><label>Current version<input value={libraryVersion} onChange={(event) => setLibraryVersion(event.target.value)} placeholder="0.1" disabled={!canManageSeats} /></label><label>Title<input value={libraryTitle} onChange={(event) => setLibraryTitle(event.target.value)} placeholder="e.g. Privacy and confidentiality policy" disabled={!canManageSeats} /></label><label>Accountable owner<input value={libraryOwner} onChange={(event) => setLibraryOwner(event.target.value)} placeholder="e.g. Governance lead" disabled={!canManageSeats} /></label><label>Review date<input type="date" value={libraryReviewDate} onChange={(event) => setLibraryReviewDate(event.target.value)} disabled={!canManageSeats} /></label></div><button className="primary-button" onClick={createLibraryItem} disabled={!canManageSeats || isCreatingLibraryItem || libraryTitle.trim().length < 3}>{isCreatingLibraryItem ? "Recording…" : "Record controlled item"} <ArrowUpRight size={16} /></button>{!canManageSeats && <p className="seat-helper">Only the Master Licence Holder or an administrator can register controlled-library items.</p>}</article>
              <article className="surface-card work-list-card"><div className="surface-heading"><div><p className="panel-kicker">REGISTER STATUS</p><h2>Library lifecycle</h2></div><span className="seat-count-pill">{libraryItems.length}</span></div><div className="work-list">{libraryItems.length ? libraryItems.map((item) => <div className="work-item" key={item.id}><div><span className={`risk-dot risk-dot--${item.lifecycle_status === "retired" ? "critical" : item.lifecycle_status === "draft" ? "attention" : "standard"}`} /><strong>{item.title}</strong><p>{item.resource_type} · v{item.current_version} · {item.owner_label || "Owner not assigned"}{item.review_date ? ` · Review ${new Date(`${item.review_date}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}` : ""}</p></div>{canManageSeats ? <select className="work-status-select" value={item.lifecycle_status} disabled={updatingLibraryId === item.id} onChange={(event) => updateLibraryLifecycle(item.id, event.target.value as "draft" | "active" | "retired")}><option value="draft">Draft</option><option value="active">Active</option><option value="retired">Retired</option></select> : <span className="work-status">{item.lifecycle_status}</span>}</div>) : <p className="seat-helper">No controlled-library items have been registered yet.</p>}</div></article>
            </section>
          </section>
        )}

        {view === "reports" && (
          <section className="content-view reports-view" aria-labelledby="reports-title">
            <div className="page-intro compact-intro"><div><p className="eyebrow">OPERATIONAL DECISION BRIEF</p><h1 id="reports-title">A concise view of what requires leadership attention.</h1><p className="lead-copy">This brief uses the verified organisation work register and controlled-library lifecycle. It does not fabricate live performance measures that have not yet been recorded.</p></div></div>
            <section className="report-metric-grid" aria-label="Decision brief metrics"><article className="report-metric"><p>Open priority actions</p><strong>{priorityCount}</strong><span>From the organisation work register</span></article><article className="report-metric"><p>Attention signals</p><strong>{attentionWork.length}</strong><span>Attention or critical open items</span></article><article className="report-metric"><p>Due in next 14 days</p><strong>{upcomingWork.length}</strong><span>Open dated commitments</span></article><article className="report-metric"><p>Active controlled items</p><strong>{activeLibraryCount}</strong><span>Policies, procedures and forms</span></article></section>
            <section className="report-detail-grid"><article className="surface-card report-list-card"><div className="surface-heading"><div><p className="panel-kicker">LEADERSHIP ATTENTION</p><h2>Open risk signals</h2></div><Gauge size={21} /></div><div className="work-list">{attentionWork.length ? attentionWork.map((item) => <div className="work-item" key={item.id}><div><span className={`risk-dot risk-dot--${item.risk_level}`} /><strong>{item.title}</strong><p>{item.risk_level} · {item.owner_label || "Owner not assigned"} · {item.status.replace("_", " ")}</p></div><button className="text-button" onClick={() => jumpTo("work")}>Review <ChevronRight size={15} /></button></div>) : <p className="seat-helper">No attention or critical work items have been recorded.</p>}</div></article><article className="surface-card report-list-card"><div className="surface-heading"><div><p className="panel-kicker">DELIVERY HORIZON</p><h2>Upcoming commitments</h2></div><CalendarDays size={21} /></div><div className="work-list">{upcomingWork.length ? upcomingWork.map((item) => <div className="work-item" key={item.id}><div><strong>{item.title}</strong><p>{item.due_date ? new Date(`${item.due_date}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long" }) : "No due date"} · {item.owner_label || "Owner not assigned"}</p></div><span className="work-status">{item.status.replace("_", " ")}</span></div>) : <p className="seat-helper">No open work items are due within the next 14 days.</p>}</div></article></section>
          </section>
        )}

        {view === "inbox" && (
          <section className="content-view inbox-view" aria-labelledby="inbox-title">
            <div className="page-intro compact-intro"><div><p className="eyebrow">ACCOUNTABILITY RADAR</p><h1 id="inbox-title">Keep the next operational decisions in one clear queue.</h1><p className="lead-copy">This inbox derives its content from verified organisation records. It does not create artificial alerts or conceal items that need a named owner.</p></div><span className="inbox-count">{inboxItems.length} open</span></div>
            <article className="surface-card inbox-card"><div className="surface-heading"><div><p className="panel-kicker">ACTION QUEUE</p><h2>Attention requiring follow-through</h2></div><BellRing size={21} /></div><div className="inbox-list">{inboxItems.length ? inboxItems.map((item) => <button className="inbox-item" key={item.id} onClick={() => jumpTo(item.destination)}><span className={`risk-dot risk-dot--${item.tone}`} /><span className="inbox-item-copy"><small>{item.type}</small><strong>{item.title}</strong><p>{item.detail}</p></span><ChevronRight size={18} /></button>) : <div className="inbox-empty"><BadgeCheck size={23} /><div><strong>No verified actions require immediate attention.</strong><p>Continue adding projects, priority actions and controlled-library review dates as operating records become available.</p></div></div>}</div></article>
          </section>
        )}
      </section>
    </main>
  );
}
