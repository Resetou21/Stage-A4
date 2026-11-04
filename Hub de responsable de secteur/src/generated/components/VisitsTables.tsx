import React, { useEffect, useState } from 'react';
import { Check, ExternalLink, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { getSinglePlanAction, getVisitsDashboard, updatePlanActionStatus, updatePlanActionText } from '@generated/server/visits';
import { monday } from '@api/BoardSDK';
import { cn } from '@lib/utils';

type Dash = Awaited<ReturnType<typeof getVisitsDashboard>>;
type Visit = Dash['recent'][number];
type Plan = Dash['plansOpen'][number];

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const qualTone = (q: string | null) =>
  q === 'Globalement bon' ? 'bg-primary/15 text-primary'
    : q === "Plan d'action urgent" ? 'bg-destructive/15 text-destructive'
    : q ? 'bg-[hsl(var(--brand-orange))]/15 text-foreground' : 'text-muted-foreground';

const Skel = () => <div className="space-y-2">{['a', 'b', 'c'].map((k) => <div key={k} className="h-8 animate-pulse rounded bg-muted" />)}</div>;
const Empty = ({ text }: { text: string }) => <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;

export default function VisitsTable({ visits, dateLabel = 'Date', qualLabel = 'Qualité', emptyText = 'Aucune visite.' }: { visits: Visit[] | null; dateLabel?: string; qualLabel?: string; emptyText?: string }) {
  if (!visits) return <Skel />;
  if (visits.length === 0) return <Empty text={emptyText} />;
  return (
    <div className="max-h-80 overflow-auto rounded-[var(--radius-sm)] border border-border">
      <table className="w-full min-w-[420px] text-sm">
        <thead className="sticky top-0 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr><th className="px-3 py-2">Chantier</th><th className="px-3 py-2">{dateLabel}</th><th className="px-3 py-2">{qualLabel}</th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {visits.map((v) => (
            <tr key={v.id}>
              <td className="px-3 py-2 font-medium">{v.chantier}</td>
              <td className="whitespace-nowrap px-3 py-2 tabular-nums">{fmt(v.date)}</td>
              <td className="px-3 py-2"><span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', qualTone(v.qualite))}>{v.qualite ?? '—'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatutBadge({
  statut,
  onChange,
  disabled = false,
}: {
  statut: string | null;
  onChange?: (next: string) => void;
  disabled?: boolean;
}) {
  const s = (statut || '').trim().toLowerCase();
  let style = 'bg-muted text-foreground border-border';
  let label = statut || 'Non commencé';

  if (s === 'en cours') {
    style = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
    label = 'En cours';
  } else if (s === 'bloqué' || s === 'bloque') {
    style = 'bg-destructive/15 text-destructive border-destructive/30';
    label = 'Bloqué';
  } else if (s === 'fait') {
    style = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    label = 'Fait';
  } else if (s === 'abandonné' || s === 'abandonne') {
    style = 'bg-muted text-muted-foreground line-through border-border';
    label = 'Abandonné';
  } else if (s.includes('non') || s === 'à faire' || !s) {
    style = 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30';
    label = 'Non commencé';
  }

  if (!onChange) {
    return (
      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap', style)}>
        {label}
      </span>
    );
  }

  return (
    <select
      value={label}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'cursor-pointer rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap bg-background focus:outline-none focus:ring-1 focus:ring-ring transition-colors shadow-sm',
        style
      )}
      title="Cliquer pour changer le statut"
    >
      <option value="Non commencé">Non commencé</option>
      <option value="En cours">En cours</option>
      <option value="Bloqué">Bloqué</option>
      <option value="Fait">✅ Fait</option>
      <option value="Abandonné">❌ Abandonné</option>
    </select>
  );
}

function EditableActionText({
  actionId,
  initialText,
  onSave,
  onOpenCard,
}: {
  actionId: string;
  initialText: string;
  onSave: (actId: string, newText: string) => void;
  onOpenCard: (actId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(initialText);

  useEffect(() => {
    setVal(initialText);
  }, [initialText]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = val.trim();
    if (trimmed && trimmed !== initialText) {
      onSave(actionId, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setVal(initialText);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-1 w-full min-w-[260px] max-w-md py-0.5">
        <input
          type="text"
          value={val}
          autoFocus
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 rounded border border-primary bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
          placeholder="Saisir l'action à mener..."
        />
        <button
          type="submit"
          className="h-6 w-6 inline-flex items-center justify-center rounded bg-primary text-primary-foreground hover:opacity-90 shrink-0 transition-opacity shadow-sm"
          title="Valider (Entrée)"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setVal(initialText);
            setIsEditing(false);
          }}
          className="h-6 w-6 inline-flex items-center justify-center rounded bg-muted text-muted-foreground hover:bg-muted/80 shrink-0 transition-colors"
          title="Annuler (Échap)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </form>
    );
  }

  return (
    <div className="group/act flex items-center gap-1.5 flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="text-left hover:text-primary transition-colors inline-flex items-center gap-1.5 group-hover/act:underline text-xs leading-relaxed"
        title="Cliquer pour modifier directement l'action à mener"
      >
        <span className={cn(!initialText && 'italic text-muted-foreground')}>
          {initialText || '— Définir l\'action —'}
        </span>
        <Pencil className="h-3 w-3 opacity-40 group-hover/act:opacity-100 transition-opacity text-primary shrink-0" />
      </button>

      <button
        type="button"
        onClick={() => onOpenCard(actionId)}
        className="opacity-0 group-hover/act:opacity-60 hover:!opacity-100 p-0.5 text-muted-foreground hover:text-foreground transition-all shrink-0"
        title="Ouvrir la fiche sur Monday"
      >
        <ExternalLink className="h-3 w-3" />
      </button>
    </div>
  );
}

export function PlansTable({ plans }: { plans: Plan[] | null }) {
  const [localPlans, setLocalPlans] = useState<Plan[] | null>(plans);

  useEffect(() => {
    setLocalPlans(plans);
  }, [plans]);

  if (!localPlans) return <Skel />;
  if (localPlans.length === 0) return <Empty text="Aucun plan d'actions en cours." />;

  const refreshSingleAction = async (actId: string) => {
    try {
      const res = await getSinglePlanAction({ data: { subitemId: actId } });
      if (!res) return;
      const isCompleted = (res.statut || '').toLowerCase() === 'fait' || (res.statut || '').toLowerCase().includes('abandonn');

      setLocalPlans((cur) => {
        if (!cur) return cur;
        return cur
          .map((p) => {
            const remainingActions = p.actions.filter((a) => a.id !== actId || !isCompleted);
            const updatedActions = remainingActions.map((a) => (a.id === actId ? { ...a, statut: res.statut, action: res.action } : a));
            return {
              ...p,
              action: updatedActions.map((a) => a.action).filter(Boolean).join(' • '),
              actions: updatedActions,
            };
          })
          .filter((p) => p.actions.length > 0);
      });
    } catch (e) {
      console.warn('Erreur rafraîchissement sous-élément:', e);
    }
  };

  const handleOpenCard = (actId: string) => {
    try {
      const p = monday.execute('openItemCard', { itemId: actId });
      if (p && typeof (p as any).then === 'function') {
        (p as Promise<any>).then(() => void refreshSingleAction(actId)).catch(() => {});
      }
    } catch (e) {
      console.error(e);
    }

    // Détection immédiate dès que l'animatrice ferme la fiche ou revient sur le Hub
    const onReturn = () => {
      void refreshSingleAction(actId);
      window.removeEventListener('focus', onReturn);
    };
    window.addEventListener('focus', onReturn);

    // Vérifications ciblées après 2s, 5s et 8s pour capter la saisie en direct
    setTimeout(() => void refreshSingleAction(actId), 2000);
    setTimeout(() => void refreshSingleAction(actId), 5000);
    setTimeout(() => void refreshSingleAction(actId), 8000);
  };

  const handleActionTextChange = async (actId: string, newText: string) => {
    const prev = localPlans;

    setLocalPlans((cur) => {
      if (!cur) return cur;
      return cur.map((p) => {
        const updatedActions = p.actions.map((a) => (a.id === actId ? { ...a, action: newText } : a));
        return {
          ...p,
          action: p.actions.length === 1 ? newText : updatedActions.map((o) => o.action).filter(Boolean).join(' • '),
          actions: updatedActions,
        };
      });
    });

    toast.promise(updatePlanActionText({ data: { subitemId: actId, action: newText } }), {
      loading: 'Enregistrement de l\'action...',
      success: 'Action à mener mise à jour',
      error: () => {
        setLocalPlans(prev);
        return 'Échec de l\'enregistrement';
      },
    });
  };

  const handleStatusChange = async (actId: string, newStatut: string) => {
    const prev = localPlans;
    const isCompleted = newStatut.toLowerCase() === 'fait' || newStatut.toLowerCase().includes('abandonn');

    setLocalPlans((cur) => {
      if (!cur) return cur;
      return cur
        .map((p) => {
          const remainingActions = p.actions.filter((a) => a.id !== actId || !isCompleted);
          const updatedActions = remainingActions.map((a) => (a.id === actId ? { ...a, statut: newStatut } : a));
          return {
            ...p,
            actions: updatedActions,
          };
        })
        .filter((p) => p.actions.length > 0);
    });

    toast.promise(updatePlanActionStatus({ data: { subitemId: actId, statut: newStatut } }), {
      loading: 'Mise à jour...',
      success: `Statut mis à jour : ${newStatut}`,
      error: () => {
        setLocalPlans(prev);
        return 'Échec de la mise à jour';
      },
    });
  };

  // Grouper comme dans Monday : Visites clients d'abord, puis Visites datant de plus de 1 an
  const groupOrder = ['Visites clients', 'Visites datant de plus de 1 an'];
  const distinctGroups = Array.from(new Set(localPlans.map((p) => p.groupTitle || 'Visites clients')));
  distinctGroups.sort((a, b) => {
    const ia = groupOrder.indexOf(a);
    const ib = groupOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <div className="max-h-[30rem] overflow-auto rounded-[var(--radius-sm)] border border-border">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="sticky top-0 z-10 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground shadow-sm">
          <tr>
            <th className="px-3 py-2">Chantier</th>
            <th className="px-3 py-2">Action à mener</th>
            <th className="px-3 py-2">Catégorie</th>
            <th className="px-3 py-2">Statut</th>
            <th className="px-3 py-2">Visite</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {distinctGroups.map((gName) => {
            const groupPlans = localPlans.filter((p) => (p.groupTitle || 'Visites clients') === gName);
            // Trier par date chronologique comme sur Monday
            groupPlans.sort((a, b) => {
              const da = a.dateVisite ? new Date(a.dateVisite).getTime() : 0;
              const db = b.dateVisite ? new Date(b.dateVisite).getTime() : 0;
              return da - db;
            });
            const totalActions = groupPlans.reduce((sum, p) => sum + (p.actions?.length || 1), 0);
            const isOld = gName.toLowerCase().includes('plus de 1 an');
            return (
              <React.Fragment key={gName}>
                <tr className="bg-muted/70">
                  <td colSpan={5} className="px-3 py-2 font-bold text-xs uppercase tracking-wider text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 rounded-full', isOld ? 'bg-[hsl(var(--brand-orange))]' : 'bg-primary')} />
                      {gName}
                      <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground">
                        {groupPlans.length} {groupPlans.length > 1 ? 'chantiers' : 'chantier'}
                        {totalActions > groupPlans.length ? ` (${totalActions} actions)` : ''}
                      </span>
                    </span>
                  </td>
                </tr>
                {groupPlans.map((p) => {
                  const hasMultiple = (p.actions?.length || 0) > 1;
                  if (!hasMultiple) {
                    const firstAct = p.actions?.[0];
                    const actId = firstAct?.id || p.id;
                    return (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{p.chantier}</td>
                        <td className="px-3 py-2">
                          <EditableActionText
                            actionId={actId}
                            initialText={firstAct?.action || p.action || ''}
                            onSave={handleActionTextChange}
                            onOpenCard={handleOpenCard}
                          />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{firstAct?.categorie || p.categorie || '—'}</td>
                        <td className="px-3 py-2">
                          <StatutBadge statut={firstAct?.statut ?? p.statut} onChange={(s) => handleStatusChange(actId, s)} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                          {fmt(p.dateVisite)}
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={p.id} className="hover:bg-muted/30 bg-muted/10">
                      <td className="px-3 py-2 font-medium align-top">
                        <div>{p.chantier}</div>
                        <span className="inline-block mt-0.5 text-[11px] font-semibold text-primary">
                          {p.actions.length} actions
                        </span>
                      </td>
                      <td className="px-3 py-1.5 align-top">
                        <div className="space-y-2">
                          {p.actions.map((act) => (
                            <div key={act.id} className="flex items-center gap-1.5 text-xs">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--brand-orange))]" />
                              <EditableActionText
                                actionId={act.id}
                                initialText={act.action || ''}
                                onSave={handleActionTextChange}
                                onOpenCard={handleOpenCard}
                              />
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground align-top">
                        <div className="space-y-2">
                          {p.actions.map((act) => (
                            <div key={act.id} className="text-xs">
                              {act.categorie || '—'}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 align-top">
                        <div className="space-y-2">
                          {p.actions.map((act) => (
                            <div key={act.id}>
                              <StatutBadge statut={act.statut} onChange={(s) => handleStatusChange(act.id, s)} />
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground align-top">
                        {fmt(p.dateVisite)}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
