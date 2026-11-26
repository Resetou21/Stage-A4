import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  FolderOpen,
  Info,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';

interface SalariesHubViewProps {
  monday: any;
}

interface RhSalarie {
  id: string;
  name: string;
  telephone: string;
  langue: string;
  secteur: string;
  chantier: string;
  statut: string;
  derniereMaj: string;
}

interface AccompagnementLog {
  id: string;
  salarie: string;
  telephone: string;
  dateEnvoi: string;
  animatrice: string;
  theme: string;
  syntheseFr: string;
  messageTraduit: string;
  langue: string;
  statutEnvoi: string;
}

const BOARD_SALARIES_ID = 5108574616;
const BOARD_ACCOMPAGNEMENTS_ID = 5108574626;
const CACHE_KEY = 'facility_salaries_hub_v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

type SubTab = 'annuaire' | 'dossier' | 'groupes';

export default function SalariesHubView({ monday }: SalariesHubViewProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('annuaire');
  const [salaries, setSalaries] = useState<RhSalarie[]>([]);
  const [messages, setMessages] = useState<AccompagnementLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'actifs' | 'tous' | 'sans_tel' | 'sortis'>('actifs');
  const [selectedSalarieId, setSelectedSalarieId] = useState<string>('');

  const loadData = useCallback(
    async (force = false) => {
      if (!force) {
        try {
          const raw = sessionStorage.getItem(CACHE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.ts && Date.now() - parsed.ts < CACHE_TTL_MS) {
              setSalaries(parsed.salaries || []);
              setMessages(parsed.messages || []);
              if (!selectedSalarieId && parsed.salaries?.[0]?.id) {
                setSelectedSalarieId(parsed.salaries[0].id);
              }
              setLoading(false);
              return;
            }
          }
        } catch {
          // ignore
        }
      }

      setLoading(true);
      try {
        const qSal = `query {
          boards(ids: [${BOARD_SALARIES_ID}]) {
            items_page(limit: 500) {
              items {
                id
                name
                column_values(ids: ["text_mm9esavp", "color_mm9enz2j", "color_mm9essp0", "text_mm9efgtq", "color_mm9ea1d9", "date_mm9ekt1k"]) {
                  id
                  text
                }
              }
            }
          }
        }`;

        const qMsg = `query {
          boards(ids: [${BOARD_ACCOMPAGNEMENTS_ID}]) {
            items_page(limit: 200) {
              items {
                id
                name
                column_values(ids: ["text_mm9eesg2", "text_mm9e4qyw", "date_mm9e39vd", "color_mm9ekdvf", "color_mm9echbq", "long_text_mm9efr78", "long_text_mm9er6mr", "text_mm9ep2xf", "color_mm9epdm8"]) {
                  id
                  text
                }
              }
            }
          }
        }`;

        const [resSal, resMsg]: any[] = await Promise.all([
          monday.api(qSal),
          monday.api(qMsg),
        ]);

        const rawSal: any[] = resSal?.data?.boards?.[0]?.items_page?.items || [];
        const parsedSal: RhSalarie[] = rawSal
          .map((it) => {
            const m = new Map<string, string>();
            (it.column_values || []).forEach((cv: any) => {
              if (cv?.id) m.set(cv.id, String(cv.text || '').trim());
            });
            return {
              id: String(it.id),
              name: String(it.name || '').trim(),
              telephone: m.get('text_mm9esavp') || '',
              langue: m.get('color_mm9enz2j') || 'Français',
              secteur: m.get('color_mm9essp0') || '',
              chantier: m.get('text_mm9efgtq') || '',
              statut: m.get('color_mm9ea1d9') || 'Actif',
              derniereMaj: m.get('date_mm9ekt1k') || '',
            };
          })
          .filter((s) => s.name)
          .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

        const rawMsg: any[] = resMsg?.data?.boards?.[0]?.items_page?.items || [];
        const parsedMsg: AccompagnementLog[] = rawMsg
          .map((it) => {
            const m = new Map<string, string>();
            (it.column_values || []).forEach((cv: any) => {
              if (cv?.id) m.set(cv.id, String(cv.text || '').trim());
            });
            return {
              id: String(it.id),
              salarie: m.get('text_mm9eesg2') || String(it.name || '').trim(),
              telephone: m.get('text_mm9e4qyw') || '',
              dateEnvoi: m.get('date_mm9e39vd') || '',
              animatrice: m.get('color_mm9ekdvf') || '',
              theme: m.get('color_mm9echbq') || 'Général',
              syntheseFr: m.get('long_text_mm9efr78') || '',
              messageTraduit: m.get('long_text_mm9er6mr') || '',
              langue: m.get('text_mm9ep2xf') || 'Français',
              statutEnvoi: m.get('color_mm9epdm8') || '',
            };
          })
          .filter((x) => x.statutEnvoi.toLowerCase() !== 'modèle' && x.statutEnvoi.toLowerCase() !== 'modele')
          .sort((a, b) => b.dateEnvoi.localeCompare(a.dateEnvoi));

        setSalaries(parsedSal);
        setMessages(parsedMsg);
        if (parsedSal.length > 0) {
          setSelectedSalarieId((cur) => cur || parsedSal[0].id);
        }

        try {
          sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ ts: Date.now(), salaries: parsedSal, messages: parsedMsg })
          );
        } catch {
          // ignore
        }
      } catch (err) {
        console.error('[Hub Salariés & RH] Erreur chargement:', err);
      } finally {
        setLoading(false);
      }
    },
    [monday, selectedSalarieId]
  );

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const stats = useMemo(() => {
    const actifs = salaries.filter((s) => s.statut.toLowerCase() !== 'sorti');
    const sortis = salaries.filter((s) => s.statut.toLowerCase() === 'sorti');
    const avecTel = actifs.filter((s) => Boolean(s.telephone.replace(/\D/g, ''))).length;
    const sansTel = actifs.length - avecTel;
    const nonFr = actifs.filter((s) => s.langue && !s.langue.toLowerCase().includes('fran')).length;
    return {
      totalActifs: actifs.length,
      totalSortis: sortis.length,
      avecTel,
      sansTel,
      nonFr,
      totalMessages: messages.length,
    };
  }, [salaries, messages]);

  const filteredSalaries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return salaries.filter((s) => {
      const isSorti = s.statut.toLowerCase() === 'sorti';
      if (statusFilter === 'actifs' && isSorti) return false;
      if (statusFilter === 'sortis' && !isSorti) return false;
      if (statusFilter === 'sans_tel' && (isSorti || Boolean(s.telephone.replace(/\D/g, '')))) return false;
      if (q) {
        const hay = `${s.name} ${s.telephone} ${s.langue} ${s.secteur} ${s.chantier}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [salaries, search, statusFilter]);

  const selectedSalarie = useMemo(
    () => salaries.find((s) => s.id === selectedSalarieId) || salaries[0] || null,
    [salaries, selectedSalarieId]
  );

  const selectedSalarieMessages = useMemo(() => {
    if (!selectedSalarie) return [];
    const nameLow = selectedSalarie.name.toLowerCase().trim();
    const telDigits = selectedSalarie.telephone.replace(/\D/g, '');
    return messages.filter((m) => {
      const mName = m.salarie.toLowerCase().trim();
      const mTel = m.telephone.replace(/\D/g, '');
      return (mName && mName === nameLow) || (telDigits && mTel && mTel.endsWith(telDigits.slice(-9)));
    });
  }, [selectedSalarie, messages]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#F4F9FC', padding: '24px 28px 48px' }}>
      <div style={{ maxWidth: '1360px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Bannière En-tête */}
        <div
          style={{
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #1B4565 0%, #26618B 55%, #39A9DC 100%)',
            padding: '22px 26px',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
            boxShadow: '0 10px 28px rgba(27, 69, 101, 0.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                backgroundColor: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.32)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={24} color="#FFFFFF" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '21px', fontWeight: 900, color: '#FFFFFF' }}>
                  Enchantement Salarié
                </h1>
                <span
                  style={{
                    padding: '2px 9px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(247, 172, 55, 0.25)',
                    border: '1px solid rgba(247, 172, 55, 0.65)',
                    color: '#FEF6E7',
                    fontSize: '10.5px',
                    fontWeight: 800,
                  }}
                >
                  Enchantement salarié • En direct Monday
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: 'rgba(255,255,255,0.88)' }}>
                Annuaire centralisé des salariés, dossiers de suivi RH et espace préparé pour les groupes de diffusion WhatsApp.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <a
              href={`https://groupefacility.monday.com/boards/${BOARD_SALARIES_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 13px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255,255,255,0.16)',
                border: '1px solid rgba(255,255,255,0.28)',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <span>Tableau Liste Salariés</span>
              <ExternalLink size={12} />
            </a>
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 13px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#FFFFFF',
                color: '#1B4565',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Actualiser</span>
            </button>
          </div>
        </div>

        {/* KPIs rapides */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '12px' }}>
          {[
            { label: 'Salariés actifs', val: stats.totalActifs, sub: `${stats.totalSortis} sorti(s) exclu(s)`, color: '#1B4565' },
            { label: 'Avec n° WhatsApp', val: stats.avecTel, sub: 'Joignables immédiatement', color: '#0E7042' },
            { label: 'Sans téléphone', val: stats.sansTel, sub: 'À compléter par RH', color: stats.sansTel > 0 ? '#D66927' : '#0E7042' },
            { label: 'Langues étrangères', val: stats.nonFr, sub: 'Traduction auto active', color: '#3989B7' },
            { label: 'Messages tracés', val: stats.totalMessages, sub: 'Historique accompagnements', color: '#B87414' },
          ].map((kpi) => (
            <div
              key={kpi.label}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #D7EAF5',
                padding: '14px 16px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748B' }}>
                {kpi.label}
              </div>
              <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '26px', fontWeight: 900, color: kpi.color, marginTop: '4px' }}>
                {loading ? '—' : kpi.val}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Onglets de l'Espace Salariés */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(
            [
              ['annuaire', `Annuaire Salariés (${stats.totalActifs})`, Users],
              ['dossier', `Dossier & Suivi Salarié (${stats.totalMessages} msg)`, FolderOpen],
              ['groupes', 'Groupes de Diffusion & Cadrage RH', Sparkles],
            ] as const
          ).map(([id, label, Icon]) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '9px 15px',
                  borderRadius: '11px',
                  border: active ? '1.5px solid #1B4565' : '1px solid #D7EAF5',
                  backgroundColor: active ? '#1B4565' : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#1B4565',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <Icon size={15} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* ==================== ONGLET 1 : ANNUAIRE SALARIÉS ==================== */}
        {activeTab === 'annuaire' && (
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #D7EAF5', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '380px' }}>
                <Search size={14} color="#64748B" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un salarié, téléphone, langue, chantier..."
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 32px',
                    borderRadius: '9px',
                    border: '1px solid #CBD5E1',
                    fontSize: '12.5px',
                    color: '#1B4565',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(
                  [
                    ['actifs', 'Actifs'],
                    ['sans_tel', `Sans tél. (${stats.sansTel})`],
                    ['sortis', `Sortis (${stats.totalSortis})`],
                    ['tous', 'Tous'],
                  ] as const
                ).map(([fId, fLabel]) => (
                  <button
                    key={fId}
                    type="button"
                    onClick={() => setStatusFilter(fId)}
                    style={{
                      padding: '6px 11px',
                      borderRadius: '999px',
                      border: statusFilter === fId ? '1px solid #3989B7' : '1px solid #CBD5E1',
                      backgroundColor: statusFilter === fId ? '#EBF6FC' : '#FFFFFF',
                      color: statusFilter === fId ? '#1B4565' : '#64748B',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {fLabel}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '36px 0', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                <Loader2 size={22} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                Chargement de l’annuaire Enchantement salarié...
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #E2EFF7' }}>
                <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F4F9FC', borderBottom: '1.5px solid #D7EAF5', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: '#3989B7' }}>
                      <th style={{ padding: '10px 12px' }}>Salarié</th>
                      <th style={{ padding: '10px 12px' }}>Téléphone</th>
                      <th style={{ padding: '10px 12px' }}>Langue</th>
                      <th style={{ padding: '10px 12px' }}>Secteur / Chantier</th>
                      <th style={{ padding: '10px 12px' }}>Statut RH</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Dossier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSalaries.map((s) => {
                      const isSorti = s.statut.toLowerCase() === 'sorti';
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #EEF5FA' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: '#1B4565' }}>{s.name}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: s.telephone ? '#1B4565' : '#D66927', fontWeight: 700 }}>
                            {s.telephone ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                <Phone size={12} color="#0E7042" />
                                {s.telephone}
                              </span>
                            ) : (
                              'Non renseigné'
                            )}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '999px', backgroundColor: '#EBF6FC', color: '#1B4565', fontSize: '11px', fontWeight: 700 }}>
                              {s.langue || 'Français'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: '#475569' }}>
                            {[s.secteur, s.chantier].filter(Boolean).join(' • ') || '—'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span
                              style={{
                                padding: '2px 9px',
                                borderRadius: '999px',
                                fontSize: '11px',
                                fontWeight: 800,
                                backgroundColor: isSorti ? '#FEF2F2' : '#E6F9F1',
                                color: isSorti ? '#DC2626' : '#0E7042',
                              }}
                            >
                              {s.statut || 'Actif'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSalarieId(s.id);
                                setActiveTab('dossier');
                              }}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '8px',
                                border: '1px solid #B7D8EA',
                                backgroundColor: '#F4F9FC',
                                color: '#1B4565',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Ouvrir le suivi
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredSalaries.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: '#64748B' }}>
                          Aucun salarié ne correspond à ce filtre.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div
              style={{
                borderRadius: '11px',
                backgroundColor: '#F8FBFD',
                border: '1px solid #D7EAF5',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <ShieldCheck size={16} color="#0E7042" style={{ flexShrink: 0 }} />
              <span>
                <strong>Source unique &amp; RGPD :</strong> Cet annuaire centralisé dans <em>Enchantement salarié</em> sert de socle partagé pour le <strong>Pôle RH</strong>, les <strong>messages WhatsApp</strong> (Hub Animatrices) et le <strong>pointage conducteurs</strong> (Hub Véhicules), sans stocker de données de paie sensibles (IBAN, n° sécu, salaires).
              </span>
            </div>
          </div>
        )}

        {/* ==================== ONGLET 2 : DOSSIER & SUIVI SALARIÉ ==================== */}
        {activeTab === 'dossier' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 310px) 1fr', gap: '16px', alignItems: 'start' }}>
            {/* Colonne gauche : choix du salarié */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #D7EAF5', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#3989B7', textTransform: 'uppercase' }}>
                Sélectionner un salarié ({salaries.length})
              </div>
              <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {salaries.map((s) => {
                  const isSel = selectedSalarie?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSalarieId(s.id)}
                      style={{
                        textAlign: 'left',
                        padding: '9px 11px',
                        borderRadius: '10px',
                        border: isSel ? '1.5px solid #39A9DC' : '1px solid transparent',
                        backgroundColor: isSel ? '#EBF6FC' : '#F8FAFC',
                        color: '#1B4565',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: '12.5px', fontWeight: 800 }}>{s.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                        {s.langue || 'Français'} • {s.telephone || 'Sans tél.'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Colonne droite : fiche dossier salarié */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #D7EAF5', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {selectedSalarie ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid #EBF6FC', paddingBottom: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#EBF6FC', color: '#1B4565', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UserCheck size={22} color="#3989B7" />
                      </div>
                      <div>
                        <h2 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '18px', fontWeight: 900, color: '#1B4565' }}>
                          {selectedSalarie.name}
                        </h2>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                          {selectedSalarie.telephone || 'Téléphone non renseigné'} • Langue : <strong>{selectedSalarie.langue || 'Français'}</strong>
                          {selectedSalarie.chantier ? ` • Chantier : ${selectedSalarie.chantier}` : ''}
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '999px',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        backgroundColor: selectedSalarie.statut.toLowerCase() === 'sorti' ? '#FEF2F2' : '#E6F9F1',
                        color: selectedSalarie.statut.toLowerCase() === 'sorti' ? '#DC2626' : '#0E7042',
                      }}
                    >
                      Statut RH : {selectedSalarie.statut || 'Actif'}
                    </span>
                  </div>

                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#1B4565', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MessageCircle size={15} color="#0E7042" />
                      <span>Historique des informations transmises &amp; messages suivis ({selectedSalarieMessages.length})</span>
                    </div>

                    {selectedSalarieMessages.length === 0 ? (
                      <div style={{ padding: '24px', borderRadius: '12px', border: '1px dashed #CBD5E1', backgroundColor: '#F8FAFC', textAlign: 'center', color: '#64748B', fontSize: '12.5px' }}>
                        Aucun message tracé pour <strong>{selectedSalarie.name}</strong> pour le moment.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {selectedSalarieMessages.map((msg) => (
                          <div
                            key={msg.id}
                            style={{
                              borderRadius: '12px',
                              border: '1px solid #D7EAF5',
                              backgroundColor: '#FAFCFE',
                              padding: '12px 14px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ padding: '2px 8px', borderRadius: '999px', backgroundColor: '#E6F9F1', color: '#0E7042', fontSize: '11px', fontWeight: 800 }}>
                                  {msg.theme}
                                </span>
                                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#1B4565' }}>
                                  {msg.dateEnvoi || 'Date NC'} {msg.animatrice ? `• Par ${msg.animatrice}` : ''}
                                </span>
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#3989B7' }}>
                                {msg.statutEnvoi || 'Transmis'}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '12.5px', color: '#1E293B', lineHeight: 1.45 }}>
                              {msg.syntheseFr || msg.messageTraduit || '—'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      borderRadius: '11px',
                      backgroundColor: '#FEF9EE',
                      border: '1px solid #FDE68A',
                      padding: '10px 14px',
                      fontSize: '12px',
                      color: '#92400E',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <FileText size={15} color="#D66927" style={{ flexShrink: 0 }} />
                    <span>
                      <strong>Espace évolutif RH :</strong> ce dossier salarié est prêt à être enrichi après la réunion du 01/12 (messages cochés « Suivi », formations, visites médicales, équipements remis…).
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ padding: '32px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                  Sélectionnez un salarié à gauche pour consulter son dossier de suivi.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== ONGLET 3 : CADRAGE GROUPES DIFFUSION (MARDI 01/12) ==================== */}
        {activeTab === 'groupes' && (
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #D7EAF5', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Info size={20} color="#39A9DC" />
              <div>
                <h2 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '16.5px', fontWeight: 900, color: '#1B4565' }}>
                  Module Groupes de Diffusion &amp; Traçabilité WhatsApp (à valider en réunion du 01/12)
                </h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                  Architecture préparée selon les demandes Direction / RH — prête à être activée dès création du compte Monday de Mélanie.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              {[
                {
                  title: '1. Groupes de diffusion liés aux Salariés',
                  desc: 'Création et modification réservées exclusivement à Mélanie (RH), avec pastille d’information pour les autres utilisateurs. Retrait automatique dès qu’un salarié passe en statut « Sorti ».',
                },
                {
                  title: '2. Affectation rapide des nouveaux salariés',
                  desc: 'Vue dédiée dans l’espace de Mélanie listant automatiquement tout nouveau salarié actif non encore rattaché à un groupe.',
                },
                {
                  title: '3. Option « Message suivi » → Dossier Salarié',
                  desc: 'Case à cocher lors de l’envoi WhatsApp (avec pastille d’info) : les messages importants (sécurité, protocoles…) s’ajoutent au Dossier Salarié ; les messages ponctuels (ex : virements) restent sans suivi.',
                },
                {
                  title: '4. Compteur Reçus / Non lus + liste nominative',
                  desc: 'Affichage chez l’expéditeur du nombre de reçus et de la liste des personnes n’ayant pas encore lu (manuel en mode gratuit wa.me, ou 100 % automatique avec l’API WhatsApp Business Meta).',
                },
              ].map((b) => (
                <div
                  key={b.title}
                  style={{
                    borderRadius: '12px',
                    border: '1px solid #D7EAF5',
                    backgroundColor: '#F8FBFD',
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: 800, color: '#1B4565', marginBottom: '6px' }}>
                    <CheckCircle2 size={15} color="#00C875" />
                    <span>{b.title}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
