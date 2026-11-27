import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Megaphone,
  Newspaper,
  Plus,
  RefreshCw,
  Send,
  User,
  X,
} from 'lucide-react';
import {
  createCustomNews,
  CustomNewsItem,
  fetchCustomNews,
  fmtNewsDateFr,
  getNewsCategoryStyle,
  NEWS_CATEGORIES,
  readCachedCustomNews,
  toggleCustomNewsActive,
  writeCachedCustomNews,
} from '../services/newsService';

interface NewsHubViewProps {
  monday: any;
  canPublishNews: boolean;
  currentUserName: string;
  initialOpenComposer?: boolean;
  onComposerOpened?: () => void;
}

export const NewsHubView: React.FC<NewsHubViewProps> = ({
  monday,
  canPublishNews,
  currentUserName,
  initialOpenComposer = false,
  onComposerOpened,
}) => {
  const [items, setItems] = useState<CustomNewsItem[]>(() => readCachedCustomNews());
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Toutes');
  const [showHidden, setShowHidden] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<CustomNewsItem | null>(null);

  // Formulaire nouvel article
  const [showComposer, setShowComposer] = useState(initialOpenComposer);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(NEWS_CATEGORIES[0].id);
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialOpenComposer && canPublishNews) {
      setShowComposer(true);
      onComposerOpened?.();
    }
  }, [initialOpenComposer, canPublishNews]);

  const loadNews = async (force = false) => {
    setLoading(true);
    try {
      const list = await fetchCustomNews(monday, force);
      setItems(list);
    } catch (err) {
      console.error('[Journal Actualités] Erreur chargement:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews(true);
  }, [monday]);

  const handleSelectImage = (file: File | null) => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    if (!file) {
      setImageFile(null);
      setImagePreviewUrl(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Veuillez sélectionner une image (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('L’image dépasse 10 Mo. Choisissez un fichier plus léger.');
      return;
    }
    setErrorMsg(null);
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setErrorMsg('Veuillez renseigner un titre et le texte de l’actualité.');
      return;
    }
    setPublishing(true);
    setErrorMsg(null);
    try {
      const created = await createCustomNews(monday, {
        title,
        content,
        category,
        author: currentUserName,
        imageFile,
      });
      // Si l'upload photo a réussi, on affiche soit l'URL Monday soit l'aperçu local en attendant le refresh
      const createdWithPreview: CustomNewsItem = {
        ...created,
        imageUrl: created.imageUrl || imagePreviewUrl || undefined,
      };
      const next = [createdWithPreview, ...items];
      setItems(next);
      writeCachedCustomNews(next);

      setTitle('');
      setContent('');
      setImageFile(null);
      setImagePreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowComposer(false);
      // Rafraîchit en arrière-plan pour récupérer l'URL publique signée Monday si besoin
      if (imageFile) {
        setTimeout(() => loadNews(true), 1500);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossible de publier cet article.');
    } finally {
      setPublishing(false);
    }
  };

  const handleToggleActive = async (item: CustomNewsItem) => {
    setTogglingId(item.id);
    const nextActive = !item.active;
    try {
      await toggleCustomNewsActive(monday, item.id, nextActive);
      const next = items.map((n) => (n.id === item.id ? { ...n, active: nextActive } : n));
      setItems(next);
      writeCachedCustomNews(next);
    } catch (err) {
      console.error('[Journal Actualités] Erreur toggle:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const visibleItems = useMemo(() => {
    return items.filter((it) => {
      if (!it.active && !(canPublishNews && showHidden)) return false;
      if (selectedCategory !== 'Toutes' && it.category.toLowerCase() !== selectedCategory.toLowerCase()) return false;
      return true;
    });
  }, [items, canPublishNews, showHidden, selectedCategory]);

  const hiddenCount = useMemo(() => items.filter((i) => !i.active).length, [items]);

  return (
    <div className="hub-view-container" style={{ padding: '28px 36px', maxWidth: '1380px', margin: '0 auto', width: '100%' }}>
      {/* En-tête Journal */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '22px' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', backgroundColor: '#EBF6FC', color: '#1B4565', fontSize: '11px', fontWeight: 800, marginBottom: '8px' }}>
            <Newspaper size={13} color="#39A9DC" />
            <span>Journal interne &amp; Vie d’entreprise</span>
          </div>
          <h1 style={{ fontFamily: "'Ruda', sans-serif", fontSize: '28px', fontWeight: 900, color: '#0F172A', margin: 0 }}>
            Actualités Groupe Facility
          </h1>
          <div style={{ marginTop: '8px', height: '3.5px', width: '80px', borderRadius: '2px', background: 'linear-gradient(90deg, #F7AC37, #39A9DC)' }} />
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748B', maxWidth: '720px', lineHeight: 1.5 }}>
            Toutes les annonces, photos, arrivées, chantiers remarquables et nouveautés partagées par l’équipe — synchronisées en direct avec le carrousel d’accueil.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => loadNews(true)}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '10px',
              border: '1.5px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#1B4565',
              fontSize: '12px',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Actualiser</span>
          </button>

          {canPublishNews && (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setShowComposer((v) => !v);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '9px 16px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#1B4565',
                color: '#FFFFFF',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(27, 69, 101, 0.25)',
              }}
            >
              {showComposer ? <X size={15} /> : <Plus size={15} color="#F7AC37" />}
              <span>{showComposer ? 'Fermer le formulaire' : 'Nouvel article'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Formulaire de publication avec Photo */}
      {canPublishNews && showComposer && (
        <form
          onSubmit={handlePublish}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            border: '1.5px solid #39A9DC',
            padding: '22px 24px',
            marginBottom: '24px',
            boxShadow: '0 10px 28px rgba(57, 169, 220, 0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#EBF6FC', color: '#39A9DC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Megaphone size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '16px', fontWeight: 900, color: '#1B4565' }}>
                Rédiger une nouvelle actualité
              </h2>
              <p style={{ margin: 0, fontSize: '11.5px', color: '#64748B' }}>
                Elle apparaîtra immédiatement dans le Journal et en tête du carrousel de l’accueil.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#1B4565', marginBottom: '6px' }}>
                  Catégorie
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {NEWS_CATEGORIES.map((c) => {
                    const selected = category === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategory(c.id)}
                        style={{
                          padding: '5px 11px',
                          borderRadius: '999px',
                          border: selected ? `1.5px solid ${c.accentColor}` : '1px solid #CBD5E1',
                          backgroundColor: selected ? c.tagBg : '#FFFFFF',
                          color: selected ? c.tagColor : '#475569',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {c.id}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#1B4565', marginBottom: '5px' }}>
                  Titre de l’article *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex : Bienvenue à Mélanie au Pôle RH !"
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '13px',
                    color: '#0F172A',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#1B4565', marginBottom: '5px' }}>
                  Texte de l’actualité *
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Rédigez votre annonce (courte ou détaillée)…"
                  rows={5}
                  required
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '13px',
                    color: '#0F172A',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                  }}
                />
              </div>
            </div>

            {/* Zone Upload Photo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#1B4565' }}>
                Photo de couverture (optionnelle)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleSelectImage(e.target.files?.[0] || null)}
              />

              {imagePreviewUrl ? (
                <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', border: '1.5px solid #B7D8EA', height: '210px', backgroundColor: '#F8FAFC' }}>
                  <img src={imagePreviewUrl} alt="Aperçu" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => handleSelectImage(null)}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 10px',
                      borderRadius: '999px',
                      border: 'none',
                      backgroundColor: 'rgba(15, 23, 42, 0.78)',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <X size={13} /> Retirer
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleSelectImage(f);
                  }}
                  style={{
                    height: '210px',
                    borderRadius: '14px',
                    border: '2px dashed #B7D8EA',
                    backgroundColor: '#F4F9FC',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    padding: '16px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#FFFFFF', color: '#39A9DC', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(27,69,101,0.08)' }}>
                    <ImagePlus size={22} />
                  </div>
                  <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#1B4565' }}>
                    Cliquez ou glissez une photo ici
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    JPG, PNG ou WebP (max 10 Mo) — stockée dans Monday
                  </div>
                </div>
              )}

              {errorMsg && (
                <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#FEF2F2', color: '#B91C1C', fontSize: '12px', fontWeight: 700 }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowComposer(false)}
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
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={publishing}
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
                    cursor: publishing ? 'wait' : 'pointer',
                  }}
                >
                  {publishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span>{publishing ? 'Publication…' : 'Publier l’article'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Filtres par catégorie */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {['Toutes', ...NEWS_CATEGORIES.map((c) => c.id)].map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '6px 13px',
                  borderRadius: '999px',
                  border: active ? '1.5px solid #1B4565' : '1px solid #CBD5E1',
                  backgroundColor: active ? '#1B4565' : '#FFFFFF',
                  color: active ? '#FFFFFF' : '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {canPublishNews && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowHidden((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 12px',
              borderRadius: '999px',
              border: '1px solid #CBD5E1',
              backgroundColor: showHidden ? '#FFF4EB' : '#FFFFFF',
              color: showHidden ? '#D66927' : '#64748B',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {showHidden ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>{showHidden ? 'Masquer les archives' : `Voir les masquées (${hiddenCount})`}</span>
          </button>
        )}
      </div>

      {/* Grille Magazine des articles */}
      {loading && items.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
          <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
          Chargement des actualités…
        </div>
      ) : visibleItems.length === 0 ? (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1.5px dashed #B7D8EA', padding: '48px 24px', textAlign: 'center' }}>
          <Newspaper size={34} color="#39A9DC" style={{ margin: '0 auto 10px' }} />
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1B4565' }}>
            Aucune actualité publiée dans cette catégorie pour le moment
          </p>
          <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
            {canPublishNews
              ? 'Cliquez sur « Nouvel article » en haut à droite pour publier la première actualité avec photo !'
              : 'Revenez bientôt pour découvrir les prochaines annonces de Groupe Facility.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '20px' }}>
          {visibleItems.map((article) => {
            const st = getNewsCategoryStyle(article.category);
            return (
              <article
                key={article.id}
                onClick={() => setSelectedArticle(article)}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1.5px solid #D7EAF5',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  opacity: article.active ? 1 : 0.65,
                  boxShadow: '0 6px 18px rgba(27, 69, 101, 0.05)',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                }}
              >
                {article.imageUrl ? (
                  <div style={{ height: '190px', width: '100%', overflow: 'hidden', backgroundColor: '#F1F5F9', position: 'relative' }}>
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        backgroundColor: st.tagBg,
                        color: st.tagColor,
                        fontSize: '10.5px',
                        fontWeight: 800,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                      }}
                    >
                      {article.category}
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      height: '74px',
                      background: `linear-gradient(135deg, ${st.tagBg} 0%, #FFFFFF 100%)`,
                      borderBottom: `1px solid ${st.accentColor}25`,
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span
                      style={{
                        padding: '4px 11px',
                        borderRadius: '999px',
                        backgroundColor: '#FFFFFF',
                        border: `1px solid ${st.accentColor}40`,
                        color: st.tagColor,
                        fontSize: '11px',
                        fontWeight: 800,
                      }}
                    >
                      {article.category}
                    </span>
                    <Megaphone size={20} color={st.accentColor} />
                  </div>
                )}

                <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', flex: 1, gap: '8px' }}>
                  <h3 style={{ margin: 0, fontFamily: "'Ruda', sans-serif", fontSize: '16px', fontWeight: 900, color: '#1B4565', lineHeight: 1.3 }}>
                    {article.title}
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '12.5px',
                      color: '#475569',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-line',
                      display: '-webkit-box',
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {article.content}
                  </p>

                  <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                      {article.date && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={11} color="#39A9DC" /> {fmtNewsDateFr(article.date)}
                        </span>
                      )}
                      {article.author && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <User size={11} color="#39A9DC" /> {article.author}
                        </span>
                      )}
                    </div>

                    {canPublishNews && (
                      <button
                        type="button"
                        disabled={togglingId === article.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(article);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 9px',
                          borderRadius: '7px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#F8FAFC',
                          color: article.active ? '#D66927' : '#0E7042',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {article.active ? <EyeOff size={12} /> : <Eye size={12} />}
                        <span>{article.active ? 'Masquer' : 'Réafficher'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modale de lecture complète d'un article */}
      {selectedArticle && (
        <div
          onClick={() => setSelectedArticle(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.56)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '88vh',
              overflowY: 'auto',
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              border: '1.5px solid #D7EAF5',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.3)',
              overflow: 'hidden',
            }}
          >
            {selectedArticle.imageUrl && (
              <div style={{ maxHeight: '320px', overflow: 'hidden', backgroundColor: '#0F172A' }}>
                <img
                  src={selectedArticle.imageUrl}
                  alt={selectedArticle.title}
                  style={{ width: '100%', maxHeight: '320px', objectFit: 'cover', display: 'block' }}
                />
              </div>
            )}
            <div style={{ padding: '22px 26px', maxHeight: '55vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '999px',
                    backgroundColor: getNewsCategoryStyle(selectedArticle.category).tagBg,
                    color: getNewsCategoryStyle(selectedArticle.category).tagColor,
                    fontSize: '11px',
                    fontWeight: 800,
                  }}
                >
                  {selectedArticle.category}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedArticle(null)}
                  style={{
                    border: 'none',
                    background: '#F1F5F9',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#475569',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              <h2 style={{ margin: '0 0 8px 0', fontFamily: "'Ruda', sans-serif", fontSize: '21px', fontWeight: 900, color: '#1B4565' }}>
                {selectedArticle.title}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
                {selectedArticle.date && <span>Publié le {fmtNewsDateFr(selectedArticle.date)}</span>}
                {selectedArticle.author && <span>• Par {selectedArticle.author}</span>}
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: 1.65, whiteSpace: 'pre-line' }}>
                {selectedArticle.content}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsHubView;
