import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, MapPin } from 'lucide-react';

export interface MobileCalendarEvent {
  id: string;
  title: string;
  start: string;
  backgroundColor: string;
  borderColor?: string;
  extendedProps?: {
    machine?: string;
    site?: string;
    type?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    reservedBy?: string;
    isControleRealise?: boolean;
    isRevisite?: boolean;
    isMachineExit?: boolean;
    controleData?: any;
    exitData?: { date: string; reason: string; author: string; comment: string };
    [k: string]: any;
  };
}

interface MobileAgendaCalendarProps {
  events: MobileCalendarEvent[];
  onSelectEvent: (ev: MobileCalendarEvent) => void;
}

const WEEKDAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function toYmd(y: number, mZero: number, d: number): string {
  return `${y}-${String(mZero + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function getTodayYmd(): string {
  const n = new Date();
  return toYmd(n.getFullYear(), n.getMonth(), n.getDate());
}

function formatDayHeaderFr(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export const MobileAgendaCalendar: React.FC<MobileAgendaCalendarProps> = ({
  events,
  onSelectEvent,
}) => {
  const todayYmd = getTodayYmd();
  const [cursorMonth, setCursorMonth] = useState<{ year: number; month: number }>(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string>(todayYmd);
  const [listMode, setListMode] = useState<'day' | 'month'>('day');

  const monthPrefix = `${cursorMonth.year}-${String(cursorMonth.month + 1).padStart(2, '0')}`;

  // Index des événements par jour (YYYY-MM-DD)
  const eventsByDay = useMemo(() => {
    const map = new Map<string, MobileCalendarEvent[]>();
    for (const ev of events) {
      const startDay = (ev.start || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay)) continue;
      const arr = map.get(startDay) || [];
      arr.push(ev);
      map.set(startDay, arr);
    }
    return map;
  }, [events]);

  // Grille des cellules du mois (lundi -> dimanche)
  const calendarCells = useMemo(() => {
    const first = new Date(cursorMonth.year, cursorMonth.month, 1);
    const daysInMonth = new Date(cursorMonth.year, cursorMonth.month + 1, 0).getDate();
    // JS: 0=Dim..6=Sam -> convertir en 0=Lun..6=Dim
    const startOffset = (first.getDay() + 6) % 7;

    const cells: Array<{ ymd: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ ymd: null, dayNum: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ ymd: toYmd(cursorMonth.year, cursorMonth.month, d), dayNum: d });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ ymd: null, dayNum: null });
    }
    return cells;
  }, [cursorMonth]);

  // Tous les événements du mois courant groupés par date (tri décroissant)
  const monthDaysWithEvents = useMemo(() => {
    const entries: Array<{ ymd: string; items: MobileCalendarEvent[] }> = [];
    eventsByDay.forEach((items, ymd) => {
      if (ymd.startsWith(monthPrefix)) {
        entries.push({ ymd, items });
      }
    });
    entries.sort((a, b) => b.ymd.localeCompare(a.ymd));
    return entries;
  }, [eventsByDay, monthPrefix]);

  const monthTotalCount = useMemo(
    () => monthDaysWithEvents.reduce((acc, d) => acc + d.items.length, 0),
    [monthDaysWithEvents]
  );

  const selectedDayEvents = useMemo(() => {
    return eventsByDay.get(selectedDay) || [];
  }, [eventsByDay, selectedDay]);

  const monthLabel = useMemo(() => {
    return new Date(cursorMonth.year, cursorMonth.month, 1).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    });
  }, [cursorMonth]);

  const shiftMonth = (delta: number) => {
    setCursorMonth((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const renderEventCard = (ev: MobileCalendarEvent) => {
    const props = ev.extendedProps || {};
    const machineLabel = (props.machine || ev.title || '').replace(/^[🟢🟠🔴📅🔄🚪]\s*/, '').trim();
    const bg = ev.backgroundColor || '#39A9DC';

    return (
      <button
        key={ev.id}
        type="button"
        onClick={() => onSelectEvent(ev)}
        style={{
          width: '100%',
          textAlign: 'left',
          backgroundColor: '#FFFFFF',
          border: '1px solid #D2E9F6',
          borderLeft: `4px solid ${bg}`,
          borderRadius: '12px',
          padding: '11px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          boxShadow: '0 2px 6px rgba(27, 69, 101, 0.05)',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <span
            style={{
              fontSize: '13.5px',
              fontWeight: 800,
              color: '#1B4565',
              lineHeight: 1.25,
              wordBreak: 'break-word',
            }}
          >
            {machineLabel}
          </span>
          <span
            style={{
              flexShrink: 0,
              fontSize: '10.5px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: bg,
              color: '#FFFFFF',
              whiteSpace: 'nowrap',
            }}
          >
            {props.isMachineExit
              ? 'Sortie parc'
              : props.isRevisite
              ? 'Revisite'
              : props.isControleRealise
              ? (props.controleData?.etatGeneral || 'Contrôle')
              : (props.type || 'Passage')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '11.5px', color: '#57778E' }}>
          {props.site && props.site !== '—' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
              <MapPin size={12} color="#39A9DC" />
              {props.site}
            </span>
          )}
          {props.reservedBy && props.reservedBy !== '—' && (
            <span>• {props.reservedBy}</span>
          )}
          {props.isMachineExit && props.exitData?.reason && (
            <span style={{ fontWeight: 700, color: '#475569' }}>• Motif : {props.exitData.reason}</span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* En-tête mois + navigation + bascule Jour / Tout le mois */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          backgroundColor: '#F5F9FC',
          padding: '8px 10px',
          borderRadius: '12px',
          border: '1px solid #D2E9F6',
        }}
      >
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Mois précédent"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            border: '1px solid #C8DCE8',
            backgroundColor: '#FFFFFF',
            color: '#1B4565',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ChevronLeft size={18} />
        </button>

        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 900, fontFamily: "'Ruda', sans-serif", color: '#1B4565', textTransform: 'capitalize' }}>
            {monthLabel}
          </div>
          <div style={{ fontSize: '11px', color: '#3989B7', fontWeight: 700 }}>
            {monthTotalCount} passage{monthTotalCount > 1 ? 's' : ''} ce mois
          </div>
        </div>

        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Mois suivant"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            border: '1px solid #C8DCE8',
            backgroundColor: '#FFFFFF',
            color: '#1B4565',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Mini-grille calendrier mensuel avec pastilles de couleurs (même repère visuel que sur PC) */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #D2E9F6',
          padding: '8px 6px 10px',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '6px' }}>
          {WEEKDAYS_FR.map((w) => (
            <div
              key={w}
              style={{
                textAlign: 'center',
                fontSize: '10.5px',
                fontWeight: 800,
                color: '#3989B7',
                padding: '3px 0',
              }}
            >
              {w}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
          {calendarCells.map((cell, idx) => {
            if (!cell.ymd) {
              return <div key={`empty-${idx}`} style={{ height: '42px' }} />;
            }
            const dayEvents = eventsByDay.get(cell.ymd) || [];
            const isToday = cell.ymd === todayYmd;
            const isSelected = cell.ymd === selectedDay && listMode === 'day';

            return (
              <button
                key={cell.ymd}
                type="button"
                onClick={() => {
                  setSelectedDay(cell.ymd!);
                  setListMode('day');
                }}
                style={{
                  height: '44px',
                  borderRadius: '10px',
                  border: isSelected
                    ? '2px solid #1B4565'
                    : isToday
                    ? '1.5px solid #39A9DC'
                    : dayEvents.length > 0
                    ? '1px solid #D2E9F6'
                    : '1px solid transparent',
                  backgroundColor: isSelected
                    ? '#1B4565'
                    : isToday
                    ? '#EBF6FC'
                    : dayEvents.length > 0
                    ? '#F8FCFE'
                    : 'transparent',
                  color: isSelected ? '#FFFFFF' : '#1B4565',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  padding: '2px',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '12.5px', fontWeight: isSelected || isToday || dayEvents.length > 0 ? 800 : 500, lineHeight: 1 }}>
                  {cell.dayNum}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', height: '7px' }}>
                  {dayEvents.slice(0, 4).map((ev, eIdx) => (
                    <span
                      key={`${cell.ymd}-dot-${eIdx}`}
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: ev.backgroundColor || '#39A9DC',
                        border: isSelected ? '1px solid #FFFFFF' : 'none',
                      }}
                    />
                  ))}
                  {dayEvents.length > 4 && (
                    <span style={{ fontSize: '8.5px', fontWeight: 900, lineHeight: 1, color: isSelected ? '#F7AC37' : '#3989B7' }}>
                      +
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Boutons rapides : Jour sélectionné / Tout le mois / Aujourd'hui */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          type="button"
          onClick={() => setListMode('day')}
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            padding: '8px 10px',
            borderRadius: '10px',
            border: listMode === 'day' ? '1.5px solid #1B4565' : '1px solid #CBD5E1',
            backgroundColor: listMode === 'day' ? '#1B4565' : '#FFFFFF',
            color: listMode === 'day' ? '#FFFFFF' : '#1B4565',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          <CalendarIcon size={13} />
          Jour ({selectedDayEvents.length})
        </button>

        <button
          type="button"
          onClick={() => setListMode('month')}
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            padding: '8px 10px',
            borderRadius: '10px',
            border: listMode === 'month' ? '1.5px solid #39A9DC' : '1px solid #CBD5E1',
            backgroundColor: listMode === 'month' ? '#39A9DC' : '#FFFFFF',
            color: listMode === 'month' ? '#FFFFFF' : '#1B4565',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          <List size={13} />
          Tout le mois ({monthTotalCount})
        </button>

        <button
          type="button"
          onClick={() => {
            const n = new Date();
            setCursorMonth({ year: n.getFullYear(), month: n.getMonth() });
            setSelectedDay(todayYmd);
            setListMode('day');
          }}
          style={{
            padding: '8px 10px',
            borderRadius: '10px',
            border: '1px solid #CBD5E1',
            backgroundColor: '#F5F9FC',
            color: '#3989B7',
            fontSize: '11.5px',
            fontWeight: 800,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Auj.
        </button>
      </div>

      {/* Cartes détaillées 100% lisibles */}
      {listMode === 'day' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#3989B7', textTransform: 'capitalize', paddingLeft: '2px' }}>
            📅 {formatDayHeaderFr(selectedDay)}
          </div>
          {selectedDayEvents.length === 0 ? (
            <div
              style={{
                padding: '18px 14px',
                borderRadius: '12px',
                backgroundColor: '#F8FCFE',
                border: '1px dashed #C8DCE8',
                textAlign: 'center',
                fontSize: '12.5px',
                color: '#64748B',
              }}
            >
              Aucun passage enregistré ce jour. Touchez un jour avec pastille ci-dessus ou « Tout le mois ».
            </div>
          ) : (
            selectedDayEvents.map(renderEventCard)
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {monthDaysWithEvents.length === 0 ? (
            <div
              style={{
                padding: '18px 14px',
                borderRadius: '12px',
                backgroundColor: '#F8FCFE',
                border: '1px dashed #C8DCE8',
                textAlign: 'center',
                fontSize: '12.5px',
                color: '#64748B',
              }}
            >
              Aucun passage enregistré sur {monthLabel}.
            </div>
          ) : (
            monthDaysWithEvents.map((group) => (
              <div key={group.ymd} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#3989B7', textTransform: 'capitalize', paddingLeft: '2px' }}>
                  📅 {formatDayHeaderFr(group.ymd)} ({group.items.length})
                </div>
                {group.items.map(renderEventCard)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
