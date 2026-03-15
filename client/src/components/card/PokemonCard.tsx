import { useRef, useCallback, CSSProperties } from 'react';
import { getKoreanName } from '../../constants/pokemonNames.ts';

interface Props {
  name: string;
  artworkUrl: string;
  grade: string;
  level?: number;
  atk?: number;
  def?: number;
  hp?: number;
  count?: number;
  size?: 'tiny' | 'small' | 'medium' | 'large';
  onClick?: () => void;
  enableTilt?: boolean;
  showStats?: boolean;
}

const GRADE_COLORS: Record<string, string> = {
  E: '#8B8B8B', D: '#6B8E23', C: '#4682B4', B: '#9370DB',
  A: '#FF6347', S: '#FFD700', SS: '#FF4500', SSS: '#FF00FF',
};

const GRADE_BG: Record<string, string> = {
  E: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
  D: 'linear-gradient(135deg, #141e14 0%, #1e2e1e 50%, #141e14 100%)',
  C: 'linear-gradient(135deg, #14142a 0%, #1e1e3e 50%, #14142a 100%)',
  B: 'linear-gradient(135deg, #201430 0%, #2e1e40 50%, #201430 100%)',
  A: 'linear-gradient(135deg, #2a1010 0%, #3e1a1a 50%, #2a1010 100%)',
  S: 'linear-gradient(135deg, #1a1a0a 0%, #2e2e14 50%, #1a1a0a 100%)',
  SS: 'linear-gradient(135deg, #2a0e04 0%, #3e1a0a 50%, #2a0e04 100%)',
  SSS: 'linear-gradient(135deg, #200a28 0%, #30103a 50%, #200a28 100%)',
};

const sizes = {
  tiny: { width: 100, height: 144, imgSize: 75, fontSize: 9 },
  small: { width: 140, height: 200, imgSize: 110, fontSize: 11 },
  medium: { width: 260, height: 360, imgSize: 220, fontSize: 14 },
  large: { width: 300, height: 420, imgSize: 280, fontSize: 15 },
};

const isHoloGrade = (grade: string) => ['S', 'SS', 'SSS'].includes(grade);

const SPARKLE_POSITIONS = Array.from({ length: 8 }, (_, i) => ({
  top: `${15 + ((i * 37 + 13) % 70)}%`,
  left: `${10 + ((i * 53 + 7) % 80)}%`,
  delay: `${i * 0.35}s`,
}));

export default function PokemonCard({
  name, artworkUrl, grade, level = 1, atk, def, hp, count,
  size = 'medium', onClick, enableTilt = true, showStats = false,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const s = sizes[size];
  const color = GRADE_COLORS[grade] || '#888';
  const holo = isHoloGrade(grade);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const absoluteX = e.clientX - rect.left;
    const absoluteY = e.clientY - rect.top;

    // percent 0-100
    const percentX = Math.max(0, Math.min(100, Math.round((100 / rect.width) * absoluteX)));
    const percentY = Math.max(0, Math.min(100, Math.round((100 / rect.height) * absoluteY)));

    // center -50 to 50
    const centerX = percentX - 50;
    const centerY = percentY - 50;

    if (enableTilt) {
      const tiltX = Math.round(-(centerX / 3.5));
      const tiltY = Math.round(centerY / 3.5);
      card.style.transform = `perspective(800px) rotateX(${tiltY}deg) rotateY(${tiltX}deg)`;
    }

    if (holo) {
      // Adjust background position (narrower range like simeydotme)
      const bgX = 37 + ((percentX / 100) * (63 - 37));
      const bgY = 33 + ((percentY / 100) * (67 - 33));

      const fromCenter = Math.min(1,
        Math.sqrt(
          (percentY - 50) * (percentY - 50) +
          (percentX - 50) * (percentX - 50)
        ) / 50
      );

      card.style.setProperty('--pointer-x', `${percentX}%`);
      card.style.setProperty('--pointer-y', `${percentY}%`);
      card.style.setProperty('--background-x', `${bgX}%`);
      card.style.setProperty('--background-y', `${bgY}%`);
      card.style.setProperty('--card-opacity', '0.5');
      card.style.setProperty('--pointer-from-center', fromCenter.toFixed(3));
      card.style.setProperty('--pointer-from-top', (percentY / 100).toFixed(3));
      card.style.setProperty('--pointer-from-left', (percentX / 100).toFixed(3));
    }
  }, [enableTilt, holo]);

  const handleMouseEnter = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.classList.add('active');
    card.style.transition = 'transform 0.15s ease-out, box-shadow 0.3s ease';
    if (holo) {
      card.style.setProperty('--card-opacity', '0.3');
    }
  }, [holo]);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.classList.remove('active');
    card.style.transition = 'transform 0.4s ease, box-shadow 0.4s ease';
    if (enableTilt) {
      card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)';
    }
    if (holo) {
      card.style.setProperty('--card-opacity', '0');
      card.style.setProperty('--pointer-x', '50%');
      card.style.setProperty('--pointer-y', '50%');
      card.style.setProperty('--background-x', '50%');
      card.style.setProperty('--background-y', '50%');
      card.style.setProperty('--pointer-from-center', '0');
      card.style.setProperty('--pointer-from-top', '0.5');
      card.style.setProperty('--pointer-from-left', '0.5');
    }
  }, [enableTilt, holo]);

  const cardStyle: CSSProperties = {
    width: s.width,
    height: s.height,
    borderRadius: '12px',
    overflow: 'hidden',
    background: GRADE_BG[grade] || GRADE_BG.E,
    cursor: onClick ? 'pointer' : 'default',
    transition: 'transform 0.4s ease, box-shadow 0.4s ease',
    transform: enableTilt ? 'perspective(800px) rotateX(0deg) rotateY(0deg)' : 'none',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    position: 'relative',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: size === 'small' ? '8px' : '16px',
  };

  const holoClasses = holo ? `holo-card grade-${grade}` : '';

  return (
    <div
      ref={cardRef}
      className={holoClasses}
      style={cardStyle}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
        {/* Holographic layers */}
        {holo && (
          <>
            <div className="holo-shine" />
            <div className="holo-glare" />
          </>
        )}

        {/* Grade Badge */}
        <div style={{
          position: 'absolute', top: size === 'small' ? 4 : 8,
          right: size === 'small' ? 4 : 8,
          zIndex: 10,
        }}>
          <span className={`grade-badge grade-${grade}`}>{grade}</span>
        </div>

        {/* Level */}
        {level > 1 && (
          <div style={{
            position: 'absolute', top: size === 'small' ? 4 : 8,
            left: size === 'small' ? 4 : 8,
            fontSize: s.fontSize - 2, color: '#ffd700', fontWeight: 700, zIndex: 10,
          }}>
            Lv.{level}
          </div>
        )}

        {/* Pokemon Image */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginTop: size === 'small' ? 16 : 24,
          zIndex: 1,
        }}>
          <img
            src={artworkUrl}
            alt={name}
            style={{
              width: s.imgSize, height: s.imgSize, objectFit: 'contain',
              filter: holo ? `drop-shadow(0 0 10px ${color}80)` : 'none',
            }}
            draggable={false}
          />
        </div>

        {/* Name */}
        <div style={{
          fontSize: s.fontSize, fontWeight: 700,
          marginTop: 4, zIndex: 10,
          textShadow: holo ? `0 0 10px ${color}60` : 'none',
        }}>
          {getKoreanName(name)}
        </div>

        {/* Stats */}
        {showStats && atk !== undefined && (
          <div style={{
            display: 'flex', gap: size === 'small' ? 6 : 12,
            marginTop: 6, fontSize: s.fontSize - 2, zIndex: 10,
          }}>
            <span style={{ color: '#ff6b6b' }}>공격 {atk}</span>
            <span style={{ color: '#4ecdc4' }}>방어 {def}</span>
            <span style={{ color: '#45b7d1' }}>체력 {hp}</span>
          </div>
        )}

        {/* Count Badge */}
        {count !== undefined && count >= 1 && (
          <div style={{
            position: 'absolute',
            bottom: size === 'small' ? 4 : 8,
            right: size === 'small' ? 4 : 8,
            zIndex: 10,
            background: 'rgba(0, 0, 0, 0.6)',
            color: '#fff',
            fontSize: size === 'small' ? 9 : 11,
            fontWeight: 700,
            padding: size === 'small' ? '2px 5px' : '3px 8px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.15)',
          }}>
            x{count}
          </div>
        )}

        {/* Sparkles for SS and SSS */}
        {(grade === 'SS' || grade === 'SSS') && (
          <>
            {SPARKLE_POSITIONS.slice(0, grade === 'SSS' ? 8 : 4).map((pos, i) => (
              <div key={i} className="holo-sparkle" style={{
                top: pos.top,
                left: pos.left,
                animationDelay: pos.delay,
              }} />
            ))}
          </>
        )}
    </div>
  );
}
