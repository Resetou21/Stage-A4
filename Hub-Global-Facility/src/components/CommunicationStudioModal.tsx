import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ImagePlus,
  Loader2,
  Newspaper,
  Palette,
  RotateCcw,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import {
  BrandingMap,
  BrandingSlotKey,
  resetBrandingSlot,
  saveBrandingSlot,
} from '../services/brandingService';

export interface StudioSlotDefault {
  key: BrandingSlotKey;
  label: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultImage: string;
}

interface CommunicationStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  monday: any;
  branding: BrandingMap;
  slots: StudioSlotDefault[];
  onBrandingUpdated: (next: BrandingMap) => void;
  onOpenNewsPage: () => void;
}

export default function CommunicationStudioModal({
  isOpen,
  onClose,
  monday,
  branding,
  slots,
  onBrandingUpdated,
  onOpenNewsPage,
}: CommunicationStudioModalProps) {
  const [selectedKey, setSelectedKey] = useState<BrandingSlotKey>('hero');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrlText, setImageUrlText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [clearUploaded, setClearUploaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSlot = slots.find((s) => s.key === selectedKey) || slots[0];
  const currentOverride = branding[selectedKey];

  useEffect(() => {
    if (!isOpen || !activeSlot) return;
    setTitle(currentOverride?.title || '');
    setDescription(currentOverride?.description || '');
    setImageUrlText(
      currentOverride?.imageUrl && !currentOverride.imageUrl.includes('monday.com/protected_static')
        ? currentOverride.imageUrl
        : ''
    );
    setImageFile(null);
    setClearUploaded(false);
    setFeedback(null);
    if (localPreview) {
      URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [isOpen, selectedKey, branding]);

  if (!isOpen || !activeSlot) return null;

  const effectivePreviewImage =
    localPreview ||
    (imageUrlText.trim() && /^(https?:\/\/|\.\/|data:image\/)/i.test(imageUrlText.trim())
      ? imageUrlText.trim()
      : !clearUploaded && currentOverride?.imageUrl
      ? currentOverride.imageUrl
      : activeSlot.defaultImage);

  const handleSelectFile = (file: File | null) => {
    if (localPreview) {
      URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
    }
    if (!file) {
      setImageFile(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'err', text: 'Veuillez choisir un fichier image (JPG, PNG, WebP).' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFeedback({ type: 'err', text: 'Image trop lourde (max 10 Mo).' });
      return;
    }
    setFeedback(null);
    setClearUploaded(false);
    setImageFile(file);
    setLocalPreview(URL.createObjectURL(file));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await saveBrandingSlot(monday, branding, {
        key: activeSlot.key,
        label: activeSlot.label,
        title,
        description,
        imageUrlText,
        imageFile,
        clearUploadedImage: clearUploaded,
      });

      const nextOverride = {
        ...saved,
        imageUrl: saved.imageUrl || (imageFile && localPreview ? localPreview : saved.imageUrl),
      };
      const nextMap: BrandingMap = {
        ...branding,
        [activeSlot.key]: nextOverride,
      };
      onBrandingUpdated(nextMap);
      setImageFile(null);
      setClearUploaded(false);
      setFeedback({ type: 'ok', text: `Modifications enregistrées pour « ${activeSlot.label} » et visibles par tous !` });
    } catch (err: any) {
      setFeedback({
        type: 'err',
        text: err?.message || 'Impossible d’enregistrer la personnalisation sur Monday.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setFeedback(null);
    try {
      await resetBrandingSlot(monday, branding, activeSlot.key);
      const nextMap: BrandingMap = { ...branding };
      delete nextMap[activeSlot.key];
      onBrandingUpdated(nextMap);
      setTitle('');
      setDescription('');
      setImageUrlText('');
      setImageFile(null);
      setClearUploaded(false);
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
        setLocalPreview(null);
      }
      setFeedback({ type: 'ok', text: `« ${activeSlot.label} » remis aux valeurs par défaut.` });
    } catch (err: any) {
      setFeedback({ type: 'err', text: err?.message || 'Erreur lors de la réinitialisation.' });
    } finally {
      setResetting(false);
    }
  };

  const isHero = activeSlot.key === 'hero';

  return (
    <div
      onClick={onClose}
      className="modal-backdrop-in facility-modal-overlay"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.58)',
        backdropFilter: 'blur(6px)',
        zIndex: 270,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-spring-in"
        style={{
          width: '960px',
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
            backgroundImage: 'linear-gradient(135deg, #1B4565 0%, #D66927 100%)',
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
                width: '40px',
                height: '40px',
                borderRadius: '11px',
                backgroundColor: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.38)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Palette size={20} color="#F7AC37" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '17px', fontWeight: 900, color: '#FFFFFF' }}>
                Studio Communication — Éditer l’Accueil &amp; les Hubs
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: 'rgba(255,255,255,0.85)' }}>
                Réservé à Léa (Communication) &amp; Admins — Modifiez la bannière, les noms, textes et photos visibles par toute l’entreprise.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenNewsPage();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.35)',
                backgroundColor: 'rgba(255,255,255,0.16)',
                color: '#FFFFFF',
                fontSize: '11.5px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Newspaper size={13} />
              <span>Gérer les Actualités</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'rgba(255,255,255,0.16)',
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

        {/* Sélecteur d'élément à personnaliser */}
        <div
          style={{
            padding: '12px 22px',
            backgroundColor: '#F4F9FC',
            borderBottom: '1px solid #D7EAF5',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          {slots.map((slot) => {
            const active = slot.key === selectedKey;
            const customized = Boolean(
              branding[slot.key]?.title || branding[slot.key]?.description || branding[slot.key]?.imageUrl
            );
            return (
              <button
                key={slot.key}
                type="button"
                onClick={() => setSelectedKey(slot.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: '999px',
                  border: active ? '1.5px solid #1B4565' : '1px solid #CBD5E1',
                  backgroundColor: active ? '#1B4565' : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#1B4565',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {slot.key === 'hero' && <Sparkles size={12} color={active ? '#F7AC37' : '#D66927'} />}
                <span>{slot.label}</span>
                {customized && (
                  <span
                    title="Personnalisé"
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: '#00C875',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Contenu d'édition */}
        <form onSubmit={handleSave} style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Aperçu visuel en direct */}
          <div
            style={{
              position: 'relative',
              borderRadius: '16px',
              overflow: 'hidden',
              height: isHero ? '160px' : '148px',
              backgroundImage: `linear-gradient(135deg, rgba(16, 43, 66, 0.85) 0%, rgba(27, 69, 101, 0.72) 55%, rgba(57, 137, 183, 0.68) 100%), url('${effectivePreviewImage}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              padding: '18px 20px',
              color: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              border: '1.5px solid #D7EAF5',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '10px',
                left: '12px',
                padding: '3px 9px',
                borderRadius: '999px',
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                color: '#F7AC37',
                fontSize: '10px',
                fontWeight: 800,
              }}
            >
              APERÇU EN DIRECT
            </span>
            <div style={{ fontFamily: "'Ruda', sans-serif", fontSize: '19px', fontWeight: 900, textShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>
              {isHero
                ? title.trim() || activeSlot.defaultTitle
                : title.trim() || activeSlot.defaultTitle}
            </div>
            <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.92)', marginTop: '4px', maxWidth: '680px' }}>
              {description.trim() || activeSlot.defaultDescription}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '16px' }}>
            {/* Champs texte */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#1B4565', marginBottom: '5px' }}>
                  {isHero ? 'Titre d’accueil (laisser vide = « Bonjour Prénom ☀️ »)' : 'Nom affiché du Hub'}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={activeSlot.defaultTitle}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '13px',
                    color: '#0F172A',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#1B4565', marginBottom: '5px' }}>
                  {isHero ? 'Texte sous le titre (page d’accueil)' : 'Description de la carte'}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={activeSlot.defaultDescription}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '13px',
                    color: '#0F172A',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    lineHeight: 1.5,
                  }}
                />
              </div>
            </div>

            {/* Image de fond / couverture */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#1B4565' }}>
                {isHero ? 'Photo de fond de la page d’accueil' : 'Image de couverture de la carte'}
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleSelectFile(e.target.files?.[0] || null)}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleSelectFile(f);
                }}
                style={{
                  borderRadius: '12px',
                  border: '2px dashed #B7D8EA',
                  backgroundColor: '#F4F9FC',
                  padding: '16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ImagePlus size={22} color="#39A9DC" />
                <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#1B4565' }}>
                  {imageFile ? `Photo prête : ${imageFile.name}` : 'Cliquer ou glisser une photo ici'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  JPG, PNG ou WebP (max 10 Mo) — hébergée sur Monday
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
                  Ou coller une URL d’image directe (optionnel)
                </label>
                <input
                  type="text"
                  value={imageUrlText}
                  onChange={(e) => setImageUrlText(e.target.value)}
                  placeholder="https://..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '12px',
                    color: '#0F172A',
                  }}
                />
              </div>

              {(currentOverride?.imageUrl || localPreview) && (
                <button
                  type="button"
                  onClick={() => {
                    handleSelectFile(null);
                    setImageUrlText('');
                    setClearUploaded(true);
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '5px 10px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#64748B',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Revenir à l’image par défaut
                </button>
              )}
            </div>
          </div>

          {feedback && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                backgroundColor: feedback.type === 'ok' ? '#E6F9F1' : '#FEF2F2',
                color: feedback.type === 'ok' ? '#0E7042' : '#B91C1C',
                border: `1px solid ${feedback.type === 'ok' ? '#A7F3D0' : '#FECACA'}`,
                fontSize: '12px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {feedback.type === 'ok' && <Check size={15} />}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Footer actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', paddingTop: '8px', borderTop: '1px solid #EBF6FC' }}>
            <button
              type="button"
              disabled={resetting || !currentOverride?.itemId}
              onClick={handleReset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 13px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: currentOverride?.itemId ? '#D66927' : '#94A3B8',
                fontSize: '12px',
                fontWeight: 700,
                cursor: currentOverride?.itemId ? 'pointer' : 'not-allowed',
              }}
            >
              {resetting ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              <span>Réinitialiser « {activeSlot.label} »</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '9px 14px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Fermer
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#1B4565',
                  color: '#FFFFFF',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: saving ? 'wait' : 'pointer',
                  boxShadow: '0 4px 12px rgba(27,69,101,0.22)',
                }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>{saving ? 'Enregistrement…' : 'Enregistrer pour tout le monde'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
