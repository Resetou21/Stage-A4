import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Building2,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Lightbulb,
  Loader2,
  Megaphone,
  Newspaper,
  Plus,
  Send,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { ViewId } from '../config/hubPermissions';

export interface NewsSlide {
  id: string;
  tag: string;
  tagColor: string;
  tagBg: string;
  accentColor: string;
  title: string;
  summary: string;
  dateLabel: string;
  actionLabel?: string;
  targetView?: ViewId;
  openRoadmap?: boolean;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

interface CustomNewsItem {
  id: string;
  title: string;
  content: string;
  category: string;
  author: string;
  date: string;
  active: boolean;
}

interface NewsCarouselProps {
  monday: any;
  stats: {
    chantiersActifs: number;
    tauxSatisfactionGlobal: number;
    etoiles: { Global: { s3: number } };
    machinesTotal: number;
    inventairesRealises: number;
  };
  canViewSecteurs: boolean;
  canViewAtelier: boolean;
  canViewCommercial: boolean;
  canPublishNews?: boolean;
  currentUserName?: string;
  onNavigate: (view: ViewId) => void;
  onOpenRoadmap: () => void;
}

const BOARD_ROADMAP_ID = 5105479748;
const GROUP_DONE_ID = 'group_mm7y1vv8';
const BOARD_NEWS_ID = 5108705371;
const NEWS_COLS = {
  content: 'long_text_mm9gnh5f',
  category: 'text_mm9grd0s',
  author: 'text_mm9g6k43',
  date: 'date_mm9g5z9f',
  active: 'boolean_mm9gdhjz',
} as const;

const NEWS_CACHE_KEY = 'facility_news_delivered_v1';
const CUSTOM_NEWS_CACHE_KEY = 'facility_custom_news_v1';

const NEWS_CATEGORIES = [
  { id: 'Vie d’entreprise', tagColor: '#1B4565', tagBg: '#EBF6FC', accentColor: '#39A9DC' },
  { id: 'Info RH / Salariés', tagColor: '#0E7042', tagBg: '#E6F9F1', accentColor: '#00C875' },
  { id: 'Sécurité / Qualité', tagColor: '#D66927', tagBg: '#FFF4EB', accentColor: '#D66927' },
  { id: 'Commercial', tagColor: '#B87414', tagBg: '#FEF6E7', accentColor: '#F7AC37' },
  { id: 'Nouveauté Hub', tagColor: '#6D28D9', tagBg: '#F3E8FF', accentColor: '#7C3AED' },
] as const;

function getCategoryStyle(cat: string) {
  const found = NEWS_CATEGORIES.find((c) => c.id.toLowerCase() === (cat || '').toLowerCase());
  return found || NEWS_CATEGORIES[0];
}

function fmtDateFr(isoDate: string): string {
  if (!isoDate) return '';
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return isoDate;
}

export default function NewsCarousel({
  monday,
  stats,
  canViewSecteurs,
  canViewAtelier,
  canViewCommercial,
  canPublishNews = false,
  currentUserName = 'Direction',
  onNavigate,
  onOpenRoadmap,
}: NewsCarouselProps) {
  const [deliveredItems, setDeliveredItems] = useState<Array<{ id: string; name: string; workspace: string; date: string }>>(() => {
    try {
      const raw = localStorage.getItem(NEWS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.ts && Date.now() - parsed.ts < 10 * 60 * 1000 && Array.isArray(parsed.items)) {
          return parsed.items;
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [customNews, setCustomNews] = useState<CustomNewsItem[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_NEWS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.ts && Date.now() - parsed.ts < 5 * 60 * 1000 && Array.isArray(parsed.items)) {
          return parsed.items;
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Modale de publication / gestion des actualités
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsCategory, setNewsCategory] = useState<string>(NEWS_CATEGORIES[0].id);
  const [newsContent, setNewsContent] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadCustomNews = async (force = false) => {
    if (!force) {
      try {
        const raw = localStorage.getItem(CUSTOM_NEWS_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.ts && Date.now() - parsed.ts < 5 * 60 * 1000 && Array.isArray(parsed.items)) {
            return;
          }
        }
      } catch {
        // ignore
      }
    }
    try {
      const q = `query {
        boards(ids: [${BOARD_NEWS_ID}]) {
          items_page(limit: 50) {
            items {
              id
              name
              state
              column_values(ids: ["${NEWS_COLS.content}", "${NEWS_COLS.category}", "${NEWS_COLS.author}", "${NEWS_COLS.date}", "${NEWS_COLS.active}"]) {
                id
                text
                value
              }
            }
          }
        }
      }`;
      const res: any = await monday.api(q);
      const raw = res?.data?.boards?.[0]?.items_page?.items || [];
      const list: CustomNewsItem[] = raw
        .filter((it: any) => !it.state || it.state === 'active')
        .map((it: any) => {
          const byId = new Map<string, any>();
          (it.column_values || []).forEach((cv: any) => byId.set(cv.id, cv));
          const activeCv = byId.get(NEWS_COLS.active);
          let isAct = activeCv?.text === 'v' || activeCv?.text === 'true';
          if (!isAct && activeCv?.value) {
            try {
              const p = JSON.parse(activeCv.value);
              isAct = p?.checked === true || p?.checked === 'true';
            } catch {
              // ignore
            }
          }
          return {
            id: String(it.id),
            title: String(it.name || '').trim(),
            content: String(byId.get(NEWS_COLS.content)?.text || '').trim(),
            category: String(byId.get(NEWS_COLS.category)?.text || NEWS_CATEGORIES[0].id).trim(),
            author: String(byId.get(NEWS_COLS.author)?.text || '').trim(),
            date: String(byId.get(NEWS_COLS.date)?.text || '').trim(),
            active: isAct,
          };
        })
        .filter((x: CustomNewsItem) => x.title)
        .sort((a: CustomNewsItem, b: CustomNewsItem) => (b.date || '').localeCompare(a.date || ''));

      setCustomNews(list);
      try {
        localStorage.setItem(CUSTOM_NEWS_CACHE_KEY, JSON.stringify({ ts: Date.now(), items: list }));
      } catch {
        // ignore
      }
    } catch {
      // silent fallback
    }
  };

  useEffect(() => {
    let mounted = true;
    loadCustomNews(false);

    // Chargement des nouveautés livrées depuis la Boîte à Idées
    try {
      const raw = localStorage.getItem(NEWS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.ts && Date.now() - parsed.ts < 10 * 60 * 1000 && Array.isArray(parsed.items)) {
          return () => {
            mounted = false;
          };
        }
      }
    } catch {
      // ignore
    }
    const loadDelivered = async () => {
      try {
        const q = `query {
          boards(ids: [${BOARD_ROADMAP_ID}]) {
            groups(ids: ["${GROUP_DONE_ID}"]) {
              items_page(limit: 8) {
                items {
                  id
                  name
                  column_values(ids: ["multi_selectp70jvoio", "date_mm7yphvc"]) {
                    id
                    text
                  }
                }
              }
            }
          }
        }`;
        const res: any = await monday.api(q);
        const raw = res?.data?.boards?.[0]?.groups?.[0]?.items_page?.items || [];
        const list = raw
          .map((it: any) => {
            const ws = it.column_values?.find((c: any) => c.id === 'multi_selectp70jvoio')?.text || 'Intranet';
            const dt = it.column_values?.find((c: any) => c.id === 'date_mm7yphvc')?.text || '';
            return {
              id: String(it.id),
              name: String(it.name || '').replace(/^\[[^\]]+\]\s*/, '').trim(),
              workspace: ws,
              date: dt,
            };
          })
          .filter((x: any) => x.name);

        if (mounted && list.length > 0) {
          setDeliveredItems(list);
          try {
            localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ ts: Date.now(), items: list }));
          } catch {
            // ignore
          }
        }
      } catch {
        // silent fallback
      }
    };
    loadDelivered();
    return () => {
      mounted = false;
    };
  }, [monday]);

  const handlePublishNews = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newsTitle.trim();
    const cleanContent = newsContent.trim();
    if (!cleanTitle || !cleanContent) {
      setPublishError('Veuillez renseigner un titre et un message.');
      return;
    }

    setPublishing(true);
    setPublishError(null);
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const colVals = JSON.stringify({
        [NEWS_COLS.content]: { text: cleanContent },
        [NEWS_COLS.category]: newsCategory,
        [NEWS_COLS.author]: currentUserName,
        [NEWS_COLS.date]: { date: todayIso },
        [NEWS_COLS.active]: { checked: 'true' },
      });

      const mut = `mutation ($name: String!, $vals: JSON!) {
        create_item(board_id: ${BOARD_NEWS_ID}, item_name: $name, column_values: $vals) {
          id
        }
      }`;
      const res: any = await monday.api(mut, { variables: { name: cleanTitle, vals: colVals } });
      const newId = String(res?.data?.create_item?.id || Date.now());

      const created: CustomNewsItem = {
        id: newId,
        title: cleanTitle,
        content: cleanContent,
        category: newsCategory,
        author: currentUserName,
        date: todayIso,
        active: true,
      };
      const updated = [created, ...customNews];
      setCustomNews(updated);
      try {
        localStorage.setItem(CUSTOM_NEWS_CACHE_KEY, JSON.stringify({ ts: Date.now(), items: updated }));
      } catch {
        // ignore
      }
      setNewsTitle('');
      setNewsContent('');
      setActiveIndex(0);
      setShowPublishModal(false);
    } catch (err: any) {
      setPublishError(err?.message || 'Impossible de publier cette actualité sur Monday.');
    } finally {
      setPublishing(false);
    }
  };

  const handleToggleNewsActive = async (item: CustomNewsItem) => {
    setTogglingId(item.id);
    const nextActive = !item.active;
    try {
      const val = nextActive ? JSON.stringify({ checked: 'true' }) : JSON.stringify({});
      const mut = `mutation ($itemId: ID!, $val: JSON!) {
        change_column_value(board_id: ${BOARD_NEWS_ID}, item_id: $itemId, column_id: "${NEWS_COLS.active}", value: $val) { id }
      }`;
      await monday.api(mut, { variables: { itemId: item.id, val } });
      const updated = customNews.map((n) => (n.id === item.id ? { ...n, active: nextActive } : n));
      setCustomNews(updated);
      try {
        localStorage.setItem(CUSTOM_NEWS_CACHE_KEY, JSON.stringify({ ts: Date.now(), items: updated }));
      } catch {
        // ignore
      }
    } catch {
      // ignore
    } finally {
      setTogglingId(null);
    }
  };

  const slides: NewsSlide[] = useMemo(() => {
    const curYear = new Date().getFullYear();
    const base: NewsSlide[] = [];

    // 1. Actualités publiées dynamiquement depuis le tableau Monday (en priorité en tête du carrousel)
    customNews
      .filter((n) => n.active)
      .slice(0, 6)
      .forEach((n) => {
        const st = getCategoryStyle(n.category);
        base.push({
          id: `custom-news-${n.id}`,
          tag: n.category.toUpperCase(),
          tagColor: st.tagColor,
          tagBg: st.tagBg,
          accentColor: st.accentColor,
          title: n.title,
          summary: n.content,
          dateLabel: [n.date ? fmtDateFr(n.date) : '', n.author ? `Par ${n.author}` : ''].filter(Boolean).join(' • '),
          icon: Megaphone,
        });
      });

    // 2. Chiffres clés live
    if (canViewSecteurs) {
      base.push({
        id: 'kpi-sat',
        tag: 'QUALITÉ GROUPE',
        tagColor: '#0E7042',
        tagBg: '#E6F9F1',
        accentColor: '#00C875',
        title: `${stats.tauxSatisfactionGlobal}% de satisfaction client certifiée en ${curYear}`,
        summary: `${stats.etoiles.Global.s3} chantiers atteignent le niveau maximal 3 étoiles sur ${stats.chantiersActifs} sites suivis.`,
        dateLabel: 'En direct Monday',
        actionLabel: 'Voir la supervision',
        targetView: 'secteur_global',
        icon: Award,
      });
    }

    if (canViewAtelier) {
      base.push({
        id: 'kpi-atelier',
        tag: 'PARC MATÉRIEL',
        tagColor: '#3989B7',
        tagBg: '#EBF6FC',
        accentColor: '#39A9DC',
        title: `${stats.machinesTotal} machines suivies avec fiches de contrôle en direct`,
        summary: 'Consultez les fiches techniques, compteurs horaires et l’avancement des réparations curatives atelier.',
        dateLabel: 'Temps réel',
        actionLabel: 'Ouvrir l’Atelier',
        targetView: 'atelier_erp',
        icon: Wrench,
      });
    }

    if (canViewCommercial) {
      base.push({
        id: 'kpi-commercial',
        tag: 'COMMERCIAL & PORTEFEUILLE',
        tagColor: '#B87414',
        tagBg: '#FEF6E7',
        accentColor: '#F7AC37',
        title: `${stats.chantiersActifs} chantiers actifs suivis dans le Hub Commercial`,
        summary: 'Pilotage en direct des gains, pertes, tranches de CA annuel, volumes horaires et provenances.',
        dateLabel: 'En direct Monday',
        actionLabel: 'Ouvrir le Hub Commercial',
        targetView: 'commercial_contrats',
        icon: Building2,
      });
    }

    // 3. Nouveautés livrées depuis la Boîte à Idées
    deliveredItems.slice(0, 4).forEach((item) => {
      base.push({
        id: `news-${item.id}`,
        tag: `NOUVEAUTÉ LIVRÉE • ${item.workspace.toUpperCase()}`,
        tagColor: '#D66927',
        tagBg: '#FFF4EB',
        accentColor: '#D66927',
        title: item.name,
        summary: 'Évolution déployée sur l’écosystème Groupe Facility suite aux retours des équipes.',
        dateLabel: item.date || `Livré ${curYear}`,
        actionLabel: 'Voir la Boîte à Idées',
        openRoadmap: true,
        icon: Sparkles,
      });
    });

    if (base.length === 0) {
      base.push({
        id: 'welcome-intranet',
        tag: 'INTRANET GROUPE FACILITY',
        tagColor: '#3989B7',
        tagBg: '#EBF6FC',
        accentColor: '#39A9DC',
        title: 'Votre espace de travail unifié et personnalisable est actif',
        summary: 'Utilisez la barre de recherche ou le bouton Personnaliser pour adapter vos Hubs favoris.',
        dateLabel: 'Actualités',
        actionLabel: 'Idées & Roadmap',
        openRoadmap: true,
        icon: Lightbulb,
      });
    }

    return base;
  }, [customNews, canViewSecteurs, canViewAtelier, canViewCommercial, stats, deliveredItems]);

  useEffect(() => {
    if (activeIndex >= slides.length) {
      setActiveIndex(0);
    }
  }, [slides.length, activeIndex]);

  useEffect(() => {
    if (isPaused || showPublishModal || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [isPaused, showPublishModal, slides.length]);

  const current = slides[activeIndex] || slides[0];
  const SlideIcon = current.icon;

  const goPrev = () => setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  const goNext = () => setActiveIndex((prev) => (prev + 1) % slides.length);

  return (
    <>
      <section
        aria-label="Actualités et temps forts Groupe Facility"
        className={`reveal-2 news-carousel-card ${isPaused ? 'is-paused' : ''}`}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={(e) => {
          setIsPaused(true);
          touchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const endX = e.changedTouches[0]?.clientX ?? null;
          if (touchStartX.current !== null && endX !== null) {
            const diff = touchStartX.current - endX;
            if (diff > 40) goNext();
            else if (diff < -40) goPrev();
          }
          touchStartX.current = null;
          setIsPaused(false);
        }}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '18px',
          border: '1.5px solid #D7EAF5',
          borderLeft: `4px solid ${current.accentColor}`,
          padding: '16px 22px',
          marginBottom: '28px',
          boxShadow: '0 6px 22px rgba(27, 69, 101, 0.05)',
          position: 'relative',
          overflow: 'hidden',
          transition: 'border-left-color 0.35s ease',
        }}
      >
        {/* En-tête compact du carrousel d'actualités */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            marginBottom: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '8px',
                backgroundColor: '#1B4565',
                color: '#FFFFFF',
                fontSize: '10.5px',
                fontWeight: 800,
                letterSpacing: '0.5px',
                fontFamily: "'Ruda', sans-serif",
              }}
            >
              <Newspaper size={12} color="#F7AC37" />
              <span>ACTUALITÉS &amp; À LA UNE</span>
            </span>
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: '999px',
                backgroundColor: current.tagBg,
                color: current.tagColor,
                transition: 'all 0.25s ease',
              }}
            >
              {current.tag}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {canPublishNews && (
              <button
                type="button"
                className="ui-btn"
                onClick={() => {
                  setPublishError(null);
                  setShowPublishModal(true);
                  loadCustomNews(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 11px',
                  borderRadius: '8px',
                  border: '1px solid #B7D8EA',
                  backgroundColor: '#EBF6FC',
                  color: '#1B4565',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
                title="Publier ou gérer les actualités Groupe Facility (sans modifier le code)"
              >
                <Plus size={13} color="#39A9DC" />
                <span>Publier une actu</span>
              </button>
            )}

            {/* Contrôles carrousel */}
            {slides.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {slides.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={`Actualité ${idx + 1}`}
                      onClick={() => setActiveIndex(idx)}
                      style={{
                        width: idx === activeIndex ? '20px' : '7px',
                        height: '7px',
                        borderRadius: '999px',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        backgroundColor: idx === activeIndex ? '#39A9DC' : '#CBD5E1',
                        transition: 'all 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    className="ui-btn"
                    onClick={goPrev}
                    aria-label="Actualité précédente"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      border: '1px solid #D7EAF5',
                      backgroundColor: '#F4F9FC',
                      color: '#1B4565',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    className="ui-btn"
                    onClick={goNext}
                    aria-label="Actualité suivante"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      border: '1px solid #D7EAF5',
                      backgroundColor: '#F4F9FC',
                      color: '#1B4565',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Corps du slide actif avec transition fluide */}
        <div
          key={`${current.id}-${activeIndex}`}
          className="news-slide-content"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1, minWidth: 'min(100%, 260px)' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '13px',
                backgroundColor: current.tagBg,
                color: current.tagColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: `1px solid ${current.accentColor}30`,
              }}
            >
              <SlideIcon size={21} color={current.tagColor} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3
                style={{
                  margin: '0 0 4px 0',
                  fontFamily: "'Ruda', sans-serif",
                  fontSize: '15.5px',
                  fontWeight: 900,
                  color: '#1B4565',
                  lineHeight: 1.3,
                }}
              >
                {current.title}
              </h3>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.45 }}>
                {current.summary}
                {current.dateLabel ? (
                  <span style={{ color: '#3989B7', fontWeight: 700 }}> • {current.dateLabel}</span>
                ) : null}
              </p>
            </div>
          </div>

          {(current.targetView || current.openRoadmap) && (
            <button
              type="button"
              className="ui-btn"
              onClick={() => {
                if (current.openRoadmap) onOpenRoadmap();
                else if (current.targetView) onNavigate(current.targetView);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 15px',
                borderRadius: '10px',
                backgroundColor: '#EBF6FC',
                color: '#1B4565',
                border: '1px solid #B7D8EA',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{current.actionLabel || 'Découvrir'}</span>
              <ChevronRight size={14} color="#39A9DC" />
            </button>
          )}
        </div>
      </section>

      {/* MODALE PUBLICATION & GESTION DES ACTUALITÉS */}
      {showPublishModal && (
        <div
          onClick={() => setShowPublishModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.52)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '580px',
              maxHeight: '88vh',
              overflowY: 'auto',
              backgroundColor: '#FFFFFF',
              borderRadius: '18px',
              border: '1.5px solid #D7EAF5',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.25)',
              padding: '22px 24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '11px',
                    backgroundColor: '#EBF6FC',
                    color: '#39A9DC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Megaphone size={19} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '17px', fontWeight: 900, color: '#1B4565' }}>
                    Publier une actualité entreprise
                  </h3>
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#64748B' }}>
                    Stockée dans Monday (📰 Actualités &amp; News) et affichée en direct dans le carrousel.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                style={{
                  border: 'none',
                  background: '#F1F5F9',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePublishNews} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#1B4565', marginBottom: '5px' }}>
                  Catégorie
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {NEWS_CATEGORIES.map((c) => {
                    const selected = newsCategory === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setNewsCategory(c.id)}
                        style={{
                          padding: '5px 11px',
                          borderRadius: '999px',
                          border: selected ? `1.5px solid ${c.accentColor}` : '1px solid #CBD5E1',
                          backgroundColor: selected ? c.tagBg : '#FFFFFF',
                          color: selected ? c.tagColor : '#475569',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {c.id}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#1B4565', marginBottom: '5px' }}>
                  Titre de l’actualité *
                </label>
                <input
                  type="text"
                  value={newsTitle}
                  onChange={(e) => setNewsTitle(e.target.value)}
                  placeholder="Ex : Bienvenue à Mélanie au Pôle RH !"
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '13px',
                    color: '#0F172A',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#1B4565', marginBottom: '5px' }}>
                  Message court *
                </label>
                <textarea
                  value={newsContent}
                  onChange={(e) => setNewsContent(e.target.value)}
                  placeholder="Décrivez l’annonce en 1 ou 2 phrases claires pour toute l’équipe…"
                  rows={3}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '13px',
                    color: '#0F172A',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {publishError && (
                <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#FEF2F2', color: '#B91C1C', fontSize: '12px', fontWeight: 700 }}>
                  {publishError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  style={{
                    padding: '9px 14px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={publishing}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#1B4565',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: publishing ? 'wait' : 'pointer',
                  }}
                >
                  {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>{publishing ? 'Publication…' : 'Publier en direct'}</span>
                </button>
              </div>
            </form>

            {/* Liste des actualités déjà publiées (afficher / masquer en 1 clic) */}
            {customNews.length > 0 && (
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E2EFF7' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#1B4565', marginBottom: '10px' }}>
                  Actualités enregistrées ({customNews.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {customNews.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: '1px solid #E2EFF7',
                        backgroundColor: n.active ? '#F8FAFC' : '#F1F5F9',
                        opacity: n.active ? 1 : 0.65,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#1B4565' }}>{n.title}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          {n.category} {n.date ? `• ${fmtDateFr(n.date)}` : ''} {n.active ? '• Visible' : '• Masquée'}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={togglingId === n.id}
                        onClick={() => handleToggleNewsActive(n)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                          color: n.active ? '#D66927' : '#0E7042',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <EyeOff size={12} />
                        <span>{n.active ? 'Masquer' : 'Réafficher'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
