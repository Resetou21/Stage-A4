import React, { useState, useEffect, useRef } from 'react';
import mondaySdk from 'monday-sdk-js';
import {
  Building2,
  Wrench,
  FileSpreadsheet,
  Users,
  ExternalLink,
  RefreshCw,
  Home,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Layers,
  ArrowRight,
  Maximize2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

const monday = mondaySdk();

export type ActiveHubId = 'home' | 'animatrices' | 'atelier';

interface HubModule {
  id: ActiveHubId | 'commercial' | 'rh';
  title: string;
  shortTitle: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>;
  accentColor: string;
  bgLight: string;
  borderColor: string;
  status: 'live' | 'coming_soon';
  liveUrl?: string;
  features: string[];
  kpis?: string;
}

const HUB_MODULES: HubModule[] = [
  {
    id: 'animatrices',
    title: 'Hub Responsable de Secteur',
    shortTitle: 'Secteur & Chantiers',
    tagline: 'Qualité, Visites & Consommables',
    description:
      'Pilotage des chantiers en cours, suivi des 3 étoiles de satisfaction, visites des 2 mois, alertes qualité et gestion des inventaires consommables.',
    icon: Building2,
    accentColor: '#0073EA',
    bgLight: '#EBF6FC',
    borderColor: '#C8DCE8',
    status: 'live',
    liveUrl: 'https://v4f02898b5089caaa1aab8b5114da62ee.cdn2.monday.app',
    features: [
      'Visites clients & satisfaction globale',
      'Alertes qualité & chantiers non vus depuis 11 mois',
      'Calcul automatique des avenants & économies',
      'Communication bidirectionnelle avec l’Atelier',
    ],
    kpis: '116 chantiers suivis',
  },
  {
    id: 'atelier',
    title: 'ERP Atelier & Parc Matériel',
    shortTitle: 'Atelier & Machines',
    tagline: 'Maintenance Préventive & Curative',
    description:
      'Gestion complète des machines de nettoyage, fiches de contrôle technique, tickets de réparation curatifs et planning préventif sur 12 mois.',
    icon: Wrench,
    accentColor: '#00C875',
    bgLight: '#E6F9F1',
    borderColor: '#B3EDD5',
    status: 'live',
    liveUrl: 'https://vb0e51dbd8fbf57664b5ec275468cb683.cdn2.monday.app',
    features: [
      'Inventaire des 107 machines en service actif',
      'Fiche de contrôle technique avec photos & NC',
      'Création automatique de tickets de réparation',
      'Synchronisation immédiate des relevés d’heures',
    ],
    kpis: '107 machines en parc',
  },
  {
    id: 'commercial',
    title: 'Espace Commercial & Contrats',
    shortTitle: 'Contrats & Tarifs',
    tagline: 'Avenants, Tarifs & Kalhyge',
    description:
      'Gestion commerciale des contrats de prestations et consommables, validation des avenants à la baisse et contrôle de la facturation fournisseur.',
    icon: FileSpreadsheet,
    accentColor: '#F59E0B',
    bgLight: '#FEF3C7',
    borderColor: '#FDE68A',
    status: 'coming_soon',
    features: [
      'Validation et signature des avenants consommables',
      'Mise à jour des dotations annuelles chantiers',
      'Contrôle automatique des factures Kalhyge',
      'Indicateurs d’économies directes et annuelles',
    ],
    kpis: 'Brique en préparation',
  },
  {
    id: 'rh',
    title: 'Gestion RH & Équipes Propreté',
    shortTitle: 'RH & Plannings',
    tagline: 'Agents, Absences & Affectations',
    description:
      'Planification des équipes d’agents de nettoyage, gestion des remplacements d’urgence et suivi des habilitations techniques.',
    icon: Users,
    accentColor: '#8B5CF6',
    bgLight: '#F3E8FF',
    borderColor: '#DDD6FE',
    status: 'coming_soon',
    features: [
      'Affectation des agents sur les chantiers',
      'Suivi des remplacements et absences',
      'Gestion des habilitations machines et sécurité',
      'Liaison directe avec les animateurs de secteur',
    ],
    kpis: 'Module à venir',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveHubId>('home');
  const [userName, setUserName] = useState<string>('');
  const [loadingIframe, setLoadingIframe] = useState<boolean>(false);
  const [iframeKey, setIframeKey] = useState<number>(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    monday.listen('context', (res: any) => {
      if (res?.data?.user?.name) {
        setUserName(res.data.user.name);
      }
    });

    monday.api('query { me { name } }')
      .then((res: any) => {
        if (res?.data?.me?.name) {
          setUserName(res.data.me.name);
        }
      })
      .catch(() => {});

    // Pont bidirectionnel transparent Monday SDK :
    // Relaye les requêtes postMessage de l'iframe enfant vers Monday parent,
    // et renvoie les réponses de Monday à l'iframe enfant !
    const handleBridgeMessage = (event: MessageEvent) => {
      // 1. Requête SDK venant du sous-hub (enfant) vers Monday
      if (event.source === iframeRef.current?.contentWindow) {
        if (event.data && typeof event.data === 'object') {
          window.parent.postMessage(event.data, '*');
        }
        return;
      }

      // 2. Réponse de Monday vers le sous-hub (enfant)
      if (event.source === window.parent && iframeRef.current?.contentWindow) {
        if (event.data && typeof event.data === 'object') {
          iframeRef.current.contentWindow.postMessage(event.data, '*');
        }
      }
    };

    window.addEventListener('message', handleBridgeMessage);
    return () => window.removeEventListener('message', handleBridgeMessage);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleSelectTab = (tab: ActiveHubId) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      if (tab !== 'home') {
        setLoadingIframe(true);
      }
    }
  };

  const handleRefreshActive = () => {
    setIframeKey((k) => k + 1);
    setLoadingIframe(true);
  };

  const activeModule = HUB_MODULES.find((m) => m.id === activeTab);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        backgroundColor: '#F8FAFC',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* ================= HEADER MAÎTRE UNIFIÉ ================= */}
      <header
        style={{
          height: '62px',
          backgroundColor: '#FFFFFF',
          borderBottom: '1.5px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
          zIndex: 20,
        }}
      >
        {/* Logo & Identité Groupe Facility */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            onClick={() => handleSelectTab('home')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: '#1E293B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                boxShadow: '0 2px 6px rgba(30, 41, 59, 0.25)',
              }}
            >
              <Layers size={22} color="#38BDF8" />
            </div>
            <div>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 900,
                  fontFamily: "'Ruda', sans-serif",
                  color: '#0F172A',
                  letterSpacing: '0.5px',
                  lineHeight: 1.1,
                }}
              >
                GROUPE FACILITY
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0284C7' }}>
                Portail Centralisé Multi-Hubs
              </div>
            </div>
          </div>

          <div
            style={{
              height: '24px',
              width: '1px',
              backgroundColor: '#E2E8F0',
              margin: '0 4px',
            }}
          />

          {/* Navigation des Hubs (Boutons Onglets) */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Accueil */}
            <button
              type="button"
              onClick={() => handleSelectTab('home')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '7px 14px',
                borderRadius: '9px',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: activeTab === 'home' ? '#0F172A' : 'transparent',
                color: activeTab === 'home' ? '#FFFFFF' : '#475569',
              }}
            >
              <Home size={15} />
              <span>Accueil Portail</span>
            </button>

            {/* Brique 1 : Hub Responsable de Secteur */}
            <button
              type="button"
              onClick={() => handleSelectTab('animatrices')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '7px 14px',
                borderRadius: '9px',
                fontSize: '13px',
                fontWeight: 700,
                border: activeTab === 'animatrices' ? '1.5px solid #0073EA' : '1px solid #E2E8F0',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: activeTab === 'animatrices' ? '#EBF6FC' : '#FFFFFF',
                color: activeTab === 'animatrices' ? '#0073EA' : '#1E293B',
                boxShadow: activeTab === 'animatrices' ? '0 2px 6px rgba(0, 115, 234, 0.15)' : 'none',
              }}
            >
              <Building2 size={16} color={activeTab === 'animatrices' ? '#0073EA' : '#64748B'} />
              <span>Hub Secteur</span>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#00C875',
                  marginLeft: '2px',
                }}
                title="En ligne"
              />
            </button>

            {/* Brique 2 : ERP Atelier & Parc Matériel */}
            <button
              type="button"
              onClick={() => handleSelectTab('atelier')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '7px 14px',
                borderRadius: '9px',
                fontSize: '13px',
                fontWeight: 700,
                border: activeTab === 'atelier' ? '1.5px solid #00C875' : '1px solid #E2E8F0',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: activeTab === 'atelier' ? '#E6F9F1' : '#FFFFFF',
                color: activeTab === 'atelier' ? '#0E7042' : '#1E293B',
                boxShadow: activeTab === 'atelier' ? '0 2px 6px rgba(0, 200, 117, 0.15)' : 'none',
              }}
            >
              <Wrench size={16} color={activeTab === 'atelier' ? '#00C875' : '#64748B'} />
              <span>ERP Atelier</span>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#00C875',
                  marginLeft: '2px',
                }}
                title="En ligne"
              />
            </button>
          </nav>
        </div>

        {/* Côté Droit : Actions & Profil Utilisateur */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {activeTab !== 'home' && (
            <>
              <button
                type="button"
                onClick={handleRefreshActive}
                title="Recharger ce module"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={13} />
                <span>Actualiser</span>
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                title="Basculer le plein écran"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Maximize2 size={13} />
                <span>Plein écran</span>
              </button>
            </>
          )}

          {/* Badge utilisateur Monday */}
          {userName && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 12px',
                borderRadius: '20px',
                backgroundColor: '#F1F5F9',
                border: '1px solid #E2E8F0',
                fontSize: '12px',
                fontWeight: 700,
                color: '#334155',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#00C875',
                }}
              />
              <span>{userName}</span>
            </div>
          )}
        </div>
      </header>

      {/* ================= CONTENU PRINCIPAL ================= */}
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* ================= VUE 1 : ACCUEIL / DASHBOARD PORTAIL ================= */}
        {activeTab === 'home' && (
          <div
            style={{
              height: '100%',
              overflowY: 'auto',
              padding: '32px 24px',
              maxWidth: '1200px',
              margin: '0 auto',
            }}
          >
            {/* Bannière de Bienvenue */}
            <div
              style={{
                background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
                borderRadius: '20px',
                padding: '36px 40px',
                color: '#FFFFFF',
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
                position: 'relative',
                overflow: 'hidden',
                marginBottom: '32px',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-40px',
                  right: '-40px',
                  width: '240px',
                  height: '240px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(56, 189, 248, 0.2) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }}
              />

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(56, 189, 248, 0.15)', padding: '5px 12px', borderRadius: '20px', marginBottom: '14px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                <Sparkles size={14} color="#38BDF8" />
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.3px' }}>
                  SUITE LOGICIELLE &amp; PORTAILS MÉTIERS
                </span>
              </div>

              <h1
                style={{
                  fontSize: '28px',
                  fontWeight: 900,
                  fontFamily: "'Ruda', sans-serif",
                  lineHeight: 1.2,
                  marginBottom: '10px',
                }}
              >
                Bienvenue sur le Hub Global Groupe Facility
              </h1>

              <p
                style={{
                  fontSize: '15px',
                  color: '#94A3B8',
                  maxWidth: '720px',
                  lineHeight: 1.5,
                }}
              >
                Ce portail unifie l’ensemble des applications opérationnelles de l’entreprise en une architecture modulaire.
                Chaque brique s’exécute de façon autonome, isolée des pannes et avec chargement des données à la demande.
              </p>
            </div>

            {/* Grille des Briques Métiers */}
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      fontFamily: "'Ruda', sans-serif",
                      color: '#0F172A',
                    }}
                  >
                    Briques Métiers Disponibles
                  </h2>
                  <p style={{ fontSize: '13px', color: '#64748B' }}>
                    Sélectionnez un module pour l'ouvrir immédiatement en plein écran
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    backgroundColor: '#E2E8F0',
                    color: '#334155',
                    padding: '4px 10px',
                    borderRadius: '12px',
                  }}
                >
                  2 Hubs Actifs · 2 En préparation
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px',
                }}
              >
                {HUB_MODULES.map((m) => {
                  const Icon = m.icon;
                  const isLive = m.status === 'live';

                  return (
                    <div
                      key={m.id}
                      onClick={() => {
                        if (isLive) {
                          handleSelectTab(m.id as ActiveHubId);
                        }
                      }}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '16px',
                        border: `1.5px solid ${m.borderColor}`,
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        cursor: isLive ? 'pointer' : 'default',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
                        position: 'relative',
                        opacity: isLive ? 1 : 0.85,
                      }}
                      onMouseEnter={(e) => {
                        if (isLive) {
                          e.currentTarget.style.transform = 'translateY(-3px)';
                          e.currentTarget.style.boxShadow = `0 12px 24px -4px ${m.accentColor}25`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (isLive) {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.04)';
                        }
                      }}
                    >
                      <div>
                        {/* En-tête de carte */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '16px',
                          }}
                        >
                          <div
                            style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '12px',
                              backgroundColor: m.bgLight,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: m.accentColor,
                              border: `1px solid ${m.borderColor}`,
                            }}
                          >
                            <Icon size={24} color={m.accentColor} />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '11.5px',
                                fontWeight: 800,
                                padding: '3px 9px',
                                borderRadius: '12px',
                                backgroundColor: isLive ? '#DCFCE7' : '#FEF3C7',
                                color: isLive ? '#15803D' : '#B45309',
                              }}
                            >
                              <span
                                style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: isLive ? '#16A34A' : '#D97706',
                                }}
                              />
                              {isLive ? 'Opérationnel' : 'À venir'}
                            </span>
                          </div>
                        </div>

                        {/* Titre & Description */}
                        <h3
                          style={{
                            fontSize: '16.5px',
                            fontWeight: 800,
                            fontFamily: "'Ruda', sans-serif",
                            color: '#0F172A',
                            marginBottom: '4px',
                          }}
                        >
                          {m.title}
                        </h3>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: m.accentColor,
                            marginBottom: '10px',
                          }}
                        >
                          {m.tagline}
                        </div>
                        <p
                          style={{
                            fontSize: '13px',
                            color: '#64748B',
                            lineHeight: 1.45,
                            marginBottom: '16px',
                          }}
                        >
                          {m.description}
                        </p>

                        {/* Liste des points clés */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                          {m.features.map((feat, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '12px',
                                color: '#334155',
                                fontWeight: 600,
                              }}
                            >
                              <CheckCircle2 size={13} color={m.accentColor} style={{ flexShrink: 0 }} />
                              <span>{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bouton d'action */}
                      <button
                        type="button"
                        disabled={!isLive}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          padding: '10px 16px',
                          borderRadius: '10px',
                          border: 'none',
                          backgroundColor: isLive ? m.accentColor : '#E2E8F0',
                          color: isLive ? '#FFFFFF' : '#94A3B8',
                          fontSize: '13px',
                          fontWeight: 800,
                          cursor: isLive ? 'pointer' : 'not-allowed',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span>{isLive ? `Ouvrir le Hub` : `Module en cours d'intégration`}</span>
                        {isLive && <ArrowRight size={15} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Encadré d'Architecture Robuste (Points forts de l'architecture) */}
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '24px 28px',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.03)',
                marginTop: '32px',
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 800,
                  fontFamily: "'Ruda', sans-serif",
                  color: '#0F172A',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <ShieldCheck size={18} color="#0284C7" />
                <span>Architecture Modulaire Haute Disponibilité</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '18px',
                }}
              >
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: '#E0F2FE',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <ShieldCheck size={16} color="#0284C7" />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                      Isolation totale des pannes
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.4, marginTop: '2px' }}>
                      Chaque brique tourne dans son propre bac à sable. Un dysfonctionnement sur un tableau ne peut jamais impacter les autres hubs.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: '#DCFCE7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Zap size={16} color="#16A34A" />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                      Chargement à la demande (0ms)
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.4, marginTop: '2px' }}>
                      Les données de chantiers ou de machines ne sont appelées qu’au clic. Aucune requête superflue n'encombre le réseau.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: '#F3E8FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Layers size={16} color="#7C3AED" />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                      Extensibilité illimitée
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.4, marginTop: '2px' }}>
                      Ajout simple et direct de futures briques (Commercial, RH, Facturation) sans refonte de l’existant.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= VUE 2 : BRIQUE ACTIVE EN PLEIN ÉCRAN ================= */}
        {activeTab !== 'home' && activeModule?.liveUrl && (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* Indicateur de chargement */}
            {loadingIframe && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#FFFFFF',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                  zIndex: 10,
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    border: `3px solid ${activeModule.accentColor}20`,
                    borderTop: `3px solid ${activeModule.accentColor}`,
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                    Chargement du {activeModule.title}…
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>
                    Connexion sécurisée en direct au CDN Monday.com
                  </div>
                </div>
              </div>
            )}

            {/* Iframe pleine page du Hub sélectionné avec cache buster */}
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={`${activeModule.liveUrl}?v=${iframeKey}&cache=20261116b`}
              title={activeModule.title}
              onLoad={() => setLoadingIframe(false)}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
              }}
              allow="clipboard-write; camera; microphone"
            />
          </div>
        )}
      </main>

      {/* Animation CSS du spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
