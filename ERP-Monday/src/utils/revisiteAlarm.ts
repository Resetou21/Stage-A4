import monday from '../services/monday';

// IDs utilisateurs Monday Groupe Facility (issus de list_users_and_teams)
export const MONDAY_USER_IDS = {
  CHRISTOPHE: 122044710, // le mauff Christophe (responsable parc matériel)
  VINCENT: 102108076,    // RIVIERE (Direction / Flotte)
  GUILLAUME: 118562356,
  LAURENT: 76526870,
} as const;

const SOUND_PREF_KEY = 'erp_revisite_sound_enabled_v1';
const NOTIFIED_PREFIX = 'erp_revisite_monday_notified_';

export function isRevisiteSoundEnabled(): boolean {
  try {
    const val = localStorage.getItem(SOUND_PREF_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setRevisiteSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_PREF_KEY, enabled ? 'true' : 'false');
  } catch {}
}

/**
 * Joue un petit carillon doux (3 notes) via Web Audio API sans aucun fichier externe.
 */
export function playRevisiteChime(): boolean {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return false;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [587.33, 783.99, 1046.5]; // Ré5 -> Sol5 -> Do6 (carillon doux)

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.14 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.34);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.36);
    });

    window.setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 1200);
    return true;
  } catch {
    return false;
  }
}

function escapeIcsText(str: string): string {
  return (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Génère et télécharge un fichier .ics (Outlook, Google Calendar, Apple/Android Calendar)
 * avec 2 alarmes intégrées (la veille à 17h00 et le matin à 08h30).
 */
export function downloadRevisiteIcs(params: {
  machineName: string;
  site?: string;
  date: string; // YYYY-MM-DD
  notes?: string;
}): void {
  const cleanDate = params.date.replace(/-/g, '').slice(0, 8);
  if (!/^\d{8}$/.test(cleanDate)) return;

  const uid = `revisite-${cleanDate}-${Date.now()}@groupefacility.fr`;
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const summary = `Revisite technique : ${params.machineName}${params.site && params.site !== '—' ? ` (${params.site})` : ''}`;
  const description = [
    `Revisite technique programmée depuis le Hub Parc Matériel Groupe Facility.`,
    `Machine : ${params.machineName}`,
    params.site && params.site !== '—' ? `Site / Chantier : ${params.site}` : '',
    params.notes ? `Notes : ${params.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Groupe Facility//Hub Parc Materiel//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${cleanDate}T083000`,
    `DTEND:${cleanDate}T093000`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `LOCATION:${escapeIcsText(params.site && params.site !== '—' ? params.site : 'Sur site')}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(`Rappel 30 min avant : ${summary}`)}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(`Revisite demain : ${summary}`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = params.machineName.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
  a.download = `Revisite_${safeName}_${params.date}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Envoie une notification native dans la cloche Monday (PC + Push mobile).
 * Anti-doublon optionnel (1 fois par jour et par machine).
 */
export async function sendMondayNativeNotification(params: {
  userId: number;
  targetItemId: string | number;
  text: string;
  dedupeKey?: string;
}): Promise<boolean> {
  if (params.dedupeKey) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const storageKey = `${NOTIFIED_PREFIX}${params.dedupeKey}_${today}`;
      if (localStorage.getItem(storageKey)) {
        return true;
      }
      localStorage.setItem(storageKey, '1');
    } catch {}
  }

  try {
    const res: any = await (monday as any).api(
      `mutation SendNativeNotif($userId: ID!, $targetId: ID!, $text: String!) {
        create_notification(
          user_id: $userId,
          target_id: $targetId,
          text: $text,
          target_type: Project
        ) {
          text
        }
      }`,
      {
        variables: {
          userId: String(params.userId),
          targetId: String(params.targetItemId),
          text: params.text.slice(0, 240),
        },
      }
    );
    return Boolean(res?.data?.create_notification);
  } catch (err) {
    console.warn('Notification native Monday non envoyée:', err);
    return false;
  }
}
