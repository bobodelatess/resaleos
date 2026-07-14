"use client";

import { Archive, Box, Clock3, PackageCheck, PackageOpen, Search, Tag } from "lucide-react";
import { useMemo, useState } from "react";
import { acquisitionCost, formatEuro, opportunityMetrics } from "@/lib/finance";
import type { Opportunity, OpportunityStatus, Settings } from "@/lib/types";
import { Badge, EmptyState, ProductThumb, statusLabels, statusStyles } from "./ui";

const filters: Array<{ key: "all" | OpportunityStatus; label: string }> = [
  { key: "all", label: "Tout le stock" },
  { key: "ordered", label: "À recevoir" },
  { key: "received", label: "À préparer" },
  { key: "listed", label: "En vente" },
];

export function InventoryView({
  items,
  settings,
  onOpen,
}: {
  items: Opportunity[];
  settings: Settings;
  onOpen: (item: Opportunity) => void;
}) {
  const [filter, setFilter] = useState<"all" | OpportunityStatus>("all");
  const [search, setSearch] = useState("");
  const stock = items.filter((item) => ["ordered", "received", "listed"].includes(item.status));
  const rows = useMemo(() => {
    const query = search.toLowerCase().trim();
    return stock
      .filter((item) => filter === "all" || item.status === filter)
      .filter((item) => !query || `${item.title} ${item.sku} ${item.storageBin}`.toLowerCase().includes(query))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [filter, search, stock]);

  const stockValue = stock.reduce((sum, item) => sum + acquisitionCost(item), 0);
  const expectedProfit = stock.reduce((sum, item) => sum + opportunityMetrics(item, settings).expectedProfit, 0);
  const atRisk = stock.filter((item) => item.estimatedDaysToSell > settings.targetHoldingDays).length;

  const nextAction = (item: Opportunity) => {
    if (item.status === "ordered") return { icon: PackageCheck, label: "Réceptionner" };
    if (item.status === "received") return { icon: PackageOpen, label: "Photographier" };
    return { icon: Tag, label: "Suivre la vente" };
  };

  return (
    <div className="view-stack">
      <header className="view-header">
        <div><p className="eyebrow">FLUX PHYSIQUE</p><h1>Inventaire</h1><p>Chaque article a un statut, une référence et une prochaine action.</p></div>
        <div className="header-stat"><Archive size={18} /><div><span>Valeur immobilisée</span><strong>{formatEuro(stockValue)}</strong></div></div>
      </header>

      <section className="inventory-stats">
        <div><span><Box size={17} /></span><p><small>Articles actifs</small><strong>{stock.length}</strong></p></div>
        <div><span><PackageOpen size={17} /></span><p><small>À préparer</small><strong>{stock.filter((item) => item.status === "received").length}</strong></p></div>
        <div><span><Tag size={17} /></span><p><small>En vente</small><strong>{stock.filter((item) => item.status === "listed").length}</strong></p></div>
        <div><span><Clock3 size={17} /></span><p><small>Rotation à risque</small><strong className={atRisk ? "warning" : "positive"}>{atRisk}</strong></p></div>
        <div className="inventory-profit"><small>Profit prévisionnel du stock</small><strong>{formatEuro(expectedProfit)}</strong></div>
      </section>

      <section className="panel inventory-panel">
        <div className="inventory-toolbar">
          <nav className="filter-tabs">{filters.map((entry) => <button className={filter === entry.key ? "active" : ""} key={entry.key} onClick={() => setFilter(entry.key)}>{entry.label}<span>{entry.key === "all" ? stock.length : stock.filter((item) => item.status === entry.key).length}</span></button>)}</nav>
          <div className="search-box"><Search size={16} /><input placeholder="Article, SKU ou bac…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        </div>

        {rows.length ? (
          <div className="inventory-grid">
            {rows.map((item) => {
              const metrics = opportunityMetrics(item, settings);
              const action = nextAction(item);
              const ActionIcon = action.icon;
              return (
                <button className="inventory-item-card" key={item.id} onClick={() => onOpen(item)}>
                  <div className="inventory-image-wrap">
                    <ProductThumb title={item.title} brand={item.brand} image={item.images[0]} size="lg" />
                    <Badge className={statusStyles[item.status]}>{statusLabels[item.status]}</Badge>
                  </div>
                  <div className="inventory-item-content">
                    <div><h3>{item.title}</h3><p>{item.brand || item.category} · {item.size || "taille non renseignée"}</p></div>
                    <div className="inventory-location">
                      <span><small>SKU</small><b className="font-mono">{item.sku || "À CRÉER"}</b></span>
                      <span><small>Bac</small><b className="font-mono">{item.storageBin || "—"}</b></span>
                    </div>
                    <div className="inventory-finance"><span><small>Coût</small><b>{formatEuro(metrics.acquisitionCost)}</b></span><span><small>Prix cible</small><b>{formatEuro(item.expectedSalePrice)}</b></span><span><small>Profit</small><b className="positive">{formatEuro(metrics.expectedProfit)}</b></span></div>
                    <div className="next-action"><ActionIcon size={15} /><span>{action.label}</span><i>→</i></div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<Box size={30} />} title="Aucun article dans cette étape" description="Les articles commandés apparaîtront automatiquement dans ton flux." />
        )}
      </section>
    </div>
  );
}

