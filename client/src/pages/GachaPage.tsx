import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext.tsx';
import api from '../api/client.ts';
import PokemonCard from '../components/card/PokemonCard.tsx';
import { useIsMobile } from '../hooks/useIsMobile.tsx';

const GRADE_COLORS: Record<string, string> = {
  E: '#8B8B8B', D: '#6B8E23', C: '#4682B4', B: '#9370DB',
  A: '#FF6347', S: '#FFD700', SS: '#FF4500', SSS: '#FF00FF',
};

const isSuperGrade = (grade: string) => ['S', 'SS', 'SSS'].includes(grade);
const isUltraGrade = (grade: string) => ['SS', 'SSS'].includes(grade);

interface PullResultData {
  card: {
    id: number; pokemonId: number; grade: string; level: number;
    atk: number; def: number; hp: number; dupeCount: number;
    pokemon: { id: number; name: string; spriteUrl: string; artworkUrl: string; type1: string; type2: string | null };
  };
  isDuplicate: boolean;
  isNew: boolean;
}

type GachaPhase = 'idle' | 'opening' | 'cutin' | 'revealing' | 'done';

// 등급별 컷인 연출 색상 (등급 텍스트는 보여주지 않음)
const CUTIN_CONFIG: Record<string, { colors: string[]; intensity: number }> = {
  S:   { colors: ['#FFD700', '#FFA500'], intensity: 1 },
  SS:  { colors: ['#FF4500', '#FF6347', '#FFD700'], intensity: 1.5 },
  SSS: { colors: ['#FF00FF', '#8B00FF', '#FFD700', '#00FFFF'], intensity: 2 },
};

// CSS keyframes를 동적으로 한번만 삽입
const styleId = 'gacha-cutin-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes meteorShoot {
      0% { transform: translate(-120vw, -60vh) rotate(-35deg); opacity: 0; }
      5% { opacity: 1; }
      60% { opacity: 1; }
      100% { transform: translate(120vw, 60vh) rotate(-35deg); opacity: 0; }
    }
    @keyframes meteorShoot2 {
      0% { transform: translate(120vw, -80vh) rotate(-145deg); opacity: 0; }
      5% { opacity: 1; }
      55% { opacity: 1; }
      100% { transform: translate(-120vw, 80vh) rotate(-145deg); opacity: 0; }
    }
    @keyframes orbPulse {
      0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
      30% { opacity: 1; }
      60% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
      100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
    }
    @keyframes orbPulse2 {
      0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
      40% { opacity: 0.6; }
      70% { transform: translate(-50%, -50%) scale(1.5); opacity: 0.4; }
      100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
    }
    @keyframes ringExpand {
      0% { transform: translate(-50%, -50%) scale(0); opacity: 0; border-width: 4px; }
      30% { opacity: 1; }
      100% { transform: translate(-50%, -50%) scale(4); opacity: 0; border-width: 1px; }
    }
    @keyframes screenFlash {
      0% { opacity: 0.9; }
      100% { opacity: 0; }
    }
    @keyframes sparkFloat {
      0% { transform: translate(0, 0) scale(0); opacity: 0; }
      20% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(0); }
    }
    @keyframes cutinShake {
      0%, 100% { transform: translate(0, 0); }
      10% { transform: translate(-6px, -4px); }
      20% { transform: translate(5px, 3px); }
      30% { transform: translate(-4px, 5px); }
      40% { transform: translate(6px, -3px); }
      50% { transform: translate(-3px, 4px); }
      60% { transform: translate(4px, -5px); }
      70% { transform: translate(-5px, 3px); }
      80% { transform: translate(3px, -4px); }
      90% { transform: translate(-4px, 5px); }
    }
    @property --glow-angle {
      syntax: "<angle>";
      initial-value: 0deg;
      inherits: false;
    }
    @keyframes glowSpin {
      to { --glow-angle: 360deg; }
    }
    .card-rare-glow {
      position: relative;
    }
    .card-rare-glow::before,
    .card-rare-glow::after {
      content: "";
      position: absolute;
      inset: -4px;
      border-radius: 14px;
      z-index: -1;
      background: conic-gradient(
        from var(--glow-angle),
        transparent 40%,
        #FFD700,
        #FFA500,
        #FFD700,
        transparent 60%
      );
      animation: glowSpin 2.5s linear infinite;
    }
    .card-rare-glow::before {
      filter: blur(12px);
      opacity: 0.8;
    }
    .card-rare-glow::after {
      filter: blur(1px);
      opacity: 1;
    }
    .card-rare-glow-ss::before,
    .card-rare-glow-ss::after {
      background: conic-gradient(
        from var(--glow-angle),
        transparent 30%,
        #FFD700,
        #FF4500,
        #FF6347,
        #FFD700,
        transparent 70%
      );
      animation-duration: 2s;
    }
    .card-rare-glow-ss::before {
      filter: blur(16px);
      opacity: 0.9;
    }
    .card-rare-glow-sss::before,
    .card-rare-glow-sss::after {
      background: conic-gradient(
        from var(--glow-angle),
        #FF00FF,
        #8B00FF,
        #00BFFF,
        #00FFFF,
        #FFD700,
        #FF4500,
        #FF00FF
      );
      animation-duration: 1.8s;
    }
    .card-rare-glow-sss::before {
      filter: blur(20px);
      opacity: 1;
    }
    /* 작은 카드(10연뽑기)용 */
    .card-rare-glow-sm::before,
    .card-rare-glow-sm::after {
      inset: -3px;
      border-radius: 10px;
    }
    .card-rare-glow-sm::before {
      filter: blur(8px);
    }
    .card-rare-glow-sm::after {
      filter: blur(0.5px);
    }
  `;
  document.head.appendChild(style);
}

export default function GachaPage() {
  const { user, updateTickets } = useAuth();
  const isMobile = useIsMobile();
  const [pulling, setPulling] = useState(false);
  const [result, setResult] = useState<PullResultData | null>(null);
  const [multiResults, setMultiResults] = useState<PullResultData[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [phase, setPhase] = useState<GachaPhase>('idle');
  const [revealIndex, setRevealIndex] = useState(-1);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [cutinGrade, setCutinGrade] = useState<string | null>(null);

  const tickets = user?.pullTickets || 0;

  // ========== 뽑기 실행 ==========
  const doPull = useCallback(async (count: number) => {
    if (pulling || tickets < count) return;
    setPulling(true);
    setResult(null);
    setMultiResults([]);
    setCardFlipped(false);
    setRevealIndex(-1);
    setCutinGrade(null);

    // 카드팩 열기 애니메이션
    setPhase('opening');
    await sleep(800);

    try {
      let bestGrade: string | null = null;

      if (count > 1) {
        const res = await api.post('/gacha/pull/multi', { count });
        updateTickets(res.data.tickets);
        setMultiResults(res.data.results);
        for (const r of res.data.results as PullResultData[]) {
          if (isSuperGrade(r.card.grade)) {
            if (!bestGrade || ['SSS', 'SS', 'S'].indexOf(r.card.grade) < ['SSS', 'SS', 'S'].indexOf(bestGrade)) {
              bestGrade = r.card.grade;
            }
          }
        }
      } else {
        const res = await api.post('/gacha/pull');
        updateTickets(res.data.tickets);
        setResult(res.data);
        if (isSuperGrade(res.data.card.grade)) {
          bestGrade = res.data.card.grade;
        }
      }

      // S등급 이상이면 컷인 연출
      if (bestGrade && CUTIN_CONFIG[bestGrade]) {
        setCutinGrade(bestGrade);
        setPhase('cutin');
        await sleep(2800);
        setCutinGrade(null);
      }

      setPhase('revealing');
      setShowModal(true);
    } catch (err: any) {
      alert(err.response?.data?.error || '뽑기 실패');
      setPhase('idle');
    } finally {
      setPulling(false);
    }
  }, [pulling, tickets, updateTickets]);

  // ========== 단일 카드 클릭 → 뒤집기 ==========
  const flipCard = () => {
    if (!cardFlipped) {
      setCardFlipped(true);
      setPhase('done');
    }
  };

  // ========== 10연 카드 순차 리빌 ==========
  const revealNext = useCallback(() => {
    setRevealIndex(prev => {
      const next = prev + 1;
      if (next >= multiResults.length) {
        setPhase('done');
      }
      return next;
    });
  }, [multiResults.length]);

  // ========== 모달 닫기 ==========
  const closeModal = () => {
    setShowModal(false);
    setPhase('idle');
    setResult(null);
    setMultiResults([]);
    setCardFlipped(false);
    setRevealIndex(-1);
    setCutinGrade(null);
  };

  // ========== 빛 이펙트 파라미터 ==========
  const getGlowParams = (grade: string) => {
    const color = GRADE_COLORS[grade] || '#888';
    if (grade === 'SSS') return { color, size: 120, pulseSize: 180, rays: 12, particles: 20 };
    if (grade === 'SS') return { color, size: 90, pulseSize: 140, rays: 8, particles: 14 };
    if (grade === 'S') return { color, size: 60, pulseSize: 100, rays: 6, particles: 8 };
    return null;
  };

  return (
    <div style={{ textAlign: 'center', paddingTop: '20px' }}>
      <h2 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 900, marginBottom: '8px' }}>카드팩 뽑기</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: isMobile ? '20px' : '32px', fontSize: '14px' }}>
        카드팩을 클릭하여 뽑기! 뽑기권: <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>{tickets}</span>
      </p>

      {/* ========== 카드팩 ========== */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        marginBottom: '40px', position: 'relative',
      }}>
        <motion.div
          onClick={() => !pulling && tickets >= 1 && doPull(1)}
          whileHover={tickets >= 1 && !pulling ? { scale: 1.05 } : {}}
          whileTap={tickets >= 1 && !pulling ? { scale: 0.95 } : {}}
          animate={phase === 'opening' ? {
            scale: [1, 1.1, 0.9, 0],
            rotateY: [0, 0, 10, 20],
            opacity: [1, 1, 1, 0],
          } : { scale: 1, rotateY: 0, opacity: 1 }}
          transition={phase === 'opening' ? { duration: 0.8, ease: 'easeInOut' } : { duration: 0.3 }}
          style={{
            width: isMobile ? '180px' : '220px', height: isMobile ? '245px' : '300px', position: 'relative',
            cursor: tickets > 0 && !pulling ? 'pointer' : 'not-allowed',
            userSelect: 'none',
          }}
        >
          {/* 카드팩 이미지 */}
          <img src="/cardpack.svg" alt="card pack" style={{
            width: '100%', height: '100%',
            borderRadius: '16px',
            objectFit: 'cover',
            pointerEvents: 'none',
          }} />
        </motion.div>

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button
            className="btn btn-primary"
            disabled={pulling || tickets < 1}
            onClick={() => doPull(1)}
            style={{ padding: '12px 32px', fontSize: '15px' }}
          >
            1회 뽑기
          </button>
          <button
            className="btn btn-primary"
            disabled={pulling || tickets < 10}
            onClick={() => doPull(10)}
            style={{
              padding: '12px 32px', fontSize: '15px',
              background: tickets >= 10 ? 'linear-gradient(135deg, #ff6b6b, #ff4757)' : undefined,
            }}
          >
            10회 뽑기
          </button>
        </div>
      </div>

      {/* ========== 희귀 카드 컷인 연출 ========== */}
      <AnimatePresence>
        {phase === 'cutin' && cutinGrade && CUTIN_CONFIG[cutinGrade] && (() => {
          const cfg = CUTIN_CONFIG[cutinGrade];
          const c1 = cfg.colors[0];
          const c2 = cfg.colors[1] || c1;
          const isMultiColor = cfg.colors.length > 2;
          const shakeAnim = cfg.intensity >= 1.5 ? 'cutinShake 0.5s ease-in-out 0.8s' : 'none';

          return (
            <motion.div
              key="cutin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.4 } }}
              style={{
                position: 'fixed', inset: 0, zIndex: 400,
                background: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
                animation: shakeAnim,
              }}
            >
              {/* === 1. 화면 플래시 === */}
              <div style={{
                position: 'absolute', inset: 0, zIndex: 10,
                background: c1,
                animation: 'screenFlash 0.8s ease-out forwards',
                pointerEvents: 'none',
              }} />

              {/* === 2. 유성 (좌상 → 우하) === */}
              <div style={{
                position: 'absolute', left: '50%', top: '50%', zIndex: 5,
                width: `${150 * cfg.intensity}px`, height: '3px',
                borderRadius: '2px',
                background: `linear-gradient(90deg, transparent, ${c1}, ${c2})`,
                boxShadow: `0 0 20px ${c1}, 0 0 60px ${c1}80, 0 0 100px ${c2}40`,
                animation: 'meteorShoot 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.3s forwards',
                opacity: 0,
              }}>
                {/* 유성 헤드 글로우 */}
                <div style={{
                  position: 'absolute', right: '-8px', top: '-8px',
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: `radial-gradient(circle, #fff, ${c1})`,
                  boxShadow: `0 0 30px ${c1}, 0 0 60px ${c1}`,
                }} />
              </div>

              {/* === 3. 유성 2번째 (우상 → 좌하, SS/SSS만) === */}
              {cfg.intensity >= 1.5 && (
                <div style={{
                  position: 'absolute', left: '50%', top: '50%', zIndex: 5,
                  width: `${120 * cfg.intensity}px`, height: '2px',
                  borderRadius: '2px',
                  background: `linear-gradient(90deg, transparent, ${c2}, ${cfg.colors[2] || c1})`,
                  boxShadow: `0 0 15px ${c2}, 0 0 40px ${c2}60`,
                  animation: 'meteorShoot2 1s cubic-bezier(0.22, 1, 0.36, 1) 0.6s forwards',
                  opacity: 0,
                }}>
                  <div style={{
                    position: 'absolute', right: '-6px', top: '-6px',
                    width: '14px', height: '14px', borderRadius: '50%',
                    background: `radial-gradient(circle, #fff, ${c2})`,
                    boxShadow: `0 0 20px ${c2}`,
                  }} />
                </div>
              )}

              {/* === 4. 중앙 빛 오브 폭발 === */}
              <div style={{
                position: 'absolute', left: '50%', top: '50%', zIndex: 6,
                width: `${200 * cfg.intensity}px`, height: `${200 * cfg.intensity}px`,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${c1}90 0%, ${c2}40 40%, transparent 70%)`,
                animation: 'orbPulse 1.4s ease-out 0.8s forwards',
                opacity: 0,
                filter: 'blur(8px)',
              }} />

              {/* === 5. 두 번째 오브 (더 큰, 느린) === */}
              <div style={{
                position: 'absolute', left: '50%', top: '50%', zIndex: 4,
                width: `${280 * cfg.intensity}px`, height: `${280 * cfg.intensity}px`,
                borderRadius: '50%',
                background: isMultiColor
                  ? `radial-gradient(circle, ${cfg.colors[2]}60 0%, ${cfg.colors[3] || c1}30 40%, transparent 70%)`
                  : `radial-gradient(circle, ${c1}50 0%, ${c2}20 40%, transparent 70%)`,
                animation: 'orbPulse2 1.8s ease-out 1s forwards',
                opacity: 0,
                filter: 'blur(15px)',
              }} />

              {/* === 6. 확산 링 === */}
              {Array.from({ length: Math.ceil(cfg.intensity * 2) }).map((_, i) => (
                <div key={`ring-${i}`} style={{
                  position: 'absolute', left: '50%', top: '50%', zIndex: 7,
                  width: '80px', height: '80px',
                  borderRadius: '50%',
                  border: `3px solid ${cfg.colors[i % cfg.colors.length]}`,
                  boxShadow: `0 0 15px ${cfg.colors[i % cfg.colors.length]}60`,
                  animation: `ringExpand ${1.2 + i * 0.3}s ease-out ${0.9 + i * 0.2}s forwards`,
                  opacity: 0,
                }} />
              ))}

              {/* === 7. 스파크 파티클 === */}
              {Array.from({ length: Math.floor(20 * cfg.intensity) }).map((_, i) => {
                const angle = (Math.PI * 2 * i) / (20 * cfg.intensity) + Math.random() * 0.5;
                const dist = 100 + Math.random() * 250 * cfg.intensity;
                const tx = Math.cos(angle) * dist;
                const ty = Math.sin(angle) * dist;
                const size = 2 + Math.random() * 5;
                const color = cfg.colors[i % cfg.colors.length];
                const delay = 0.9 + Math.random() * 0.6;
                const dur = 0.8 + Math.random() * 0.8;
                return (
                  <motion.div
                    key={`sp-${i}`}
                    initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                    animate={{ x: tx, y: ty, scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
                    transition={{ duration: dur, delay, ease: 'easeOut' }}
                    style={{
                      position: 'absolute', left: '50%', top: '50%',
                      width: `${size}px`, height: `${size}px`,
                      borderRadius: '50%',
                      background: color,
                      boxShadow: `0 0 ${size * 2}px ${color}, 0 0 ${size * 4}px ${color}80`,
                      pointerEvents: 'none', zIndex: 8,
                      marginLeft: `-${size / 2}px`, marginTop: `-${size / 2}px`,
                    }}
                  />
                );
              })}

              {/* === 8. 중앙 포켓볼 실루엣 (빛 속에서) === */}
              <motion.img
                src="/pokeball.svg"
                alt=""
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.2, 1], opacity: [0, 0.7, 0.3] }}
                transition={{ duration: 0.8, delay: 1.2, ease: [0.23, 1, 0.32, 1] }}
                style={{
                  position: 'absolute', zIndex: 9,
                  width: '80px', height: '80px',
                  filter: `drop-shadow(0 0 30px ${c1}) drop-shadow(0 0 60px ${c1}80) brightness(2)`,
                }}
              />
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ========== 결과 모달 ========== */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 300,
              background: 'rgba(0,0,0,0.85)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: '20px 0',
            }}
          >
            {/* ===== 단일 뽑기 결과 ===== */}
            {result && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                {/* S등급 이상 배경 글로우 */}
                {isSuperGrade(result.card.grade) && (() => {
                  const glow = getGlowParams(result.card.grade)!;
                  return (
                    <>
                      {/* 맥동 글로우 */}
                      <motion.div
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: cardFlipped ? [0.3, 0.6, 0.3] : 0,
                        }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        style={{
                          position: 'absolute',
                          width: `${glow.pulseSize}px`, height: `${glow.pulseSize * 1.3}px`,
                          borderRadius: '20px',
                          background: `radial-gradient(ellipse, ${glow.color}40 0%, ${glow.color}15 40%, transparent 70%)`,
                          filter: `blur(${glow.size / 4}px)`,
                          pointerEvents: 'none',
                        }}
                      />
                      {/* 빛 줄기 (rays) */}
                      {cardFlipped && Array.from({ length: glow.rays }).map((_, i) => (
                        <motion.div
                          key={`ray-${i}`}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{
                            opacity: [0, 0.5, 0],
                            scale: [0.5, 1.5],
                            rotate: (360 / glow.rays) * i,
                          }}
                          transition={{ duration: 2, delay: i * 0.1, repeat: Infinity, ease: 'easeOut' }}
                          style={{
                            position: 'absolute',
                            width: '2px', height: `${glow.size}px`,
                            background: `linear-gradient(0deg, ${glow.color}80, transparent)`,
                            transformOrigin: 'bottom center',
                            pointerEvents: 'none',
                          }}
                        />
                      ))}
                      {/* 반짝 파티클 */}
                      {cardFlipped && Array.from({ length: glow.particles }).map((_, i) => (
                        <motion.div
                          key={`gp-${i}`}
                          initial={{ opacity: 0, x: 0, y: 0 }}
                          animate={{
                            opacity: [0, 1, 0],
                            x: (Math.random() - 0.5) * glow.pulseSize * 1.5,
                            y: (Math.random() - 0.5) * glow.pulseSize * 1.5,
                            scale: [0, 1, 0],
                          }}
                          transition={{
                            duration: 1.5 + Math.random(),
                            delay: 0.3 + i * 0.08,
                            repeat: Infinity,
                            repeatDelay: Math.random() * 2,
                          }}
                          style={{
                            position: 'absolute',
                            width: '4px', height: '4px',
                            borderRadius: '50%',
                            background: glow.color,
                            boxShadow: `0 0 6px ${glow.color}`,
                            pointerEvents: 'none',
                          }}
                        />
                      ))}
                    </>
                  );
                })()}

                {/* 카드 (클릭해서 뒤집기) */}
                <div
                  onClick={flipCard}
                  className={cardFlipped && isSuperGrade(result.card.grade)
                    ? `card-rare-glow${result.card.grade === 'SSS' ? ' card-rare-glow-sss' : result.card.grade === 'SS' ? ' card-rare-glow-ss' : ''}`
                    : ''}
                  style={{
                    cursor: cardFlipped ? 'default' : 'pointer',
                    position: 'relative', zIndex: 1,
                    borderRadius: '14px',
                  }}
                >
                  <AnimatePresence mode="wait">
                    {!cardFlipped ? (
                      <motion.div
                        key="back"
                        initial={{ scale: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{
                          width: 300, height: 420,
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #1a1a3e, #2d1b69, #1a1a3e)',
                          border: '2px solid rgba(108,92,231,0.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <img src="/pokeball.svg" alt="pokeball" style={{
                          width: '60px', height: '60px', opacity: 0.5,
                        }} />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="front"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                      >
                        <PokemonCard
                          name={result.card.pokemon.name}
                          artworkUrl={result.card.pokemon.artworkUrl}
                          grade={result.card.grade}
                          level={result.card.level}
                          atk={result.card.atk}
                          def={result.card.def}
                          hp={result.card.hp}
                          size="large"
                          showStats
                          enableTilt={false}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!cardFlipped && (
                    <motion.p
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      style={{
                        marginTop: '16px', fontSize: '14px',
                        color: 'var(--text-secondary)', textAlign: 'center',
                      }}
                    >
                      터치하여 카드 확인
                    </motion.p>
                  )}
                </div>

                {/* 뒤집은 후 정보 표시 */}
                <AnimatePresence>
                  {cardFlipped && (
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}
                    >
                      {isSuperGrade(result.card.grade) && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: [0, 1.3, 1] }}
                          transition={{ delay: 0.2, duration: 0.5 }}
                          style={{
                            fontSize: '32px', fontWeight: 900,
                            color: GRADE_COLORS[result.card.grade],
                            textShadow: `0 0 30px ${GRADE_COLORS[result.card.grade]}, 0 0 60px ${GRADE_COLORS[result.card.grade]}50`,
                          }}
                        >
                          {result.card.grade} 등급!
                        </motion.div>
                      )}

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {result.isNew && (
                          <span style={{
                            padding: '4px 12px', borderRadius: '12px', fontSize: '12px',
                            background: 'var(--success)', color: 'white', fontWeight: 600,
                          }}>신규!</span>
                        )}
                        {result.isDuplicate && (
                          <span style={{
                            padding: '4px 12px', borderRadius: '12px', fontSize: '12px',
                            background: 'var(--accent)', color: 'white', fontWeight: 600,
                          }}>중복 +1</span>
                        )}
                      </div>

                      <button className="btn btn-primary" onClick={closeModal}
                        style={{ marginTop: '8px', padding: '10px 40px' }}>
                        확인
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ===== 10연 뽑기 결과 ===== */}
            {multiResults.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? '12px' : '20px', width: '100%', maxWidth: isMobile ? '100%' : multiResults.length > 10 ? '1100px' : '600px', padding: isMobile ? '0 8px' : '0' }}>
                <h3 style={{ fontSize: isMobile ? '16px' : '20px', fontWeight: 900, color: 'white' }}>뽑기 결과</h3>

                {/* 전체 공개 / 닫기 버튼 - 모바일에서 상단 배치 */}
                <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
                  {phase !== 'done' && (
                    <button className="btn btn-primary" onClick={() => { setRevealIndex(multiResults.length - 1); setPhase('done'); }}
                      style={{ padding: '10px 32px' }}>
                      전체 공개
                    </button>
                  )}
                  {phase === 'done' && (
                    <button className="btn btn-primary" onClick={closeModal}
                      style={{ padding: '10px 40px' }}>
                      확인
                    </button>
                  )}
                </div>

                {phase !== 'done' && (
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                    카드를 터치하여 하나씩 공개하거나 전체 공개
                  </p>
                )}

                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: isMobile ? '8px' : '12px',
                  justifyContent: 'center',
                  paddingBottom: '20px',
                }}>
                  {multiResults.map((r, i) => {
                    const revealed = i <= revealIndex;
                    const glow = isSuperGrade(r.card.grade) ? getGlowParams(r.card.grade) : null;
                    const cardSize = isMobile ? 100 : 140;
                    const cardHeight = isMobile ? 144 : 200;
                    return (
                      <motion.div
                        key={i}
                        className={revealed && glow
                          ? `card-rare-glow card-rare-glow-sm${r.card.grade === 'SSS' ? ' card-rare-glow-sss' : r.card.grade === 'SS' ? ' card-rare-glow-ss' : ''}`
                          : ''}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => { if (revealIndex < i) setRevealIndex(i); if (i >= multiResults.length - 1) setPhase('done'); }}
                        style={{
                          cursor: revealed ? 'default' : 'pointer',
                          position: 'relative',
                          borderRadius: '10px',
                        }}
                      >
                        {!revealed ? (
                          <div style={{
                            borderRadius: '8px',
                            width: `${cardSize}px`, height: `${cardHeight}px`,
                            background: 'linear-gradient(135deg, #1a1a3e, #2d1b69)',
                            border: '1px solid rgba(108,92,231,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <img src="/pokeball.svg" alt="pokeball" style={{
                              width: isMobile ? '20px' : '30px', height: isMobile ? '20px' : '30px', opacity: 0.4,
                            }} />
                          </div>
                        ) : (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                          >
                            <PokemonCard
                              name={r.card.pokemon.name}
                              artworkUrl={r.card.pokemon.artworkUrl}
                              grade={r.card.grade}
                              level={r.card.level}
                              size={isMobile ? 'tiny' as any : 'small'}
                              showStats={false}
                              enableTilt={false}
                            />
                            <div style={{ marginTop: '2px', display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              {r.isNew && <span style={{ fontSize: isMobile ? '8px' : '10px', color: 'var(--success)', fontWeight: 600 }}>신규</span>}
                              {r.isDuplicate && <span style={{ fontSize: isMobile ? '8px' : '10px', color: 'var(--accent-light)', fontWeight: 600 }}>중복</span>}
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
