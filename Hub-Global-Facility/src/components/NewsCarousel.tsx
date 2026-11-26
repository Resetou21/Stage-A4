import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Building2,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Newspaper,
  Sparkles,
  Wrench,
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
  onNavigate: (view: ViewId) => void;
  onOpenRoadmap: () => void;
}

const BOARD_ROADMAP_ID = 5105479748;
const GROUP_DONE_ID = 'group_mm7y1vv8';
const NEWS_CACHE_KEY = 'facility_news_delivered_v1';

export default function NewsCarousel({
  monday,
  stats,
  canViewSecteurs,
  canViewAtelier,
  canViewCommercial,
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
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

  const slides: NewsSlide[] = useMemo(() => {
    const curYear = new Date().getFullYear();
    const base: NewsSlide[] = [];

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
  }, [canViewSecteurs, canViewAtelier, canViewCommercial, stats, deliveredItems]);

  useEffect(() => {
    if (activeIndex >= slides.length) {
      setActiveIndex(0);
    }
  }, [slides.length, activeIndex]);

  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [isPaused, slides.length]);

  const current = slides[activeIndex] || slides[0];
  const SlideIcon = current.icon;

  const goPrev = () => setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  const goNext = () => setActiveIndex((prev) => (prev + 1) % slides.length);

  return (
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
  );
}
