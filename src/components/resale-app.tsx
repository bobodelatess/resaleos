"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  CloudOff,
  LayoutDashboard,
  Menu,
  PackageSearch,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  X,
} from "lucide-react";
import { createDemoState, createEmptyState } from "@/lib/demo-data";
import { loadState, saveState } from "@/lib/storage";
import type { AppState, Opportunity, Settings } from "@/lib/types";
import { DashboardView } from "./dashboard-view";
import { InventoryView } from "./inventory-view";
import { ItemModal } from "./item-modal";
import { OpportunitiesView } from "./opportunities-view";
import { OpportunityModal } from "./opportunity-modal";
import { SalesView } from "./sales-view";
import { SettingsView } from "./settings-view";
import { Button, cn } from "./ui";

export type AppView = "dashboard" | "opportunities" | "inventory" | "sales" | "settings";

const navItems: Array<{
  key: AppView;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: "dashboard", label: "Vue d’ensemble", icon: LayoutDashboard },
  { key: "opportunities", label: "Opportunités", icon: PackageSearch },
  { key: "inventory", label: "Inventaire", icon: Boxes },
  { key: "sales", label: "Ventes", icon: BarChart3 },
  { key: "settings", label: "Paramètres", icon: SettingsIcon },
];

export function ResaleApp() {
  const [state, setState] = useState<AppState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<AppView>("dashboard");
  const [newOpen, setNewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;
    void loadState().then((stored) => {
      if (!active) return;
      setState(stored ?? createDemoState());
      setHydrated(true);
    });
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !state) return;
    const timer = window.setTimeout(() => {
      setSaveStatus("saving");
      void saveState(state).then(() => setSaveStatus("saved"));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [hydrated, state]);

  const selected = useMemo(
    () => state?.opportunities.find((item) => item.id === selectedId) ?? null,
    [selectedId, state?.opportunities],
  );

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const updateItem = (item: Opportunity) => {
    setState((current) =>
      current
        ? {
            ...current,
            opportunities: current.opportunities.map((entry) =>
              entry.id === item.id ? item : entry,
            ),
          }
        : current,
    );
    notify("Article mis à jour");
  };

  const addItem = (item: Opportunity) => {
    setState((current) =>
      current
        ? { ...current, opportunities: [item, ...current.opportunities] }
        : current,
    );
    notify(item.status === "ordered" ? "Achat ajouté au flux" : "Analyse enregistrée");
  };

  const deleteItem = (id: string) => {
    setState((current) =>
      current
        ? {
            ...current,
            opportunities: current.opportunities.filter((item) => item.id !== id),
          }
        : current,
    );
    setSelectedId(null);
    notify("Article supprimé");
  };

  const changeSettings = (settings: Settings) => {
    setState((current) => (current ? { ...current, settings } : current));
  };

  const navigate = (next: AppView) => {
    setView(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!state) {
    return (
      <main className="loading-screen">
        <div className="loading-brand"><span><CircleDollarSign size={22} /></span><strong>ResaleOS</strong></div>
        <div className="loading-line"><i /></div>
        <p>Préparation de ton espace local…</p>
      </main>
    );
  }

  const pageLabel = navItems.find((item) => item.key === view)?.label ?? "ResaleOS";
  const alerts = state.opportunities.filter(
    (item) => item.status === "received" || (item.status === "listed" && item.estimatedDaysToSell > state.settings.targetHoldingDays),
  ).length;

  return (
    <div className="app-shell">
      <aside className={cn("sidebar", mobileNav && "sidebar-open")}>
        <div className="brand-lockup">
          <span><CircleDollarSign size={23} /></span>
          <div><strong>ResaleOS</strong><small>VINTED OPERATING SYSTEM</small></div>
          <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Fermer le menu"><X size={19} /></button>
        </div>

        <button className="workspace-switcher">
          <span>RC</span><div><strong>Mon activité</strong><small>Compte local</small></div><ChevronDown size={15} />
        </button>

        <nav className="sidebar-nav">
          <p>ESPACE DE TRAVAIL</p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const count = item.key === "opportunities"
              ? state.opportunities.filter((entry) => entry.status === "watching").length
              : item.key === "inventory"
                ? state.opportunities.filter((entry) => ["ordered", "received", "listed"].includes(entry.status)).length
                : 0;
            return (
              <button className={cn(view === item.key && "active")} key={item.key} onClick={() => navigate(item.key)}>
                <Icon size={18} /><span>{item.label}</span>{count ? <b>{count}</b> : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-pro-card">
          <span><CloudOff size={18} /></span>
          <strong>Mode sans Vinted Pro</strong>
          <p>Saisie, calcul, stock et annonces fonctionnent déjà. Le connecteur API viendra ensuite.</p>
          <div><i style={{ width: "72%" }} /><span /></div>
          <small>7 modules sur 9 actifs</small>
        </div>

        <footer className="sidebar-footer">
          <span className="status-dot" />
          <div><strong>{saveStatus === "saving" ? "Sauvegarde…" : "Sauvegardé localement"}</strong><small>Aucune donnée envoyée</small></div>
        </footer>
      </aside>

      {mobileNav ? <button className="mobile-overlay" onClick={() => setMobileNav(false)} aria-label="Fermer le menu" /> : null}

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Ouvrir le menu"><Menu size={20} /></button>
            <div><span>{pageLabel}</span><small>{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</small></div>
          </div>
          <div className="topbar-actions">
            <button className="global-search" onClick={() => navigate("opportunities")}><Search size={16} /><span>Rechercher</span><kbd>⌘ K</kbd></button>
            <button className="notification-button" aria-label={`${alerts} alertes`} onClick={() => navigate("inventory")}><Bell size={18} />{alerts ? <i>{alerts}</i> : null}</button>
            <Button onClick={() => setNewOpen(true)}><Plus size={16} /> Nouvelle analyse</Button>
          </div>
        </header>

        <main className="content-area">
          {view === "dashboard" ? <DashboardView items={state.opportunities} settings={state.settings} onNew={() => setNewOpen(true)} onOpen={(item) => setSelectedId(item.id)} onNavigate={navigate} /> : null}
          {view === "opportunities" ? <OpportunitiesView items={state.opportunities} settings={state.settings} onNew={() => setNewOpen(true)} onOpen={(item) => setSelectedId(item.id)} /> : null}
          {view === "inventory" ? <InventoryView items={state.opportunities} settings={state.settings} onOpen={(item) => setSelectedId(item.id)} /> : null}
          {view === "sales" ? <SalesView items={state.opportunities} onOpen={(item) => setSelectedId(item.id)} /> : null}
          {view === "settings" ? <SettingsView state={state} onChangeSettings={changeSettings} onImport={(next) => { setState(next); notify("Sauvegarde restaurée"); }} onResetDemo={() => { setState(createDemoState()); notify("Démonstration rechargée"); }} onClear={() => { setState(createEmptyState()); notify("Données effacées"); }} /> : null}
        </main>

        <nav className="mobile-bottom-nav">
          {navItems.slice(0, 4).map((item) => { const Icon = item.icon; return <button className={view === item.key ? "active" : ""} key={item.key} onClick={() => navigate(item.key)}><Icon size={19} /><span>{item.label === "Vue d’ensemble" ? "Accueil" : item.label}</span></button>; })}
        </nav>
      </div>

      {newOpen ? <OpportunityModal open settings={state.settings} onClose={() => setNewOpen(false)} onSave={addItem} /> : null}
      {selected ? <ItemModal key={selected.id} item={selected} settings={state.settings} itemCount={state.opportunities.length} onClose={() => setSelectedId(null)} onUpdate={updateItem} onDelete={deleteItem} /> : null}

      {toast ? <div className="toast"><Sparkles size={15} />{toast}</div> : null}
    </div>
  );
}
