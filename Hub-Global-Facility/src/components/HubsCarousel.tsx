import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Layers,
  LayoutGrid,
  SlidersHorizontal,
} from 'lucide-react';
import { HubKey, ViewId } from '../config/hubPermissions';

export interface HubCardSubItem {
  id: ViewId;
  title: string;
  badge?: string;
  badgeColor?: string;
  description: string;
  icon: React.ComponentType<{ size?: number; color?: string; className?: string; style?: React.CSSProperties }>;
}

export interface HubCardData {
  key: HubKey;
  title: string;
  description: string;
  image: string;
  accentColor: string;
  bgLight: string;
  badge?: string;
  menuLabel?: string;
  defaultView: ViewId;
  icon: React.ComponentType<{ size?: number; color?: string; className?: string; style?: React.CSSProperties }>;
  items: HubCardSubItem[];
}

interface HubsCarouselProps {
  cards: HubCardData[];
  viewMode: 'carousel' | 'grid';
  onChangeViewMode: (mode: 'carousel' | 'grid') => void;
  onNavigate: (view: ViewId) => void;
  onOpenCustomize: () => void;
}

export default function HubsCarousel({
  cards,
  viewMode,
  onChangeViewMode,
  onNavigate,
  onOpenCustomize,
}: HubsCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchPaused, setIsTouchPaused] = useState(false);
  const [isManualPaused, setIsManualPaused] = useState(false);
  const [openMenuCardId, setOpenMenuCardId] = useState<string | null>(null);
  const [openMenuCard, setOpenMenuCard] = useState<HubCardData | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const activeMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuPopoverRef = useRef<HTMLDivElement | null>(null);
  const touchResumeTimerRef = useRef<number | null>(null);
  const manualResumeTimerRef = useRef<number | null>(null);
  const floatScrollRef = useRef<number>(0);

  const shouldLoop = viewMode === 'carousel' && cards.length > 1;
  const renderedCards = shouldLoop ? [...cards, ...cards] : cards;

  const positionPopover = (triggerEl: HTMLButtonElement | null, itemsCount: number) => {
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(Math.max(rect.width, 340), vw - 20);
    const left = Math.max(10, Math.min(rect.left, vw - width - 10));
    const estHeight = Math.min(310, itemsCount * 54 + 44);
    const openUp = vh - rect.bottom - 14 < estHeight && rect.top > estHeight;
    setMenuStyle({
      position: 'fixed',
      left: `${left}px`,
      width: `${width}px`,
      ...(openUp ? { bottom: `${vh - rect.top + 8}px` } : { top: `${rect.bottom + 8}px` }),
      zIndex: 9999,
    });
  };

  useEffect(() => {
    if (!openMenuCardId) return;
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        activeMenuTriggerRef.current?.contains(target) ||
        menuPopoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpenMenuCardId(null);
      setOpenMenuCard(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuCardId(null);
        setOpenMenuCard(null);
      }
    };
    const onScrollOrResize = (e: Event) => {
      if (menuPopoverRef.current && e.target instanceof Node && menuPopoverRef.current.contains(e.target)) {
        return;
      }
      positionPopover(activeMenuTriggerRef.current, openMenuCard?.items.length || 4);
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [openMenuCardId, openMenuCard]);

  const updateScrollState = () => {
    const el = trackRef.current;
    if (!el) return;
    if (shouldLoop) {
      setCanScrollLeft(true);
      setCanScrollRight(el.scrollWidth > el.clientWidth + 10);
      return;
    }
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  };

  useEffect(() => {
    updateScrollState();
    const timer = window.setTimeout(updateScrollState, 150);
    window.addEventListener('resize', updateScrollState);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [cards.length, viewMode]);

  // Défilement continu ultra-fluide (requestAnimationFrame, boucle infinie sans coupure)
  useEffect(() => {
    if (!shouldLoop || isHovered || isTouchPaused || isManualPaused || Boolean(openMenuCardId)) return;
    const el = trackRef.current;
    if (!el) return;

    floatScrollRef.current = el.scrollLeft;
    let rafId = 0;
    let lastTime = performance.now();
    const speedPxPerSec = 32; // Glissement lent et constant, lisible sur PC & mobile

    const step = (now: number) => {
      const dt = Math.min(now - lastTime, 50);
      lastTime = now;

      const halfWidth = el.scrollWidth / 2;
      if (halfWidth > el.clientWidth / 2 && el.scrollWidth > el.clientWidth + 12) {
        floatScrollRef.current += (speedPxPerSec * dt) / 1000;
        if (floatScrollRef.current >= halfWidth) {
          floatScrollRef.current -= halfWidth;
        }
        el.scrollLeft = floatScrollRef.current;
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [shouldLoop, isHovered, isTouchPaused, isManualPaused, openMenuCardId, cards.length]);

  useEffect(() => {
    return () => {
      if (touchResumeTimerRef.current) {
        window.clearTimeout(touchResumeTimerRef.current);
      }
      if (manualResumeTimerRef.current) {
        window.clearTimeout(manualResumeTimerRef.current);
      }
    };
  }, []);

  const handleTouchStart = () => {
    setIsTouchPaused(true);
    if (touchResumeTimerRef.current) {
      window.clearTimeout(touchResumeTimerRef.current);
    }
  };

  const handleTouchEnd = () => {
    if (touchResumeTimerRef.current) {
      window.clearTimeout(touchResumeTimerRef.current);
    }
    touchResumeTimerRef.current = window.setTimeout(() => {
      setIsTouchPaused(false);
    }, 3500);
  };

  const scrollTrack = (direction: 'left' | 'right') => {
    const el = trackRef.current;
    if (!el) return;
    setIsManualPaused(true);
    if (manualResumeTimerRef.current) {
      window.clearTimeout(manualResumeTimerRef.current);
    }

    const halfWidth = el.scrollWidth / 2;
    if (shouldLoop && direction === 'left' && el.scrollLeft < 20 && halfWidth > 0) {
      el.scrollLeft = halfWidth;
    }

    const step = Math.min(el.clientWidth * 0.82, 360);
    el.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth',
    });

    manualResumeTimerRef.current = window.setTimeout(() => {
      setIsManualPaused(false);
    }, 1200);
  };

  return (
    <section className="reveal-3" aria-label="Mes Hubs Métiers" style={{ marginBottom: '30px' }}>
      {/* En-tête section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "'Ruda', sans-serif",
              fontSize: '21px',
              fontWeight: 900,
              color: '#1B4565',
              margin: 0,
              letterSpacing: '-0.2px',
            }}
          >
            Vos Espaces Métiers
          </h2>
          <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#3989B7', fontWeight: 600 }}>
            {cards.length} hub{cards.length > 1 ? 's' : ''} actif{cards.length > 1 ? 's' : ''} selon vos accès et vos préférences
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Bascule Carrousel / Grille (Desktop & Mobile) */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              border: '1px solid #D7EAF5',
              borderRadius: '10px',
              padding: '3px',
              gap: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => onChangeViewMode('carousel')}
              title="Vue Carrousel"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                backgroundColor: viewMode === 'carousel' ? '#39A9DC' : 'transparent',
                color: viewMode === 'carousel' ? '#FFFFFF' : '#3989B7',
              }}
            >
              <Columns3 size={13} />
              <span>Carrousel</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode('grid')}
              title="Vue Grille"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: '7px',
                border: 'none',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                backgroundColor: viewMode === 'grid' ? '#39A9DC' : 'transparent',
                color: viewMode === 'grid' ? '#FFFFFF' : '#3989B7',
              }}
            >
              <LayoutGrid size={13} />
              <span>Grille</span>
            </button>
          </div>

          {viewMode === 'carousel' && cards.length > 1 && (
            <div className="desktop-only" style={{ alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                className="ui-btn"
                disabled={!canScrollLeft}
                onClick={() => scrollTrack('left')}
                aria-label="Faire défiler à gauche"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  border: '1px solid #D7EAF5',
                  backgroundColor: '#FFFFFF',
                  color: '#1B4565',
                  opacity: canScrollLeft ? 1 : 0.4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canScrollLeft ? 'pointer' : 'default',
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="ui-btn"
                disabled={!canScrollRight}
                onClick={() => scrollTrack('right')}
                aria-label="Faire défiler à droite"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  border: '1px solid #D7EAF5',
                  backgroundColor: '#FFFFFF',
                  color: '#1B4565',
                  opacity: canScrollRight ? 1 : 0.4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canScrollRight ? 'pointer' : 'default',
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          <button
            type="button"
            className="ui-btn"
            onClick={onOpenCustomize}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 13px',
              borderRadius: '10px',
              backgroundColor: '#FFFFFF',
              border: '1.5px solid #B7D8EA',
              color: '#1B4565',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={14} color="#39A9DC" />
            <span>Personnaliser mes Hubs</span>
          </button>
        </div>
      </div>

      {cards.length === 0 ? (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            border: '1.5px dashed #B7D8EA',
            padding: '36px 20px',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#1B4565' }}>
            Aucun Hub sélectionné sur votre page d’accueil.
          </p>
          <button
            type="button"
            className="ui-btn"
            onClick={onOpenCustomize}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 18px',
              borderRadius: '10px',
              backgroundColor: '#39A9DC',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={15} />
            <span>Réactiver des Hubs</span>
          </button>
        </div>
      ) : (
        <div
          className="hubs-carousel-shell"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {viewMode === 'carousel' && canScrollRight && (
            <div className="hubs-carousel-fade-right" />
          )}

          <div
            ref={trackRef}
            onScroll={updateScrollState}
            className={viewMode === 'grid' ? 'hubs-grid-container' : 'hubs-carousel-track'}
          >
            {renderedCards.map((card, idx) => {
              const CardIcon = card.icon;
              return (
                <article
                  key={`${card.key}-${idx}`}
                  className={viewMode === 'grid' ? 'hub-feature-card' : 'hub-feature-card hub-carousel-card'}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '20px',
                    border: '1.5px solid #D7EAF5',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 6px 20px rgba(27, 69, 101, 0.06)',
                  }}
                >
                  {/* Bandeau Visuel aéré — zéro chevauchement, zoom fluide au survol */}
                  <div
                    onClick={() => onNavigate(card.defaultView)}
                    style={{
                      position: 'relative',
                      height: '154px',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      backgroundColor: '#1B4565',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={card.image}
                      alt={card.title}
                      loading="lazy"
                      className="hub-card-cover-img"
                    />
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(180deg, rgba(27, 69, 101, 0.22) 0%, rgba(27, 69, 101, 0.52) 48%, rgba(27, 69, 101, 0.94) 100%)',
                      }}
                    />

                    {/* Barre supérieure du bandeau : Icône à gauche + Badge à droite */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        left: '14px',
                        right: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '11px',
                          backgroundColor: 'rgba(255, 255, 255, 0.18)',
                          border: '1px solid rgba(255, 255, 255, 0.42)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <CardIcon size={19} color="#FFFFFF" />
                      </div>

                      {card.badge && (
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            color: '#1B4565',
                            fontSize: '10.5px',
                            fontWeight: 800,
                            boxShadow: '0 3px 10px rgba(0,0,0,0.16)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {card.badge}
                        </span>
                      )}
                    </div>

                    {/* Bas du bandeau : Titre net sur 1-2 lignes + bouton pilule Ouvrir */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '14px',
                        right: '14px',
                        bottom: '13px',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontFamily: "'Ruda', sans-serif",
                          fontSize: '15.5px',
                          fontWeight: 900,
                          color: '#FFFFFF',
                          lineHeight: 1.22,
                          textShadow: '0 2px 6px rgba(0,0,0,0.35)',
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {card.title}
                      </h3>

                      <span
                        className="hub-open-pill"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 11px',
                          borderRadius: '999px',
                          backgroundColor: '#FFFFFF',
                          color: '#1B4565',
                          fontSize: '11px',
                          fontWeight: 800,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                          flexShrink: 0,
                        }}
                      >
                        <span>Ouvrir</span>
                        <ArrowRight size={12} />
                      </span>
                    </div>
                  </div>

                  {/* Corps de carte : description + sous-modules cliquables */}
                  <div
                    style={{
                      padding: '14px 16px 16px',
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: '12px',
                        color: '#64748B',
                        lineHeight: 1.45,
                      }}
                    >
                      {card.description}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {card.items.length > 1 ? (
                        (() => {
                          const cardInstanceId = `${card.key}-${idx}`;
                          const isMenuOpen = openMenuCardId === cardInstanceId;
                          const primaryBadge = card.items[0]?.badge;
                          const primaryBadgeColor = card.items[0]?.badgeColor || card.accentColor;
                          return (
                            <button
                              type="button"
                              className="hub-subitem-row"
                              onClick={(e) => {
                                const btn = e.currentTarget;
                                if (isMenuOpen) {
                                  setOpenMenuCardId(null);
                                  setOpenMenuCard(null);
                                  activeMenuTriggerRef.current = null;
                                } else {
                                  activeMenuTriggerRef.current = btn;
                                  positionPopover(btn, card.items.length);
                                  setOpenMenuCardId(cardInstanceId);
                                  setOpenMenuCard(card);
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                                padding: '9px 11px',
                                borderRadius: '11px',
                                backgroundColor: isMenuOpen ? card.bgLight : '#F4F9FC',
                                border: isMenuOpen ? `1.5px solid ${card.accentColor}` : '1px solid #D7EAF5',
                                color: '#1B4565',
                                fontSize: '12px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <Layers size={14} color={card.accentColor} style={{ flexShrink: 0 }} />
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {card.menuLabel || 'Choisir un espace'} ({card.items.length})
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                {primaryBadge && (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 800,
                                      padding: '2px 7px',
                                      borderRadius: '999px',
                                      backgroundColor: '#FFFFFF',
                                      color: primaryBadgeColor,
                                      border: `1px solid ${primaryBadgeColor}33`,
                                    }}
                                  >
                                    {primaryBadge}
                                  </span>
                                )}
                                <ChevronDown
                                  size={14}
                                  color="#3989B7"
                                  style={{
                                    transform: isMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.18s ease',
                                  }}
                                />
                              </div>
                            </button>
                          );
                        })()
                      ) : (
                        card.items.map((subItem) => {
                          const SubIcon = subItem.icon;
                          return (
                            <button
                              key={subItem.id}
                              type="button"
                              className="hub-subitem-row"
                              onClick={() => onNavigate(subItem.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '8px',
                                padding: '9px 11px',
                                borderRadius: '11px',
                                backgroundColor: '#F4F9FC',
                                border: '1px solid #D7EAF5',
                                color: '#1B4565',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = card.bgLight;
                                e.currentTarget.style.borderColor = card.accentColor;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#F4F9FC';
                                e.currentTarget.style.borderColor = '#D7EAF5';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <SubIcon size={14} color={card.accentColor} style={{ flexShrink: 0 }} />
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {subItem.title}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                {subItem.badge && (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 800,
                                      padding: '2px 7px',
                                      borderRadius: '999px',
                                      backgroundColor: '#FFFFFF',
                                      color: subItem.badgeColor || card.accentColor,
                                      border: `1px solid ${subItem.badgeColor || card.accentColor}33`,
                                    }}
                                  >
                                    {subItem.badge}
                                  </span>
                                )}
                                <ChevronRight size={14} color="#3989B7" className="hub-subitem-arrow" />
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* Menu Portal pour les Hubs multi-espaces (ex: Responsables de Secteur) */}
      {openMenuCard &&
        createPortal(
          <div
            ref={menuPopoverRef}
            className="hero-search-dropdown"
            style={{
              ...menuStyle,
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              border: '1.5px solid #B7D8EA',
              boxShadow: '0 18px 40px rgba(27, 69, 101, 0.22)',
              overflow: 'hidden',
              fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
            }}
          >
            <div
              style={{
                padding: '9px 12px',
                backgroundColor: '#F4F9FC',
                borderBottom: '1px solid #D7EAF5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#1B4565', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {openMenuCard.title}
              </span>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#3989B7' }}>
                {openMenuCard.items.length} espaces
              </span>
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {openMenuCard.items.map((subItem) => {
                const SubIcon = subItem.icon;
                return (
                  <button
                    key={subItem.id}
                    type="button"
                    onClick={() => {
                      setOpenMenuCardId(null);
                      setOpenMenuCard(null);
                      onNavigate(subItem.id);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '9px 10px',
                      borderRadius: '10px',
                      border: '1px solid transparent',
                      backgroundColor: 'transparent',
                      color: '#1B4565',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.14s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = openMenuCard.bgLight;
                      e.currentTarget.style.borderColor = '#B7D8EA';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '8px',
                          backgroundColor: openMenuCard.bgLight,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <SubIcon size={15} color={subItem.badgeColor || openMenuCard.accentColor} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#1B4565', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {subItem.title}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {subItem.description}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {subItem.badge && (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '999px',
                            backgroundColor: '#FFFFFF',
                            color: subItem.badgeColor || openMenuCard.accentColor,
                            border: `1px solid ${subItem.badgeColor || openMenuCard.accentColor}33`,
                          }}
                        >
                          {subItem.badge}
                        </span>
                      )}
                      <ChevronRight size={14} color="#3989B7" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
