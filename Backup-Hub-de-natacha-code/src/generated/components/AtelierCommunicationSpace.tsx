import { useEffect, useState, useRef } from 'react';
import {
  Wrench,
  Send,
  RefreshCw,
  CheckCircle2,
  Clock,
  Inbox,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Loader2,
  MessageSquare,
  AlertTriangle,
  Eye,
  Archive,
  Camera,
  Paperclip,
  Image as ImageIcon,
  FileText,
  X,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { monday } from '@api/BoardSDK';
import AlertContextSelect, { type AlertMachineOption } from '@generated/components/AlertContextSelect';
import { getAlertContexts, getMaintenanceExchanges, sendAlertToMaintenance, markCommunicationSeen, archiveCommunication, type MaintenanceExchange } from '@generated/server/visits';
import { cn } from '@lib/utils';

// Helper pour uploader la photo / le fichier sur la colonne file_mm98hfng du tableau Communication
async function uploadAlertFile(itemId: string | number, file: File): Promise<boolean> {
  const mutation = `mutation ($file: File!) {
    add_file_to_column(item_id: ${itemId}, column_id: "file_mm98hfng", file: $file) {
      id
      name
    }
  }`;

  try {
    const res: any = await (monday as any).api(mutation, { variables: { file } });
    if (res?.data?.add_file_to_column?.id) return true;
  } catch (err) {
    console.warn('Tentative SDK échouée, fallback multipart:', err);
  }

  try {
    let token = '';
    try {
      const sessionRes: any = await (monday as any).get('sessionToken');
      token = sessionRes?.data || '';
    } catch {}

    const formData = new FormData();
    formData.append('query', mutation);
    formData.append('variables[file]', file);

    const headers: Record<string, string> = { 'API-Version': '2024-04' };
    if (token) headers['Authorization'] = token;

    const res = await fetch('https://api.monday.com/v2/file', {
      method: 'POST',
      headers,
      body: formData,
    });
    const json = await res.json();
    return !!json?.data?.add_file_to_column?.id;
  } catch (err) {
    console.warn('Erreur fallback fetch:', err);
    return false;
  }
}

export default function AtelierCommunicationSpace({ firstName }: { firstName: string }) {
  // Formulaire d'envoi
  const [contextVal, setContextVal] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Données contextuelles (Chantiers & Machines)
  const [ctxLoading, setCtxLoading] = useState(false);
  const [chantiers, setChantiers] = useState<string[]>([]);
  const [machines, setMachines] = useState<AlertMachineOption[]>([]);

  // Échanges / Historique des alertes
  const [exchanges, setExchanges] = useState<MaintenanceExchange[]>([]);
  const [loadingExchanges, setLoadingExchanges] = useState(true);
  const [filterDirection, setFilterDirection] = useState<'all' | 'from_atelier' | 'to_atelier'>('all');

  const loadContexts = async () => {
    setCtxLoading(true);
    try {
      const res = await getAlertContexts({ data: { firstName } });
      setChantiers(res?.chantiers ?? []);
      setMachines(res?.machines ?? []);
    } catch (err) {
      console.warn('Erreur chargement contextes:', err);
    } finally {
      setCtxLoading(false);
    }
  };

  const loadExchanges = async () => {
    setLoadingExchanges(true);
    try {
      const res = await getMaintenanceExchanges({ data: { firstName } });
      setExchanges(res?.exchanges ?? []);
    } catch (err) {
      console.warn('Erreur chargement échanges:', err);
    } finally {
      setLoadingExchanges(false);
    }
  };

  useEffect(() => {
    loadContexts();
    loadExchanges();
  }, [firstName]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = messageText.trim();
    if (!msg) {
      toast.error('Veuillez saisir votre message pour Christophe.');
      return;
    }

    setSending(true);
    try {
      const res = await sendAlertToMaintenance({
        data: {
          senderName: firstName,
          context: contextVal || undefined,
          message: msg,
        },
      });

      // Si une photo ou un fichier a été joint, l'uploader sur la colonne file_mm98hfng
      if (res?.id && attachedFile) {
        try {
          await uploadAlertFile(res.id, attachedFile);
        } catch (fErr) {
          console.warn("Erreur d'upload du fichier pour l'alerte:", fErr);
        }
      }

      toast.success('Alerte transmise à Christophe !', {
        description: attachedFile
          ? 'Votre message et son document/photo ont été envoyés avec succès.'
          : 'Votre message a été envoyé vers le tableau de maintenance et le Hub de Christophe.',
      });

      setMessageText('');
      setContextVal('');
      setAttachedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadExchanges();
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'envoi de l'alerte.");
    } finally {
      setSending(false);
    }
  };

  const handleToggleSeen = async (item: MaintenanceExchange) => {
    try {
      await markCommunicationSeen({ data: { itemId: item.id, vu: !item.seen } });
      setExchanges((prev) =>
        prev.map((x) => (x.id === item.id ? { ...x, seen: !item.seen } : x))
      );
      toast.success(item.seen ? 'Marqué comme non lu' : 'Alerte marquée comme lue');
    } catch (err) {
      console.error(err);
      toast.error('Erreur mise à jour');
    }
  };

  const handleArchive = async (item: MaintenanceExchange) => {
    try {
      await archiveCommunication({ data: { itemId: item.id } });
      setExchanges((prev) => prev.filter((x) => x.id !== item.id));
      toast.success('Alerte archivée avec succès');
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'archivage");
    }
  };

  const filteredExchanges = exchanges.filter((e) => {
    if (filterDirection === 'from_atelier') return e.direction === 'from_atelier';
    if (filterDirection === 'to_atelier') return e.direction === 'to_atelier';
    return true;
  });

  const unreadCount = exchanges.filter((e) => !e.seen && e.direction === 'from_atelier').length;

  return (
    <div className="rounded-[var(--radius-xl)] border border-border bg-card p-6 shadow-xs sm:p-8">
      {/* En-tête de section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-[family-name:var(--font-heading)] text-xl font-extrabold text-foreground tracking-tight sm:text-2xl">
              Échanges Atelier &amp; Parc Matériel (Christophe)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Signalements de pannes, suivi des réparations et communication bidirectionnelle en direct.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600 border border-amber-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              {unreadCount} message{unreadCount > 1 ? 's' : ''} de Christophe
            </span>
          )}

          <button
            type="button"
            onClick={loadExchanges}
            disabled={loadingExchanges}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            title="Rafraîchir les échanges"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-primary', loadingExchanges && 'animate-spin')} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Grille 2 colonnes : Formulaire d'envoi à gauche + Fil des messages à droite */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Colonne Gauche : Formulaire de signalement */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-border bg-muted/20 p-5 sm:p-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Send className="h-4 w-4 text-primary" />
              <span>Transmettre un signalement à l'Atelier</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Christophe recevra immédiatement ce message sur son ERP avec la machine et le chantier ciblés.
            </p>

            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Machine ou chantier concerné
                </label>
                <AlertContextSelect
                  chantiers={chantiers}
                  machines={machines}
                  loading={ctxLoading}
                  value={contextVal}
                  onChange={setContextVal}
                  placeholder="Rechercher une machine ou un chantier…"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Description du problème / Message <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={3}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Ex: Bavettes suceur déchirées sur autolaveuse, faire devis réparation ou changement..."
                  className="w-full rounded-xl border border-input bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none shadow-xs"
                />
              </div>

              {/* Pièce jointe / Photo du problème */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setAttachedFile(f);
                      if (f.type.startsWith('image/')) {
                        setPreviewUrl(URL.createObjectURL(f));
                      } else {
                        setPreviewUrl(null);
                      }
                    }
                  }}
                />

                {!attachedFile ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl border border-dashed border-[#CBD5E1] bg-card/60 px-3 py-2 text-xs font-semibold text-[#1B4565] hover:bg-card hover:border-[#39A9DC] transition cursor-pointer w-full justify-center shadow-2xs"
                  >
                    <Camera className="h-4 w-4 text-[#39A9DC]" />
                    <span>📷 Prendre une photo / joindre un fichier</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/70 p-2 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Aperçu"
                          className="h-10 w-10 rounded-lg object-cover border border-blue-300 shadow-2xs"
                        />
                      ) : (
                        <FileText className="h-6 w-6 text-blue-600 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-blue-900 truncate text-[11.5px]">{attachedFile.name}</p>
                        <p className="text-[10px] text-blue-600">{(attachedFile.size / 1024).toFixed(1)} Ko • Prêt à envoyer</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachedFile(null);
                        setPreviewUrl(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="rounded-lg p-1 text-red-500 hover:bg-red-100 transition cursor-pointer"
                      title="Retirer cette photo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={sending || !messageText.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-md transition hover:brightness-95 disabled:opacity-50 cursor-pointer"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Transmission en cours…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Alerter Christophe (Atelier)
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-border/80 bg-background/80 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            <span>
              L'alerte s'inscrit automatiquement dans le tableau officiel de communication Monday et alerte le Hub Matériel de Christophe.
            </span>
          </div>
        </div>

        {/* Colonne Droite : Fil des échanges récents */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-bold text-foreground">Historique des échanges</h4>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                {filteredExchanges.length}
              </span>
            </div>

            {/* Filtres de direction */}
            <div className="inline-flex rounded-lg bg-muted p-1 text-xs">
              <button
                type="button"
                onClick={() => setFilterDirection('all')}
                className={cn(
                  'rounded-md px-2.5 py-1 font-semibold transition',
                  filterDirection === 'all'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => setFilterDirection('from_atelier')}
                className={cn(
                  'rounded-md px-2.5 py-1 font-semibold transition',
                  filterDirection === 'from_atelier'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                De Christophe
              </button>
              <button
                type="button"
                onClick={() => setFilterDirection('to_atelier')}
                className={cn(
                  'rounded-md px-2.5 py-1 font-semibold transition',
                  filterDirection === 'to_atelier'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Envoyés
              </button>
            </div>
          </div>

          {/* Liste des messages */}
          <div className="mt-4 flex-1 overflow-y-auto space-y-3 max-h-[380px] pr-1">
            {loadingExchanges ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Chargement des échanges…</p>
              </div>
            ) : filteredExchanges.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Inbox className="h-10 w-10 stroke-[1.5] mb-2 text-muted-foreground/60" />
                <p className="text-sm font-semibold">Aucun échange pour le moment</p>
                <p className="text-xs mt-0.5">
                  Les alertes échangées avec l'Atelier apparaîtront ici automatiquement.
                </p>
              </div>
            ) : (
              filteredExchanges.map((item) => {
                const isFromAtelier = item.direction === 'from_atelier';
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'group relative rounded-xl border p-4 transition-all',
                      isFromAtelier
                        ? item.seen
                          ? 'border-border bg-muted/20'
                          : 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border bg-background'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {isFromAtelier ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 border border-blue-500/20">
                            <ArrowDownLeft className="h-3 w-3" /> De Christophe (Atelier)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 border border-amber-500/20">
                            <ArrowUpRight className="h-3 w-3" /> Envoyé à Christophe
                          </span>
                        )}

                        {item.context && (
                          <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground truncate max-w-[200px]">
                            {item.context}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{item.date || 'Récemment'}</span>
                      </div>
                    </div>

                    <p className="mt-2.5 text-xs text-foreground font-medium whitespace-pre-wrap leading-relaxed">
                      {item.message}
                    </p>

                    {/* Photo ou pièce jointe attachée */}
                    {item.fileUrl && (
                      <div className="mt-2.5">
                        {item.isImage ? (
                          <a
                            href={item.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative inline-block overflow-hidden rounded-xl border border-border shadow-2xs hover:border-primary transition"
                            title="Cliquer pour afficher la photo en grand format"
                          >
                            <img
                              src={item.fileUrl}
                              alt={item.fileName || 'Photo du matériel'}
                              className="max-h-40 max-w-full rounded-xl object-contain group-hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute bottom-1.5 right-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur flex items-center gap-1">
                              <ExternalLink className="h-2.5 w-2.5" /> Agrandir
                            </div>
                          </a>
                        ) : (
                          <a
                            href={item.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-muted transition"
                            title="Télécharger / ouvrir le document"
                          >
                            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate max-w-[200px]">{item.fileName || 'Document joint'}</span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </a>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[11px]">
                      <span className="text-muted-foreground">
                        {isFromAtelier ? (
                          item.seen ? (
                            <span className="text-emerald-600 font-semibold inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Lu
                            </span>
                          ) : (
                            <span className="text-amber-600 font-bold inline-flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Non lu
                            </span>
                          )
                        ) : (
                          <span className="text-muted-foreground">Transmis à l'Atelier</span>
                        )}
                      </span>

                      <div className="flex items-center gap-2">
                        {isFromAtelier && (
                          <button
                            type="button"
                            onClick={() => handleToggleSeen(item)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                          >
                            <Eye className="h-3 w-3" />
                            {item.seen ? 'Marquer non lu' : 'Marquer comme lu'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleArchive(item)}
                          className="text-muted-foreground hover:text-destructive transition p-1 cursor-pointer"
                          title="Archiver cette alerte"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
