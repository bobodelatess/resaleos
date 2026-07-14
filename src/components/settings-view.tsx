"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  Database,
  Download,
  HardDrive,
  RotateCcw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { exportState, importState } from "@/lib/storage";
import type { AppState, Settings } from "@/lib/types";
import { Button, Field } from "./ui";

function SettingNumber({
  label,
  hint,
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  suffix,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <div className="suffix-input"><input className="input" type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />{suffix ? <span>{suffix}</span> : null}</div>
    </Field>
  );
}

export function SettingsView({
  state,
  onChangeSettings,
  onImport,
  onResetDemo,
  onClear,
}: {
  state: AppState;
  onChangeSettings: (settings: Settings) => void;
  onImport: (state: AppState) => void;
  onResetDemo: () => void;
  onClear: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const settings = state.settings;
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => onChangeSettings({ ...settings, [key]: value });

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const imported = await importState(file);
      onImport(imported);
      setMessage(`${imported.opportunities.length} article(s) restauré(s).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import impossible.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div className="view-stack">
      <header className="view-header">
        <div><p className="eyebrow">RÈGLES DU SYSTÈME</p><h1>Paramètres</h1><p>Fixe tes seuils une fois, puis laisse le calcul empêcher les achats impulsifs.</p></div>
        <div className="local-badge"><HardDrive size={16} /><span>Données locales</span><i /></div>
      </header>

      <section className="settings-layout">
        <div className="settings-main">
          <article className="panel settings-card">
            <header className="settings-card-header"><span><ShieldCheck size={20} /></span><div><h2>Seuils de décision</h2><p>Une recommandation “Acheter” doit satisfaire l’ensemble de ces critères.</p></div></header>
            <div className="settings-grid">
              <SettingNumber label="Profit minimal" hint="après réserve de risque" value={settings.minimumProfit} onChange={(value) => update("minimumProfit", value)} step={0.5} suffix="€" />
              <SettingNumber label="ROI minimal" hint="profit / coût complet" value={settings.minimumRoi} onChange={(value) => update("minimumRoi", value)} suffix="%" />
              <SettingNumber label="Vente sous 30 jours" hint="probabilité minimale" value={Math.round(settings.minimumProbability30d * 100)} onChange={(value) => update("minimumProbability30d", Math.min(1, Math.max(0, value / 100)))} max={100} suffix="%" />
              <SettingNumber label="Rotation cible" hint="durée maximale souhaitée" value={settings.targetHoldingDays} onChange={(value) => update("targetHoldingDays", value)} min={1} suffix="jours" />
              <SettingNumber label="Marge de négociation" hint="contre-offre suggérée" value={settings.negotiationBuffer} onChange={(value) => update("negotiationBuffer", value)} max={80} suffix="%" />
            </div>
          </article>

          <article className="panel settings-card">
            <header className="settings-card-header"><span><Database size={20} /></span><div><h2>Coûts par défaut</h2><p>Ils préremplissent une nouvelle analyse et restent modifiables article par article.</p></div></header>
            <div className="settings-grid">
              <SettingNumber label="Protection variable" hint="généralement 5 %" value={settings.buyerProtectionRate * 100} onChange={(value) => update("buyerProtectionRate", value / 100)} step={0.1} suffix="%" />
              <SettingNumber label="Protection fixe" value={settings.buyerProtectionFixed} onChange={(value) => update("buyerProtectionFixed", value)} step={0.1} suffix="€" />
              <SettingNumber label="Port entrant" value={settings.defaultShipping} onChange={(value) => update("defaultShipping", value)} step={0.01} suffix="€" />
              <SettingNumber label="Préparation" hint="nettoyage + emballage" value={settings.defaultPreparation} onChange={(value) => update("defaultPreparation", value)} step={0.1} suffix="€" />
              <SettingNumber label="Réserve de risque" hint="retours, défauts, pertes" value={settings.defaultRiskReserve} onChange={(value) => update("defaultRiskReserve", value)} step={0.5} suffix="€" />
            </div>
          </article>

          <article className="panel settings-card ai-settings-card">
            <header className="settings-card-header"><span><BrainCircuit size={20} /></span><div><h2>Connecteur IA</h2><p>Le logiciel actuel fonctionne sans clé et génère des textes factuels à partir de tes données.</p></div></header>
            <div className="ai-roadmap">
              <div className="complete"><span><Check size={14} /></span><p><strong>Disponible</strong> Détection locale de marque, taille et état à partir du texte.</p></div>
              <div className="complete"><span><Check size={14} /></span><p><strong>Disponible</strong> Génération d’annonce sans inventer d’information.</p></div>
              <div><span>3</span><p><strong>Prochaine connexion</strong> Analyse multimodale avec ton fournisseur d’IA, lorsque tu me préciseras lequel.</p></div>
            </div>
          </article>
        </div>

        <aside className="settings-aside">
          <article className="panel backup-card">
            <span className="backup-icon"><Database size={22} /></span>
            <h2>Sauvegarde</h2>
            <p>Les photos et données sont conservées dans ce navigateur. Exporte régulièrement une copie complète.</p>
            <div className="backup-stats"><div><span>Articles</span><strong>{state.opportunities.length}</strong></div><div><span>Photos</span><strong>{state.opportunities.reduce((sum, item) => sum + item.images.length, 0)}</strong></div></div>
            <Button className="full-button" onClick={() => exportState(state)}><Download size={16} /> Exporter en JSON</Button>
            <Button className="full-button" variant="secondary" onClick={() => fileInput.current?.click()}><Upload size={16} /> Importer une sauvegarde</Button>
            <input ref={fileInput} hidden type="file" accept="application/json" onChange={(event) => void handleImport(event.target.files?.[0])} />
            {message ? <p className="import-message">{message}</p> : null}
          </article>

          <article className="panel danger-card">
            <div><AlertTriangle size={19} /><h2>Jeu de données</h2></div>
            <p>Recharge les exemples pour tester l’interface, ou efface tout pour commencer réellement.</p>
            <Button className="full-button" variant="secondary" onClick={() => { if (window.confirm("Remplacer les données actuelles par la démonstration ?")) onResetDemo(); }}><RotateCcw size={15} /> Recharger la démo</Button>
            <Button className="full-button" variant="danger" onClick={() => { if (window.confirm("Effacer tous les articles ? Cette action est irréversible sans sauvegarde.")) onClear(); }}>Effacer tous les articles</Button>
          </article>
        </aside>
      </section>
    </div>
  );
}

