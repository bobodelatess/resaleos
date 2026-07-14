"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ImagePlus,
  Link2,
  ScanSearch,
  Sparkles,
  Trash2,
} from "lucide-react";
import { decisionLabel, formatEuro, formatPercent, opportunityMetrics, protectionFee } from "@/lib/finance";
import { conditionLabels, extractHints } from "@/lib/listing";
import { fileToCompressedDataUrl } from "@/lib/storage";
import type { GarmentAnalysis } from "@/lib/automation/schemas";
import type { Opportunity, OpportunityStatus, Settings } from "@/lib/types";
import { Badge, Button, cn, decisionStyles, Field, MiniBar, Modal, riskLabels } from "./ui";

function newOpportunity(settings: Settings): Opportunity {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    source: "Vinted",
    sourceUrl: "",
    title: "",
    brand: "",
    model: "",
    category: "Vêtement",
    size: "",
    condition: "very_good",
    description: "",
    purchasePrice: 20,
    protectionFee: protectionFee(20, settings),
    inboundShipping: settings.defaultShipping,
    preparationCost: settings.defaultPreparation,
    riskReserve: settings.defaultRiskReserve,
    expectedSalePrice: 45,
    salePriceLow: 35,
    salePriceHigh: 55,
    probability30d: 0.6,
    estimatedDaysToSell: 25,
    riskLevel: "moderate",
    status: "watching",
    notes: "",
    images: [],
    sku: "",
    storageBin: "",
    listingDraft: null,
    listedAt: "",
    soldAt: "",
    actualSalePrice: null,
    extraSaleCosts: 0,
  };
}

function NumberInput({
  value,
  onChange,
  min = 0,
  max,
  step = 0.01,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      className="input"
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

export function OpportunityModal({
  open,
  settings,
  onClose,
  onSave,
}: {
  open: boolean;
  settings: Settings;
  onClose: () => void;
  onSave: (item: Opportunity) => void;
}) {
  const [item, setItem] = useState<Opportunity>(() => newOpportunity(settings));
  const [step, setStep] = useState<1 | 2>(1);
  const [textHintMessage, setTextHintMessage] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const metrics = useMemo(
    () => opportunityMetrics(item, settings),
    [item, settings],
  );

  const update = <K extends keyof Opportunity>(key: K, value: Opportunity[K]) => {
    setItem((current) => ({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
  };

  const updatePurchasePrice = (value: number) => {
    setItem((current) => ({
      ...current,
      purchasePrice: value,
      protectionFee: protectionFee(value, settings),
      updatedAt: new Date().toISOString(),
    }));
  };

  const analyzeText = () => {
    const hints = extractHints(`${item.title}\n${item.description}`);
    setItem((current) => ({
      ...current,
      brand: hints.brand ?? current.brand,
      size: hints.size ?? current.size,
      condition: hints.condition ?? current.condition,
    }));
    const found = [hints.brand && "marque", hints.size && "taille", hints.condition && "état"].filter(Boolean);
    setTextHintMessage(
      found.length
        ? `${found.join(", ")} détecté${found.length > 1 ? "s" : ""}. Vérifie avant d’enregistrer.`
        : "Aucune information suffisamment fiable détectée : complète les champs manuellement.",
    );
  };

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    const remaining = Math.max(0, 8 - item.images.length);
    const selected = Array.from(files).slice(0, remaining);
    const encoded = await Promise.all(selected.map(fileToCompressedDataUrl));
    update("images", [...item.images, ...encoded]);
  };

  const analyzeWithAi = async () => {
    if (!item.images.length || aiLoading) return;
    setAiLoading(true);
    setAiMessage("Analyse visuelle en cours…");

    const requestAnalysis = (secret: string) =>
      fetch("/api/automation/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "x-resale-secret": secret } : {}),
        },
        body: JSON.stringify({
          images: item.images,
          context: [
            item.title && `Titre actuel : ${item.title}`,
            item.description && `Description actuelle : ${item.description}`,
            item.notes && `Notes : ${item.notes}`,
            `Prix d'achat envisagé : ${item.purchasePrice} €`,
          ]
            .filter(Boolean)
            .join("\n"),
        }),
      });

    try {
      let secret = window.localStorage.getItem("resaleos-automation-secret") || "";
      let response = await requestAnalysis(secret);
      if (response.status === 401) {
        const provided = window.prompt(
          "Saisis le secret d'automatisation configuré sur le serveur. Il restera uniquement dans ce navigateur.",
        );
        if (!provided) throw new Error("Secret d'automatisation requis.");
        secret = provided.trim();
        window.localStorage.setItem("resaleos-automation-secret", secret);
        response = await requestAnalysis(secret);
      }
      const body = (await response.json()) as {
        analysis?: GarmentAnalysis;
        error?: string;
      };
      if (!response.ok || !body.analysis) {
        throw new Error(body.error || "Analyse IA impossible.");
      }

      const analysis = body.analysis;
      const facts = analysis.inspection.visibleFacts.join(" · ");
      const defects = analysis.inspection.visibleDefects.join(" · ");
      const verifications = analysis.inspection.needsVerification.join(" · ");
      setItem((current) => ({
        ...current,
        title: analysis.identification.title || current.title,
        brand: analysis.identification.brand || current.brand,
        model: analysis.identification.model || current.model,
        category: analysis.identification.category || current.category,
        size: analysis.identification.size || current.size,
        condition: analysis.identification.condition,
        riskLevel: analysis.sourcing.riskLevel,
        description: facts || current.description,
        salePriceLow: analysis.resale.priceLow,
        expectedSalePrice: analysis.resale.expectedPrice,
        salePriceHigh: analysis.resale.priceHigh,
        probability30d: analysis.resale.probability30d,
        estimatedDaysToSell: analysis.resale.estimatedDaysToSell,
        notes: [
          defects && `Défauts visibles : ${defects}`,
          verifications && `À vérifier : ${verifications}`,
          analysis.sourcing.riskReasons.length
            ? `Risques : ${analysis.sourcing.riskReasons.join(" · ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        listingDraft: analysis.listing,
        updatedAt: new Date().toISOString(),
      }));
      setAiMessage(
        `Analyse terminée (${Math.round(analysis.overallConfidence * 100)} % de confiance). Tous les champs restent à vérifier sur l'article réel.`,
      );
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : "Analyse IA impossible.");
    } finally {
      setAiLoading(false);
    }
  };

  const finish = (status: OpportunityStatus) => {
    if (!item.title.trim()) return;
    onSave({ ...item, status, updatedAt: new Date().toISOString() });
    onClose();
  };

  const validFirstStep = item.title.trim().length >= 3 && item.purchasePrice >= 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Analyser une opportunité"
      eyebrow="NOUVELLE DÉCISION"
      wide
    >
      <div className="stepper" aria-label="Progression">
        <button className={cn(step === 1 && "active")} onClick={() => setStep(1)}>
          <span>1</span> Article et coûts
        </button>
        <i />
        <button className={cn(step === 2 && "active")} onClick={() => validFirstStep && setStep(2)}>
          <span>2</span> Décision
        </button>
      </div>

      {step === 1 ? (
        <div className="opportunity-form-layout">
          <div className="form-stack">
            <section className="form-section">
              <div className="section-title-row">
                <div>
                  <p className="section-kicker">SOURCE</p>
                  <h3>Annonce repérée</h3>
                </div>
                <Badge className="badge-neutral">Saisie locale</Badge>
              </div>
              <div className="field-grid field-grid-2">
                <Field label="Source">
                  <select className="input" value={item.source} onChange={(event) => update("source", event.target.value as Opportunity["source"])}>
                    <option>Vinted</option>
                    <option>Brocante</option>
                    <option>Friperie</option>
                    <option>Autre</option>
                  </select>
                </Field>
                <Field label="Lien de l’annonce" hint="facultatif">
                  <div className="input-with-icon">
                    <Link2 size={15} />
                    <input className="input" type="url" placeholder="https://www.vinted.fr/items/..." value={item.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} />
                  </div>
                </Field>
              </div>
              <Field label="Titre de l’annonce">
                <input className="input input-large" autoFocus placeholder="Ex. Veste Carhartt Detroit marron M" value={item.title} onChange={(event) => update("title", event.target.value)} />
              </Field>
              <Field label="Description observée" hint="colle le texte de l’annonce">
                <textarea className="textarea" rows={3} placeholder="État, matière, défauts annoncés, mesures…" value={item.description} onChange={(event) => update("description", event.target.value)} />
              </Field>
              <div className="inline-action-row">
                <Button variant="secondary" onClick={analyzeText}>
                  <ScanSearch size={16} /> Détecter marque, taille et état
                </Button>
                {textHintMessage ? <p className="helper-message"><Sparkles size={14} />{textHintMessage}</p> : null}
              </div>
            </section>

            <section className="form-section">
              <p className="section-kicker">IDENTIFICATION</p>
              <div className="field-grid field-grid-3">
                <Field label="Marque"><input className="input" value={item.brand} onChange={(event) => update("brand", event.target.value)} /></Field>
                <Field label="Modèle"><input className="input" value={item.model} onChange={(event) => update("model", event.target.value)} /></Field>
                <Field label="Taille"><input className="input" value={item.size} onChange={(event) => update("size", event.target.value)} /></Field>
                <Field label="Catégorie"><input className="input" value={item.category} onChange={(event) => update("category", event.target.value)} /></Field>
                <Field label="État">
                  <select className="input" value={item.condition} onChange={(event) => update("condition", event.target.value as Opportunity["condition"])}>
                    {Object.entries(conditionLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Risque">
                  <select className="input" value={item.riskLevel} onChange={(event) => update("riskLevel", event.target.value as Opportunity["riskLevel"])}>
                    {Object.entries(riskLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                  </select>
                </Field>
              </div>
            </section>

            <section className="form-section">
              <div className="section-title-row">
                <div><p className="section-kicker">PHOTOS</p><h3>Images de référence</h3></div>
                <span className="muted-small">8 maximum · compressées localement</span>
              </div>
              <div className="image-picker-row">
                {item.images.map((image, index) => (
                  <div className="image-preview" style={{ backgroundImage: `url(${image})` }} key={`${image.slice(0, 28)}-${index}`}>
                    <button type="button" aria-label="Supprimer l’image" onClick={() => update("images", item.images.filter((_, imageIndex) => imageIndex !== index))}><Trash2 size={14} /></button>
                  </div>
                ))}
                {item.images.length < 8 ? (
                  <label className="image-upload">
                    <ImagePlus size={20} /><span>Ajouter</span>
                    <input type="file" accept="image/*" multiple onChange={(event) => void addImages(event.target.files)} />
                  </label>
                ) : null}
              </div>
              <div className="inline-action-row">
                <Button
                  variant="secondary"
                  disabled={!item.images.length || aiLoading}
                  onClick={() => void analyzeWithAi()}
                >
                  <Sparkles size={16} />
                  {aiLoading
                    ? "Analyse des photos…"
                    : `Analyser ${item.images.length || "les"} photo${item.images.length > 1 ? "s" : ""} avec l’IA`}
                </Button>
                {aiMessage ? <p className="helper-message"><Sparkles size={14} />{aiMessage}</p> : null}
              </div>
            </section>
          </div>

          <aside className="cost-panel">
            <div className="cost-panel-head">
              <p className="section-kicker">COÛT COMPLET</p>
              <strong>{formatEuro(metrics.acquisitionCost)}</strong>
            </div>
            <div className="field-grid field-grid-2 compact-fields">
              <Field label="Prix article"><NumberInput value={item.purchasePrice} onChange={updatePurchasePrice} /></Field>
              <Field label="Protection"><NumberInput value={item.protectionFee} onChange={(value) => update("protectionFee", value)} /></Field>
              <Field label="Port entrant"><NumberInput value={item.inboundShipping} onChange={(value) => update("inboundShipping", value)} /></Field>
              <Field label="Préparation"><NumberInput value={item.preparationCost} onChange={(value) => update("preparationCost", value)} /></Field>
            </div>
            <div className="cost-breakdown">
              <span><i style={{ width: `${Math.min(100, (item.purchasePrice / Math.max(1, metrics.acquisitionCost)) * 100)}%` }} /></span>
              <p><small>Article</small><b>{formatEuro(item.purchasePrice)}</b></p>
              <p><small>Frais + port + préparation</small><b>{formatEuro(metrics.acquisitionCost - item.purchasePrice)}</b></p>
            </div>
            <div className="cost-note"><Sparkles size={15} /><p>La protection est calculée avec tes réglages. Tu peux la corriger selon le total affiché par Vinted.</p></div>
          </aside>
        </div>
      ) : (
        <div className="decision-layout">
          <section className="decision-inputs form-section">
            <div className="section-title-row">
              <div><p className="section-kicker">REVENTE</p><h3>Hypothèse de sortie</h3></div>
              <span className="muted-small">Utilise des prix réellement vendables</span>
            </div>
            <div className="field-grid field-grid-3">
              <Field label="Prix prudent P10"><NumberInput value={item.salePriceLow} onChange={(value) => update("salePriceLow", value)} /></Field>
              <Field label="Prix attendu P50"><NumberInput value={item.expectedSalePrice} onChange={(value) => update("expectedSalePrice", value)} /></Field>
              <Field label="Prix haut P90"><NumberInput value={item.salePriceHigh} onChange={(value) => update("salePriceHigh", value)} /></Field>
              <Field label="Vente sous 30 jours"><NumberInput min={0} max={100} step={1} value={Math.round(item.probability30d * 100)} onChange={(value) => update("probability30d", Math.min(1, Math.max(0, value / 100)))} /></Field>
              <Field label="Délai attendu" hint="jours"><NumberInput min={1} max={365} step={1} value={item.estimatedDaysToSell} onChange={(value) => update("estimatedDaysToSell", value)} /></Field>
              <Field label="Réserve de risque"><NumberInput value={item.riskReserve} onChange={(value) => update("riskReserve", value)} /></Field>
            </div>
            <Field label="Notes de décision" hint="défauts à vérifier, questions au vendeur…">
              <textarea className="textarea" rows={4} value={item.notes} onChange={(event) => update("notes", event.target.value)} />
            </Field>
            <div className="probability-row">
              <span>Probabilité de vente sous 30 jours</span>
              <b>{formatPercent(item.probability30d * 100)}</b>
              <MiniBar value={item.probability30d} max={1} tone={item.probability30d >= settings.minimumProbability30d ? "green" : "amber"} />
            </div>
          </section>

          <aside className={cn("decision-card", decisionStyles[metrics.decision])}>
            <div className="score-ring" style={{ "--score": `${metrics.score * 3.6}deg` } as React.CSSProperties}>
              <span><strong>{metrics.score}</strong><small>/100</small></span>
            </div>
            <p className="section-kicker">RECOMMANDATION</p>
            <h3>{decisionLabel(metrics.decision)}</h3>
            <p className="decision-summary">
              {metrics.decision === "buy"
                ? "La marge, la vitesse et le scénario prudent passent tes seuils."
                : metrics.decision === "negotiate"
                  ? `L’opération devient intéressante autour de ${formatEuro(metrics.negotiationTarget)}.`
                  : "La marge corrigée du risque est insuffisante pour immobiliser ton capital."}
            </p>
            <div className="decision-metrics">
              <div><span>Profit attendu</span><strong>{formatEuro(metrics.expectedProfit)}</strong></div>
              <div><span>ROI</span><strong>{formatPercent(metrics.roi)}</strong></div>
              <div><span>Fourchette profit</span><strong>{formatEuro(metrics.lowProfit)} — {formatEuro(metrics.highProfit)}</strong></div>
              <div><span>Prix d’achat max.</span><strong>{formatEuro(metrics.maxBuyPrice)}</strong></div>
            </div>
            <div className="threshold-checks">
              <span className={metrics.expectedProfit >= settings.minimumProfit ? "pass" : "fail"}><Check size={13} /> Profit ≥ {formatEuro(settings.minimumProfit)}</span>
              <span className={metrics.roi >= settings.minimumRoi ? "pass" : "fail"}><Check size={13} /> ROI ≥ {settings.minimumRoi} %</span>
              <span className={metrics.lowProfit >= 0 ? "pass" : "fail"}><Check size={13} /> Scénario prudent positif</span>
            </div>
          </aside>
        </div>
      )}

      <footer className="modal-footer">
        <Button variant="ghost" onClick={step === 1 ? onClose : () => setStep(1)}>{step === 1 ? "Annuler" : "Retour"}</Button>
        <div className="footer-actions">
          {step === 1 ? (
            <Button disabled={!validFirstStep} onClick={() => setStep(2)}>Calculer la décision <ArrowRight size={16} /></Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => finish(metrics.decision === "skip" ? "skipped" : "watching")}>Enregistrer</Button>
              {metrics.decision !== "skip" ? <Button onClick={() => finish("ordered")}><Check size={16} /> Achat effectué</Button> : null}
            </>
          )}
        </div>
      </footer>
    </Modal>
  );
}
