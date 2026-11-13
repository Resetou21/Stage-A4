import React, { useState, useMemo, useEffect } from 'react';
import {
  Wrench,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Send,
  Sparkles,
  ClipboardCheck,
  Check,
  Calendar,
  Gauge,
  User,
  Tag,
  Megaphone,
  RotateCw,
  Truck,
  ShieldAlert,
  Info,
  History,
  X,
} from 'lucide-react';
import type { Machine } from '../types';
import {
  ReferentielPoint,
  RealisedControle,
  filterPointsByMachineType,
  submitFicheControle,
  FicheControleSubmission,
} from '../services/maintenanceApi';
import { MachineSelect } from './MachineSelect';
import { TechnicienSelect } from './TechnicienSelect';
import { ResponsableSelect } from './ResponsableSelect';

const POINT_TIPS: Record<string, string> = {
  suceur: "Vérifier la souplesse de la bavette, l'absence de déchirure et le bon contact avec le sol.",
  bavette: "Contrôler l'usure du caoutchouc, la propreté et le serrage des fixations.",
  brosse: "Contrôler la hauteur des poils, l'usure régulière et l'absence de fils ou ficelles coincés.",
  plateau: "Vérifier le clip de verrouillage, le centrage du disque et l'absence de vibration.",
  filtre: "Contrôler l'encrassement, l'absence de colmatage et l'étanchéité du panier.",
  cuve: "Vérifier l'absence de boue stagnante, le bon fonctionnement du flotteur et l'état du joint.",
  batterie: "Vérifier le niveau d'eau déminéralisée, le serrage des cosses et l'absence de corrosion/sulfate.",
  cable: "Contrôler l'état de la gaine extérieure, la prise 230V et l'absence de coupure/écrasement.",
  chargeur: "Tester le voyant de charge, la ventilation et l'intégrité de la connectique.",
  roue: "Vérifier la rotation libre, l'absence de blocage mécanique et la bande de roulement.",
  flexible: "Contrôler l'absence de pliure, de perforation ou de fuite d'eau/aspiration.",
  lance: "Vérifier le déclenchement de la gâchette et le raccord rapide haute pression.",
  buse: "Contrôler le calibrage du jet et l'absence d'entartrage ou de bouchage.",
  commande: "Tester les contacteurs marche/arrêt, le timon de réglage et le bouton de sécurité.",
  moteur: "Vérifier l'absence de bruit anormal, d'odeur d'échauffement ou d'étincelles.",
  purge: "Contrôler le bon écoulement et l'étanchéité du bouchon/tuyau de vidange.",
};

function getInspectionTip(name: string): string {
  const n = (name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [key, tip] of Object.entries(POINT_TIPS)) {
    if (n.includes(key)) return tip;
  }
  return "Point de contrôle spécifique : inspecter l'usure, la propreté et le bon fonctionnement mécanique.";
}

interface InspectionFormProps {
  machines: Machine[];
  referentielPoints: ReferentielPoint[];
  realisedControles?: RealisedControle[];
  initialMachineId?: string;
  targetTicketId?: string;
  onInspectionSuccess: (machineName: string, date: string, resolvedRepairsCount?: number) => void;
  isModal?: boolean;
  onCloseModal?: () => void;
}

export const InspectionForm: React.FC<InspectionFormProps> = ({
  machines,
  referentielPoints,
  realisedControles = [],
  initialMachineId,
  targetTicketId,
  onInspectionSuccess,
  isModal = false,
  onCloseModal,
}) => {
  const [selectedMachineId, setSelectedMachineId] = useState<string>(initialMachineId || '');

  useEffect(() => {
    if (initialMachineId) {
      setSelectedMachineId(initialMachineId);
    }
  }, [initialMachineId]);
  const [inspectionDate, setInspectionDate] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [technicienName, setTechnicienName] = useState<string>('Christophe');
  const [showStep3Info, setShowStep3Info] = useState<boolean>(false);
  const [showMachineHistory, setShowMachineHistory] = useState<boolean>(true);
  const [targetAnimatrice, setTargetAnimatrice] = useState<string>('Natacha THOMAS');
  const [pastilleConforme, setPastilleConforme] = useState<boolean>(true);
  const [noteSurDix, setNoteSurDix] = useState<number>(8);
  const [etatGeneral, setEtatGeneral] = useState<'OK' | 'Moyen' | 'Non conforme'>('OK');
  const [decisionFinale, setDecisionFinale] = useState<'Favorable' | 'A voir animatrice' | 'Non conforme'>('Favorable');
  const [typeReparation, setTypeReparation] = useState<'Interne' | 'Fournisseur'>('Interne');
  const [machineVetuste, setMachineVetuste] = useState<boolean>(false);
  const [besoinRevisite, setBesoinRevisite] = useState<boolean>(false);
  const [dateRevisite, setDateRevisite] = useState<string>('');
  const [categorieIntervention, setCategorieIntervention] = useState<string>('Contrôle simple');
  const [proprete, setProprete] = useState<'Propre' | 'Sale'>('Propre');
  const [entretienRegulier, setEntretienRegulier] = useState<'Entretenue' | 'Négligée'>('Entretenue');
  const [ficheSurSite, setFicheSurSite] = useState<'Oui' | 'Non'>('Oui');
  const [tempsPasse, setTempsPasse] = useState<number>(15);
  const [remarquesTerrain, setRemarquesTerrain] = useState<string>('');
  const [notifierResponsable, setNotifierResponsable] = useState<boolean>(true);
  const [evaluations, setEvaluations] = useState<Record<string, 'OK' | 'Moyen' | 'NC'>>({});
  const [ncActions, setNcActions] = useState<Record<string, string>>({});
  const [heuresCompteur, setHeuresCompteur] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper pour extraire le texte d'une colonne
  const getCol = (m: Machine, colId: string) => {
    return m.column_values?.find((c) => c.id === colId)?.text || '';
  };

  // Machine sélectionnée
  const selectedMachine = useMemo(() => {
    return machines.find((m) => m.id === selectedMachineId) || null;
  }, [machines, selectedMachineId]);

  // Historique des contrôles réalisés pour la machine sélectionnée
  const selectedMachineHistory = useMemo(() => {
    if (!selectedMachine) return [];
    const targetNameNorm = selectedMachine.name.trim().toLowerCase();
    return realisedControles
      .filter((c) => {
        if (c.machineId && String(c.machineId) === String(selectedMachine.id)) return true;
        const cNameNorm = (c.machineName || c.name || '').trim().toLowerCase();
        return (
          cNameNorm === targetNameNorm ||
          (targetNameNorm.length >= 4 && cNameNorm.includes(targetNameNorm))
        );
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [selectedMachine, realisedControles]);

  // Type et site de la machine sélectionnée
  const machineType = selectedMachine ? getCol(selectedMachine, 'color_mm8t2mn5') : '';
  const machineSite = selectedMachine ? getCol(selectedMachine, 'dropdown_mm8d4vj2') : '';
  const [showAllPoints, setShowAllPoints] = useState<boolean>(false);

  // Tous les points de base pour ce type de machine (sans filtre de catégorie)
  const allBasePoints = useMemo(() => {
    if (!selectedMachine) return [];
    return filterPointsByMachineType(referentielPoints, machineType);
  }, [selectedMachine, machineType, referentielPoints]);

  // Points ciblés selon la catégorie d'intervention choisie
  const adaptedChecklist = useMemo(() => {
    if (!selectedMachine) return [];
    return filterPointsByMachineType(referentielPoints, machineType, categorieIntervention);
  }, [selectedMachine, machineType, referentielPoints, categorieIntervention]);

  // Checklist effective affichée (ciblée par défaut selon la catégorie, ou complète si demandé)
  const dynamicChecklist = useMemo(() => {
    return showAllPoints ? allBasePoints : adaptedChecklist;
  }, [showAllPoints, allBasePoints, adaptedChecklist]);

  // Points non conformes détectés
  const nonConformePoints = useMemo(() => {
    return Object.entries(evaluations)
      .filter(([_, status]) => status === 'NC')
      .map(([pointName]) => pointName);
  }, [evaluations]);

  // Définir l'évaluation pour un point
  const handleEvalChange = (pointName: string, status: 'OK' | 'Moyen' | 'NC') => {
    setEvaluations((prev) => ({
      ...prev,
      [pointName]: status,
    }));
  };

  const updateTempsPasse = (minutes: number) => {
    const safeMinutes = Math.max(15, minutes);
    setTempsPasse(safeMinutes);
  };

  // Soumission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachine) {
      setErrorMessage('Veuillez sélectionner une machine.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const trimmedNote = remarquesTerrain.trim();
    const shouldNotifySecteur = notifierResponsable || decisionFinale === 'A voir animatrice';

    const submission: FicheControleSubmission = {
      machineId: selectedMachine.id,
      machineName: selectedMachine.name,
      machineType,
      machineSite,
      technicienName: technicienName.trim(),
      pastilleConforme,
      noteSurDix,
      date: inspectionDate,
      etatGeneral,
      decisionFinale,
      typeReparation,
      machineVetuste,
      besoinRevisite,
      dateRevisite,
      categorieIntervention,
      proprete,
      entretienRegulier,
      ficheSurSite,
      tempsPasseMinutes: tempsPasse,
      heuresCompteur,
      remarqueAnimatrice: shouldNotifySecteur ? trimmedNote : '',
      targetAnimatrice: shouldNotifySecteur ? targetAnimatrice : undefined,
      anomaliesText: !shouldNotifySecteur ? trimmedNote : '',
      ncActions,
      pointsEvaluations: evaluations,
      targetTicketId,
    };

    const res = await submitFicheControle(submission);

    setIsSubmitting(false);

    if (res.success) {
      setSubmitSuccess(true);
      onInspectionSuccess(selectedMachine.name, inspectionDate, res.resolvedRepairsCount);
      if (isModal && onCloseModal) {
        setTimeout(() => {
          onCloseModal();
        }, 1600);
      }
      setTimeout(() => {
        setSubmitSuccess(false);
        setRemarquesTerrain('');
        setNotifierResponsable(true);
        setEvaluations({});
        setNcActions({});
        setHeuresCompteur(undefined);
        setCategorieIntervention('Contrôle simple');
        setShowAllPoints(false);
        setProprete('Propre');
        setEntretienRegulier('Entretenue');
        setFicheSurSite('Oui');
        setBesoinRevisite(false);
        setDateRevisite('');
        setMachineVetuste(false);
      }, 4000);
    } else {
      setErrorMessage(res.error || 'Erreur lors de la validation du contrôle.');
    }
  };

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', padding: isModal ? '0' : '6px 0 30px 0' }}>
      {/* ================= BANNIÈRE DE TITRE FACILITY ================= */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '22px 28px',
          marginBottom: '22px',
          border: '1px solid #E2EEF5',
          boxShadow: '0 4px 16px rgba(27, 69, 101, 0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: '#EBF6FC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#39A9DC',
              border: '1px solid #D2E9F6',
            }}
          >
            <ClipboardCheck size={26} />
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 800,
                fontFamily: "'Ruda', sans-serif",
                color: '#1B4565',
                letterSpacing: '-0.3px',
              }}
            >
              Fiche de Contrôle Technique
            </h2>
            <p
              style={{
                margin: '4px 0 0 0',
                fontSize: '13px',
                color: '#3989B7',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 500,
              }}
            >
              Points de contrôle issus dynamiquement du tableau Référentiel selon le type de machine
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              padding: '7px 14px',
              borderRadius: '20px',
              backgroundColor: '#F5F9FC',
              color: '#1B4565',
              border: '1px solid #E2EEF5',
              fontSize: '12.5px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Clock size={15} color="#39A9DC" />
            {new Date(inspectionDate).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>

          {onCloseModal && (
            <button
              type="button"
              onClick={onCloseModal}
              title="Fermer la fiche de contrôle"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '10px',
                border: '1.5px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F1F5F9';
                e.currentTarget.style.color = '#0F172A';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.color = '#475569';
              }}
            >
              <X size={16} />
              <span>Fermer</span>
            </button>
          )}
        </div>
      </div>

      {/* Message de succès */}
      {submitSuccess && (
        <div
          style={{
            backgroundColor: '#E6F8F0',
            color: '#0E7042',
            border: '1.5px solid #00C875',
            borderRadius: '14px',
            padding: '18px 22px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            boxShadow: '0 4px 14px rgba(0, 200, 117, 0.15)',
          }}
        >
          <CheckCircle size={26} color="#00C875" />
          <div>
            <div style={{ fontWeight: 800, fontSize: '15px', fontFamily: "'Ruda', sans-serif" }}>
              Contrôle enregistré avec succès dans Monday.com !
            </div>
            <div style={{ fontSize: '13px', marginTop: '3px' }}>
              La fiche a été transmise au tableau « Fiche de Contrôle ».
              {nonConformePoints.length > 0 && (
                <span style={{ fontWeight: 800, color: '#961C2E', marginLeft: '6px' }}>
                  ⚠️ {nonConformePoints.length} point(s) non conforme(s) détecté(s) pour intervention.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Message d'erreur */}
      {errorMessage && (
        <div
          style={{
            backgroundColor: '#FDECEE',
            color: '#961C2E',
            border: '1px solid #E2445C',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          <AlertTriangle size={18} />
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ================= ÉTAPE 1 : SÉLECTION DE LA MACHINE (STYLE ANIMATRICES HUB) ================= */}
        <div
          className="inspection-card"
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2EEF5',
            boxShadow: '0 4px 14px rgba(27, 69, 101, 0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  backgroundColor: '#39A9DC',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  width: '26px',
                  height: '26px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                  fontFamily: "'Ruda', sans-serif",
                }}
              >
                01
              </span>
              <label
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  fontFamily: "'Ruda', sans-serif",
                  color: '#1B4565',
                }}
              >
                Sélectionner la machine à contrôler
              </label>
            </div>

            {/* Technicien & Date d'intervention */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <User size={15} color="#39A9DC" />
                <span
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: '#3989B7',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  Technicien :
                </span>
                <TechnicienSelect
                  value={technicienName}
                  onChange={(val) => setTechnicienName(val)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={15} color="#39A9DC" />
                <span
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: '#3989B7',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  Date :
                </span>
                <input
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #C8DCE8',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    outline: 'none',
                    color: '#1B4565',
                    fontWeight: 700,
                    backgroundColor: '#F8FCFE',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Sélecteur de machine personnalisé (Ouverture vers le bas, recherche intégrée, 100% du parc disponible) */}
          <MachineSelect
            machines={machines}
            selectedMachineId={selectedMachineId}
            onSelectMachine={(mId) => {
              setSelectedMachineId(mId);
              setEvaluations({});
              setNcActions({});
              setHeuresCompteur(undefined);
              setPastilleConforme(true);
              setNoteSurDix(8);
              setCategorieIntervention('Contrôle simple');
        setShowAllPoints(false);
              setProprete('Propre');
              setEntretienRegulier('Entretenue');
              setFicheSurSite('Oui');
            }}
            getCol={getCol}
          />

          {selectedMachine && (
            <>
              <div
                style={{
                  marginTop: '16px',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  backgroundColor: '#F0F8FD',
                  border: '1px solid #D2E9F6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '18px',
                  flexWrap: 'wrap',
                  fontSize: '13px',
                }}
              >
                <div>
                  <span style={{ color: '#3989B7', fontWeight: 600 }}>Type machine :</span>{' '}
                  <strong style={{ color: '#1B4565', fontFamily: "'Ruda', sans-serif" }}>
                    {machineType || 'Standard'}
                  </strong>
                </div>
                {machineSite && (
                  <div>
                    <span style={{ color: '#3989B7', fontWeight: 600 }}>Site d'affectation :</span>{' '}
                    <strong style={{ color: '#1B4565', fontFamily: "'Ruda', sans-serif" }}>
                      {machineSite}
                    </strong>
                  </div>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} color="#F7AC37" />
                  <span style={{ color: '#D66927', fontWeight: 800, fontFamily: "'Ruda', sans-serif" }}>
                    {dynamicChecklist.length} points de contrôle chargés
                  </span>
                </div>
              </div>

              {/* Historique des contrôles techniques effectués sur cette machine */}
              <div
                style={{
                  marginTop: '12px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  backgroundColor: '#F8FCFE',
                  border: '1px solid #D2E9F6',
                }}
              >
                <div
                  onClick={() => setShowMachineHistory((v) => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <History size={15} color="#39A9DC" />
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#1B4565', fontFamily: "'Ruda', sans-serif" }}>
                      Historique des contrôles sur cette machine ({selectedMachineHistory.length})
                    </span>
                  </div>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#3989B7' }}>
                    {showMachineHistory ? 'Masquer ▲' : 'Afficher ▼'}
                  </span>
                </div>

                {showMachineHistory && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '190px', overflowY: 'auto' }}>
                    {selectedMachineHistory.length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#64748B', fontStyle: 'italic' }}>
                        Aucun contrôle précédent enregistré dans Fiche de Contrôle pour cette machine.
                      </div>
                    ) : (
                      selectedMachineHistory.map((ctrl) => {
                        const etatLow = (ctrl.etatGeneral || '').toLowerCase();
                        const isNC = etatLow.includes('rouge') || etatLow.includes('non');
                        const isMid = etatLow.includes('orange') || etatLow.includes('moyen');
                        const badgeColor = isNC ? '#961C2E' : isMid ? '#D66927' : '#0E7042';
                        const badgeBg = isNC ? '#FDECEE' : isMid ? '#FFF8EC' : '#E6F9F0';
                        return (
                          <div
                            key={ctrl.id}
                            style={{
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #E2EEF5',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '3px',
                              fontSize: '12px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#1B4565' }}>
                                <span>📅 {ctrl.date}</span>
                                {ctrl.technicienName && (
                                  <span style={{ color: '#475569', fontWeight: 600 }}>· {ctrl.technicienName}</span>
                                )}
                                {ctrl.categorieIntervention && (
                                  <span style={{ color: '#3989B7', fontSize: '11px', backgroundColor: '#EBF6FC', padding: '1px 6px', borderRadius: '6px' }}>
                                    {ctrl.categorieIntervention}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {ctrl.noteSurDix !== undefined && (
                                  <span style={{ fontWeight: 800, color: '#1B4565', fontSize: '11px' }}>
                                    {ctrl.noteSurDix}/10
                                  </span>
                                )}
                                <span
                                  style={{
                                    backgroundColor: badgeBg,
                                    color: badgeColor,
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                  }}
                                >
                                  {ctrl.etatGeneral || 'OK'}
                                </span>
                              </div>
                            </div>
                            {ctrl.anomalies && (
                              <div style={{ fontSize: '11.5px', color: '#475569', whiteSpace: 'pre-line', marginTop: '2px', maxHeight: '54px', overflow: 'hidden' }}>
                                {ctrl.anomalies}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Vérification pastille Facility (numéro physique machine) */}
              <div
                onClick={() => setPastilleConforme(!pastilleConforme)}
                style={{
                  marginTop: '14px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: pastilleConforme ? '1.5px solid #00C875' : '1.5px solid #E2445C',
                  backgroundColor: pastilleConforme ? '#E6F8F0' : '#FDECEE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '6px',
                      backgroundColor: pastilleConforme ? '#00C875' : '#E2445C',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {pastilleConforme ? <Check size={14} /> : <XCircle size={14} />}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565' }}>
                      <Tag size={15} color={pastilleConforme ? '#0E7042' : '#961C2E'} />
                      Pastille Facility &amp; référence physique vérifiées
                    </div>
                    <div style={{ fontSize: '11.5px', color: pastilleConforme ? '#0E7042' : '#961C2E', fontWeight: 600 }}>
                      {pastilleConforme
                        ? 'Correspondance confirmée avec le numéro étiqueté sur la machine'
                        : 'Attention : pastille absente, illisible ou discordante (à rééditer)'}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: '10px',
                    backgroundColor: '#FFFFFF',
                    color: pastilleConforme ? '#0E7042' : '#961C2E',
                    border: `1px solid ${pastilleConforme ? '#00C875' : '#E2445C'}`,
                  }}
                >
                  {pastilleConforme ? 'Conforme ✓' : 'À corriger'}
                </span>
              </div>

              {/* Catégorie d'intervention (Placée dès le haut de la fiche) */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '16px 18px',
                  borderRadius: '12px',
                  backgroundColor: '#FFFFFF',
                  border: '1.5px solid #D2E9F6',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565' }}>
                    🏷️ Catégorie d'intervention
                  </label>
                  <span style={{ fontSize: '11.5px', color: '#57778E', fontStyle: 'italic' }}>
                    Adapte la vérification selon l'opération
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    { label: 'Contrôle simple', color: '#39A9DC', bg: '#EBF6FC', desc: 'Maintenance préventive' },
                    { label: 'Nettoyage', color: '#00A389', bg: '#E6F7F4', desc: 'Lavage cuves/filtres' },
                    { label: 'Pièce usée', color: '#F7AC37', bg: '#FFF8EC', desc: 'Remplacement usure' },
                    { label: 'Pièce cassée', color: '#E2445C', bg: '#FDECEE', desc: 'Curatif / panne' },
                  ].map((cat) => {
                    const isSel = categorieIntervention === cat.label;
                    return (
                      <button
                        key={cat.label}
                        type="button"
                        onClick={() => {
                          setCategorieIntervention(cat.label);
                          setShowAllPoints(false);
                        }}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '10px',
                          border: isSel ? `2px solid ${cat.color}` : '1px solid #D2E9F6',
                          backgroundColor: isSel ? cat.color : '#FAFCFD',
                          color: isSel ? '#FFFFFF' : '#1B4565',
                          fontSize: '12.5px',
                          fontWeight: 800,
                          fontFamily: "'Ruda', sans-serif",
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: isSel ? `0 3px 10px ${cat.color}35` : 'none',
                        }}
                      >
                        {isSel && <Check size={14} />}
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                {/* Retour visuel immédiat : points ciblés pour cette catégorie */}
                {selectedMachine && (
                  <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color:
                          categorieIntervention === 'Nettoyage'
                            ? '#00A389'
                            : categorieIntervention === 'Pièce usée'
                            ? '#D66927'
                            : categorieIntervention === 'Pièce cassée'
                            ? '#E2445C'
                            : '#3989B7',
                        backgroundColor:
                          categorieIntervention === 'Nettoyage'
                            ? '#E6F7F4'
                            : categorieIntervention === 'Pièce usée'
                            ? '#FFF8EC'
                            : categorieIntervention === 'Pièce cassée'
                            ? '#FDECEE'
                            : '#EBF6FC',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: '1px solid currentColor',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>🎯</span>
                      <span>
                        <b>{adaptedChecklist.length}</b> point(s) de contrôle ciblés pour « {categorieIntervention} » (sur {allBasePoints.length} au total)
                      </span>
                    </span>
                    {allBasePoints.length > adaptedChecklist.length && (
                      <button
                        type="button"
                        onClick={() => setShowAllPoints((v) => !v)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#3989B7',
                          textDecoration: 'underline',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '2px 4px',
                        }}
                      >
                        {showAllPoints ? `← Revenir aux ${adaptedChecklist.length} points ciblés` : `Afficher tous les ${allBasePoints.length} points`}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Heures au compteur machine (Placé dès le haut de la fiche) */}
              <div
                style={{
                  marginTop: '14px',
                  padding: '16px 18px',
                  borderRadius: '12px',
                  backgroundColor: '#F8FCFE',
                  border: '1.5px solid #D2E9F6',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565' }}>
                    <Gauge size={17} color="#39A9DC" />
                    Heures au compteur machine :
                  </label>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px', backgroundColor: '#EBF6FC', color: '#1B4565', border: '1px solid #D2E9F6' }}>
                    Optionnel · Pour autolaveuses avec cadran horaire
                  </span>
                </div>

                <input
                  type="number"
                  placeholder="Ex : 1450 (laisser vide si machine sans compteur)..."
                  value={heuresCompteur !== undefined ? heuresCompteur : ''}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setHeuresCompteur(v !== '' ? Number(v) : undefined);
                  }}
                  min={0}
                  step={1}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #C8DCE8',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    color: '#1B4565',
                    fontFamily: 'inherit',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />

                <p style={{ margin: '6px 0 0 0', fontSize: '11.5px', color: '#57778E', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  💡 Renseigne automatiquement la fiche de contrôle ET met à jour la colonne « Heures compteur (dernier relevé) » de la machine dans Monday.
                </p>
              </div>
            </>
          )}
        </div>

        {/* ================= ÉTAPE 2 : ÉTAT GÉNÉRAL DE LA MACHINE ================= */}
        {selectedMachine && (
          <div
            className="inspection-card"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2EEF5',
              boxShadow: '0 4px 14px rgba(27, 69, 101, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span
                style={{
                  backgroundColor: '#39A9DC',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  width: '26px',
                  height: '26px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                  fontFamily: "'Ruda', sans-serif",
                }}
              >
                02
              </span>
              <label
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  fontFamily: "'Ruda', sans-serif",
                  color: '#1B4565',
                }}
              >
                État général constaté
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              {[
                {
                  label: 'OK' as const,
                  title: 'Conforme (Vert)',
                  color: '#00C875',
                  bg: '#E6F8F0',
                  border: '#00C875',
                  icon: CheckCircle,
                  desc: 'Machine 100% opérationnelle',
                },
                {
                  label: 'Moyen' as const,
                  title: 'Moyen (Orange)',
                  color: '#F7AC37',
                  bg: '#FFF8EC',
                  border: '#F7AC37',
                  icon: AlertTriangle,
                  desc: 'À surveiller ou pièce d’usure',
                },
                {
                  label: 'Non conforme' as const,
                  title: 'Non Conforme (Rouge)',
                  color: '#E2445C',
                  bg: '#FDECEE',
                  border: '#E2445C',
                  icon: XCircle,
                  desc: 'Arrêt / Réparation nécessaire',
                },
              ].map((opt) => {
                const isSelected = etatGeneral === opt.label;
                const IconComponent = opt.icon;
                return (
                  <div
                    key={opt.label}
                    onClick={() => setEtatGeneral(opt.label)}
                    style={{
                      border: `2px solid ${isSelected ? opt.border : '#E2EEF5'}`,
                      backgroundColor: isSelected ? opt.bg : '#FAFCFD',
                      borderRadius: '14px',
                      padding: '16px 18px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      boxShadow: isSelected ? `0 4px 12px ${opt.color}25` : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '14px',
                          fontFamily: "'Ruda', sans-serif",
                          color: opt.color,
                        }}
                      >
                        {opt.title}
                      </span>
                      <IconComponent size={22} color={opt.color} />
                    </div>
                    <span style={{ fontSize: '12.5px', color: '#57778E', fontWeight: 500 }}>
                      {opt.desc}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Note sur 10 (rayures, casse, propreté) & Vétusté matériel */}
            <div
              style={{
                marginTop: '18px',
                padding: '16px 18px',
                borderRadius: '14px',
                backgroundColor: '#FFFFFF',
                border: '1.5px solid #D2E9F6',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565' }}>
                  ⭐ Note d'aspect &amp; état général (rayures, casse, propreté) :
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 900,
                    fontFamily: "'Ruda', sans-serif",
                    padding: '4px 12px',
                    borderRadius: '10px',
                    backgroundColor: noteSurDix >= 8 ? '#E6F8F0' : noteSurDix >= 5 ? '#FFF8EC' : '#FDECEE',
                    color: noteSurDix >= 8 ? '#0E7042' : noteSurDix >= 5 ? '#B86114' : '#961C2E',
                    border: `1.5px solid ${noteSurDix >= 8 ? '#00C875' : noteSurDix >= 5 ? '#F7AC37' : '#E2445C'}`,
                  }}
                >
                  {noteSurDix} / 10
                </span>
              </div>

              <div className="note-sur-dix-grid">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
                  const isSel = noteSurDix === val;
                  const tone = val <= 4 ? '#E2445C' : val <= 7 ? '#F7AC37' : '#00C875';
                  return (
                    <button
                      key={val}
                      type="button"
                      className="note-sur-dix-btn"
                      onClick={() => setNoteSurDix(val)}
                      style={{
                        border: isSel ? `2px solid ${tone}` : '1px solid #C8DCE8',
                        backgroundColor: isSel ? tone : '#F8FCFE',
                        color: isSel ? '#FFFFFF' : '#1B4565',
                        boxShadow: isSel ? `0 3px 10px ${tone}40` : 'none',
                      }}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>

              {/* Alerte Vétusté (Machine à renouveler) */}
              <div
                onClick={() => setMachineVetuste(!machineVetuste)}
                style={{
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: machineVetuste ? '1.5px solid #F7AC37' : '1px solid #E2EEF5',
                  backgroundColor: machineVetuste ? '#FFF8EC' : '#FAFCFD',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  gap: '10px',
                  flexWrap: 'wrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '5px',
                      border: `1.5px solid ${machineVetuste ? '#D66927' : '#94A3B8'}`,
                      backgroundColor: machineVetuste ? '#F7AC37' : '#FFFFFF',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {machineVetuste && <Check size={13} />}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <ShieldAlert size={16} color={machineVetuste ? '#D66927' : '#64748B'} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1B4565' }}>
                      Machine trop vieille / vétuste (signaler pour demande de renouvellement)
                    </span>
                  </div>
                </div>
                {machineVetuste && (
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#B86114', backgroundColor: '#FFFFFF', padding: '3px 9px', borderRadius: '8px', border: '1px solid #F7AC37' }}>
                    À remplacer
                  </span>
                )}
              </div>
            </div>

            {/* Critères d'inspection terrain & Contexte opérationnel (Conformes à Monday) */}
            <div
              style={{
                marginTop: '18px',
                padding: '16px 18px',
                borderRadius: '14px',
                backgroundColor: '#F8FCFE',
                border: '1.5px solid #D2E9F6',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    fontFamily: "'Ruda', sans-serif",
                    color: '#1B4565',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Sparkles size={16} color="#39A9DC" />
                  Critères d'inspection terrain &amp; Fiche machine
                </span>
                <span style={{ fontSize: '11.5px', color: '#57778E', fontStyle: 'italic' }}>
                  Valeurs pré-sélectionnées par défaut · Modifiables en 1 clic
                </span>
              </div>

              {/* Grille des 3 critères d'inspection terrain */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                {/* 1. Propreté */}
                <div style={{ backgroundColor: '#FFFFFF', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2EEF5' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#3989B7', marginBottom: '8px' }}>
                    ✨ Propreté de la machine
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { label: 'Propre' as const, color: '#00C875', bg: '#E6F8F0', icon: CheckCircle },
                      { label: 'Sale' as const, color: '#E2445C', bg: '#FDECEE', icon: XCircle },
                    ].map((p) => {
                      const isSel = proprete === p.label;
                      const IconComp = p.icon;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setProprete(p.label)}
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: isSel ? `1.5px solid ${p.color}` : '1px solid #D2E9F6',
                            backgroundColor: isSel ? p.color : '#FAFCFD',
                            color: isSel ? '#FFFFFF' : '#1B4565',
                            fontSize: '12px',
                            fontWeight: 800,
                            fontFamily: "'Ruda', sans-serif",
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          <IconComp size={14} />
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Entretien régulier */}
                <div style={{ backgroundColor: '#FFFFFF', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2EEF5' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#3989B7', marginBottom: '8px' }}>
                    🛠️ Entretien régulier
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { label: 'Entretenue' as const, color: '#00C875', bg: '#E6F8F0', icon: CheckCircle },
                      { label: 'Négligée' as const, color: '#E2445C', bg: '#FDECEE', icon: XCircle },
                    ].map((ent) => {
                      const isSel = entretienRegulier === ent.label;
                      const IconComp = ent.icon;
                      return (
                        <button
                          key={ent.label}
                          type="button"
                          onClick={() => setEntretienRegulier(ent.label)}
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: isSel ? `1.5px solid ${ent.color}` : '1px solid #D2E9F6',
                            backgroundColor: isSel ? ent.color : '#FAFCFD',
                            color: isSel ? '#FFFFFF' : '#1B4565',
                            fontSize: '12px',
                            fontWeight: 800,
                            fontFamily: "'Ruda', sans-serif",
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          <IconComp size={14} />
                          {ent.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Fiche sur site présente ? */}
                <div style={{ backgroundColor: '#FFFFFF', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2EEF5' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#3989B7', marginBottom: '8px' }}>
                    📋 Fiche sur site présente ?
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { label: 'Oui' as const, color: '#00C875', bg: '#E6F8F0', icon: CheckCircle },
                      { label: 'Non' as const, color: '#E2445C', bg: '#FDECEE', icon: XCircle },
                    ].map((f) => {
                      const isSel = ficheSurSite === f.label;
                      const IconComp = f.icon;
                      return (
                        <button
                          key={f.label}
                          type="button"
                          onClick={() => setFicheSurSite(f.label)}
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: isSel ? `1.5px solid ${f.color}` : '1px solid #D2E9F6',
                            backgroundColor: isSel ? f.color : '#FAFCFD',
                            color: isSel ? '#FFFFFF' : '#1B4565',
                            fontSize: '12px',
                            fontWeight: 800,
                            fontFamily: "'Ruda', sans-serif",
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          <IconComp size={14} />
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= ÉTAPE 3 : POINTS DE CONTRÔLE DYNAMIQUES DU RÉFÉRENTIEL ================= */}
        {selectedMachine && (
          <div
            className="inspection-card"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2EEF5',
              boxShadow: '0 4px 14px rgba(27, 69, 101, 0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    backgroundColor: '#39A9DC',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                    width: '26px',
                    height: '26px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 800,
                    fontFamily: "'Ruda', sans-serif",
                  }}
                >
                  03
                </span>
                <label
                  style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    fontFamily: "'Ruda', sans-serif",
                    color: '#1B4565',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  Points de contrôle spécifiques ({dynamicChecklist.length})
                  <button
                    type="button"
                    onClick={() => setShowStep3Info((v) => !v)}
                    title="Légende des statuts (OK / Moyen / NC = Non conforme)"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      border: '1.5px solid #39A9DC',
                      backgroundColor: showStep3Info ? '#39A9DC' : '#EBF6FC',
                      color: showStep3Info ? '#FFFFFF' : '#3989B7',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <Info size={13} />
                  </button>
                </label>
                {categorieIntervention !== 'Contrôle simple' && (
                  <span
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 800,
                      padding: '3px 10px',
                      borderRadius: '12px',
                      backgroundColor: showAllPoints ? '#F3F4F6' : '#EFF6FF',
                      color: showAllPoints ? '#4B5563' : '#1D4ED8',
                      border: showAllPoints ? '1px solid #E5E7EB' : '1px solid #BFDBFE',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    🎯 {showAllPoints ? 'Tous les points affichés' : `Ciblé : « ${categorieIntervention} » (${adaptedChecklist.length}/${allBasePoints.length})`}
                  </span>
                )}
                {allBasePoints.length > adaptedChecklist.length && (
                  <button
                    type="button"
                    onClick={() => setShowAllPoints((v) => !v)}
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: '#0284C7',
                      backgroundColor: '#E0F2FE',
                      border: '1px solid #BAE6FD',
                      borderRadius: '8px',
                      padding: '3px 9px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {showAllPoints ? `← Revenir au ciblage « ${categorieIntervention} »` : `Voir tous les ${allBasePoints.length} points`}
                  </button>
                )}
              </div>

              <span
                style={{
                  fontSize: '12.5px',
                  color: '#3989B7',
                  fontWeight: 600,
                  backgroundColor: '#F5F9FC',
                  padding: '4px 10px',
                  borderRadius: '8px',
                }}
              >
                Référentiel : {machineType || 'Général'} · {Object.keys(evaluations).length} saisi(s)
              </span>
            </div>

            {showStep3Info && (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#EBF6FC',
                  border: '1px solid #D2E9F6',
                  fontSize: '12px',
                  color: '#1B4565',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                <span><b style={{ color: '#0E7042' }}>OK</b> = Conforme</span>
                <span><b style={{ color: '#D66927' }}>Moyen</b> = À surveiller</span>
                <span><b style={{ color: '#961C2E' }}>NC = Non conforme</b> (crée automatiquement un ticket &amp; checklist dans Réparations)</span>
                <span style={{ color: '#3989B7', fontStyle: 'italic' }}>Par défaut aucun bouton n&apos;est coché : cliquez pour évaluer chaque point.</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {dynamicChecklist.map((pt, idx) => {
                const hasSubitems = Boolean(pt.subitems && pt.subitems.length > 0);
                const currentStatus = evaluations[pt.name];

                if (hasSubitems && pt.subitems) {
                  return (
                    <div
                      key={pt.id || idx}
                      style={{
                        borderRadius: '12px',
                        backgroundColor: '#F8FCFE',
                        border: '1.5px solid #D2E9F6',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '10px 16px',
                          backgroundColor: '#EBF6FC',
                          borderBottom: '1px solid #D2E9F6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <Wrench size={15} color="#39A9DC" />
                          <span style={{ fontSize: '14px', fontWeight: 800, color: '#1B4565', fontFamily: "'Ruda', sans-serif" }}>
                            {pt.name}
                          </span>
                          {pt.categories?.nettoyage && (
                            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#E6F7F4', color: '#00A389', border: '1px solid #A7F3D0' }}>
                              Nettoyage
                            </span>
                          )}
                          {pt.categories?.usee && (
                            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#FFF8EC', color: '#D66927', border: '1px solid #FDE68A' }}>
                              Pièce usée
                            </span>
                          )}
                          {pt.categories?.cassee && (
                            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#FDECEE', color: '#E2445C', border: '1px solid #FECACA' }}>
                              Pièce cassée
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#3989B7' }}>
                          {pt.subitems.length} sous-points
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 12px' }}>
                        {pt.subitems.map((sub, sIdx) => {
                          const evalKey = `${pt.name} › ${sub.name}`;
                          const subStatus = evaluations[evalKey];
                          return (
                            <div
                              key={sub.id || sIdx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '9px 14px',
                                borderRadius: '10px',
                                backgroundColor: subStatus === 'NC' ? '#FDECEE' : '#FFFFFF',
                                border: `1px solid ${subStatus === 'NC' ? '#E2445C' : '#E2EEF5'}`,
                                flexWrap: 'wrap',
                                gap: '8px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#1B4565', paddingLeft: '6px' }}>
                                  ↳ {sub.name}
                                </span>
                                <span
                                  title={getInspectionTip(sub.name)}
                                  style={{
                                    cursor: 'help',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    backgroundColor: '#EBF6FC',
                                    color: '#39A9DC',
                                    border: '1px solid #BAE6FD',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                  }}
                                >
                                  <Info size={11} />
                                </span>
                              </div>
                              <div className="inspection-eval-group">
                                {(['OK', 'Moyen', 'NC'] as const).map((st) => {
                                  const isChecked = subStatus === st;
                                  const bgMap = { OK: '#00C875', Moyen: '#F7AC37', NC: '#E2445C' };
                                  const labelMap = { OK: 'OK', Moyen: 'Moyen', NC: 'NC · Non conforme' };
                                  return (
                                    <button
                                      key={st}
                                      type="button"
                                      className="inspection-eval-btn"
                                      onClick={() => handleEvalChange(evalKey, st)}
                                      style={{
                                        border: isChecked ? `1.5px solid ${bgMap[st]}` : '1px solid #C8DCE8',
                                        backgroundColor: isChecked ? bgMap[st] : '#FFFFFF',
                                        color: isChecked ? '#FFFFFF' : '#3989B7',
                                      }}
                                    >
                                      {labelMap[st]}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={pt.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 18px',
                      borderRadius: '12px',
                      backgroundColor: currentStatus === 'NC' ? '#FDECEE' : '#F8FCFE',
                      border: `1.5px solid ${currentStatus === 'NC' ? '#E2445C' : '#E2EEF5'}`,
                      flexWrap: 'wrap',
                      gap: '10px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 260px' }}>
                      <div
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '8px',
                          backgroundColor: currentStatus === 'NC' ? '#FBD3D8' : '#EBF6FC',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Wrench size={16} color={currentStatus === 'NC' ? '#E2445C' : '#39A9DC'} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1B4565' }}>
                          {pt.name}
                        </span>
                        <span
                          title={getInspectionTip(pt.name)}
                          style={{
                            cursor: 'help',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: '#EBF6FC',
                            color: '#39A9DC',
                            border: '1px solid #BAE6FD',
                            fontSize: '11px',
                            fontWeight: 800,
                          }}
                        >
                          <Info size={11} />
                        </span>
                        {pt.categories?.nettoyage && (
                          <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#E6F7F4', color: '#00A389', border: '1px solid #A7F3D0' }}>
                            Nettoyage
                          </span>
                        )}
                        {pt.categories?.usee && (
                          <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#FFF8EC', color: '#D66927', border: '1px solid #FDE68A' }}>
                            Pièce usée
                          </span>
                        )}
                        {pt.categories?.cassee && (
                          <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#FDECEE', color: '#E2445C', border: '1px solid #FECACA' }}>
                            Pièce cassée
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="inspection-eval-group">
                      {(['OK', 'Moyen', 'NC'] as const).map((st) => {
                        const isChecked = currentStatus === st;
                        const bgMap = { OK: '#00C875', Moyen: '#F7AC37', NC: '#E2445C' };
                        const labelMap = { OK: 'OK', Moyen: 'Moyen', NC: 'NC · Non conforme' };
                        return (
                          <button
                            key={st}
                            type="button"
                            className="inspection-eval-btn"
                            onClick={() => handleEvalChange(pt.name, st)}
                            style={{
                              border: isChecked ? `1.5px solid ${bgMap[st]}` : '1px solid #C8DCE8',
                              backgroundColor: isChecked ? bgMap[st] : '#FFFFFF',
                              color: isChecked ? '#FFFFFF' : '#3989B7',
                            }}
                          >
                            {labelMap[st]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= ÉTAPE 4 : TEMPS PASSÉ & ANOMALIES ================= */}
        {selectedMachine && (
          <div
            className="inspection-card"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2EEF5',
              boxShadow: '0 4px 14px rgba(27, 69, 101, 0.04)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span
                style={{
                  backgroundColor: '#39A9DC',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  width: '26px',
                  height: '26px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                  fontFamily: "'Ruda', sans-serif",
                }}
              >
                04
              </span>
              <label
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  fontFamily: "'Ruda', sans-serif",
                  color: '#1B4565',
                }}
              >
                Temps passé &amp; Remarques terrain
              </label>
            </div>

            {/* Sélecteur de temps passé : Paliers stricts de 15 en 15 minutes */}
            <div
              style={{
                backgroundColor: '#F8FCFE',
                borderRadius: '14px',
                padding: '18px 20px',
                border: '1.5px solid #D2E9F6',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '14px',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <label
                  style={{
                    fontSize: '14px',
                    fontWeight: 800,
                    color: '#1B4565',
                    fontFamily: "'Ruda', sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Clock size={16} color="#39A9DC" />
                  Temps passé sur le contrôle :
                </label>
                <span
                  style={{
                    fontSize: '12px',
                    color: '#3989B7',
                    fontWeight: 700,
                    backgroundColor: '#EBF6FC',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    border: '1px solid #D2E9F6',
                  }}
                >
                  Tranches de 15 minutes
                </span>
              </div>

              {/* Contrôle interactif +/- 15 min avec affichage central grand format */}
              <div className="time-stepper-row">
                <button
                  type="button"
                  className="time-stepper-btn"
                  onClick={() => updateTempsPasse(Math.max(15, tempsPasse - 15))}
                  disabled={tempsPasse <= 15}
                  style={{
                    border: '1.5px solid #D2E9F6',
                    backgroundColor: tempsPasse <= 15 ? '#F5F9FC' : '#FAFCFD',
                    color: tempsPasse <= 15 ? '#A0B4C3' : '#1B4565',
                    cursor: tempsPasse <= 15 ? 'not-allowed' : 'pointer',
                  }}
                >
                  − 15 min
                </button>

                <div className="time-stepper-center">
                  <span
                    style={{
                      display: 'block',
                      fontSize: '20px',
                      fontWeight: 900,
                      color: '#1B4565',
                      fontFamily: "'Ruda', sans-serif",
                    }}
                  >
                    ⏱️ {tempsPasse >= 60 ? `${Math.floor(tempsPasse / 60)}h${tempsPasse % 60 > 0 ? String(tempsPasse % 60).padStart(2, '0') : '00'}` : `${tempsPasse} min`}
                  </span>
                  <span style={{ fontSize: '11px', color: '#3989B7', fontWeight: 700 }}>
                    ({tempsPasse} minutes au total)
                  </span>
                </div>

                <button
                  type="button"
                  className="time-stepper-btn"
                  onClick={() => updateTempsPasse(tempsPasse + 15)}
                  style={{
                    border: '1.5px solid #39A9DC',
                    backgroundColor: '#39A9DC',
                    color: '#FFFFFF',
                    boxShadow: '0 2px 6px rgba(57, 169, 220, 0.25)',
                  }}
                >
                  + 15 min
                </button>
              </div>

              {/* Raccourcis fréquents par tranches de 15 minutes */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 800,
                    fontFamily: "'Ruda', sans-serif",
                    color: '#3989B7',
                    marginRight: '4px',
                  }}
                >
                  Choix direct :
                </span>
                {[
                  { label: '15 min', val: 15 },
                  { label: '30 min', val: 30 },
                  { label: '45 min', val: 45 },
                  { label: '1h00', val: 60 },
                  { label: '1h15', val: 75 },
                  { label: '1h30', val: 90 },
                  { label: '1h45', val: 105 },
                  { label: '2h00', val: 120 },
                  { label: '2h30', val: 150 },
                  { label: '3h00', val: 180 },
                ].map((item) => {
                  const isSel = tempsPasse === item.val;
                  return (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => updateTempsPasse(item.val)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: isSel ? '2px solid #39A9DC' : '1px solid #C8DCE8',
                        backgroundColor: isSel ? '#39A9DC' : '#FFFFFF',
                        color: isSel ? '#FFFFFF' : '#1B4565',
                        fontSize: '12px',
                        fontWeight: 800,
                        fontFamily: "'Ruda', sans-serif",
                        cursor: 'pointer',
                        boxShadow: isSel ? '0 2px 8px rgba(57, 169, 220, 0.25)' : 'none',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tableau "Si NC, rajouter dans actions à entreprendre" (Conforme au Tableau Blanc) */}
            {nonConformePoints.length > 0 ? (
              <div
                style={{
                  backgroundColor: '#FFF7F7',
                  borderRadius: '14px',
                  border: '1.5px solid #F5C6CB',
                  padding: '16px 18px',
                  marginBottom: '18px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        backgroundColor: '#E2445C',
                        color: '#FFFFFF',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: 800,
                        fontFamily: "'Ruda', sans-serif",
                      }}
                    >
                      NON CONFORMITÉS ({nonConformePoints.length})
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#961C2E', fontFamily: "'Ruda', sans-serif" }}>
                      Actions à entreprendre (Tableau de bord)
                    </span>
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#961C2E', fontStyle: 'italic' }}>
                    Transmis automatiquement vers le tableau Réparations
                  </span>
                </div>

                <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #F5C6CB', backgroundColor: '#FFFFFF' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#FDECEE', borderBottom: '1.5px solid #F5C6CB', color: '#961C2E' }}>
                        <th style={{ padding: '9px 12px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", width: '42%' }}>
                          Nom action (Point de contrôle)
                        </th>
                        <th style={{ padding: '9px 8px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", width: '14%', textAlign: 'center' }}>
                          Statut
                        </th>
                        <th style={{ padding: '9px 12px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", width: '44%' }}>
                          Action à entreprendre (à compléter)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {nonConformePoints.map((ptName) => (
                        <tr key={ptName} style={{ borderBottom: '1px solid #FBE1E4' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1B4565' }}>
                            {ptName}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <span
                              style={{
                                backgroundColor: '#FDECEE',
                                color: '#E2445C',
                                border: '1px solid #E2445C',
                                borderRadius: '12px',
                                padding: '2px 8px',
                                fontSize: '11px',
                                fontWeight: 800,
                                fontFamily: "'Ruda', sans-serif",
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <XCircle size={12} /> NC
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="text"
                              placeholder="Ex: Remplacer roulette, réparer câble, commander pièce..."
                              value={ncActions[ptName] || ''}
                              onChange={(e) => setNcActions((prev) => ({ ...prev, [ptName]: e.target.value }))}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1.5px solid #F5C6CB',
                                fontSize: '13px',
                                color: '#1B4565',
                                outline: 'none',
                                boxSizing: 'border-box',
                                backgroundColor: '#FFFDFD',
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#E6F8F0',
                  borderRadius: '12px',
                  border: '1.5px solid #00C875',
                  padding: '12px 18px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#0E7042',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  fontFamily: "'Ruda', sans-serif",
                }}
              >
                <CheckCircle size={18} color="#00C875" />
                Aucun point non conforme : machine en parfait état de conformité.
              </div>
            )}

            {/* Décision finale, Mode de réparation & Revisite */}
            <div
              style={{
                backgroundColor: '#F8FCFE',
                borderRadius: '14px',
                border: '1.5px solid #D2E9F6',
                padding: '16px 18px',
                marginBottom: '18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* 1. Décision finale */}
              <div>
                <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565', marginBottom: '10px' }}>
                  🎯 Décision &amp; Suite donnée au contrôle
                </label>
                <div className="decision-finale-grid">
                  {[
                    { value: 'Favorable' as const, label: 'Favorable (Conforme)', color: '#00C875', bg: '#E6F8F0' },
                    { value: 'A voir animatrice' as const, label: 'À voir avec le Responsable de Secteur', color: '#F7AC37', bg: '#FFF8EC' },
                    { value: 'Non conforme' as const, label: 'Non conforme / À réparer', color: '#E2445C', bg: '#FDECEE' },
                  ].map((dec) => {
                    const isSel = decisionFinale === dec.value;
                    return (
                      <button
                        key={dec.value}
                        type="button"
                        onClick={() => setDecisionFinale(dec.value)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: isSel ? `2px solid ${dec.color}` : '1px solid #C8DCE8',
                          backgroundColor: isSel ? dec.color : '#FFFFFF',
                          color: isSel ? '#FFFFFF' : '#1B4565',
                          fontSize: '13px',
                          fontWeight: 800,
                          fontFamily: "'Ruda', sans-serif",
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          boxShadow: isSel ? `0 3px 10px ${dec.color}30` : 'none',
                        }}
                      >
                        {isSel && <Check size={14} />}
                        {dec.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Mode de réparation (si non conforme ou pannes lourdes / 500 kg) */}
              {(nonConformePoints.length > 0 || decisionFinale === 'Non conforme' || etatGeneral !== 'OK') && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565', marginBottom: '8px' }}>
                    <Truck size={15} color="#39A9DC" />
                    Prise en charge de la réparation / intervention :
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                    {[
                      {
                        val: 'Interne' as const,
                        title: '🛠️ Réparation en interne (Équipe)',
                        desc: 'Petits consommables, lames, câbles, entretien courant',
                      },
                      {
                        val: 'Fournisseur' as const,
                        title: '🚛 Intervention fournisseur agréé',
                        desc: 'Grosse machine (ex: 500 kg), moteur, garantie',
                      },
                    ].map((mode) => {
                      const isSel = typeReparation === mode.val;
                      return (
                        <div
                          key={mode.val}
                          onClick={() => setTypeReparation(mode.val)}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '10px',
                            border: isSel ? '2px solid #39A9DC' : '1px solid #C8DCE8',
                            backgroundColor: isSel ? '#EBF6FC' : '#FFFFFF',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#1B4565', fontFamily: "'Ruda', sans-serif" }}>
                            {mode.title}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#57778E', marginTop: '2px' }}>
                            {mode.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Programmation de revisite (suivi sur 6 mois / par secteur) */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: besoinRevisite ? '1.5px solid #39A9DC' : '1px solid #D2E9F6',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <div
                  onClick={() => setBesoinRevisite(!besoinRevisite)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '5px',
                        border: `1.5px solid ${besoinRevisite ? '#39A9DC' : '#94A3B8'}`,
                        backgroundColor: besoinRevisite ? '#39A9DC' : '#FFFFFF',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {besoinRevisite && <Check size={13} />}
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 800, color: '#1B4565', fontFamily: "'Ruda', sans-serif" }}>
                      <RotateCw size={15} color="#39A9DC" />
                      Programmer une revisite technique sur site
                    </span>
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#3989B7', fontWeight: 600 }}>
                    Liée au suivi brosses / secteur
                  </span>
                </div>

                {besoinRevisite && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #E2EEF5', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#1B4565' }}>
                      Date prévue :
                    </span>
                    <input
                      type="date"
                      value={dateRevisite}
                      onChange={(e) => setDateRevisite(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1.5px solid #C8DCE8',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#1B4565',
                        backgroundColor: '#F8FCFE',
                      }}
                    />
                    {[
                      { label: '+ 1 mois', months: 1 },
                      { label: '+ 3 mois', months: 3 },
                      { label: '+ 6 mois', months: 6 },
                    ].map((preset) => (
                      <button
                        key={preset.months}
                        type="button"
                        onClick={() => {
                          const base = inspectionDate ? new Date(inspectionDate) : new Date();
                          base.setMonth(base.getMonth() + preset.months);
                          setDateRevisite(base.toISOString().split('T')[0]);
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border: '1px solid #C8DCE8',
                          backgroundColor: '#F0F8FD',
                          color: '#1B4565',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Espace unifié Responsable de Secteur & Remarques terrain (sans doublon, taille fixe) */}
            <div
              style={{
                backgroundColor: notifierResponsable || decisionFinale === 'A voir animatrice' ? '#FFFDF7' : '#FAFCFD',
                borderRadius: '14px',
                border: notifierResponsable || decisionFinale === 'A voir animatrice' ? '1.5px solid #F7AC37' : '1.5px solid #D2E9F6',
                padding: '16px 18px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565' }}>
                  <Megaphone size={17} color={notifierResponsable || decisionFinale === 'A voir animatrice' ? '#D66927' : '#3989B7'} />
                  Remarques terrain &amp; Communication Responsable de Secteur
                </label>

                <button
                  type="button"
                  onClick={() => setNotifierResponsable((v) => !v)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    fontFamily: "'Ruda', sans-serif",
                    color: notifierResponsable || decisionFinale === 'A voir animatrice' ? '#B86114' : '#57778E',
                    backgroundColor: notifierResponsable || decisionFinale === 'A voir animatrice' ? '#FFF3DC' : '#EEF5FA',
                    padding: '5px 11px',
                    borderRadius: '10px',
                    border: notifierResponsable || decisionFinale === 'A voir animatrice' ? '1.5px solid #F7AC37' : '1px solid #C8DCE8',
                    cursor: decisionFinale === 'A voir animatrice' ? 'default' : 'pointer',
                  }}
                >
                  {(notifierResponsable || decisionFinale === 'A voir animatrice')
                    ? '📢 Transmis au Responsable de Secteur'
                    : '🔧 Note atelier interne uniquement'}
                </button>
              </div>

              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#57778E', lineHeight: 1.4 }}>
                {(notifierResponsable || decisionFinale === 'A voir animatrice')
                  ? 'Informations transmises sur la fiche machine et envoyées en alerte directe vers le Responsable de Secteur choisi.'
                  : 'Remarque enregistrée uniquement sur la fiche de contrôle technique (référence pièce, observation mécanique atelier...).'}
              </p>

              {(notifierResponsable || decisionFinale === 'A voir animatrice') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#B86114' }}>
                    Destinataire de l&apos;alerte Hub :
                  </span>
                  <ResponsableSelect
                    value={targetAnimatrice}
                    onChange={setTargetAnimatrice}
                    accentColor="#F7AC37"
                  />
                </div>
              )}

              <textarea
                rows={3}
                placeholder="Ex : Local encombré, cuve d’eau sale non vidée par l’agent, référence pièce ou observation mécanique..."
                value={remarquesTerrain}
                onChange={(e) => setRemarquesTerrain(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: notifierResponsable || decisionFinale === 'A voir animatrice' ? '1.5px solid #F3CE8A' : '1.5px solid #C8DCE8',
                  fontSize: '13.5px',
                  fontFamily: 'inherit',
                  lineHeight: 1.45,
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#1B4565',
                  resize: 'none',
                  height: '88px',
                  overflowY: 'auto',
                  backgroundColor: '#FFFFFF',
                }}
              />
            </div>
          </div>
        )}

        {/* ================= BOUTON DE VALIDATION DU CONTRÔLE ================= */}
        {selectedMachine && (
          <div className="inspection-submit-container">
            <button
              type="submit"
              className="inspection-submit-btn"
              disabled={isSubmitting}
              style={{
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? (
                <>Enregistrement dans Monday.com...</>
              ) : (
                <>
                  <Send size={18} />
                  Valider et Enregistrer le Contrôle
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
