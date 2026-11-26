import { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Home,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import SearchableSelect from '@components/SearchableSelect';
import { formatMinutesToDuration, type GeoDailySummary } from '@lib/geolocParser';
import {
  computePointageStatus,
  computeUsefulDayMetrics,
  parseHHMMToMin,
  type DayAnnotationState,
  type DriverPointageEntry,
} from '@generated/server/geolocDetails';
import { cn } from '@lib/utils';

interface GeolocDayDetailCardProps {
  day: GeoDailySummary;
  defaultDriverName: string;
  employeeOptions: string[];
  annotation: DayAnnotationState;
  isOpen: boolean;
  saving: boolean;
  onToggleOpen: () => void;
  onChangeAnnotation: (next: DayAnnotationState) => void;
  onSaveDayToMonday: () => void;
}

const kmFmt = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;

const DELTA_PRESET_MINUTES = [
  15, 30, 45, 60, 75, 90, 105, 120, 150, 180,
  -15, -30, -45, -60, -75, -90, -105, -120, -150, -180,
];

function formatDeltaLabel(min: number): string {
  if (min === 0) return '0 min (Aucun écart)';
  const sign = min > 0 ? '+' : '-';
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const hPart = h > 0 ? ` (${sign}${h}h${m > 0 ? String(m).padStart(2, '0') : ''})` : '';
  return `${sign}${abs} min${hPart}`;
}

function parseDeltaInput(raw: string): number {
  const cleaned = String(raw || '').replace(/[^\d+-]/g, '');
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : 0;
}

function DayTimelineBarWithExclusions({
  day,
  excludedSet,
  usefulStartMin,
  usefulEndMin,
  usefulAmplitudeMin,
}: {
  day: GeoDailySummary;
  excludedSet: Set<string>;
  usefulStartMin: number;
  usefulEndMin: number;
  usefulAmplitudeMin: number;
}) {
  const MIN_START = 3 * 60;
  const MAX_END = 22 * 60;
  const SPAN = MAX_END - MIN_START;
  const ticks = [4, 7, 10, 13, 16, 19, 22];

  return (
    <div className="mt-2">
      <div className="relative h-5 w-full overflow-hidden rounded-md border border-border/70 bg-muted/40">
        {ticks.map((h) => {
          const leftPct = ((h * 60 - MIN_START) / SPAN) * 100;
          return (
            <div
              key={h}
              className="pointer-events-none absolute top-0 bottom-0 border-l border-border/50"
              style={{ left: `${leftPct}%` }}
            />
          );
        })}

        {/* Barre d'amplitude UTILE (recalculée sans Domicile ↔ Travail) */}
        {usefulAmplitudeMin > 0 && (
          <div
            className="pointer-events-none absolute top-1 bottom-1 rounded bg-emerald-500/18 border border-emerald-500/30"
            style={{
              left: `${Math.max(0, Math.min(100, ((usefulStartMin - MIN_START) / SPAN) * 100))}%`,
              width: `${Math.max(
                0.8,
                Math.min(
                  100,
                  ((Math.min(usefulEndMin, MAX_END) - Math.max(usefulStartMin, MIN_START)) / SPAN) * 100
                )
              )}%`,
            }}
          />
        )}

        {/* Segments de trajets */}
        {day.trips.map((t) => {
          const isExcluded = excludedSet.has(t.id);
          const s = Math.max(MIN_START, Math.min(MAX_END, t.startMinutes));
          const e = Math.max(s + 3, Math.min(MAX_END, t.endMinutes));
          const leftPct = ((s - MIN_START) / SPAN) * 100;
          const widthPct = Math.max(0.7, ((e - s) / SPAN) * 100);
          const colorClass = isExcluded
            ? 'bg-slate-400/50 border border-dashed border-slate-600/60'
            : t.isPrivate
              ? 'bg-sky-500'
              : t.isWeekend
                ? 'bg-purple-500'
                : t.startMinutes < 270 || t.endMinutes > 1170
                  ? 'bg-[#D66927]'
                  : 'bg-[#39A9DC]';
          return (
            <div
              key={t.id}
              className={cn('absolute top-0.5 bottom-0.5 rounded-[3px] transition-opacity hover:opacity-80', colorClass)}
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              title={`${isExcluded ? '[EXCLU Domicile ↔ Travail] ' : ''}${t.startTime} → ${t.endTime} (${t.distanceKm} km · ${t.durationLabel})\n${t.startAddress} → ${t.endAddress}`}
            />
          );
        })}
      </div>
      <div className="relative mt-0.5 flex justify-between text-[9px] font-mono text-muted-foreground select-none">
        <span>03h</span>
        <span>07h</span>
        <span>10h</span>
        <span>13h</span>
        <span>16h</span>
        <span>19h</span>
        <span>22h</span>
      </div>
    </div>
  );
}

export default function GeolocDayDetailCard({
  day,
  defaultDriverName,
  employeeOptions,
  annotation,
  isOpen,
  saving,
  onToggleOpen,
  onChangeAnnotation,
  onSaveDayToMonday,
}: GeolocDayDetailCardProps) {
  const excludedSet = useMemo(() => new Set(annotation.excludedTripIds), [annotation.excludedTripIds]);

  const metrics = useMemo(
    () => computeUsefulDayMetrics(day, excludedSet),
    [day, excludedSet]
  );

  const pointageSummary = useMemo(
    () => computePointageStatus(annotation.pointages),
    [annotation.pointages]
  );

  const selectOptions = useMemo(() => {
    const set = new Set<string>(employeeOptions);
    if (defaultDriverName && defaultDriverName !== '—') set.add(defaultDriverName);
    annotation.pointages.forEach((p) => {
      if (p.employeeName.trim()) set.add(p.employeeName.trim());
    });
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b, 'fr'))
      .map((name) => ({ value: name, label: name }));
  }, [employeeOptions, defaultDriverName, annotation.pointages]);

  const toggleTripExcluded = (tripId: string) => {
    const next = new Set(annotation.excludedTripIds);
    if (next.has(tripId)) next.delete(tripId);
    else next.add(tripId);
    onChangeAnnotation({ ...annotation, excludedTripIds: Array.from(next) });
  };

  const handleExcludeFirstAndLast = () => {
    if (day.trips.length === 0) return;
    const next = new Set(annotation.excludedTripIds);
    next.add(day.trips[0].id);
    if (day.trips.length > 1) next.add(day.trips[day.trips.length - 1].id);
    onChangeAnnotation({ ...annotation, excludedTripIds: Array.from(next) });
  };

  const handleClearExclusions = () => {
    onChangeAnnotation({ ...annotation, excludedTripIds: [] });
  };

  const handleAddPointage = () => {
    const isFirst = annotation.pointages.length === 0;
    const entry: DriverPointageEntry = {
      id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      employeeName: isFirst && defaultDriverName !== '—' ? defaultDriverName : '',
      plannedStart: metrics.usefulStartLabel !== '—' ? metrics.usefulStartLabel : day.firstDeparture,
      plannedEnd: metrics.usefulEndLabel !== '—' ? metrics.usefulEndLabel : day.lastArrival,
      compliant: true,
      deltaMin: 0,
      note: '',
    };
    onChangeAnnotation({
      ...annotation,
      pointages: [...annotation.pointages, entry],
    });
  };

  const updatePointage = (id: string, patch: Partial<DriverPointageEntry>, autoRecalcDelta = false) => {
    const nextList = annotation.pointages.map((p) => {
      if (p.id !== id) return p;
      const merged = { ...p, ...patch };
      if (autoRecalcDelta && annotation.pointages.length === 1) {
        const ps = parseHHMMToMin(merged.plannedStart);
        const pe = parseHHMMToMin(merged.plannedEnd);
        if (ps !== null && pe !== null && pe > ps && metrics.usefulAmplitudeMin > 0) {
          const plannedDur = pe - ps;
          merged.deltaMin = Math.round(metrics.usefulAmplitudeMin - plannedDur);
        }
      }
      return merged;
    });
    onChangeAnnotation({ ...annotation, pointages: nextList });
  };

  const removePointage = (id: string) => {
    onChangeAnnotation({
      ...annotation,
      pointages: annotation.pointages.filter((p) => p.id !== id),
    });
  };

  const handleAutoComputeDelta = (entry: DriverPointageEntry) => {
    const ps = parseHHMMToMin(entry.plannedStart);
    const pe = parseHHMMToMin(entry.plannedEnd);
    if (ps === null || pe === null || pe <= ps) return;
    const plannedDur = pe - ps;
    const diff = Math.round(metrics.usefulAmplitudeMin - plannedDur);
    updatePointage(entry.id, { deltaMin: diff, compliant: Math.abs(diff) <= 5 });
  };

  return (
    <div
      className={cn(
        'rounded-[var(--radius-xl)] border bg-background p-3.5 transition',
        day.isWeekend ? 'border-purple-500/35 bg-purple-500/[0.02]' : 'border-border'
      )}
    >
      {/* En-tête de la journée */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'rounded-md px-2 py-0.5 font-mono text-xs font-extrabold',
              day.isWeekend ? 'bg-purple-500/15 text-purple-700' : 'bg-secondary text-primary'
            )}
          >
            {day.dayLabel}
          </span>

          {/* Plage utile recalculée */}
          <span className="font-mono text-xs font-extrabold text-foreground">
            {metrics.usefulStartLabel} → {metrics.usefulEndLabel}
          </span>

          {metrics.hasAdjustment && (
            <span className="font-mono text-[10.5px] text-muted-foreground line-through" title="Plage brute avant exclusion Domicile-Travail">
              {day.firstDeparture} → {day.lastArrival}
            </span>
          )}

          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-bold',
              metrics.hasAdjustment
                ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30'
                : 'bg-muted text-foreground'
            )}
          >
            {metrics.hasAdjustment ? `Utile ${metrics.usefulAmplitudeLabel}` : `Ampl. ${day.amplitudeLabel}`}
          </span>

          <span className="text-[11px] text-muted-foreground">
            Conduite {metrics.usefulDriveLabel} · Sur sites {metrics.usefulOnSiteLabel}
          </span>

          {metrics.excludedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-bold text-slate-700">
              <Home className="h-2.5 w-2.5" />
              {metrics.excludedCount} exclu(s) (-{kmFmt(metrics.excludedKm)})
            </span>
          )}

          {/* Badge état du pointage */}
          {pointageSummary.status === 'Conforme' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3" /> Pointage conforme ({annotation.pointages.length})
            </span>
          )}
          {pointageSummary.status === 'Écart horaire' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-500/30">
              <AlertTriangle className="h-3 w-3" /> Écart {pointageSummary.totalDeltaMin > 0 ? `+${pointageSummary.totalDeltaMin}` : pointageSummary.totalDeltaMin} min
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-foreground">
            {metrics.usefulTripsCount}/{day.tripCount} traj. · {kmFmt(metrics.usefulKm)}
          </span>
          <button
            type="button"
            onClick={onToggleOpen}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-foreground hover:border-primary hover:text-primary cursor-pointer"
          >
            <span>{isOpen ? 'Masquer' : 'Pointage & Trajets'}</span>
            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Timeline visuelle recalculée */}
      <DayTimelineBarWithExclusions
        day={day}
        excludedSet={excludedSet}
        usefulStartMin={metrics.usefulStartMin}
        usefulEndMin={metrics.usefulEndMin}
        usefulAmplitudeMin={metrics.usefulAmplitudeMin}
      />

      {/* Panneau dépliable : 1) Pointage Multi-Salariés + 2) Trajets avec case Domicile-Travail */}
      {isOpen && (
        <div className="mt-3.5 space-y-3.5">
          {/* BLOC 1 : POINTAGE & CONTRÔLE CONFORMITÉ MULTI-SALARIÉS */}
          <div className="rounded-xl border border-primary/25 bg-primary/[0.03] p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                <span className="text-xs font-extrabold text-foreground">
                  Pointage &amp; Conformité ({day.dayLabel})
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Temps utile véhicule : <strong className="font-mono text-foreground">{metrics.usefulStartLabel} → {metrics.usefulEndLabel} ({metrics.usefulAmplitudeLabel})</strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAddPointage}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-card px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/10 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>{annotation.pointages.length === 0 ? 'Pointer un salarié' : 'Ajouter un salarié (relais)'}</span>
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={onSaveDayToMonday}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  <span>{saving ? 'Enreg...' : 'Enregistrer sur Monday'}</span>
                </button>
              </div>
            </div>

            {annotation.pointages.length === 0 ? (
              <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-card/70 px-3 py-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Aucun salarié pointé sur cette journée. Cliquez sur « Pointer un salarié » pour contrôler ses horaires (1 ou plusieurs conducteurs).
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {annotation.pointages.map((entry, pIdx) => (
                  <div
                    key={entry.id}
                    className={cn(
                      'rounded-lg border p-2.5 transition',
                      entry.compliant
                        ? 'border-emerald-500/30 bg-card'
                        : 'border-red-500/35 bg-red-500/[0.03]'
                    )}
                  >
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-12 lg:items-center">
                      {/* Sélecteur Salarié */}
                      <div className="lg:col-span-4">
                        <label className="mb-0.5 block text-[10px] font-bold uppercase text-muted-foreground">
                          Salarié #{pIdx + 1}
                        </label>
                        <SearchableSelect
                          size="sm"
                          allowCreate
                          createLabelPrefix="Utiliser le salarié"
                          showDot={false}
                          placeholder="Choisir ou saisir un salarié..."
                          value={entry.employeeName}
                          options={selectOptions}
                          onChange={(val) => updatePointage(entry.id, { employeeName: val })}
                        />
                      </div>

                      {/* Horaires prévus */}
                      <div className="grid grid-cols-2 gap-1.5 lg:col-span-3">
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-muted-foreground">
                            Début prévu
                          </label>
                          <input
                            type="time"
                            value={entry.plannedStart}
                            onChange={(e) => updatePointage(entry.id, { plannedStart: e.target.value }, true)}
                            className="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs font-bold outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-bold uppercase text-muted-foreground">
                            Fin prévue
                          </label>
                          <input
                            type="time"
                            value={entry.plannedEnd}
                            onChange={(e) => updatePointage(entry.id, { plannedEnd: e.target.value }, true)}
                            className="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs font-bold outline-none focus:border-primary"
                          />
                        </div>
                      </div>

                      {/* Case à cocher Conforme (dans les clous) */}
                      <div className="flex flex-wrap items-center gap-2 lg:col-span-4 lg:pt-3">
                        <label className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-bold cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={entry.compliant}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              if (!checked && entry.deltaMin === 0) {
                                const ps = parseHHMMToMin(entry.plannedStart);
                                const pe = parseHHMMToMin(entry.plannedEnd);
                                const autoDiff =
                                  ps !== null && pe !== null && pe > ps && metrics.usefulAmplitudeMin > 0
                                    ? Math.round(metrics.usefulAmplitudeMin - (pe - ps))
                                    : 0;
                                updatePointage(entry.id, { compliant: false, deltaMin: autoDiff });
                              } else {
                                updatePointage(entry.id, { compliant: checked, ...(checked ? { deltaMin: 0 } : {}) });
                              }
                            }}
                            className="h-3.5 w-3.5 accent-emerald-600"
                          />
                          <span className={entry.compliant ? 'text-emerald-700' : 'text-red-700'}>
                            {entry.compliant ? 'Conforme (dans les clous)' : 'Non conforme'}
                          </span>
                        </label>

                        {!entry.compliant && (
                          <div className="min-w-[175px] flex-1">
                            <SearchableSelect
                              size="sm"
                              allowCreate
                              clearable={false}
                              createLabelPrefix="Écart perso (min)"
                              showDot={true}
                              icon={<Clock className="h-3.5 w-3.5 text-red-600" />}
                              placeholder="Choisir l'écart..."
                              searchPlaceholder="Ex: +45, -30, +20..."
                              value={String(entry.deltaMin)}
                              onChange={(val) => updatePointage(entry.id, { deltaMin: parseDeltaInput(val) })}
                              options={(() => {
                                const vals = new Set<number>(DELTA_PRESET_MINUTES);
                                if (entry.deltaMin !== 0) vals.add(entry.deltaMin);
                                const positives = Array.from(vals)
                                  .filter((v) => v > 0)
                                  .sort((a, b) => a - b);
                                const negatives = Array.from(vals)
                                  .filter((v) => v < 0)
                                  .sort((a, b) => b - a);
                                return [
                                  ...positives.map((v) => ({
                                    value: String(v),
                                    label: formatDeltaLabel(v),
                                    group: 'Temps en plus (+)',
                                    badgeColor: '#dc2626',
                                    searchTokens: [`+${v}`, `${v}`],
                                  })),
                                  ...negatives.map((v) => ({
                                    value: String(v),
                                    label: formatDeltaLabel(v),
                                    group: 'Temps en moins (-)',
                                    badgeColor: '#d97706',
                                    searchTokens: [`${v}`],
                                  })),
                                ];
                              })()}
                            />
                          </div>
                        )}
                      </div>

                      {/* Supprimer ligne pointage */}
                      <div className="flex justify-end lg:col-span-1 lg:pt-3">
                        <button
                          type="button"
                          onClick={() => removePointage(entry.id)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                          title="Retirer ce salarié de la journée"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Note d'écart si non conforme */}
                    {!entry.compliant && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={entry.note}
                          onChange={(e) => updatePointage(entry.id, { note: e.target.value })}
                          placeholder="Motif de l'écart (ex : départ tardif, arrêt prolongé, embouteillage...)"
                          className="h-7 flex-1 min-w-[200px] rounded-md border border-red-300/70 bg-background px-2.5 text-[11px] outline-none focus:border-red-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleAutoComputeDelta(entry)}
                          className="rounded-md border border-border bg-background px-2 py-1 text-[10.5px] font-bold text-primary hover:bg-muted cursor-pointer"
                        >
                          Recalculer écart auto
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* BLOC 2 : TABLEAU DES TRAJETS AVEC CASE "EXCLURE DOMICILE ↔ TRAVAIL" */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-muted-foreground">
                Cochez les trajets <strong className="text-foreground">Domicile ↔ Travail</strong> à exclure du calcul journalier :
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExcludeFirstAndLast}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-[10.5px] font-bold text-foreground hover:border-primary hover:text-primary cursor-pointer"
                >
                  <Home className="h-3 w-3 text-primary" />
                  <span>Exclure 1er &amp; dernier trajet</span>
                </button>
                {metrics.excludedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleClearExclusions}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10.5px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Tout réinclure</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full min-w-[720px] text-left text-[11px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[10px] font-bold uppercase text-muted-foreground">
                    <th className="w-24 px-2.5 py-2 text-center">Exclure</th>
                    <th className="px-2.5 py-2">Départ</th>
                    <th className="px-2.5 py-2">Site / Adresse départ</th>
                    <th className="px-2.5 py-2">Arrivée</th>
                    <th className="px-2.5 py-2">Site / Adresse arrivée</th>
                    <th className="px-2.5 py-2 text-right">Km</th>
                    <th className="px-2.5 py-2 text-right">Durée</th>
                    <th className="px-2.5 py-2 text-right">Arrêt sur place</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {day.trips.map((t, idx) => {
                    const isExcluded = excludedSet.has(t.id);
                    const nextTrip = day.trips[idx + 1];
                    const stopGap = nextTrip ? nextTrip.startMinutes - t.endMinutes : null;
                    return (
                      <tr
                        key={t.id}
                        className={cn(
                          'transition-colors',
                          isExcluded
                            ? 'bg-slate-100/80 text-muted-foreground line-through opacity-70 dark:bg-slate-900/40'
                            : t.isPrivate
                              ? 'bg-sky-500/5'
                              : ''
                        )}
                      >
                        <td className="px-2.5 py-1.5 text-center">
                          <label className="inline-flex items-center gap-1 cursor-pointer select-none no-underline">
                            <input
                              type="checkbox"
                              checked={isExcluded}
                              onChange={() => toggleTripExcluded(t.id)}
                              className="h-3.5 w-3.5 accent-primary cursor-pointer"
                              title="Ne pas calculer ce trajet (Domicile ↔ Travail)"
                            />
                            {isExcluded && (
                              <span className="rounded bg-slate-200 px-1 py-0.5 text-[9px] font-bold text-slate-700 no-underline">
                                Dom.
                              </span>
                            )}
                          </label>
                        </td>
                        <td className="px-2.5 py-1.5 font-mono font-bold">{t.startTime}</td>
                        <td className="px-2.5 py-1.5 max-w-[220px] truncate" title={t.startAddress}>
                          {t.startAddress}
                        </td>
                        <td className="px-2.5 py-1.5 font-mono font-bold">{t.endTime}</td>
                        <td className="px-2.5 py-1.5 max-w-[220px] truncate font-medium" title={t.endAddress}>
                          {t.endAddress}
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-mono font-bold">{t.distanceKm}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono text-muted-foreground">{t.durationLabel}</td>
                        <td className="px-2.5 py-1.5 text-right font-mono text-muted-foreground">
                          {stopGap !== null && stopGap > 0 ? formatMinutesToDuration(stopGap) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
