"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import {
  Archive,
  Box,
  Check,
  Clipboard,
  Copy,
  Download,
  ExternalLink,
  ImagePlus,
  PackageCheck,
  PencilLine,
  QrCode,
  RotateCcw,
  ShoppingBag,
  Tag,
  Trash2,
} from "lucide-react";
import {
  decisionLabel,
  formatEuro,
  formatPercent,
  opportunityMetrics,
  realizedProfit,
} from "@/lib/finance";
import { conditionLabels, generateListing, generateSku } from "@/lib/listing";
import { fileToCompressedDataUrl } from "@/lib/storage";
import type { Opportunity, Settings } from "@/lib/types";
import {
  Badge,
  Button,
  cn,
  decisionStyles,
  Field,
  Modal,
  ProductThumb,
  riskLabels,
  statusLabels,
  statusStyles,
} from "./ui";

export function ItemModal({
  item,
  settings,
  itemCount,
  onClose,
  onUpdate,
  onDelete,
}: {
  item: Opportunity | null;
  settings: Settings;
  itemCount: number;
  onClose: () => void;
  onUpdate: (item: Opportunity) => void;
  onDelete: (id: string) => void;
}) {
  const [tab, setTab] = useState<"decision" | "operations" | "listing">(
    item?.status === "received" || item?.status === "listed" ? "operations" : "decision",
  );
  const [qrCode, setQrCode] = useState("");
  const [copied, setCopied] = useState("");
  const [salePrice, setSalePrice] = useState(
    item?.actualSalePrice ?? item?.expectedSalePrice ?? 0,
  );

  useEffect(() => {
    if (!item?.sku) return;
    void QRCode.toDataURL(item.sku, {
      margin: 1,
      width: 220,
      color: { dark: "#111614", light: "#ffffff" },
    }).then(setQrCode);
  }, [item?.sku]);

  const metrics = useMemo(
    () => (item ? opportunityMetrics(item, settings) : null),
    [item, settings],
  );

  if (!item || !metrics) return null;

  const update = (patch: Partial<Opportunity>) => {
    onUpdate({ ...item, ...patch, updatedAt: new Date().toISOString() });
  };

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files).slice(0, Math.max(0, 12 - item.images.length));
    const encoded = await Promise.all(selected.map(fileToCompressedDataUrl));
    update({ images: [...item.images, ...encoded] });
  };

  const receiveItem = () => {
    update({
      status: "received",
      sku: item.sku || generateSku(item, itemCount + 1),
      storageBin: item.storageBin || "A-01",
    });
    setTab("operations");
  };

  const prepareListing = () => {
    update({ listingDraft: generateListing(item) });
    setTab("listing");
  };

  const markListed = () => {
    update({
      status: "listed",
      listedAt: item.listedAt || new Date().toISOString(),
      listingDraft: item.listingDraft || generateListing(item),
    });
  };

  const markSold = () => {
    update({
      status: "sold",
      soldAt: new Date().toISOString(),
      actualSalePrice: salePrice,
      storageBin: "",
    });
  };

  const copyText = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const listingPackage = () => ({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    draft: item.listingDraft,
    item: {
      sku: item.sku,
      brand: item.brand,
      model: item.model,
      category: item.category,
      size: item.size,
      condition: item.condition,
      colors: [],
    },
    images: item.images,
  });

  const downloadListingPackage = () => {
    if (!item.listingDraft) return;
    const blob = new Blob([JSON.stringify(listingPackage())], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${item.sku || "resaleos-annonce"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setCopied("package");
    window.setTimeout(() => setCopied(""), 1600);
  };

  const actualProfit = realizedProfit(item);

  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      title={item.title}
      eyebrow={`${item.brand || item.category || "ARTICLE"} · ${item.size || conditionLabels[item.condition]}`}
      wide
    >
      <div className="item-hero">
        <ProductThumb title={item.title} brand={item.brand} image={item.images[0]} size="lg" />
        <div className="item-hero-main">
          <div className="item-badges">
            <Badge className={statusStyles[item.status]}>{statusLabels[item.status]}</Badge>
            <Badge className={decisionStyles[metrics.decision]}>{decisionLabel(metrics.decision)}</Badge>
            <Badge className="badge-neutral">Risque {riskLabels[item.riskLevel].toLowerCase()}</Badge>
          </div>
          <div className="item-hero-metrics">
            <div><span>Profit attendu</span><strong className={metrics.expectedProfit >= 0 ? "positive" : "negative"}>{formatEuro(metrics.expectedProfit)}</strong></div>
            <div><span>ROI</span><strong>{formatPercent(metrics.roi)}</strong></div>
            <div><span>Coût complet</span><strong>{formatEuro(metrics.acquisitionCost)}</strong></div>
            <div><span>Vente P50</span><strong>{formatEuro(item.expectedSalePrice)}</strong></div>
          </div>
        </div>
        {item.sourceUrl ? (
          <a className="button button-secondary item-external-link" href={item.sourceUrl} target="_blank" rel="noreferrer">
            Ouvrir la source <ExternalLink size={15} />
          </a>
        ) : null}
      </div>

      <nav className="detail-tabs">
        <button className={cn(tab === "decision" && "active")} onClick={() => setTab("decision")}>Décision</button>
        <button className={cn(tab === "operations" && "active")} onClick={() => setTab("operations")}>Opérations</button>
        <button className={cn(tab === "listing" && "active")} onClick={() => setTab("listing")}>Annonce</button>
      </nav>

      {tab === "decision" ? (
        <div className="detail-grid">
          <section className="detail-card">
            <p className="section-kicker">SCÉNARIOS</p>
            <h3>Résultat corrigé du risque</h3>
            <div className="scenario-grid">
              <div><span>Prudent · P10</span><strong>{formatEuro(item.salePriceLow)}</strong><small>profit {formatEuro(metrics.lowProfit)}</small></div>
              <div className="featured"><span>Attendu · P50</span><strong>{formatEuro(item.expectedSalePrice)}</strong><small>profit {formatEuro(metrics.expectedProfit)}</small></div>
              <div><span>Haut · P90</span><strong>{formatEuro(item.salePriceHigh)}</strong><small>profit {formatEuro(metrics.highProfit)}</small></div>
            </div>
            <div className="detail-facts">
              <p><span>Vente sous 30 jours</span><b>{formatPercent(item.probability30d * 100)}</b></p>
              <p><span>Délai attendu</span><b>{item.estimatedDaysToSell} jours</b></p>
              <p><span>Prix d’achat maximal</span><b>{formatEuro(metrics.maxBuyPrice)}</b></p>
              <p><span>Efficacité du capital</span><b>{metrics.capitalEfficiency.toFixed(2).replace(".", ",")} %/jour</b></p>
            </div>
          </section>
          <section className="detail-card">
            <p className="section-kicker">INFORMATIONS</p>
            <h3>Article observé</h3>
            <dl className="definition-list">
              <div><dt>Marque</dt><dd>{item.brand || "Non renseignée"}</dd></div>
              <div><dt>Modèle</dt><dd>{item.model || "Non renseigné"}</dd></div>
              <div><dt>Catégorie</dt><dd>{item.category}</dd></div>
              <div><dt>Taille</dt><dd>{item.size || "Non renseignée"}</dd></div>
              <div><dt>État</dt><dd>{conditionLabels[item.condition]}</dd></div>
              <div><dt>Source</dt><dd>{item.source}</dd></div>
            </dl>
            {item.description ? <p className="observed-copy">{item.description}</p> : null}
            {item.notes ? <div className="note-box"><strong>Points à vérifier</strong><p>{item.notes}</p></div> : null}
          </section>
        </div>
      ) : null}

      {tab === "operations" ? (
        <div className="operations-layout">
          <section className="detail-card operations-timeline-card">
            <p className="section-kicker">FLUX</p>
            <h3>Prochaine action</h3>
            <div className="status-timeline">
              {[
                ["ordered", "Commande", ShoppingBag],
                ["received", "Réception", PackageCheck],
                ["listed", "Mise en vente", Tag],
                ["sold", "Vente", Check],
              ].map(([status, label, Icon], index) => {
                const order = ["watching", "ordered", "received", "listed", "sold"];
                const complete = order.indexOf(item.status) >= order.indexOf(status as string);
                return (
                  <div className={cn("timeline-step", complete && "complete")} key={status as string}>
                    <span><Icon size={16} /></span><div><b>{label as string}</b><small>{complete ? "Terminé" : index === 0 && item.status === "watching" ? "À confirmer" : "À venir"}</small></div>
                  </div>
                );
              })}
            </div>

            {item.status === "watching" ? (
              <div className="operation-action-box">
                <h4>Décision enregistrée</h4>
                <p>Confirme seulement après avoir réellement payé sur Vinted.</p>
                <div className="button-row"><Button onClick={() => update({ status: "ordered" })}><ShoppingBag size={16} /> Achat effectué</Button><Button variant="ghost" onClick={() => update({ status: "skipped" })}>Écarter</Button></div>
              </div>
            ) : null}

            {item.status === "ordered" ? (
              <div className="operation-action-box">
                <h4>Le colis est arrivé ?</h4>
                <p>Le système créera le SKU et l’emplacement initial.</p>
                <Button onClick={receiveItem}><PackageCheck size={16} /> Réceptionner l’article</Button>
              </div>
            ) : null}

            {item.status === "received" ? (
              <div className="operation-action-box">
                <h4>Article prêt à photographier</h4>
                <p>Ajoute les photos réelles et vérifie les défauts avant de générer l’annonce.</p>
                <Button onClick={prepareListing}><PencilLine size={16} /> Préparer l’annonce</Button>
              </div>
            ) : null}

            {item.status === "listed" ? (
              <div className="operation-action-box">
                <h4>Enregistrer la vente</h4>
                <Field label="Prix réellement encaissé">
                  <input className="input" type="number" min="0" step="0.01" value={salePrice} onChange={(event) => setSalePrice(Number(event.target.value))} />
                </Field>
                <Button onClick={markSold}><Check size={16} /> Marquer vendu</Button>
              </div>
            ) : null}

            {item.status === "sold" ? (
              <div className="operation-action-box operation-success">
                <h4>Vente terminée</h4>
                <p>Profit réalisé : <strong>{actualProfit === null ? "—" : formatEuro(actualProfit)}</strong></p>
                <Button variant="secondary" onClick={() => update({ status: "listed", soldAt: "", actualSalePrice: null })}><RotateCcw size={15} /> Annuler la vente</Button>
              </div>
            ) : null}
          </section>

          <section className="detail-card inventory-card">
            <div className="section-title-row">
              <div><p className="section-kicker">INVENTAIRE</p><h3>Identification physique</h3></div>
              <Archive size={20} />
            </div>
            <div className="field-grid field-grid-2">
              <Field label="SKU"><input className="input font-mono" value={item.sku} placeholder="Créé à la réception" onChange={(event) => update({ sku: event.target.value.toUpperCase() })} /></Field>
              <Field label="Bac"><input className="input font-mono" value={item.storageBin} placeholder="Ex. B-04" onChange={(event) => update({ storageBin: event.target.value.toUpperCase() })} /></Field>
            </div>
            <div className="qr-zone">
              {qrCode ? <div className="qr-image" style={{ backgroundImage: `url(${qrCode})` }} /> : <div className="qr-placeholder"><QrCode size={42} /><span>Disponible après réception</span></div>}
              <div><span>Référence interne</span><strong className="font-mono">{item.sku || "AUCUN SKU"}</strong><small>{item.storageBin ? `Rangé dans ${item.storageBin}` : "Aucun emplacement"}</small></div>
            </div>

            <div className="section-title-row photo-title">
              <div><p className="section-kicker">PHOTOS RÉELLES</p><h3>{item.images.length} image{item.images.length > 1 ? "s" : ""}</h3></div>
              <label className="button button-secondary compact-button"><ImagePlus size={15} /> Ajouter<input type="file" accept="image/*" multiple onChange={(event) => void addImages(event.target.files)} /></label>
            </div>
            <div className="detail-photo-grid">
              {item.images.map((image, index) => (
                <div className="detail-photo" style={{ backgroundImage: `url(${image})` }} key={`${image.slice(0, 24)}-${index}`}>
                  <button aria-label="Supprimer" onClick={() => update({ images: item.images.filter((_, imageIndex) => imageIndex !== index) })}><Trash2 size={13} /></button>
                </div>
              ))}
              {!item.images.length ? <div className="photo-empty"><ImagePlus size={22} /><p>Ajoute au minimum : vue générale, étiquette, taille et défauts.</p></div> : null}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "listing" ? (
        <div className="listing-layout">
          <section className="detail-card">
            <div className="section-title-row">
              <div><p className="section-kicker">BROUILLON</p><h3>Annonce factuelle</h3></div>
              <Button variant="secondary" onClick={prepareListing}><RotateCcw size={15} /> Régénérer</Button>
            </div>
            {!item.listingDraft ? (
              <div className="listing-empty"><Clipboard size={32} /><h4>Aucun brouillon</h4><p>Le texte sera généré uniquement à partir des informations que tu as saisies.</p><Button onClick={prepareListing}><PencilLine size={16} /> Générer l’annonce</Button></div>
            ) : (
              <div className="listing-editor">
                <Field label="Titre">
                  <div className="copy-field"><input className="input" value={item.listingDraft.title} onChange={(event) => update({ listingDraft: { ...item.listingDraft!, title: event.target.value } })} /><button onClick={() => void copyText("title", item.listingDraft!.title)}>{copied === "title" ? <Check size={15} /> : <Copy size={15} />}</button></div>
                </Field>
                <Field label="Description">
                  <div className="copy-field copy-textarea"><textarea className="textarea" rows={10} value={item.listingDraft.description} onChange={(event) => update({ listingDraft: { ...item.listingDraft!, description: event.target.value } })} /><button onClick={() => void copyText("description", item.listingDraft!.description)}>{copied === "description" ? <Check size={15} /> : <Copy size={15} />}</button></div>
                </Field>
                <div className="field-grid field-grid-2">
                  <Field label="Prix affiché"><input className="input" type="number" value={item.listingDraft.price} onChange={(event) => update({ listingDraft: { ...item.listingDraft!, price: Number(event.target.value) } })} /></Field>
                  <Field label="Taille du colis"><select className="input" value={item.listingDraft.packageSize} onChange={(event) => update({ listingDraft: { ...item.listingDraft!, packageSize: event.target.value as "Petit" | "Moyen" | "Grand" } })}><option>Petit</option><option>Moyen</option><option>Grand</option></select></Field>
                </div>
                <div className="listing-warning"><Box size={17} /><p>Vérifie systématiquement l’état, les défauts, l’authenticité et les mesures avant de copier dans Vinted.</p></div>
                <div className="button-row">
                  <Button variant="secondary" onClick={() => void copyText("all", `${item.listingDraft!.title}\n\n${item.listingDraft!.description}`)}>{copied === "all" ? <Check size={15} /> : <Copy size={15} />} Tout copier</Button>
                  <Button variant="secondary" onClick={downloadListingPackage}>{copied === "package" ? <Check size={15} /> : <Download size={15} />} Paquet assistant Vinted</Button>
                  {item.status !== "listed" && item.status !== "sold" ? <Button onClick={markListed}><Tag size={16} /> Marquer comme publié</Button> : null}
                </div>
              </div>
            )}
          </section>
          <aside className="detail-card listing-checklist">
            <p className="section-kicker">CONTRÔLE</p>
            <h3>Avant publication</h3>
            {[
              [item.images.length >= 4, "Au moins 4 vraies photos"],
              [Boolean(item.brand), "Marque vérifiée"],
              [Boolean(item.size), "Taille ou mesures renseignées"],
              [Boolean(item.description), "État observé décrit"],
              [item.salePriceLow > metrics.acquisitionCost, "Scénario prudent supérieur au coût"],
            ].map(([complete, label]) => <div className={cn("checklist-row", complete && "complete")} key={label as string}><span><Check size={13} /></span><p>{label as string}</p></div>)}
          </aside>
        </div>
      ) : null}

      <footer className="modal-footer item-footer">
        <Button variant="danger" onClick={() => { if (window.confirm("Supprimer définitivement cet article ?")) onDelete(item.id); }}><Trash2 size={15} /> Supprimer</Button>
        <Button variant="ghost" onClick={onClose}>Fermer</Button>
      </footer>
    </Modal>
  );
}
