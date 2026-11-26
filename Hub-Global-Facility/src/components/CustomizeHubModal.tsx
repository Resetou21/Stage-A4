import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  RotateCcw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { HUB_DEFINITIONS, HubKey } from '../config/hubPermissions';
import { UserHubPermissions } from '../services/permissionsService';
import { getDefaultUserPrefs, UserHubPrefs } from '../services/userPrefsService';

interface CustomizeHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  permissions: UserHubPermissions;
  prefs: UserHubPrefs;
  onUpdatePrefs: (next: UserHubPrefs) => void;
}

export default function CustomizeHubModal({
  isOpen,
  onClose,
  userName,
  permissions,
  prefs,
  onUpdatePrefs,
}: CustomizeHubModalProps) {
  if (!isOpen) return null;

  // Les 6 cartes-pôles du menu principal (Facturation+Fournisseurs, Clients = Commerce+Contacts, Espace Salariés & RH)
  const GROUPED_DISPLAY_KEYS: HubKey[] = ['secteurs', 'atelier', 'facturation', 'commercial', 'direction', 'communication'];
  const isCardAllowed = (k: HubKey): boolean => {
    if (k === 'facturation') return permissions.facturation || permissions.fournisseurs;
    if (k === 'commercial') return permissions.commercial || permissions.communication;
    if (k === 'communication') return permissions.direction;
    return permissions[k];
  };
  const CARD_LABEL_OVERRIDE: Partial<Record<HubKey, string>> = {
    facturation: 'Facturation & Fournisseurs',
    commercial: 'Clients (Commerce & Contacts)',
    communication: 'Espace Salariés & RH',
  };

  const allowedHubsOrder = prefs.hubOrder.filter((k) => GROUPED_DISPLAY_KEYS.includes(k) && isCardAllowed(k));
  const defMap = new Map(HUB_DEFINITIONS.map((d) => [d.key, d]));

  const toggleHubVisibility = (key: HubKey) => {
    const isHidden = prefs.hiddenHubs.includes(key);
    const nextHidden = isHidden
      ? prefs.hiddenHubs.filter((h) => h !== key)
      : [...prefs.hiddenHubs, key];
    onUpdatePrefs({ ...prefs, hiddenHubs: nextHidden });
  };

  const moveHub = (key: HubKey, dir: -1 | 1) => {
    const fullOrder = [...prefs.hubOrder];
    const allowedIndices = fullOrder
      .map((k, idx) => (GROUPED_DISPLAY_KEYS.includes(k) && isCardAllowed(k) ? idx : -1))
      .filter((idx) => idx !== -1);

    const posInAllowed = allowedIndices.findIndex((idx) => fullOrder[idx] === key);
    const targetPos = posInAllowed + dir;
    if (posInAllowed < 0 || targetPos < 0 || targetPos >= allowedIndices.length) return;

    const idxA = allowedIndices[posInAllowed];
    const idxB = allowedIndices[targetPos];
    const tmp = fullOrder[idxA];
    fullOrder[idxA] = fullOrder[idxB];
    fullOrder[idxB] = tmp;

    onUpdatePrefs({ ...prefs, hubOrder: fullOrder });
  };

  const handleReset = () => {
    onUpdatePrefs(getDefaultUserPrefs());
  };

  return (
    <div
      onClick={onClose}
      className="modal-backdrop-in facility-modal-overlay"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
        zIndex: 250,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-spring-in"
        style={{
          width: '620px',
          maxWidth: '100%',
          maxHeight: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          border: '1px solid #D7EAF5',
          boxShadow: '0 24px 60px rgba(27, 69, 101, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 22px',
            backgroundColor: '#1B4565',
            backgroundImage: 'linear-gradient(135deg, #1B4565 0%, #3989B7 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(57, 169, 220, 0.25)',
                border: '1px solid rgba(57, 169, 220, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SlidersHorizontal size={19} color="#F7AC37" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '17px', fontWeight: 900, color: '#FFFFFF' }}>
                Personnaliser mon Intranet
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'rgba(255,255,255,0.78)' }}>
                Profil : <strong>{userName}</strong> • Préférences enregistrées automatiquement
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'rgba(255,255,255,0.14)',
              color: '#FFFFFF',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1, backgroundColor: '#F4F9FC', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Blocs visibles */}
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#3989B7', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Modules d’accueil affichés
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
              <button
                type="button"
                onClick={() => onUpdatePrefs({ ...prefs, showNewsCarousel: !prefs.showNewsCarousel })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: prefs.showNewsCarousel ? '1.5px solid #39A9DC' : '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1B4565' }}>
                  Carrousel d’actualités
                </span>
                <span
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '6px',
                    backgroundColor: prefs.showNewsCarousel ? '#39A9DC' : '#E2E8F0',
                    color: '#FFFFFF',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {prefs.showNewsCarousel && <Check size={13} strokeWidth={3} />}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onUpdatePrefs({ ...prefs, showStatsSection: !prefs.showStatsSection })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  border: prefs.showStatsSection ? '1.5px solid #39A9DC' : '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1B4565' }}>
                  Chiffres clés Groupe en bas
                </span>
                <span
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '6px',
                    backgroundColor: prefs.showStatsSection ? '#39A9DC' : '#E2E8F0',
                    color: '#FFFFFF',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {prefs.showStatsSection && <Check size={13} strokeWidth={3} />}
                </span>
              </button>
            </div>
          </div>

          {/* Liste des Hubs autorisés */}
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#3989B7', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Mes Hubs autorisés ({allowedHubsOrder.length}) — Cocher et ordonner
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {allowedHubsOrder.map((hubKey, idx) => {
                const def = defMap.get(hubKey);
                if (!def) return null;
                const isVisible = !prefs.hiddenHubs.includes(hubKey);
                return (
                  <div
                    key={hubKey}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      backgroundColor: '#FFFFFF',
                      border: isVisible ? '1.5px solid #B7D8EA' : '1px solid #E2E8F0',
                      opacity: isVisible ? 1 : 0.68,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleHubVisibility(hubKey)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flex: 1,
                        minWidth: 0,
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '6px',
                          backgroundColor: isVisible ? '#39A9DC' : '#E2E8F0',
                          color: '#FFFFFF',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isVisible ? <Check size={13} strokeWidth={3} /> : <EyeOff size={12} color="#64748B" />}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: '#1B4565', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {CARD_LABEL_OVERRIDE[hubKey] || def.label}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {isVisible ? 'Affiché sur mon accueil' : 'Masqué de mon accueil'}
                        </div>
                      </div>
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => toggleHubVisibility(hubKey)}
                        title={isVisible ? 'Masquer ce Hub' : 'Afficher ce Hub'}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '7px',
                          border: '1px solid #D7EAF5',
                          backgroundColor: '#F4F9FC',
                          color: '#3989B7',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveHub(hubKey, -1)}
                        title="Monter"
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '7px',
                          border: '1px solid #D7EAF5',
                          backgroundColor: '#F4F9FC',
                          color: '#1B4565',
                          opacity: idx === 0 ? 0.35 : 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === allowedHubsOrder.length - 1}
                        onClick={() => moveHub(hubKey, 1)}
                        title="Descendre"
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '7px',
                          border: '1px solid #D7EAF5',
                          backgroundColor: '#F4F9FC',
                          color: '#1B4565',
                          opacity: idx === allowedHubsOrder.length - 1 ? 0.35 : 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: idx === allowedHubsOrder.length - 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 22px',
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #D7EAF5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '9px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={13} />
            <span>Réinitialiser</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 20px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#39A9DC',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Terminer
          </button>
        </div>
      </div>
    </div>
  );
}
