import { useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getKoreanName } from '../../constants/pokemonNames.ts';

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

const isHoloGrade = (grade: string) => ['S', 'SS', 'SSS'].includes(grade);

const SPARKLE_POSITIONS = Array.from({ length: 8 }, (_, i) => ({
  top: `${15 + ((i * 37 + 13) % 70)}%`,
  left: `${10 + ((i * 53 + 7) % 80)}%`,
  delay: `${i * 0.35}s`,
}));

interface Props {
  open: boolean;
  onClose: () => void;
  name: string;
  artworkUrl: string;
  grade: string;
  level?: number;
}

export default function CardPopover({ open, onClose, name, artworkUrl, grade, level = 1 }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const holo = isHoloGrade(grade);
  const color = GRADE_COLORS[grade] || '#888';

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const absoluteX = e.clientX - rect.left;
    const absoluteY = e.clientY - rect.top;

    const percentX = Math.max(0, Math.min(100, Math.round((100 / rect.width) * absoluteX)));
    const percentY = Math.max(0, Math.min(100, Math.round((100 / rect.height) * absoluteY)));
    const centerX = percentX - 50;
    const centerY = percentY - 50;

    // 3D tilt
    const tiltX = Math.round(-(centerX / 4));
    const tiltY = Math.round(centerY / 4);
    card.style.transform = `perspective(1000px) rotateX(${tiltY}deg) rotateY(${tiltX}deg)`;

    if (holo) {
      const bgX = 37 + ((percentX / 100) * 26);
      const bgY = 33 + ((percentY / 100) * 34);
      const fromCenter = Math.min(1,
        Math.sqrt((percentY - 50) ** 2 + (percentX - 50) ** 2) / 50
      );

      card.style.setProperty('--pointer-x', `${percentX}%`);
      card.style.setProperty('--pointer-y', `${percentY}%`);
      card.style.setProperty('--background-x', `${bgX}%`);
      card.style.setProperty('--background-y', `${bgY}%`);
      card.style.setProperty('--card-opacity', '0.6');
      card.style.setProperty('--pointer-from-center', fromCenter.toFixed(3));
      card.style.setProperty('--pointer-from-top', (percentY / 100).toFixed(3));
      card.style.setProperty('--pointer-from-left', (percentX / 100).toFixed(3));
    }
  }, [holo]);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = 'transform 0.5s ease';
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
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
    setTimeout(() => {
      if (card) card.style.transition = 'transform 0.12s ease-out';
    }, 500);
  }, [holo]);

  const handleMouseEnter = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transition = 'transform 0.12s ease-out';
    if (holo) {
      card.style.setProperty('--card-opacity', '0.4');
    }
  }, [holo]);

  const holoClasses = holo ? `holo-card grade-${grade} active` : '';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0, rotateY: 180 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 80,
              damping: 15,
              mass: 1,
            }}
            onClick={(e) => e.stopPropagation()}
            style={{ perspective: '1200px', cursor: 'default' }}
          >
            <div
              ref={cardRef}
              className={holoClasses}
              onMouseMove={handleMouseMove}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              style={{
                width: Math.min(480, window.innerWidth * 0.9),
                height: Math.min(672, window.innerHeight * 0.88),
                borderRadius: '16px',
                overflow: 'hidden',
                background: GRADE_BG[grade] || GRADE_BG.E,
                boxShadow: `0 0 40px 5px ${color}30, 0 20px 60px rgba(0,0,0,0.6)`,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '20px',
                transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
                transition: 'transform 0.12s ease-out',
                willChange: 'transform',
              }}
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
                position: 'absolute', top: 12, right: 12, zIndex: 10,
              }}>
                <span className={`grade-badge grade-${grade}`}>{grade}</span>
              </div>

              {/* Level */}
              {level > 1 && (
                <div style={{
                  position: 'absolute', top: 12, left: 12,
                  fontSize: 14, color: '#ffd700', fontWeight: 700, zIndex: 10,
                }}>
                  Lv.{level}
                </div>
              )}

              {/* Pokemon Image */}
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 30, zIndex: 1,
              }}>
                <img
                  src={artworkUrl}
                  alt={name}
                  style={{
                    width: Math.min(400, window.innerWidth * 0.75),
                    height: Math.min(400, window.innerWidth * 0.75),
                    objectFit: 'contain',
                    filter: holo ? `drop-shadow(0 0 15px ${color}80)` : 'none',
                  }}
                  draggable={false}
                />
              </div>

              {/* Name */}
              <div style={{
                fontSize: 18, fontWeight: 700,
                marginTop: 8, zIndex: 10,
                textShadow: holo ? `0 0 12px ${color}60` : 'none',
              }}>
                {getKoreanName(name)}
              </div>

              {/* Sparkles */}
              {(grade === 'SS' || grade === 'SSS') && (
                <>
                  {SPARKLE_POSITIONS.slice(0, grade === 'SSS' ? 8 : 4).map((pos, i) => (
                    <div key={i} className="holo-sparkle" style={{
                      top: pos.top, left: pos.left, animationDelay: pos.delay,
                    }} />
                  ))}
                </>
              )}
            </div>
          </motion.div>

          {/* 닫기 안내 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 0.5, y: 0 }}
            transition={{ delay: 0.5 }}
            style={{
              position: 'absolute', bottom: 30,
              color: 'white', fontSize: 13, pointerEvents: 'none',
            }}
          >
            아무 곳이나 클릭하여 닫기
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
