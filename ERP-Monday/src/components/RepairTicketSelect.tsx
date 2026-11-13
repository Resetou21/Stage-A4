import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, Link2, PlusCircle, Wrench, Calendar, MapPin, X } from 'lucide-react';
import type { RepairTicket } from '../services/maintenanceApi';

interface RepairTicketSelectProps {
  tickets: RepairTicket[];
  selectedTicketId: string; // "" = Créer un nouveau ticket, sinon ID du ticket existant
  onSelectTicket: (ticketId: string) => void;
  selectedMachineId?: string;
  selectedMachineName?: string;
}

export const RepairTicketSelect: React.FC<RepairTicketSelectProps> = React.memo(({
  tickets,
  selectedTicketId,
  onSelectTicket,
  selectedMachineId,
  selectedMachineName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fermer lors d'un clic en dehors ou appui sur Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Autofocus à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Filtrer uniquement les tickets non encore réparés (ouverts)
  const openTickets = useMemo(() => {
    return tickets.filter((t) => {
      const lower = (t.status || '').toLowerCase();
      const grpLower = (t.groupTitle || '').toLowerCase();
      return (
        !lower.includes('réparée') &&
        !lower.includes('reparee') &&
        !grpLower.includes('réparé') &&
        !grpLower.includes('repare')
      );
    });
  }, [tickets]);

  // Ticket actuellement sélectionné
  const currentTicket = useMemo(() => {
    if (!selectedTicketId) return null;
    return openTickets.find((t) => t.id === selectedTicketId) || null;
  }, [openTickets, selectedTicketId]);

  // Normalisation recherche
  const searchNorm = search.trim().toLowerCase();

  // Séparation : tickets de la machine vs autres tickets
  const { machineTickets, otherTickets } = useMemo(() => {
    const cleanMachineName = (selectedMachineName || '').toLowerCase().trim();

    const isMatch = (t: RepairTicket) => {
      if (selectedMachineId && String(t.machineId || '') === String(selectedMachineId)) return true;
      if (cleanMachineName && t.machineName.toLowerCase().includes(cleanMachineName)) return true;
      if (cleanMachineName && t.name.toLowerCase().includes(cleanMachineName)) return true;
      return false;
    };

    const matchesSearch = (t: RepairTicket) => {
      if (!searchNorm) return true;
      return (
        t.name.toLowerCase().includes(searchNorm) ||
        t.machineName.toLowerCase().includes(searchNorm) ||
        (t.date && t.date.includes(searchNorm)) ||
        (t.status && t.status.toLowerCase().includes(searchNorm))
      );
    };

    const machineList: RepairTicket[] = [];
    const otherList: RepairTicket[] = [];

    for (const t of openTickets) {
      if (!matchesSearch(t)) continue;
      if (selectedMachineId && isMatch(t)) {
        machineList.push(t);
      } else {
        otherList.push(t);
      }
    }

    return { machineTickets: machineList, otherTickets: otherList };
  }, [openTickets, selectedMachineId, selectedMachineName, searchNorm]);

  const handleSelect = (ticketId: string) => {
    onSelectTicket(ticketId);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Bouton Déclencheur Chic */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 13px',
          borderRadius: '10px',
          border: isOpen ? '1.5px solid #0073EA' : '1.5px solid #CBD5E1',
          backgroundColor: '#FFFFFF',
          cursor: 'pointer',
          boxShadow: isOpen ? '0 0 0 3px rgba(0, 115, 234, 0.15)' : '0 1px 3px rgba(27, 69, 101, 0.05)',
          transition: 'all 0.15s ease',
          textAlign: 'left',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          {currentTicket ? (
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                color: '#1D4ED8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Link2 size={16} />
            </div>
          ) : (
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#F0FDF4',
                border: '1px solid #BBF7D0',
                color: '#16A34A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <PlusCircle size={16} />
            </div>
          )}

          <div style={{ minWidth: 0, flex: 1 }}>
            {currentTicket ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#1B4565', fontFamily: "'Ruda', sans-serif" }}>
                    Mettre à jour : {currentTicket.name}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '6px',
                      backgroundColor: '#FFF8EC',
                      color: '#D66927',
                      border: '1px solid #F7AC37',
                    }}
                  >
                    {currentTicket.status}
                  </span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                  📅 Panne du {currentTicket.date || 'Non datée'} · Machine : {currentTicket.machineName}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#047857', fontFamily: "'Ruda', sans-serif" }}>
                  ✨ Créer un nouveau ticket dans « Réparation machines »
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '1px' }}>
                  Ajoute une nouvelle intervention curative sur le tableau Monday (5106693291)
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px', flexShrink: 0 }}>
          {selectedTicketId && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onSelectTicket('');
              }}
              title="Revenir à la création d'un nouveau ticket"
              style={{
                padding: '4px',
                borderRadius: '6px',
                color: '#64748B',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown
            size={16}
            color="#57778E"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
            }}
          />
        </div>
      </button>

      {/* Menu Déroulant Stylisé */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1.5px solid #CBD5E1',
            boxShadow: '0 12px 30px rgba(27, 69, 101, 0.18)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '340px',
            animation: 'fadeIn 0.12s ease-out',
          }}
        >
          {/* Barre de recherche */}
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Search size={15} color="#64748B" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un ticket, une panne, une date..."
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: '12.5px',
                color: '#1B4565',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 600,
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: '#94A3B8',
                  padding: '2px',
                  display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Liste déroulante scrollable */}
          <div style={{ overflowY: 'auto', padding: '6px' }}>
            {/* OPTION 1 : TOUJOURS EN HAUT -> Créer un nouveau ticket */}
            <div
              onClick={() => handleSelect('')}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: !selectedTicketId ? '#ECFDF5' : 'transparent',
                border: !selectedTicketId ? '1px solid #6EE7B7' : '1px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'background 0.1s ease',
                marginBottom: '4px',
              }}
              onMouseEnter={(e) => {
                if (selectedTicketId) e.currentTarget.style.backgroundColor = '#F0FDF4';
              }}
              onMouseLeave={(e) => {
                if (selectedTicketId) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <PlusCircle size={16} color="#059669" />
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#047857', fontFamily: "'Ruda', sans-serif" }}>
                    ✨ Créer un nouveau ticket dans « Réparation machines »
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    Recommandé si cette intervention n&apos;est pas liée à une panne déjà déclarée
                  </div>
                </div>
              </div>
              {!selectedTicketId && <Check size={16} color="#059669" />}
            </div>

            {/* SECTION 1 : Tickets de la machine sélectionnée (Recommandés) */}
            {machineTickets.length > 0 && (
              <div style={{ marginTop: '6px', marginBottom: '4px' }}>
                <div
                  style={{
                    padding: '4px 8px',
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: '#0284C7',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontFamily: "'Ruda', sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Wrench size={11} />
                  Tickets ouverts pour cette machine ({machineTickets.length})
                </div>

                {machineTickets.map((t) => {
                  const isSel = selectedTicketId === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => handleSelect(t.id)}
                      style={{
                        padding: '9px 12px',
                        borderRadius: '8px',
                        backgroundColor: isSel ? '#EFF6FF' : '#F8FAFC',
                        border: isSel ? '1.5px solid #3B82F6' : '1px solid #E2E8F0',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '4px',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSel) e.currentTarget.style.backgroundColor = '#EEF2F6';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSel) e.currentTarget.style.backgroundColor = '#F8FAFC';
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#1B4565' }}>
                            {t.name}
                          </span>
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: '#FFF8EC',
                              color: '#D66927',
                              border: '1px solid #F7AC37',
                            }}
                          >
                            {t.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <span>📅 Signalé le {t.date || 'Non daté'}</span>
                          <span>🔗 {t.machineName}</span>
                        </div>
                      </div>
                      {isSel && <Check size={16} color="#2563EB" style={{ marginLeft: '8px', flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* SECTION 2 : Autres tickets curatifs */}
            {otherTickets.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div
                  style={{
                    padding: '4px 8px',
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: '#64748B',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontFamily: "'Ruda', sans-serif",
                  }}
                >
                  {machineTickets.length > 0 ? 'Autres tickets ouverts du parc' : 'Tickets ouverts du parc'} ({otherTickets.length})
                </div>

                {otherTickets.map((t) => {
                  const isSel = selectedTicketId === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => handleSelect(t.id)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: isSel ? '#EFF6FF' : 'transparent',
                        border: isSel ? '1px solid #93C5FD' : '1px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '2px',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSel) e.currentTarget.style.backgroundColor = '#F1F5F9';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSel) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#1B4565' }}>
                            {t.name}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: '#F1F5F9',
                              color: '#475569',
                            }}
                          >
                            {t.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '1px' }}>
                          📅 {t.date || 'Non daté'} · 🔗 {t.machineName}
                        </div>
                      </div>
                      {isSel && <Check size={15} color="#2563EB" style={{ marginLeft: '6px', flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
            )}

            {machineTickets.length === 0 && otherTickets.length === 0 && search && (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#94A3B8' }}>
                Aucun ticket ouvert ne correspond à « {search} »
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

