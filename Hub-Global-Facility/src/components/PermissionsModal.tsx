import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  HUB_DEFINITIONS,
  HubKey,
  PERMISSIONS_BOARD_URL,
} from '../config/hubPermissions';
import {
  addPermissionUserRow,
  archivePermissionUserRow,
  fetchAllPermissionsRows,
  PermissionRow,
  updatePermissionCell,
} from '../services/permissionsService';

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  monday: any;
  onPermissionsChanged: () => void;
}

const PERMISSION_COLUMN_META: Record<HubKey, { title: string; subtitle: string }> = {
  secteurs: { title: 'Resp. Secteur', subtitle: 'Animatrices' },
  atelier: { title: 'Parc Machines', subtitle: 'Atelier · Christophe' },
  facturation: { title: 'Fact. Véhicules', subtitle: 'Énergie · Christine' },
  fournisseurs: { title: 'Fournisseurs', subtitle: 'SAV & Partenaires' },
  communication: { title: 'Contacts Clients', subtitle: 'Annuaire · Léa' },
  direction: { title: 'Véhicules', subtitle: 'Flotte & GPS · Vincent' },
  commercial: { title: 'Commercial', subtitle: 'Portefeuille & CA' },
  finance: { title: 'Finance', subtitle: 'Direction & CA' },
  salaries: { title: 'Salariés', subtitle: 'Enchantement RH' },
};

export default function PermissionsModal({
  isOpen,
  onClose,
  monday,
  onPermissionsChanged,
}: PermissionsModalProps) {
  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Détection des e-mails en doublon déjà présents dans le tableau Monday
  const duplicateEmails = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      const em = r.email.toLowerCase().trim();
      if (!em) return;
      counts.set(em, (counts.get(em) || 0) + 1);
    });
    const dupes = new Set<string>();
    counts.forEach((count, em) => {
      if (count > 1) dupes.add(em);
    });
    return dupes;
  }, [rows]);

  const loadRows = async (force = false) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchAllPermissionsRows(monday, force);
      setRows(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossible de charger les autorisations depuis Monday.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRows(true);
    }
  }, [isOpen]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(
      (r) => r.userName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const handleToggle = async (row: PermissionRow, hubKey: HubKey) => {
    const nextVal = !row.permissions[hubKey];
    const cellKey = `${row.itemId}:${hubKey}`;
    setSavingKey(cellKey);
    setErrorMsg(null);

    // Mise à jour optimiste
    setRows((prev) =>
      prev.map((r) =>
        r.itemId === row.itemId
          ? { ...r, permissions: { ...r.permissions, [hubKey]: nextVal } }
          : r
      )
    );

    try {
      await updatePermissionCell(monday, row.itemId, hubKey, nextVal);
      onPermissionsChanged();
    } catch (err: any) {
      // Rollback en cas d'erreur
      setRows((prev) =>
        prev.map((r) =>
          r.itemId === row.itemId
            ? { ...r, permissions: { ...r.permissions, [hubKey]: !nextVal } }
            : r
        )
      );
      setErrorMsg(err?.message || 'Erreur lors de la mise à jour Monday.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const cleanEmail = newEmail.toLowerCase().trim();
    if (cleanEmail) {
      const existing = rows.find((r) => r.email.toLowerCase().trim() === cleanEmail);
      if (existing) {
        setErrorMsg(
          `L’adresse « ${newEmail.trim()} » existe déjà pour ${existing.userName}. Modifiez directement sa ligne ci-dessous pour éviter un doublon.`
        );
        setSearch(cleanEmail);
        setHighlightedItemId(existing.itemId);
        window.setTimeout(() => setHighlightedItemId(null), 4000);
        return;
      }
    }

    setAdding(true);
    setErrorMsg(null);
    try {
      const created = await addPermissionUserRow(monday, newName, newEmail);
      if (created) {
        setRows((prev) => [...prev, created]);
        setNewName('');
        setNewEmail('');
        onPermissionsChanged();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossible d’ajouter ce collaborateur.');
    } finally {
      setAdding(false);
    }
  };

  const handleArchiveUser = async (row: PermissionRow) => {
    setDeletingId(row.itemId);
    setErrorMsg(null);
    try {
      await archivePermissionUserRow(monday, row.itemId);
      setRows((prev) => prev.filter((r) => r.itemId !== row.itemId));
      setConfirmDeleteId(null);
      onPermissionsChanged();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossible de retirer ce collaborateur.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="modal-backdrop-in facility-modal-overlay"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.58)',
        backdropFilter: 'blur(6px)',
        zIndex: 260,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-spring-in"
        style={{
          width: '1260px',
          maxWidth: '100%',
          maxHeight: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          border: '1px solid #D7EAF5',
          boxShadow: '0 24px 60px rgba(27, 69, 101, 0.28)',
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
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(247, 172, 55, 0.22)',
                border: '1px solid rgba(247, 172, 55, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={20} color="#F7AC37" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '17px', fontWeight: 900, color: '#FFFFFF' }}>
                Gestion des Autorisations Hubs (Oui / Non)
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'rgba(255,255,255,0.8)' }}>
                Synchronisé en direct avec le tableau Monday « 🔐 Autorisations Hubs » — Les carrés non cochés disparaissent pour le collaborateur.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href={PERMISSIONS_BOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.14)',
                color: '#FFFFFF',
                fontSize: '11.5px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <span>Tableau Monday</span>
              <ExternalLink size={12} />
            </a>
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
        </div>

        {/* Barre outils */}
        <div
          style={{
            padding: '12px 22px',
            backgroundColor: '#F4F9FC',
            borderBottom: '1px solid #D7EAF5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: '210px', maxWidth: '340px' }}>
            <Search size={14} color="#64748B" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer un collaborateur ou e-mail..."
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '12.5px',
                backgroundColor: '#FFFFFF',
                color: '#1B4565',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => loadRows(true)}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #B7D8EA',
              backgroundColor: '#FFFFFF',
              color: '#3989B7',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Actualiser</span>
          </button>
        </div>

        {errorMsg && (
          <div style={{ padding: '10px 22px', backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: '12px', fontWeight: 700 }}>
            {errorMsg}
          </div>
        )}

        {/* Matrice des autorisations */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 22px 14px' }}>
          {loading && rows.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
              Chargement des autorisations...
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ borderBottom: '2px solid #D7EAF5', backgroundColor: '#F4F9FC', textAlign: 'left', boxShadow: '0 2px 4px rgba(27,69,101,0.06)' }}>
                  <th style={{ padding: '12px 12px', color: '#1B4565', fontWeight: 800, minWidth: '180px', backgroundColor: '#F4F9FC' }}>
                    Collaborateur
                  </th>
                  {HUB_DEFINITIONS.map((h) => {
                    const meta = PERMISSION_COLUMN_META[h.key];
                    return (
                      <th
                        key={h.key}
                        title={`${h.label} — ${h.description}`}
                        style={{
                          padding: '10px 6px',
                          textAlign: 'center',
                          minWidth: '94px',
                          backgroundColor: '#F4F9FC',
                          verticalAlign: 'middle',
                          cursor: 'help',
                        }}
                      >
                        <div style={{ color: '#1B4565', fontWeight: 800, fontSize: '11.5px', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                          {meta.title}
                        </div>
                        <div style={{ color: '#3989B7', fontWeight: 700, fontSize: '9.5px', lineHeight: 1.2, marginTop: '2px', whiteSpace: 'nowrap' }}>
                          {meta.subtitle}
                        </div>
                      </th>
                    );
                  })}
                  <th style={{ padding: '12px 8px', color: '#64748B', fontWeight: 800, textAlign: 'center', width: '76px', backgroundColor: '#F4F9FC' }}>
                    Retirer
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const rowEmailLow = row.email.toLowerCase().trim();
                  const isDupe = Boolean(rowEmailLow && duplicateEmails.has(rowEmailLow));
                  const isHighlighted = highlightedItemId === row.itemId;
                  return (
                  <tr
                    key={row.itemId}
                    style={{
                      borderBottom: '1px solid #EBF6FC',
                      backgroundColor: isHighlighted ? '#FEF6E7' : isDupe ? '#FFF7ED' : 'transparent',
                      transition: 'background-color 0.25s ease',
                    }}
                  >
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, color: '#1B4565' }}>{row.userName}</span>
                        {isDupe && (
                          <span
                            title="Deux lignes partagent cette même adresse e-mail sur Monday : seule la première est prise en compte."
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: '999px',
                              backgroundColor: '#FFEDD5',
                              color: '#C2410C',
                              border: '1px solid #FDBA74',
                            }}
                          >
                            Doublon e-mail
                          </span>
                        )}
                      </div>
                      {row.email && (
                        <div style={{ fontSize: '10.5px', color: '#64748B' }}>{row.email}</div>
                      )}
                    </td>
                    {HUB_DEFINITIONS.map((h) => {
                      const active = row.permissions[h.key];
                      const busy = savingKey === `${row.itemId}:${h.key}`;
                      return (
                        <td key={h.key} style={{ padding: '8px', textAlign: 'center' }}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleToggle(row, h.key)}
                            title={`${row.userName} — ${h.label} : ${active ? 'Visible (Oui)' : 'Masqué (Non)'}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              border: active ? '1px solid #10B981' : '1px solid #CBD5E1',
                              backgroundColor: active ? '#E6F9F1' : '#F8FAFC',
                              color: active ? '#0E7042' : '#64748B',
                              fontSize: '11px',
                              fontWeight: 800,
                              cursor: busy ? 'wait' : 'pointer',
                              minWidth: '58px',
                            }}
                          >
                            {busy ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : active ? (
                              <>
                                <Check size={11} strokeWidth={3} />
                                <span>Oui</span>
                              </>
                            ) : (
                              <span>Non</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      {confirmDeleteId === row.itemId ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            disabled={deletingId === row.itemId}
                            onClick={() => handleArchiveUser(row)}
                            title="Confirmer la suppression (archivage Monday)"
                            style={{
                              padding: '4px 8px',
                              borderRadius: '7px',
                              border: 'none',
                              backgroundColor: '#DC2626',
                              color: '#FFFFFF',
                              fontSize: '10.5px',
                              fontWeight: 800,
                              cursor: deletingId === row.itemId ? 'wait' : 'pointer',
                            }}
                          >
                            {deletingId === row.itemId ? '...' : 'Oui'}
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === row.itemId}
                            onClick={() => setConfirmDeleteId(null)}
                            title="Annuler"
                            style={{
                              padding: '4px 7px',
                              borderRadius: '7px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFFFFF',
                              color: '#475569',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Non
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(row.itemId)}
                          title={`Retirer ${row.userName} (archive la ligne sur Monday)`}
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '8px',
                            border: '1px solid #FECACA',
                            backgroundColor: '#FEF2F2',
                            color: '#DC2626',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Ajout rapide d'un collaborateur */}
        <form
          onSubmit={handleAddUser}
          style={{
            padding: '12px 22px',
            backgroundColor: '#F4F9FC',
            borderTop: '1px solid #D7EAF5',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#1B4565', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <UserPlus size={14} color="#39A9DC" />
            Ajouter :
          </span>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom Prénom"
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '12px',
              backgroundColor: '#FFFFFF',
              minWidth: '150px',
            }}
          />
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@groupefacility.fr"
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '12px',
              backgroundColor: '#FFFFFF',
              flex: 1,
              minWidth: '180px',
            }}
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#39A9DC',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 800,
              cursor: adding || !newName.trim() ? 'not-allowed' : 'pointer',
              opacity: adding || !newName.trim() ? 0.6 : 1,
            }}
          >
            {adding ? 'Ajout...' : 'Ajouter l’utilisateur'}
          </button>
        </form>
      </div>
    </div>
  );
}
