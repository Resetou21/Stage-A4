import { useState } from 'react';
import { Plus, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { addMeetingTopic } from '@generated/server/meeting';

export default function NewTopic() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const topic = text.trim();
    if (!topic) return;
    setBusy(true);
    setMsg(null);
    try {
      await addMeetingTopic({ data: { topic } });
      setText('');
      setOpen(false);
      setMsg({ ok: true, text: '✓ Sujet ajouté dans « A faire » !' });
      toast.success('Sujet ajouté avec succès !', {
        description: `« ${topic} » est prêt dans « A faire » pour la prochaine réunion d'associés.`,
      });
      setTimeout(() => {
        setMsg(null);
      }, 4000);
    } catch (err) {
      console.error(err);
      setMsg({ ok: false, text: 'Impossible d’ajouter le sujet. Réessayez.' });
      toast.error('Erreur lors de l’ajout du sujet. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return (
    <div className="flex flex-col items-center gap-1.5">
      <button type="button" onClick={() => { setOpen(true); setMsg(null); }} aria-label="Ajouter un nouveau sujet"
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-primary text-primary transition hover:bg-primary hover:text-primary-foreground shadow-xs">
        <Plus className="h-5 w-5" />
      </button>
      <span className="text-xs text-muted-foreground font-medium">Nouveau sujet</span>
      {msg && (
        <output className={`text-center text-xs font-bold px-2 py-1 rounded-md transition-all ${
          msg.ok ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-destructive border border-red-200'
        }`}>
          {msg.text}
        </output>
      )}
    </div>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={255} rows={2}
        placeholder="Nouveau sujet…" aria-label="Nouveau sujet"
        className="w-full resize-none rounded-[var(--radius-md)] border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !text.trim()}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-[var(--radius-md)] bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Valider
        </button>
        <button type="button" onClick={() => { setOpen(false); setText(''); }} disabled={busy} aria-label="Annuler"
          className="inline-flex min-h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-border hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      {msg && !msg.ok && <span role="alert" className="text-xs text-destructive">{msg.text}</span>}
    </form>
  );
}
