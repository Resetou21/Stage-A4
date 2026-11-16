import React, { useState, useMemo } from 'react';
import { X, Plus, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
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
  const [customSite, setCustomSite] = useState<string>('');
  const [isCustomSite, setIsCustomSite] = useState<boolean>(false);
  const [frequence, setFrequence] = useState<string>('1 fois par trimestre');
  const [maintenancePreventive, setMaintenancePreventive] = useState<boolean>(true);
  const [pastilleConforme, setPastilleConforme] = useState<boolean>(true);
  const [heuresCompteur, setHeuresCompteur] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

    const targetSite = isCustomSite ? customSite.trim() : site.trim();

    const params: CreateMachineParams = {
      name: fullName,
      type,
      site: targetSite || undefined,
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
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#F8FCFE',
            borderBottom: '1px solid #E2EEF5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
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
                  fontSize: '15px',
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
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
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
                }}
              >
                N° Facility
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={machineNumber}
                  onChange={(e) => setMachineNumber(e.target.value)}
                  placeholder="Ex: 108"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#0369A1',
                    backgroundColor: '#F0F9FF',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  color: '#1B4565',
                  marginBottom: '5px',
                }}
              >
                Modèle / Nom de la machine *
              </label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="Ex: AUTOLAVEUSE SC351 NILFISK"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '13px',
                  color: '#1B4565',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Aperçu du libellé exact sur Monday */}
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#F8FCFE',
              border: '1px solid #E2EEF5',
              borderRadius: '8px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#3989B7',
            }}
          >
            <Sparkles size={14} color="#39A9DC" />
            <span>Nom affiché : <b>{fullName}</b></span>
          </div>

          {/* Type de machine & Fréquence */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  color: '#1B4565',
                  marginBottom: '5px',
                }}
              >
                Type de machine
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12.5px',
                  color: '#1B4565',
                  backgroundColor: '#FFFFFF',
                }}
              >
                {MACHINE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  color: '#1B4565',
                  marginBottom: '5px',
                }}
              >
                Fréquence maintenance
              </label>
              <select
                value={frequence}
                onChange={(e) => setFrequence(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12.5px',
                  color: '#1B4565',
                  backgroundColor: '#FFFFFF',
                }}
              >
                {FREQUENCES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Site d'affectation */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '5px',
              }}
            >
              <label style={{ fontSize: '11.5px', fontWeight: 800, color: '#1B4565' }}>
                Site ou Véhicule d&apos;affectation
              </label>
              <button
                type="button"
                onClick={() => setIsCustomSite((v) => !v)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#39A9DC',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {isCustomSite ? 'Choisir dans la liste' : '+ Nouveau site'}
              </button>
            </div>

            {isCustomSite ? (
              <input
                type="text"
                value={customSite}
                onChange={(e) => setCustomSite(e.target.value)}
                placeholder="Saisir le nom du nouveau site..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12.5px',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <select
                value={site}
                onChange={(e) => setSite(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12.5px',
                  color: '#1B4565',
                  backgroundColor: '#FFFFFF',
                }}
              >
                {existingSites.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Pastille Facility & Maintenance Préventive */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              padding: '12px 14px',
              backgroundColor: '#F8FAFC',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
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
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '12.5px',
                boxSizing: 'border-box',
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
              marginTop: '10px',
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
                borderRadius: '8px',
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
                gap: '6px',
                padding: '9px 18px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isSubmitting ? '#94A3B8' : '#00C875',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 800,
                cursor: isSubmitting ? 'wait' : 'pointer',
                boxShadow: '0 2px 8px rgba(0, 200, 117, 0.35)',
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
