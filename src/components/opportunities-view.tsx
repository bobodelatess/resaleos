"use client";

import { ArrowDownUp, Filter, PackageSearch, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { decisionLabel, formatEuro, formatPercent, opportunityMetrics } from "@/lib/finance";
import type { Opportunity, Settings } from "@/lib/types";
import { Badge, Button, decisionStyles, EmptyState, ProductThumb, statusLabels, statusStyles } from "./ui";

type SortKey = "score" | "profit" | "newest" | "price";

export function OpportunitiesView({
  items,
  settings,
  onNew,
  onOpen,
}: {
  items: Opportunity[];
  settings: Settings;
  onNew: () => void;
  onOpen: (item: Opportunity) => void;
}) {
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<"all" | "buy" | "negotiate" | "skip">("all");
  const [sort, setSort] = useState<SortKey>("score");

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items
      .filter((item) => item.status === "watching" || item.status === "skipped")
      .filter((item) => !query || `${item.title} ${item.brand} ${item.model} ${item.category}`.toLowerCase().includes(query))
      .filter((item) => decision === "all" || opportunityMetrics(item, settings).decision === decision)
      .sort((a, b) => {
        const am = opportunityMetrics(a, settings);
        const bm = opportunityMetrics(b, settings);
        if (sort === "score") return bm.score - am.score;
        if (sort === "profit") return bm.expectedProfit - am.expectedProfit;
        if (sort === "price") return a.purchasePrice - b.purchasePrice;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [decision, items, search, settings, sort]);

  const counts = items
    .filter((item) => item.status === "watching" || item.status === "skipped")
    .reduce(
      (acc, item) => {
        acc[opportunityMetrics(item, settings).decision] += 1;
        return acc;
      },
      { buy: 0, negotiate: 0, skip: 0 },
    );

  return (
    <div className="view-stack">
      <header className="view-header">
        <div><p className="eyebrow">DÉCISIONS D’ACHAT</p><h1>Opportunités</h1><p>Compare les opérations avec les mêmes critères, sans intuition trompeuse.</p></div>
        <Button onClick={onNew}><Plus size={17} /> Analyser une annonce</Button>
      </header>

      <section className="decision-summary-grid">
        <button className={decision === "buy" ? "active" : ""} onClick={() => setDecision(decision === "buy" ? "all" : "buy")}><span className="summary-dot summary-buy" /><div><strong>{counts.buy}</strong><small>À acheter</small></div></button>
        <button className={decision === "negotiate" ? "active" : ""} onClick={() => setDecision(decision === "negotiate" ? "all" : "negotiate")}><span className="summary-dot summary-negotiate" /><div><strong>{counts.negotiate}</strong><small>À négocier</small></div></button>
        <button className={decision === "skip" ? "active" : ""} onClick={() => setDecision(decision === "skip" ? "all" : "skip")}><span className="summary-dot summary-skip" /><div><strong>{counts.skip}</strong><small>À ignorer</small></div></button>
        <div className="summary-rule"><Filter size={17} /><p>Seuils : <b>{formatEuro(settings.minimumProfit)}</b> de profit et <b>{settings.minimumRoi} %</b> de ROI</p></div>
      </section>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-box"><Search size={16} /><input placeholder="Rechercher une marque, un modèle…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <div className="sort-control"><ArrowDownUp size={15} /><select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}><option value="score">Meilleur score</option><option value="profit">Plus gros profit</option><option value="newest">Plus récent</option><option value="price">Prix d’achat</option></select></div>
        </div>

        {rows.length ? (
          <div className="data-table-wrap">
            <table className="data-table opportunities-table">
              <thead><tr><th>Article</th><th>Achat complet</th><th>Revente P50</th><th>Profit</th><th>ROI</th><th>Score</th><th>Décision</th><th>État</th></tr></thead>
              <tbody>
                {rows.map((item) => {
                  const metrics = opportunityMetrics(item, settings);
                  return (
                    <tr key={item.id} onClick={() => onOpen(item)}>
                      <td><div className="table-product"><ProductThumb title={item.title} brand={item.brand} image={item.images[0]} /><div><strong>{item.title}</strong><span>{item.source} · {item.size || "taille ?"} · {new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span></div></div></td>
                      <td><strong>{formatEuro(metrics.acquisitionCost)}</strong><span className="table-subtext">article {formatEuro(item.purchasePrice)}</span></td>
                      <td><strong>{formatEuro(item.expectedSalePrice)}</strong><span className="table-subtext">{formatEuro(item.salePriceLow)} — {formatEuro(item.salePriceHigh)}</span></td>
                      <td><strong className={metrics.expectedProfit >= settings.minimumProfit ? "positive" : "negative"}>{formatEuro(metrics.expectedProfit)}</strong><span className="table-subtext">P10 {formatEuro(metrics.lowProfit)}</span></td>
                      <td><strong>{formatPercent(metrics.roi)}</strong><span className="table-subtext">{item.estimatedDaysToSell} jours</span></td>
                      <td><span className="score-chip">{metrics.score}</span></td>
                      <td><Badge className={decisionStyles[metrics.decision]}>{decisionLabel(metrics.decision)}</Badge></td>
                      <td><Badge className={statusStyles[item.status]}>{statusLabels[item.status]}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<PackageSearch size={28} />} title="Aucune opportunité ici" description="Modifie les filtres ou analyse une nouvelle annonce." action={<Button onClick={onNew}><Plus size={15} /> Nouvelle analyse</Button>} />
        )}
      </section>
    </div>
  );
}

