import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package,
  AlertTriangle,
  Plus,
  Search,
  Minus,
  Edit2,
  Trash2,
  ShoppingCart,
  Sparkles,
  RefreshCw,
  X,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import {
  StockBoardSchema,
  StockItemRecord,
  STOCK_BOARD_NAME,
  discoverStockBoard,
  fetchStockPartsFromMonday,
  createStockItemOnMonday,
  updateStockItemOnMonday,
  archiveStockItemOnMonday,
} from '../services/stockApi';

export interface SparePart {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  minStock: number;
  unit: string;
  lastUpdated?: string;
  notes?: string;
}

const DEFAULT_PARTS: SparePart[] = [];

const STORAGE_KEY = 'facility_spare_parts_stock_v1';

export function getLowStockPartsCount(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const list: SparePart[] = saved ? JSON.parse(saved) : DEFAULT_PARTS;
    if (Array.isArray(list)) {
      return list.filter((p) => p.currentStock <= p.minStock).length;
    }
  } catch {}
  return DEFAULT_PARTS.filter((p) => p.currentStock <= p.minStock).length;
}

interface StockManagementProps {
  onLowStockCountChange?: (count: number) => void;
}

export const StockManagement: React.FC<StockManagementProps> = ({ onLowStockCountChange }) => {
  const [parts, setParts] = useState<StockItemRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_PARTS;
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [onlyAlerts, setOnlyAlerts] = useState<boolean>(false);
  const [editingPart, setEditingPart] = useState<SparePart | null>(null);
  const [isNewPartModalOpen, setIsNewPartModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Formulaire d'ajout / édition
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Consommable');
  const [formCurrent, setFormCurrent] = useState<number>(0);
  const [formMin, setFormMin] = useState<number>(1);
  const [formUnit, setFormUnit] = useState('pièces');
  const [formNotes, setFormNotes] = useState('');

  // Sauvegarde dans le localStorage à chaque modification
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parts));
    } catch {}
    if (onLowStockCountChange) {
      onLowStockCountChange(parts.filter((p) => p.currentStock <= p.minStock).length);
    }
  }, [parts, onLowStockCountChange]);

  const [stockSchema, setStockSchema] = useState<StockBoardSchema | null>(null);
  const [mondayStatus, setMondayStatus] = useState<'checking' | 'connected' | 'not_created' | 'error'>('checking');
  const [mondayError, setMondayError] = useState<string | null>(null);
  const [isSavingMonday, setIsSavingMonday] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Découverte & chargement temps réel du tableau Monday partagé (#5107680355)
  const syncWithMonday = useCallback(async (showFeedback = false) => {
    setMondayStatus('checking');
    setMondayError(null);
    try {
      const schema = await discoverStockBoard();
      if (!schema) {
        setStockSchema(null);
        setMondayStatus('not_created');
        return;
      }
      const mondayItems = await fetchStockPartsFromMonday(schema);
      setStockSchema(schema);
      setParts(mondayItems);
      setMondayStatus('connected');
      if (showFeedback) {
        showToast(`🔄 Stock synchronisé avec Monday (${mondayItems.length} références)`);
      }
    } catch (err: any) {
      setMondayStatus('error');
      setMondayError(err?.message || 'Erreur lors de la connexion au tableau Stock Monday');
    }
  }, []);

  useEffect(() => {
    syncWithMonday(false);
  }, [syncWithMonday]);

  // Ajustement rapide de stock (-1, +1, -5, +5) synchronisé avec Monday
  const adjustStock = async (id: string, delta: number) => {
    const target = parts.find((p) => p.id === id);
    if (!target) return;

    const previousStock = target.currentStock;
    const newStock = Math.max(0, previousStock + delta);
    const nowIso = new Date().toISOString();

    setParts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              currentStock: newStock,
              lastUpdated: nowIso,
            }
          : p
      )
    );

    const actionText = delta > 0 ? `+${delta}` : `${delta}`;
    showToast(`${actionText} ${target.unit} sur "${target.name}" (Stock : ${newStock})`);

    if (stockSchema && target.mondayItemId) {
      try {
        await updateStockItemOnMonday(stockSchema, target.mondayItemId, { currentStock: newStock });
      } catch (err: any) {
        // Rollback propre si Monday rejette la mise à jour
        setParts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, currentStock: previousStock } : p))
        );
        showToast(`⚠️ Échec sauvegarde Monday (${target.name}) : ${err?.message || 'erreur réseau'}`);
      }
    }
  };

  // Catégories uniques disponibles
  const categories = useMemo(() => {
    const set = new Set<string>();
    parts.forEach((p) => set.add(p.category));
    return Array.from(set);
  }, [parts]);

  // Alertes stock mini
  const alertParts = useMemo(() => {
    return parts.filter((p) => p.currentStock <= p.minStock);
  }, [parts]);

  // Pièces filtrées
  const filteredParts = useMemo(() => {
    return parts.filter((p) => {
      const matchSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.notes && p.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchSearch) return false;
      if (onlyAlerts && p.currentStock > p.minStock) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      return true;
    });
  }, [parts, searchTerm, onlyAlerts, categoryFilter]);

  // Ouvrir modal ajout
  const openNewModal = () => {
    setFormName('');
    setFormCategory('Consommable');
    setFormCurrent(2);
    setFormMin(1);
    setFormUnit('pièces');
    setFormNotes('');
    setEditingPart(null);
    setIsNewPartModalOpen(true);
  };

  // Ouvrir modal édition
  const openEditModal = (p: SparePart) => {
    setEditingPart(p);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormCurrent(p.currentStock);
    setFormMin(p.minStock);
    setFormUnit(p.unit);
    setFormNotes(p.notes || '');
    setIsNewPartModalOpen(true);
  };

  // Enregistrer ajout / modification (synchronisé Monday si connecté)
  const handleSavePart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || isSavingMonday) return;

    const payload = {
      name: formName.trim(),
      category: formCategory.trim() || 'Général',
      currentStock: Math.max(0, formCurrent),
      minStock: Math.max(0, formMin),
      unit: formUnit.trim() || 'pièces',
      notes: formNotes.trim(),
    };

    if (editingPart) {
      const existingRecord = parts.find((p) => p.id === editingPart.id);
      if (stockSchema && existingRecord?.mondayItemId) {
        setIsSavingMonday(true);
        try {
          await updateStockItemOnMonday(stockSchema, existingRecord.mondayItemId, payload);
        } catch (err: any) {
          setIsSavingMonday(false);
          showToast(`⚠️ Erreur mise à jour Monday : ${err?.message || 'échec'}`);
          return;
        }
        setIsSavingMonday(false);
      }

      setParts((prev) =>
        prev.map((p) =>
          p.id === editingPart.id
            ? {
                ...p,
                ...payload,
                lastUpdated: new Date().toISOString(),
              }
            : p
        )
      );
      showToast(`Pièce "${payload.name}" mise à jour avec succès`);
    } else {
      if (stockSchema) {
        setIsSavingMonday(true);
        try {
          const created = await createStockItemOnMonday(stockSchema, payload);
          setParts((prev) => [created, ...prev]);
          showToast(`✅ "${created.name}" créée dans Monday et ajoutée au stock`);
        } catch (err: any) {
          setIsSavingMonday(false);
          showToast(`⚠️ Erreur création Monday : ${err?.message || 'échec'}`);
          return;
        }
        setIsSavingMonday(false);
      } else {
        const newPart: StockItemRecord = {
          id: `part-${Date.now()}`,
          ...payload,
          lastUpdated: new Date().toISOString(),
        };
        setParts((prev) => [newPart, ...prev]);
        showToast(`Nouvelle référence "${newPart.name}" ajoutée au stock`);
      }
    }

    setIsNewPartModalOpen(false);
    setEditingPart(null);
  };

  // Archiver (sur Monday) ou supprimer (local) une pièce
  const handleDeletePart = async (id: string, name: string) => {
    const target = parts.find((p) => p.id === id);
    const confirmLabel =
      stockSchema && target?.mondayItemId
        ? `Confirmez-vous l'archivage de la référence "${name}" dans Monday ?`
        : `Confirmez-vous la suppression de la référence "${name}" ?`;

    if (!confirm(confirmLabel)) return;

    if (stockSchema && target?.mondayItemId) {
      try {
        await archiveStockItemOnMonday(target.mondayItemId);
        setParts((prev) => prev.filter((p) => p.id !== id));
        showToast(`Référence "${name}" archivée dans Monday`);
      } catch (err: any) {
        showToast(`⚠️ Erreur archivage Monday : ${err?.message || 'échec'}`);
      }
    } else {
      setParts((prev) => prev.filter((p) => p.id !== id));
      showToast(`Référence "${name}" supprimée`);
    }
  };

  // Réinitialiser au stock par défaut (uniquement en mode local hors tableau Monday)
  const handleResetDefaults = () => {
    if (confirm('Voulez-vous restaurer les 10 pièces et seuils par défaut de Christophe ?')) {
      setParts(DEFAULT_PARTS);
      showToast('Stock par défaut réinitialisé avec succès');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Toast de notification */}
      {toastMessage && (
        <div
          style={{
            backgroundColor: '#1B4565',
            color: '#FFFFFF',
            borderRadius: '12px',
            padding: '12px 20px',
            fontSize: '13.5px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 6px 20px rgba(27, 69, 101, 0.3)',
            fontFamily: "'Ruda', sans-serif",
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="#F7AC37" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', fontWeight: 800 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ================= EN-TÊTE & CARTES KPI DU STOCK ================= */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              backgroundColor: '#39A9DC',
              color: '#FFFFFF',
              fontFamily: "'Ruda', sans-serif",
              fontSize: '12px',
              fontWeight: 800,
              padding: '3px 9px',
              borderRadius: '6px',
            }}
          >
            05
          </span>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565' }}>
              Stocks Pièces Détachées &amp; Consommables
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#57778E' }}>
              Gestion globale des stocks pour le dépannage et le réapprovisionnement terrain
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={openNewModal}
            style={{
              backgroundColor: '#00C875',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: 800,
              fontFamily: "'Ruda', sans-serif",
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 3px 10px rgba(0, 200, 117, 0.25)',
            }}
          >
            <Plus size={16} />
            Ajouter une pièce
          </button>

          {stockSchema ? (
            <>
              <button
                type="button"
                onClick={() => syncWithMonday(true)}
                disabled={mondayStatus === 'checking'}
                title="Recharger les quantités depuis Monday"
                style={{
                  backgroundColor: '#FAFCFD',
                  color: '#1B4565',
                  border: '1px solid #D2E9F6',
                  borderRadius: '10px',
                  padding: '9px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: mondayStatus === 'checking' ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <RefreshCw size={14} />
                Actualiser
              </button>
              {stockSchema.boardUrl && (
                <button
                  type="button"
                  onClick={() => window.open(stockSchema.boardUrl, '_blank', 'noopener,noreferrer')}
                  title="Ouvrir le tableau Stock sur Monday"
                  style={{
                    backgroundColor: '#FAFCFD',
                    color: '#1B4565',
                    border: '1px solid #D2E9F6',
                    borderRadius: '10px',
                    padding: '9px 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <ExternalLink size={14} />
                  Voir sur Monday
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={handleResetDefaults}
              title="Restaurer les pièces types"
              style={{
                backgroundColor: '#FAFCFD',
                color: '#6C8CA3',
                border: '1px solid #D2E9F6',
                borderRadius: '10px',
                padding: '9px 12px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <RefreshCw size={14} />
              Réinit.
            </button>
          )}
        </div>
      </div>

      {/* ================= BANDEAU CONNEXION / MIGRATION TABLEAU MONDAY STOCK ================= */}
      {mondayStatus === 'checking' && (
        <div
          style={{
            backgroundColor: '#F0F8FE',
            border: '1px solid #BFE3F7',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#1B4565',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          <Loader2 size={16} color="#39A9DC" />
          <span>Recherche du tableau partagé « {STOCK_BOARD_NAME} » sur Monday...</span>
        </div>
      )}

      {(mondayStatus === 'not_created' || mondayStatus === 'error') && (
        <div
          style={{
            backgroundColor: '#FFF5F5',
            border: '1.5px solid #FEB2B2',
            borderRadius: '14px',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '12.5px', color: '#991B1B', fontWeight: 700 }}>
            ⚠️ {mondayError || `Tableau « ${STOCK_BOARD_NAME} » introuvable sur Monday. Affichage local en secours.`}
          </div>
          <button
            type="button"
            onClick={() => syncWithMonday(true)}
            style={{
              backgroundColor: '#1B4565',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '9px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 800,
              fontFamily: "'Ruda', sans-serif",
              cursor: 'pointer',
            }}
          >
            🔄 Reconnecter
          </button>
        </div>
      )}

      {/* 3 Cartes synthétiques */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        {/* Total références */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            padding: '16px 18px',
            border: '1.5px solid #E2EEF5',
            boxShadow: '0 2px 10px rgba(27, 69, 101, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#3989B7', fontFamily: "'Ruda', sans-serif", textTransform: 'uppercase' }}>
              Références Suivies
            </span>
            <Package size={18} color="#39A9DC" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#1B4565', fontFamily: "'Ruda', sans-serif' " }}>
            {parts.length}
          </div>
          <span style={{ fontSize: '11.5px', color: '#57778E' }}>
            Dans le stock global pièces &amp; consommables
          </span>
        </div>

        {/* Alertes Stock Mini */}
        <div
          onClick={() => setOnlyAlerts(!onlyAlerts)}
          style={{
            backgroundColor: alertParts.length > 0 ? '#FFF7F7' : '#FFFFFF',
            borderRadius: '14px',
            padding: '16px 18px',
            border: alertParts.length > 0 ? '2px solid #E2445C' : '1.5px solid #E2EEF5',
            boxShadow: alertParts.length > 0 ? '0 4px 14px rgba(226, 68, 92, 0.15)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 800, color: alertParts.length > 0 ? '#E2445C' : '#0E7042', fontFamily: "'Ruda', sans-serif", textTransform: 'uppercase' }}>
              Sous Stock Mini (Alertes)
            </span>
            <AlertTriangle size={18} color={alertParts.length > 0 ? '#E2445C' : '#00C875'} />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: alertParts.length > 0 ? '#E2445C' : '#00C875', fontFamily: "'Ruda', sans-serif" }}>
            {alertParts.length}
          </div>
          <span style={{ fontSize: '11.5px', color: alertParts.length > 0 ? '#961C2E' : '#57778E', fontWeight: 600 }}>
            {alertParts.length > 0 ? '⚠️ Cliquez pour filtrer les réapprovisionnements' : '✅ Tous les stocks sont au-dessus du minimum'}
          </span>
        </div>

        {/* Total pièces disponibles */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            padding: '16px 18px',
            border: '1.5px solid #E2EEF5',
            boxShadow: '0 2px 10px rgba(27, 69, 101, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#D66927', fontFamily: "'Ruda', sans-serif", textTransform: 'uppercase' }}>
              Unités en Stock
            </span>
            <ShoppingCart size={18} color="#F7AC37" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#1B4565', fontFamily: "'Ruda', sans-serif" }}>
            {parts.reduce((sum, p) => sum + p.currentStock, 0)}
          </div>
          <span style={{ fontSize: '11.5px', color: '#57778E' }}>
            Pièces et consommables disponibles à l'atelier
          </span>
        </div>
      </div>

      {/* ================= BARRE DE RECHERCHE ET FILTRES ================= */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          padding: '14px 18px',
          border: '1.5px solid #E2EEF5',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Champ recherche */}
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <Search size={16} color="#6C8CA3" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Rechercher une pièce, moteur, suceur, câble..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '8px',
                border: '1.5px solid #D2E9F6',
                fontSize: '13px',
                color: '#1B4565',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Filtre d'alerte rouge 1-clic */}
          <button
            type="button"
            onClick={() => setOnlyAlerts(!onlyAlerts)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: onlyAlerts ? '2px solid #E2445C' : '1px solid #F5C6CB',
              backgroundColor: onlyAlerts ? '#E2445C' : '#FFF7F7',
              color: onlyAlerts ? '#FFFFFF' : '#961C2E',
              fontSize: '12.5px',
              fontWeight: 800,
              fontFamily: "'Ruda', sans-serif",
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.12s ease',
            }}
          >
            <AlertTriangle size={15} />
            À réapprovisionner ({alertParts.length})
          </button>

          {/* Filtre catégorie */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1.5px solid #D2E9F6',
              backgroundColor: '#FAFCFD',
              color: '#1B4565',
              fontSize: '12.5px',
              fontWeight: 700,
              fontFamily: "'Ruda', sans-serif",
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="all">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ================= GRILLE DES CARTES PIÈCES (CONÇUE POUR MOBILE) ================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '14px' }}>
        {filteredParts.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: '36px 20px',
              textAlign: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              border: '1px dashed #D2E9F6',
              color: '#57778E',
            }}
          >
            <Package size={34} color="#39A9DC" style={{ marginBottom: '8px' }} />
            <p style={{ margin: 0, fontWeight: 800, fontSize: '14px', color: '#1B4565' }}>
              Aucune pièce ne correspond à ces critères.
            </p>
          </div>
        ) : (
          filteredParts.map((p) => {
            const isAlert = p.currentStock <= p.minStock;

            return (
              <div
                key={p.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '14px',
                  padding: '16px 18px',
                  border: isAlert ? '2px solid #F5C6CB' : '1.5px solid #E2EEF5',
                  boxShadow: isAlert ? '0 4px 14px rgba(226, 68, 92, 0.08)' : '0 2px 8px rgba(27, 69, 101, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* En-tête de la carte */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        fontFamily: "'Ruda', sans-serif",
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#EBF6FC',
                        color: '#39A9DC',
                        textTransform: 'uppercase',
                      }}
                    >
                      {p.category}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        title="Modifier la pièce"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6C8CA3', padding: '3px' }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePart(p.id, p.name)}
                        title="Supprimer"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A0B4C3', padding: '3px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <h3
                    style={{
                      margin: '4px 0 0 0',
                      fontSize: '15px',
                      fontWeight: 800,
                      fontFamily: "'Ruda', sans-serif",
                      color: '#1B4565',
                      lineHeight: 1.3,
                    }}
                  >
                    {p.name}
                  </h3>

                  {p.notes && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#6C8CA3', fontStyle: 'italic' }}>
                      {p.notes}
                    </p>
                  )}
                </div>

                {/* Bloc d'affichage du Stock & Alerte */}
                <div
                  style={{
                    backgroundColor: isAlert ? '#FFF7F7' : '#F8FCFE',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    border: isAlert ? '1.5px solid #F5C6CB' : '1px solid #D2E9F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '11px', color: '#57778E', fontWeight: 700, display: 'block' }}>
                      STOCK ACTUEL
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                      <span
                        style={{
                          fontSize: '26px',
                          fontWeight: 900,
                          fontFamily: "'Ruda', sans-serif",
                          color: isAlert ? '#E2445C' : '#00A389',
                        }}
                      >
                        {p.currentStock}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#6C8CA3' }}>
                        {p.unit}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#57778E', fontWeight: 700, display: 'block' }}>
                      SEUIL MINI
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#1B4565', fontFamily: "'Ruda', sans-serif" }}>
                      {p.minStock} {p.unit}
                    </span>
                    {isAlert && (
                      <span
                        style={{
                          display: 'block',
                          marginTop: '2px',
                          fontSize: '10.5px',
                          fontWeight: 800,
                          color: '#E2445C',
                          fontFamily: "'Ruda', sans-serif",
                        }}
                      >
                        ⚠️ À COMMANDER
                      </span>
                    )}
                  </div>
                </div>

                {/* Boutons d'action rapides smartphone (-1, +1, -5, +5) */}
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => adjustStock(p.id, -1)}
                    disabled={p.currentStock <= 0}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: '8px',
                      border: '1.5px solid #D2E9F6',
                      backgroundColor: p.currentStock <= 0 ? '#F5F9FC' : '#FAFCFD',
                      color: p.currentStock <= 0 ? '#A0B4C3' : '#1B4565',
                      fontSize: '13px',
                      fontWeight: 800,
                      fontFamily: "'Ruda', sans-serif",
                      cursor: p.currentStock <= 0 ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    <Minus size={13} /> 1
                  </button>

                  <button
                    type="button"
                    onClick={() => adjustStock(p.id, 1)}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: '8px',
                      border: '1.5px solid #00C875',
                      backgroundColor: '#E6F8F0',
                      color: '#0E7042',
                      fontSize: '13px',
                      fontWeight: 800,
                      fontFamily: "'Ruda', sans-serif",
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    <Plus size={13} /> 1
                  </button>

                  <button
                    type="button"
                    onClick={() => adjustStock(p.id, -5)}
                    disabled={p.currentStock < 5}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #D2E9F6',
                      backgroundColor: p.currentStock < 5 ? '#F5F9FC' : '#FAFCFD',
                      color: p.currentStock < 5 ? '#A0B4C3' : '#57778E',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: p.currentStock < 5 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    − 5
                  </button>

                  <button
                    type="button"
                    onClick={() => adjustStock(p.id, 5)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #D2E9F6',
                      backgroundColor: '#FAFCFD',
                      color: '#3989B7',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    + 5
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ================= MODAL AJOUT / MODIFICATION D'UNE PIÈCE ================= */}
      {isNewPartModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(27, 69, 101, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          onClick={() => setIsNewPartModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 10px 30px rgba(27, 69, 101, 0.2)',
              border: '1px solid #E2EEF5',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565' }}>
                {editingPart ? 'Modifier la référence' : 'Ajouter une pièce au stock'}
              </h3>
              <button
                type="button"
                onClick={() => setIsNewPartModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6C8CA3' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePart} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565', marginBottom: '4px' }}>
                  Nom de la pièce / Référence *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex : Moteur aspiration 1200W, Câble 15m..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #D2E9F6',
                    fontSize: '13px',
                    color: '#1B4565',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565', marginBottom: '4px' }}>
                    Catégorie
                  </label>
                  <input
                    type="text"
                    placeholder="Consommable, Moteur..."
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #D2E9F6',
                      fontSize: '13px',
                      color: '#1B4565',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565', marginBottom: '4px' }}>
                    Unité
                  </label>
                  <input
                    type="text"
                    placeholder="pièces, paires, mètres..."
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #D2E9F6',
                      fontSize: '13px',
                      color: '#1B4565',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565', marginBottom: '4px' }}>
                    Stock actuel
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formCurrent}
                    onChange={(e) => setFormCurrent(parseInt(e.target.value, 10) || 0)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #D2E9F6',
                      fontSize: '14px',
                      fontWeight: 800,
                      color: '#1B4565',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565', marginBottom: '4px' }}>
                    Seuil Stock Mini
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formMin}
                    onChange={(e) => setFormMin(parseInt(e.target.value, 10) || 0)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #D2E9F6',
                      fontSize: '14px',
                      fontWeight: 800,
                      color: '#1B4565',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, fontFamily: "'Ruda', sans-serif", color: '#1B4565', marginBottom: '4px' }}>
                  Remarques / Compatibilité machines
                </label>
                <input
                  type="text"
                  placeholder="Ex : Pour autolaveuses autoportées, réf 24V..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid #D2E9F6',
                    fontSize: '13px',
                    color: '#1B4565',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsNewPartModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#F0F5F8',
                    color: '#57778E',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingMonday}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isSavingMonday ? '#94A3B8' : '#00C875',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 800,
                    fontFamily: "'Ruda', sans-serif",
                    cursor: isSavingMonday ? 'wait' : 'pointer',
                    boxShadow: '0 2px 8px rgba(0, 200, 117, 0.25)',
                  }}
                >
                  {isSavingMonday
                    ? 'Enregistrement Monday...'
                    : editingPart
                      ? 'Enregistrer les modifications'
                      : 'Ajouter au stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
