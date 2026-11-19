import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getChantierAlerts } from '@generated/server/alerts';
import { getInventoryActions, getInventoryDue } from '@generated/server/inventory';
import { archiveCommunication, getChantierQuality, getCommunications, markCommunicationSeen } from '@generated/server/visits';

type Quality = Awaited<ReturnType<typeof getChantierQuality>>;
export type Message = Awaited<ReturnType<typeof getCommunications>>['messages'][number];
export type QualityRow = Quality['insatisfaits'][number];
export type VisitAlert = Awaited<ReturnType<typeof getChantierAlerts>>['alerts'][number];

export type AlertsData = {
  messages: Message[];
  insatisfaits: QualityRow[];
  controle2Mois: QualityRow[];
  nonVus11Mois: QualityRow[];
  visites2Mois: VisitAlert[];
  due: number;
  recup: number;
  avenants: number;
};

export function totalAlerts(d: AlertsData | null) {
  if (!d) return 0;
  return d.messages.length + d.insatisfaits.length + d.controle2Mois.length + d.nonVus11Mois.length + d.visites2Mois.length + d.due + d.recup + d.avenants;
}

export function useAlerts(firstName: string) {
  const [data, setData] = useState<AlertsData | null>(null);

  useEffect(() => {
    let active = true;

    // Phase 1 (Immédiate) : messages, qualité & alertes chantiers (une seule requête groupée)
    Promise.allSettled([
      getCommunications({ data: { firstName } }),
      getChantierQuality({ data: { firstName } }),
    ]).then(([m, q]) => {
      if (!active) return;
      [m, q].forEach((r) => { if (r.status === 'rejected') console.error(r.reason); });
      const qual = q.status === 'fulfilled' ? q.value : null;
      setData((prev) => ({
        messages: m.status === 'fulfilled' ? m.value?.messages ?? [] : (prev?.messages ?? []),
        insatisfaits: qual?.insatisfaits ?? (prev?.insatisfaits ?? []),
        controle2Mois: qual?.controle2Mois ?? (prev?.controle2Mois ?? []),
        nonVus11Mois: qual?.nonVus11Mois ?? (prev?.nonVus11Mois ?? []),
        visites2Mois: qual?.alerts ?? (prev?.visites2Mois ?? []),
        due: prev?.due ?? 0,
        recup: prev?.recup ?? 0,
        avenants: prev?.avenants ?? 0,
      }));
    });

    // Phase 2 (Différée de 700ms) : inventaires consommables pour laisser toute la bande passante au haut de page
    const timer = setTimeout(() => {
      Promise.allSettled([
        getInventoryDue({ data: { firstName } }),
        getInventoryActions({ data: { firstName } }),
      ]).then(([d, a]) => {
        if (!active) return;
        [d, a].forEach((r) => { if (r.status === 'rejected') console.error(r.reason); });
        const rows = a.status === 'fulfilled' ? a.value?.rows ?? [] : [];
        setData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            due: d.status === 'fulfilled' ? d.value?.count ?? 0 : prev.due,
            recup: a.status === 'fulfilled' ? rows.filter((r) => r.type === 'À récupérer').length : prev.recup,
            avenants: a.status === 'fulfilled' ? rows.filter((r) => r.type === 'Avenant').length : prev.avenants,
          };
        });
      });
    }, 700);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [firstName]);

  // Case « ✅ Vu » : l'alerte disparaît tout de suite, retour arrière en cas d'erreur
  const markSeen = useCallback(async (msg: Message) => {
    const prev = data;
    setData((d) => (d ? { ...d, messages: d.messages.filter((x) => x.id !== msg.id) } : d));
    try {
      await markCommunicationSeen({ data: { itemId: msg.id, vu: true } });
    } catch (e) {
      console.error(e);
      setData(prev);
      toast.error('Impossible de cocher « Vu ». Réessayez.');
    }
  }, [data]);

  // Supprimer / archiver un message (utile notamment après un test ou message obsolète)
  const archiveMessage = useCallback(async (msg: Message) => {
    const prev = data;
    setData((d) => (d ? { ...d, messages: d.messages.filter((x) => x.id !== msg.id) } : d));
    try {
      await archiveCommunication({ data: { itemId: msg.id } });
      toast.success('Alerte supprimée (archivée sur Monday).');
    } catch (e) {
      console.error(e);
      setData(prev);
      toast.error('Impossible de supprimer cette alerte. Réessayez.');
    }
  }, [data]);

  // Actualiser manuellement les messages de communication
  const refreshMessages = useCallback(async () => {
    try {
      const res = await getCommunications({ data: { firstName } });
      setData((d) => (d ? { ...d, messages: res?.messages ?? [] } : d));
    } catch (e) {
      console.error(e);
      toast.error('Erreur lors de l’actualisation des messages.');
    }
  }, [firstName]);

  return { data, markSeen, archiveMessage, refreshMessages };
}
