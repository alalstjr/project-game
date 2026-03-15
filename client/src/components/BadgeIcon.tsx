const BADGE_SHAPES: Record<number, { emoji: string; shape: string }> = {
  1: { emoji: '🪨', shape: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' },
  2: { emoji: '💧', shape: 'polygon(50% 0%, 85% 35%, 100% 70%, 50% 100%, 0% 70%, 15% 35%)' },
  3: { emoji: '⚡', shape: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' },
  4: { emoji: '🌈', shape: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' },
  5: { emoji: '💜', shape: 'circle(50%)' },
  6: { emoji: '🔮', shape: 'polygon(50% 0%, 90% 25%, 90% 75%, 50% 100%, 10% 75%, 10% 25%)' },
  7: { emoji: '🔥', shape: 'polygon(50% 0%, 100% 35%, 85% 100%, 15% 100%, 0% 35%)' },
  8: { emoji: '🌿', shape: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)' },
};

const BADGE_COLORS: Record<number, string> = {
  1: '#A8A878',
  2: '#6890F0',
  3: '#F8D030',
  4: '#78C850',
  5: '#A040A0',
  6: '#F85888',
  7: '#F08030',
  8: '#E0C068',
};

interface BadgeIconProps {
  badgeId: number;
  size?: number;
  owned?: boolean;
}

export default function BadgeIcon({ badgeId, size = 40, owned = true }: BadgeIconProps) {
  const badge = BADGE_SHAPES[badgeId];
  const color = BADGE_COLORS[badgeId] || '#888';

  if (!badge) return null;

  return (
    <div style={{
      width: size,
      height: size,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: owned
        ? `linear-gradient(135deg, ${color}, ${color}dd)`
        : 'rgba(60,60,80,0.5)',
      clipPath: badge.shape,
      filter: owned ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' : 'grayscale(1) opacity(0.3)',
      transition: 'all 0.3s',
      position: 'relative',
    }}>
      <span style={{ fontSize: size * 0.4, filter: owned ? 'none' : 'grayscale(1)' }}>
        {badge.emoji}
      </span>
    </div>
  );
}

export { BADGE_COLORS };
