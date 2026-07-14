"use client";

import {
  ArrowRight,
  Banknote,
  Box,
  Clock3,
  PackageSearch,
  Plus,
  ScanLine,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  acquisitionCost,
  decisionLabel,
  formatEuro,
  formatPercent,
  opportunityMetrics,
  realizedProfit,
} from "@/lib/finance";
import type { Opportunity, Settings } from "@/lib/types";
import { Badge, Button, cn, decisionStyles, MiniBar, ProductThumb } from "./ui";

export function DashboardView({
  items,
  settings,
  onNew,
  onOpen,
  onNavigate,
}: {
  items: Opportunity[];
  settings: Settings;
  onNew: () => void;
  onOpen: (item: Opportunity) => void;
  onNavigate: (view: "opportunities" | "inventory" | "sales") => void;
}) {
  const active = items.filter((item) => ["ordered", "received", "listed"].includes(item.status));
  const watching = items
    .filter((item) => item.status === "watching")
    .sort((a, b) => opportunityMetrics(b, settings).score - opportunityMetrics(a, settings).score);
  const sold = items.filter((item) => item.status === "sold");
  const committed = active.reduce((sum, item) => sum + acquisitionCost(item), 0);
  const forecastProfit = active.reduce((sum, item) => sum + opportunityMetrics(item, settings).expectedProfit, 0);
  const realized = sold.reduce((sum, item) => sum + (realizedProfit(item) ?? 0), 0);
  const listed = items.filter((item) => item.status === "listed");
  const averageDays = active.length
    ? Math.round(active.reduce((sum, item) => sum + item.estimatedDaysToSell, 0) / active.length)
    : 0;

  const recentWeeks = Array.from({ length: 7 }, (_, index) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (6 - index) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const profit = sold
      .filter((item) => {
        const date = item.soldAt ? new Date(item.soldAt) : null;
        return date && date >= start && date < end;
      })
      .reduce((sum, item) => sum + (realizedProfit(item) ?? 0), 0);
    return {
      label: start.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      profit,
    };
  });
  const maxWeek = Math.max(20, ...recentWeeks.map((week) => week.profit));

  const pipeline = [
    { label: "Commandés", status: "ordered", tone: "purple" },
    { label: "À préparer", status: "received", tone: "amber" },
    { label: "En vente", status: "listed", tone: "green" },
  ].map((entry) => ({
    ...entry,
    count: items.filter((item) => item.status === entry.status).length,
    value: items.filter((item) => item.status === entry.status).reduce((sum, item) => sum + acquisitionCost(item), 0),
  }));

  return (
    <div className="view-stack">
      <section className="hero-banner">
        <div>
          <p className="eyebrow">CENTRE DE DÉCISION</p>
          <h1>Ton capital doit travailler,<br /><span>pas dormir dans des bacs.</span></h1>
          <p>Chaque achat est filtré par la marge, le risque et la vitesse de revente.</p>
        </div>
        <div className="hero-actions">
          <Button onClick={onNew}><Plus size={17} /> Analyser une annonce</Button>
          <Button variant="secondary" onClick={() => onNavigate("inventory")}><ScanLine size={17} /> Réceptionner</Button>
        </div>
        <div className="hero-orbit"><span /><i /><b /></div>
      </section>

      <section className="kpi-grid">
        <article className="kpi-card">
          <div className="kpi-icon kpi-icon-lime"><WalletCards size={19} /></div>
          <span>Capital engagé</span>
          <strong>{formatEuro(committed)}</strong>
          <small>{active.length} article{active.length > 1 ? "s" : ""} actif{active.length > 1 ? "s" : ""}</small>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon kpi-icon-green"><TrendingUp size={19} /></div>
          <span>Profit prévisionnel</span>
          <strong className="positive">{formatEuro(forecastProfit)}</strong>
          <small>corrigé des réserves de risque</small>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon kpi-icon-blue"><Banknote size={19} /></div>
          <span>Profit réalisé</span>
          <strong>{formatEuro(realized)}</strong>
          <small>{sold.length} vente{sold.length > 1 ? "s" : ""} enregistrée{sold.length > 1 ? "s" : ""}</small>
        </article>
        <article className="kpi-card">
          <div className="kpi-icon kpi-icon-amber"><Clock3 size={19} /></div>
          <span>Délai attendu</span>
          <strong>{averageDays || "—"}{averageDays ? " j" : ""}</strong>
          <small>objectif : {settings.targetHoldingDays} jours maximum</small>
        </article>
      </section>

      <section className="dashboard-grid-main">
        <article className="panel opportunity-panel">
          <header className="panel-header">
            <div><p className="section-kicker">À DÉCIDER</p><h2>Meilleures opportunités</h2></div>
            <button className="text-button" onClick={() => onNavigate("opportunities")}>Tout afficher <ArrowRight size={15} /></button>
          </header>
          <div className="opportunity-list">
            {watching.slice(0, 4).map((item) => {
              const metrics = opportunityMetrics(item, settings);
              return (
                <button className="opportunity-row" key={item.id} onClick={() => onOpen(item)}>
                  <ProductThumb title={item.title} brand={item.brand} image={item.images[0]} />
                  <div className="opportunity-row-main"><strong>{item.title}</strong><span>{item.source} · {item.size || "taille ?"} · risque {item.riskLevel === "low" ? "faible" : item.riskLevel === "moderate" ? "modéré" : "élevé"}</span></div>
                  <div className="opportunity-score"><span>Score</span><strong>{metrics.score}</strong></div>
                  <div className="opportunity-profit"><span>Profit</span><strong>{formatEuro(metrics.expectedProfit)}</strong></div>
                  <Badge className={decisionStyles[metrics.decision]}>{decisionLabel(metrics.decision)}</Badge>
                  <ArrowRight className="row-arrow" size={16} />
                </button>
              );
            })}
            {!watching.length ? (
              <div className="compact-empty"><PackageSearch size={25} /><div><strong>Aucune décision en attente</strong><p>Ajoute une annonce pour calculer son potentiel.</p></div><Button onClick={onNew}><Plus size={15} /> Ajouter</Button></div>
            ) : null}
          </div>
        </article>

        <article className="panel pipeline-panel">
          <header className="panel-header"><div><p className="section-kicker">FLUX PHYSIQUE</p><h2>Pipeline</h2></div><Box size={20} /></header>
          <div className="pipeline-summary">
            {pipeline.map((entry) => (
              <button key={entry.status} onClick={() => onNavigate("inventory")}>
                <span className={`pipeline-dot pipeline-${entry.tone}`} />
                <div><strong>{entry.count}</strong><small>{entry.label}</small></div>
                <b>{formatEuro(entry.value)}</b>
              </button>
            ))}
          </div>
          <div className="stock-health">
            <div className="section-title-row"><span>Santé du stock</span><b>{listed.length ? "Sous contrôle" : "À alimenter"}</b></div>
            <MiniBar value={Math.max(0, settings.targetHoldingDays - averageDays)} max={settings.targetHoldingDays} tone={averageDays <= settings.targetHoldingDays ? "green" : "amber"} />
            <p><ShieldCheck size={15} /> {active.filter((item) => item.estimatedDaysToSell > settings.targetHoldingDays).length} article{active.filter((item) => item.estimatedDaysToSell > settings.targetHoldingDays).length > 1 ? "s" : ""} au-delà de l’objectif de rotation.</p>
          </div>
        </article>
      </section>

      <section className="dashboard-grid-secondary">
        <article className="panel chart-panel">
          <header className="panel-header">
            <div><p className="section-kicker">ENCAISSÉ</p><h2>Profit réalisé par semaine</h2></div>
            <Badge className="badge-neutral">7 semaines</Badge>
          </header>
          <div className="bar-chart">
            {recentWeeks.map((week, index) => (
              <div className="bar-column" key={`${week.label}-${index}`}>
                <span className={cn(week.profit > 0 && "has-value")} style={{ height: `${Math.max(5, (week.profit / maxWeek) * 100)}%` }}><i>{week.profit > 0 ? formatEuro(week.profit) : ""}</i></span>
                <small>{week.label}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel rules-panel">
          <header className="panel-header"><div><p className="section-kicker">GARDE-FOUS</p><h2>Règles actives</h2></div></header>
          <div className="rules-list">
            <div><span>Profit minimal</span><strong>{formatEuro(settings.minimumProfit)}</strong></div>
            <div><span>ROI minimal</span><strong>{formatPercent(settings.minimumRoi)}</strong></div>
            <div><span>Vente à 30 jours</span><strong>≥ {formatPercent(settings.minimumProbability30d * 100)}</strong></div>
            <div><span>Rotation cible</span><strong>{settings.targetHoldingDays} jours</strong></div>
          </div>
          <button className="rule-callout" onClick={() => onNavigate("opportunities")}><ShieldCheck size={18} /><div><strong>Ne contourne pas tes propres seuils</strong><p>Un article “sympa” avec 6 € de marge reste une mauvaise allocation.</p></div></button>
        </article>
      </section>
    </div>
  );
}
