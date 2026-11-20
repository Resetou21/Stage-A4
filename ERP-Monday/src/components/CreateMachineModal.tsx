import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Plus,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Check,
  Search,
  MapPin,
  Wrench,
  Calendar,
} from 'lucide-react';
import { createNewMachine, CreateMachineParams } from '../services/maintenanceApi';

interface CreateMachineModalProps {
  existingMachines: Array<{ id: string | number; name: string }>;
  existingSites: string[];
  onClose: () => void;
  onSuccess: (newMachineName: string) => void;
}

const MACHINE_TYPES = [
  'Autolaveuse',
  'Monobrosse',
  'Aspirateur',
  'Nettoyeur haute pression',
  'Injecteur-extracteur / moquette',
  'Petite autolaveuse',
  'Chariot / Manutention',
  'Balayeuse',
  'Eau pure',
  'Autre / à vérifier',
] as const;

const FREQUENCES = [
  '1 fois par trimestre',
  '1 fois par mois',
  '2 fois par an',
  '1 fois par an',
] as const;

export const CreateMachineModal: React.FC<CreateMachineModalProps> = ({
  existingMachines,
  existingSites,
  onClose,
  onSuccess,
}) => {
  // Calcul automatique du prochain numéro disponible
  const nextNumber = useMemo(() => {
    let maxNum = 0;
    for (const m of existingMachines) {
      const match = m.name.match(/^(\d{1,4})\s*[-–]/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum && num < 1000) maxNum = num;
      }
    }
    return maxNum > 0 ? maxNum + 1 : 108;
  }, [existingMachines]);

  const [machineNumber, setMachineNumber] = useState<string>(String(nextNumber));
  const [modelName, setModelName] = useState<string>('');
  const [type, setType] = useState<string>('Autolaveuse');
  const [site, setSite] = useState<string>('GROUPE FACILITY');
  const [frequence, setFrequence] = useState<string>('1 fois par trimestre');
  const [maintenancePreventive, setMaintenancePreventive] = useState<boolean>(true);
  const [pastilleConforme, setPastilleConforme] = useState<boolean>(true);
  const [heuresCompteur, setHeuresCompteur] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Gestion des dropdowns personnalisés (un seul ouvert à la fois)
  const [openDropdown, setOpenDropdown] = useState<'type' | 'freq' | 'site' | null>(null);
  const [siteSearch, setSiteSearch] = useState<string>('');

  const typeContainerRef = useRef<HTMLDivElement>(null);
  const freqContainerRef = useRef<HTMLDivElement>(null);
  const siteContainerRef = useRef<HTMLDivElement>(null);
  const siteSearchInputRef = useRef<HTMLInputElement>(null);

  // Focus sur la recherche quand le dropdown site s'ouvre
  useEffect(() => {
    if (openDropdown === 'site') {
      setTimeout(() => siteSearchInputRef.current?.focus(), 50);
    }
  }, [openDropdown]);

  // Fermeture au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !typeContainerRef.current?.contains(target) &&
        !freqContainerRef.current?.contains(target) &&
        !siteContainerRef.current?.contains(target)
      ) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtrage des sites avec la recherche
  const filteredSites = useMemo(() => {
    const q = siteSearch.trim().toLowerCase();
    if (!q) return existingSites;
    return existingSites.filter((s) => s.toLowerCase().includes(q));
  }, [existingSites, siteSearch]);

  const isExactSiteMatch = useMemo(() => {
    const q = siteSearch.trim().toLowerCase();
    return existingSites.some((s) => s.toLowerCase() === q);
  }, [existingSites, siteSearch]);

  // Nom complet généré
  const fullName = useMemo(() => {
    const cleanModel = modelName.trim();
    if (machineNumber.trim()) {
      return `${machineNumber.trim()} - ${cleanModel || 'NOUVELLE MACHINE'}`;
    }
    return cleanModel || 'NOUVELLE MACHINE';
  }, [machineNumber, modelName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName.trim()) {
      setError('Veuillez renseigner le modèle ou nom de la machine (ex: TASKI ERGODISC 2000).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const params: CreateMachineParams = {
      name: fullName,
      type,
      site: site.trim() || undefined,
      statut: 'En service',
      frequence,
      maintenancePreventive,
      pastilleConforme,
      heuresCompteur: heuresCompteur ? parseFloat(heuresCompteur) : undefined,
    };

    const res = await createNewMachine(params);
    setIsSubmitting(false);

    if (res.success) {
      onSuccess(fullName);
      onClose();
    } else {
      setError(res.error || 'Erreur lors de la création de la machine sur Monday.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(27, 69, 101, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.25)',
          border: '1.5px solid #D2E9F6',
          overflow: 'visible',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '94vh',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#F8FCFE',
            borderBottom: '1px solid #E2EEF5',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                backgroundColor: '#E8F5FC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#39A9DC',
              }}
            >
              <Plus size={20} />
            </span>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '15.5px',
                  fontWeight: 800,
                  color: '#1B4565',
                  fontFamily: "'Ruda', sans-serif",
                }}
              >
                Ajouter une nouvelle machine au parc
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
                Création en direct sur le tableau Monday « Liste des machines » (5106585240)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94A3B8',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {error && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#FDECEE',
                border: '1px solid #F5C2C7',
                borderRadius: '8px',
                color: '#961C2E',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Numéro & Modèle */}
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '10px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  color: '#1B4565',
                  marginBottom: '5px',
                  fontFamily: "'Ruda', sans-serif",
                }}
              >
                N° Facility
              </label>
              <input
                type="text"
                value={machineNumber}
                onChange={(e) => setMachineNumber(e.target.value)}
                placeholder="Ex: 108"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  color: '#0369A1',
                  backgroundColor: '#F0F9FF',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border 0.15s ease',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  color: '#1B4565',
                  marginBottom: '5px',
                  fontFamily: "'Ruda', sans-serif",
                }}
              >
                Modèle / Nom de la machine *
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="Ex: TASKI ERGODISC 2000"
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '13px',
                  color: '#1B4565',
                  boxSizing: 'border-box',
                  outline: 'none',
                  transition: 'border 0.15s ease',
                }}
              />
            </div>
          </div>

          {/* Aperçu du libellé exact sur Monday */}
          <div
            style={{
              padding: '9px 14px',
              backgroundColor: '#F8FCFE',
              border: '1px solid #E2EEF5',
              borderRadius: '10px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#3989B7',
            }}
          >
            <Sparkles size={14} color="#39A9DC" />
            <span>Nom affiché : <b>{fullName}</b></span>
          </div>

          {/* Type de machine & Fréquence (Menu personnalisés avec beau design) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* 1. SELECT PERSONNALISÉ : TYPE DE MACHINE */}
            <div ref={typeContainerRef} style={{ position: 'relative' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  color: '#1B4565',
                  marginBottom: '5px',
                  fontFamily: "'Ruda', sans-serif",
                }}
              >
                Type de machine
              </label>
              <button
                type="button"
                onClick={() => setOpenDropdown((prev) => (prev === 'type' ? null : 'type'))}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: openDropdown === 'type' ? '1.5px solid #39A9DC' : '1px solid #C8DCE8',
                  backgroundColor: '#FFFFFF',
                  color: '#1B4565',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: openDropdown === 'type' ? '0 0 0 3px rgba(57, 169, 220, 0.15)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Wrench size={13} color="#39A9DC" />
                  {type}
                </span>
                <ChevronDown
                  size={15}
                  color="#57778E"
                  style={{
                    transform: openDropdown === 'type' ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0,
                  }}
                />
              </button>

              {/* Menu déroulant Type */}
              {openDropdown === 'type' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1.5px solid #D2E9F6',
                    boxShadow: '0 10px 30px rgba(27, 69, 101, 0.2)',
                    zIndex: 100,
                    maxHeight: '230px',
                    overflowY: 'auto',
                    padding: '5px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  {MACHINE_TYPES.map((t) => {
                    const isSelected = type === t;
                    return (
                      <div
                        key={t}
                        onClick={() => {
                          setType(t);
                          setOpenDropdown(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#EBF6FC' : 'transparent',
                          color: isSelected ? '#0073EA' : '#1B4565',
                          fontSize: '12px',
                          fontWeight: isSelected ? 800 : 600,
                          transition: 'background 0.1s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <span>{t}</span>
                        {isSelected && <Check size={14} color="#0073EA" strokeWidth={3} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. SELECT PERSONNALISÉ : FRÉQUENCE DE MAINTENANCE */}
            <div ref={freqContainerRef} style={{ position: 'relative' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  color: '#1B4565',
                  marginBottom: '5px',
                  fontFamily: "'Ruda', sans-serif",
                }}
              >
                Fréquence maintenance
              </label>
              <button
                type="button"
                onClick={() => setOpenDropdown((prev) => (prev === 'freq' ? null : 'freq'))}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: openDropdown === 'freq' ? '1.5px solid #39A9DC' : '1px solid #C8DCE8',
                  backgroundColor: '#FFFFFF',
                  color: '#1B4565',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  boxShadow: openDropdown === 'freq' ? '0 0 0 3px rgba(57, 169, 220, 0.15)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Calendar size={13} color="#39A9DC" />
                  {frequence}
                </span>
                <ChevronDown
                  size={15}
                  color="#57778E"
                  style={{
                    transform: openDropdown === 'freq' ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0,
                  }}
                />
              </button>

              {/* Menu déroulant Fréquence */}
              {openDropdown === 'freq' && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1.5px solid #D2E9F6',
                    boxShadow: '0 10px 30px rgba(27, 69, 101, 0.2)',
                    zIndex: 100,
                    padding: '5px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  {FREQUENCES.map((f) => {
                    const isSelected = frequence === f;
                    return (
                      <div
                        key={f}
                        onClick={() => {
                          setFrequence(f);
                          setOpenDropdown(null);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#EBF6FC' : 'transparent',
                          color: isSelected ? '#0073EA' : '#1B4565',
                          fontSize: '12px',
                          fontWeight: isSelected ? 800 : 600,
                          transition: 'background 0.1s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <span>{f}</span>
                        {isSelected && <Check size={14} color="#0073EA" strokeWidth={3} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 3. SELECT PERSONNALISÉ AVEC RECHERCHE : SITE D'AFFECTATION */}
          <div ref={siteContainerRef} style={{ position: 'relative' }}>
            <label
              style={{
                display: 'block',
                fontSize: '11.5px',
                fontWeight: 800,
                color: '#1B4565',
                marginBottom: '5px',
                fontFamily: "'Ruda', sans-serif",
              }}
            >
              Site ou Véhicule d&apos;affectation
            </label>
            <button
              type="button"
              onClick={() => {
                setOpenDropdown((prev) => (prev === 'site' ? null : 'site'));
                setSiteSearch('');
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: '10px',
                border: openDropdown === 'site' ? '1.5px solid #39A9DC' : '1px solid #C8DCE8',
                backgroundColor: '#FFFFFF',
                color: '#1B4565',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxSizing: 'border-box',
                boxShadow: openDropdown === 'site' ? '0 0 0 3px rgba(57, 169, 220, 0.15)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <MapPin size={14} color="#39A9DC" />
                <span style={{ fontWeight: 800, color: '#1B4565' }}>{site || 'Sélectionner un site...'}</span>
              </span>
              <ChevronDown
                size={15}
                color="#57778E"
                style={{
                  transform: openDropdown === 'site' ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease',
                  flexShrink: 0,
                }}
              />
            </button>

            {/* Menu déroulant Site avec recherche intégrée */}
            {openDropdown === 'site' && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  right: 0,
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1.5px solid #D2E9F6',
                  boxShadow: '0 12px 35px rgba(27, 69, 101, 0.22)',
                  zIndex: 200,
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {/* Barre de recherche dans les sites */}
                <div style={{ position: 'relative' }}>
                  <Search
                    size={15}
                    color="#39A9DC"
                    style={{ position: 'absolute', left: '10px', top: '10px' }}
                  />
                  <input
                    ref={siteSearchInputRef}
                    type="text"
                    placeholder={`Filtrer parmi les ${existingSites.length} sites ou taper un nouveau...`}
                    value={siteSearch}
                    onChange={(e) => setSiteSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px 8px 32px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12.5px',
                      color: '#1B4565',
                      backgroundColor: '#F8FCFE',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  {siteSearch && (
                    <button
                      type="button"
                      onClick={() => setSiteSearch('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '8px',
                        background: 'none',
                        border: 'none',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        padding: '2px',
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Option de création rapide si le site saisi n'existe pas encore */}
                {siteSearch.trim() && !isExactSiteMatch && (
                  <div
                    onClick={() => {
                      setSite(siteSearch.trim());
                      setOpenDropdown(null);
                      setSiteSearch('');
                    }}
                    style={{
                      padding: '9px 12px',
                      backgroundColor: '#E6F8F0',
                      border: '1px dashed #00C875',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 800,
                      color: '#0E7042',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Plus size={14} strokeWidth={3} />
                    <span>Créer et affecter à : « <b>{siteSearch.trim()}</b> »</span>
                  </div>
                )}

                {/* Liste scrollable des sites existants */}
                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  {filteredSites.length === 0 && !siteSearch.trim() ? (
                    <div style={{ padding: '12px', textAlign: 'center', color: '#64748B', fontSize: '12px' }}>
                      Aucun site disponible
                    </div>
                  ) : (
                    filteredSites.map((s) => {
                      const isSelected = site === s;
                      return (
                        <div
                          key={s}
                          onClick={() => {
                            setSite(s);
                            setOpenDropdown(null);
                            setSiteSearch('');
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? '#EBF6FC' : 'transparent',
                            color: isSelected ? '#0073EA' : '#1B4565',
                            fontSize: '12.5px',
                            fontWeight: isSelected ? 800 : 600,
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={12} color={isSelected ? '#0073EA' : '#94A3B8'} />
                            {s}
                          </span>
                          {isSelected && <Check size={14} color="#0073EA" strokeWidth={3} />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pastille Facility & Maintenance Préventive */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              padding: '12px 14px',
              backgroundColor: '#F8FCFE',
              borderRadius: '10px',
              border: '1px solid #E2EEF5',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#1B4565',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={pastilleConforme}
                onChange={(e) => setPastilleConforme(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#39A9DC' }}
              />
              Pastille Facility apposée
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#1B4565',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={maintenancePreventive}
                onChange={(e) => setMaintenancePreventive(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#39A9DC' }}
              />
              Suivi préventif actif
            </label>
          </div>

          {/* Heures compteur initiales */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '11.5px',
                fontWeight: 800,
                color: '#1B4565',
                marginBottom: '5px',
                fontFamily: "'Ruda', sans-serif",
              }}
            >
              Heures compteur initiales (Optionnel)
            </label>
            <input
              type="number"
              value={heuresCompteur}
              onChange={(e) => setHeuresCompteur(e.target.value)}
              placeholder="Ex: 0 ou 145"
              min="0"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                fontSize: '12.5px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          {/* Footer Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '6px',
              paddingTop: '14px',
              borderTop: '1px solid #E2EEF5',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '9px 16px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#64748B',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '9px 18px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: isSubmitting ? '#94A3B8' : '#00C875',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 800,
                cursor: isSubmitting ? 'wait' : 'pointer',
                boxShadow: '0 2px 8px rgba(0, 200, 117, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              <CheckCircle2 size={16} />
              {isSubmitting ? 'Création en cours sur Monday...' : 'Créer la machine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
