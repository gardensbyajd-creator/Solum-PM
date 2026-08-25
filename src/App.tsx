import { ArrowUpRight, CheckCircle2, Database, ShieldCheck, Sparkles } from "lucide-react";
import { hasSupabasePublicConfig } from "./lib/supabase";

const targetProject = "cvqualjefkorrwiqsxkv";

const foundationAreas = [
  {
    icon: Database,
    eyebrow: "Data foundation",
    title: "Supabase-ready client",
    body: "Public browser configuration is isolated from application code and ready for the target project only.",
  },
  {
    icon: ShieldCheck,
    eyebrow: "Scope boundary",
    title: "Fresh and isolated build",
    body: "SolumPM begins in its own repository and will not access the separate Solum Safety database project.",
  },
  {
    icon: Sparkles,
    eyebrow: "Product direction",
    title: "Workflow to define",
    body: "The first respiratory-project workflow can be shaped around the users, records and decisions that matter most.",
  },
];

export default function App() {
  const isSupabaseConfigured = hasSupabasePublicConfig();

  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="Primary">
        <a className="brand" href="/" aria-label="SolumPM home">Solum<span>PM</span></a>
        <div className="topbar-status">
          <span className={`status-dot ${isSupabaseConfigured ? "status-dot--ready" : ""}`} aria-hidden="true" />
          {isSupabaseConfigured ? "Supabase connected" : "Foundation mode"}
        </div>
      </nav>

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">SOLU MPM · FRESH PROJECT FOUNDATION</p>
          <h1 id="hero-title">A clear starting point for operational work that matters.</h1>
          <p className="hero-description">
            SolumPM is being established as an independent, Supabase-backed application. The first production workflow will be designed around your respiratory project’s real users and decisions.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="#foundation">View foundation <ArrowUpRight size={17} aria-hidden="true" /></a>
            <span className="quiet-note">Target project: {targetProject}</span>
          </div>
        </div>

        <aside className="status-panel" aria-label="Foundation status">
          <p className="panel-label">SETUP STATUS</p>
          <div className="status-headline"><CheckCircle2 size={25} aria-hidden="true" /> Repository isolated</div>
          <dl>
            <div><dt>Repository</dt><dd>gardensbyajd-creator/Solum-PM</dd></div>
            <div><dt>Supabase project</dt><dd>{targetProject}</dd></div>
            <div><dt>Data tables</dt><dd>Awaiting approved domain model</dd></div>
          </dl>
        </aside>
      </section>

      <section id="foundation" className="foundation" aria-labelledby="foundation-title">
        <div className="section-heading">
          <p className="eyebrow">FOUNDATION</p>
          <h2 id="foundation-title">Built deliberately, before features.</h2>
        </div>
        <div className="foundation-grid">
          {foundationAreas.map(({ icon: Icon, eyebrow, title, body }) => (
            <article className="foundation-card" key={title}>
              <Icon className="card-icon" size={22} aria-hidden="true" />
              <p className="card-eyebrow">{eyebrow}</p>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
