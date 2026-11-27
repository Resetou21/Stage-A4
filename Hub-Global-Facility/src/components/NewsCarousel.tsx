import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Newspaper,
  Plus,
} from 'lucide-react';
import { ViewId } from '../config/hubPermissions';
import {
  CustomNewsItem,
  fetchCustomNews,
  fmtNewsDateFr,
  getNewsCategoryStyle,
  readCachedCustomNews,
} from '../services/newsService';

export interface NewsSlide {
  id: string;
  tag: string;
  tagColor: string;
  tagBg: string;
  accentColor: string;
  title: string;
  summary: string;
  dateLabel: string;
  imageUrl?: string;
  actionLabel?: string;
  targetView?: ViewId;
  openRoadmap?: boolean;
  openNewsPage?: boolean;
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
  canPublishNews?: boolean;
  onNavigate: (view: ViewId) => void;
  onOpenRoadmap: () => void;
  onOpenNewsPage: (openComposer?: boolean) => void;
}

export default function NewsCarousel({
  monday,
  canPublishNews = false,
  onNavigate,
  onOpenRoadmap,
  onOpenNewsPage,
}: NewsCarouselProps) {
  const [customNews, setCustomNews] = useState<CustomNewsItem[]>(() => readCachedCustomNews());
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;

    fetchCustomNews(monday, false)
      .then((list) => {
        if (mounted) setCustomNews(list);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [monday]);

  const activeCustomNews = useMemo(() => customNews.filter((n) => n.active), [customNews]);

  const slides: NewsSlide[] = useMemo(() => {
    const base: NewsSlide[] = [];

    // Uniquement les vraies actualités publiées depuis le Journal (100 % modifiables / supprimables)
    activeCustomNews.slice(0, 10).forEach((n) => {
      const st = getNewsCategoryStyle(n.category);
      base.push({
        id: `custom-news-${n.id}`,
        tag: n.category.toUpperCase(),
        tagColor: st.tagColor,
        tagBg: st.tagBg,
        accentColor: st.accentColor,
        title: n.title,
        summary: n.content,
        dateLabel: [n.date ? fmtNewsDateFr(n.date) : '', n.author ? `Par ${n.author}` : ''].filter(Boolean).join(' • '),
        imageUrl: n.imageUrl,
        actionLabel: 'Lire dans le Journal',
        openNewsPage: true,
        icon: Megaphone,
      });
    });

    if (base.length === 0) {
      base.push({
        id: 'empty-news',
        tag: 'JOURNAL GROUPE FACILITY',
        tagColor: '#3989B7',
        tagBg: '#EBF6FC',
        accentColor: '#39A9DC',
        title: 'Aucune actualité publiée pour le moment',
        summary: canPublishNews
          ? 'Cliquez sur « + Publier » pour partager une annonce, une photo ou une info d’équipe avec tout le monde.'
          : 'Les prochaines actualités, photos et annonces de Groupe Facility apparaîtront ici.',
        dateLabel: 'Journal interne',
        actionLabel: canPublishNews ? 'Publier une actualité' : 'Ouvrir le Journal',
        openNewsPage: true,
        icon: Newspaper,
      });
    }

    return base;
  }, [activeCustomNews, canPublishNews]);

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="ui-btn"
            onClick={() => onOpenNewsPage(false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              borderRadius: '8px',
              border: '1px solid #D7EAF5',
              backgroundColor: '#F4F9FC',
              color: '#1B4565',
              fontSize: '11px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
            title="Ouvrir le Journal complet des actualités"
          >
            <Newspaper size={12} color="#39A9DC" />
            <span>Toutes les actus{activeCustomNews.length > 0 ? ` (${activeCustomNews.length})` : ''}</span>
          </button>

          {canPublishNews && (
            <button
              type="button"
              className="ui-btn"
              onClick={() => onOpenNewsPage(true)}
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
              title="Publier un nouvel article avec photo"
            >
              <Plus size={13} color="#39A9DC" />
              <span>Publier</span>
            </button>
          )}

          {/* Contrôles carrousel */}
          {slides.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

      {/* Corps du slide actif avec miniature photo si disponible */}
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
          {current.imageUrl ? (
            <img
              src={current.imageUrl}
              alt={current.title}
              onClick={() => onOpenNewsPage(false)}
              style={{
                width: '68px',
                height: '52px',
                borderRadius: '11px',
                objectFit: 'cover',
                flexShrink: 0,
                border: '1.5px solid #D7EAF5',
                cursor: 'pointer',
              }}
            />
          ) : (
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
          )}
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
            <p
              style={{
                margin: 0,
                fontSize: '12.5px',
                color: '#475569',
                lineHeight: 1.45,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {current.summary}
              {current.dateLabel ? (
                <span style={{ color: '#3989B7', fontWeight: 700 }}> • {current.dateLabel}</span>
              ) : null}
            </p>
          </div>
        </div>

        {(current.targetView || current.openRoadmap || current.openNewsPage) && (
          <button
            type="button"
            className="ui-btn"
            onClick={() => {
              if (current.openNewsPage) onOpenNewsPage(false);
              else if (current.openRoadmap) onOpenRoadmap();
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
