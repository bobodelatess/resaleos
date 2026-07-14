"use client";

import { Banknote, CalendarDays, ReceiptText, ShoppingBag, TrendingUp } from "lucide-react";
import { acquisitionCost, formatEuro, formatPercent, realizedProfit } from "@/lib/finance";
import type { Opportunity } from "@/lib/types";
import { Badge, EmptyState, MiniBar, ProductThumb } from "./ui";

export function SalesView({
  items,
  onOpen,
}: {
  items: Opportunity[];
  onOpen: (item: Opportunity) => void;
}) {
  const sold = items
    .filter((item) => item.status === "sold")
    .sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime());
  const revenue = sold.reduce((sum, item) => sum + (item.actualSalePrice ?? 0), 0);
  const profit = sold.reduce((sum, item) => sum + (realizedProfit(item) ?? 0), 0);
  const invested = sold.reduce((sum, item) => sum + acquisitionCost(item), 0);
  const roi = invested ? (profit / invested) * 100 : 0;
  const averageTicket = sold.length ? revenue / sold.length : 0;
  const predictionError = sold.length
    ? sold.reduce((sum, item) => sum + Math.abs((item.actualSalePrice ?? 0) - item.expectedSalePrice), 0) / sold.length
    : 0;

  const brandProfits = Object.entries(
    sold.reduce<Record<string, number>>((acc, item) => {
      const key = item.brand || item.category || "Autre";
      acc[key] = (acc[key] ?? 0) + (realizedProfit(item) ?? 0);
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const maxBrandProfit = Math.max(1, ...brandProfits.map(([, value]) => value));

  return (
    <div className="view-stack">
      <header className="view-header">
        <div><p className="eyebrow">RÉSULTATS RÉELS</p><h1>Ventes</h1><p>Les hypothèses s’effacent ici : seuls les euros réellement encaissés comptent.</p></div>
        <Badge className="badge-green"><Banknote size={14} /> {formatEuro(profit)} de profit</Badge>
      </header>

      <section className="sales-kpis">
        <article><span><ReceiptText size={18} /></span><p><small>Chiffre d’affaires</small><strong>{formatEuro(revenue)}</strong></p></article>
        <article><span><TrendingUp size={18} /></span><p><small>Profit réalisé</small><strong className="positive">{formatEuro(profit)}</strong></p></article>
        <article><span><ShoppingBag size={18} /></span><p><small>Ticket moyen</small><strong>{formatEuro(averageTicket)}</strong></p></article>
        <article><span><CalendarDays size={18} /></span><p><small>ROI réalisé</small><strong>{formatPercent(roi)}</strong></p></article>
      </section>

      <section className="sales-layout">
        <article className="panel table-panel sales-table-panel">
          <header className="panel-header"><div><p className="section-kicker">HISTORIQUE</p><h2>Transactions terminées</h2></div><span className="muted-small">{sold.length} vente{sold.length > 1 ? "s" : ""}</span></header>
          {sold.length ? (
            <div className="data-table-wrap">
              <table className="data-table sales-table">
                <thead><tr><th>Article</th><th>Vendu le</th><th>Investi</th><th>Prévu</th><th>Encaissé</th><th>Profit</th></tr></thead>
                <tbody>{sold.map((item) => {
                  const itemProfit = realizedProfit(item) ?? 0;
                  return <tr key={item.id} onClick={() => onOpen(item)}><td><div className="table-product"><ProductThumb title={item.title} brand={item.brand} image={item.images[0]} /><div><strong>{item.title}</strong><span>{item.sku || item.brand || item.category}</span></div></div></td><td>{new Date(item.soldAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</td><td>{formatEuro(acquisitionCost(item))}</td><td>{formatEuro(item.expectedSalePrice)}</td><td><strong>{formatEuro(item.actualSalePrice ?? 0)}</strong></td><td><strong className={itemProfit >= 0 ? "positive" : "negative"}>{formatEuro(itemProfit)}</strong></td></tr>;
                })}</tbody>
              </table>
            </div>
          ) : <EmptyState icon={<ReceiptText size={30} />} title="Aucune vente enregistrée" description="Marque un article en vente comme vendu pour calculer le profit réel." />}
        </article>

        <aside className="sales-aside">
          <article className="panel accuracy-panel">
            <p className="section-kicker">CALIBRATION</p><h2>Qualité des estimations</h2>
            <div className="accuracy-value"><strong>{formatEuro(predictionError)}</strong><span>erreur moyenne sur le prix</span></div>
            <p>Cette valeur doit diminuer à mesure que tu accumules des ventes dans une même niche.</p>
          </article>
          <article className="panel brand-panel">
            <p className="section-kicker">PROFIT PAR MARQUE</p><h2>Ce qui fonctionne</h2>
            <div className="brand-profit-list">
              {brandProfits.length ? brandProfits.map(([brand, value]) => <div key={brand}><p><span>{brand}</span><b>{formatEuro(value)}</b></p><MiniBar value={Math.max(0, value)} max={maxBrandProfit} tone={value >= 0 ? "green" : "red"} /></div>) : <p className="muted-small">Pas encore assez de données.</p>}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}

