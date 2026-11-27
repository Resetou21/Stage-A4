import React from 'react';
import { Heart } from 'lucide-react';

interface FavoriteHeartButtonProps {
  isFavorite: boolean;
  onToggle: () => void;
  size?: number;
  label?: string;
  compact?: boolean;
}

/**
 * Petit cœur interactif pour ajouter / retirer n'importe quel indicateur,
 * tableau ou bloc d'information dans « Mes informations préférées ».
 */
export const FavoriteHeartButton: React.FC<FavoriteHeartButtonProps> = ({
  isFavorite,
  onToggle,
  size = 15,
  label,
  compact = false,
}) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      title={
        isFavorite
          ? `Retirer${label ? ` « ${label} »` : ''} de Mes informations préférées`
          : `Ajouter${label ? ` « ${label} »` : ''} à Mes informations préférées`
      }
      aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      aria-pressed={isFavorite}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px',
        padding: compact ? '4px' : '5px 8px',
        borderRadius: '999px',
        border: isFavorite ? '1px solid rgba(225, 29, 72, 0.35)' : '1px solid rgba(148, 163, 184, 0.35)',
        backgroundColor: isFavorite ? '#FFF1F2' : 'rgba(255, 255, 255, 0.9)',
        color: isFavorite ? '#E11D48' : '#94A3B8',
        cursor: 'pointer',
        transition: 'transform 0.16s ease, background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)';
        if (!isFavorite) {
          e.currentTarget.style.color = '#E11D48';
          e.currentTarget.style.borderColor = 'rgba(225, 29, 72, 0.35)';
          e.currentTarget.style.backgroundColor = '#FFF1F2';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        if (!isFavorite) {
          e.currentTarget.style.color = '#94A3B8';
          e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.35)';
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        }
      }}
    >
      <Heart
        size={size}
        fill={isFavorite ? '#E11D48' : 'none'}
        strokeWidth={2.2}
      />
    </button>
  );
};

export default FavoriteHeartButton;
