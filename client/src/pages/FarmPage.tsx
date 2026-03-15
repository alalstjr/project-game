import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext.tsx';
import api from '../api/client.ts';
import PokemonCard from '../components/card/PokemonCard.tsx';
import { useIsMobile } from '../hooks/useIsMobile.tsx';
import { getKoreanName } from '../constants/pokemonNames.ts';

const GRADE_COLORS: Record<string, string> = {
  E: '#8B8B8B', D: '#6B8E23', C: '#4682B4', B: '#9370DB',
  A: '#FF6347', S: '#FFD700', SS: '#FF4500', SSS: '#FF00FF',
};

interface PokemonInfo {
  id: number; name: string; spriteUrl: string; artworkUrl: string;
  type1: string; type2: string | null;
}

interface FarmSlot {
  slot: number; empty: boolean; cardId?: number; grade?: string;
  level?: number; atk?: number; def?: number; hp?: number;
  pokemon?: PokemonInfo; accumulated?: number; maxPerSlot?: number;
  minutesPerTicket?: number; nextTicketInSeconds?: number | null;
  deployedAt?: string;
}

interface CardData {
  id: number; pokemonId: number; grade: string; level: number;
  atk: number; def: number; hp: number; dupeCount: number;
  pokemon: PokemonInfo;
}

const GRADE_TICKET_TIME: Record<string, string> = {
  E: '2시간', D: '1시간30분', C: '1시간', B: '45분',
  A: '30분', S: '20분', SS: '15분', SSS: '10분',
};

// ===== 포켓몬 AI =====
interface PokemonState {
  slot: number; x: number; y: number;
  targetX: number; targetY: number;
  facingLeft: boolean;
  action: 'idle' | 'walking' | 'interacting';
  interactWith: number | null;
  idleTimer: number;
  spriteUrl: string; name: string; grade: string;
  accumulated: number; maxPerSlot: number;
}

const PX = 4; // 픽셀 단위

function initPokemonState(slot: FarmSlot, fw: number, fh: number): PokemonState {
  const grassTop = fh * 0.52;
  const x = 80 + Math.random() * (fw - 160);
  const y = grassTop + 20 + Math.random() * (fh - grassTop - 60);
  return {
    slot: slot.slot, x, y, targetX: x, targetY: y,
    facingLeft: Math.random() > 0.5,
    action: 'idle', interactWith: null,
    idleTimer: 60 + Math.random() * 120,
    spriteUrl: slot.pokemon?.spriteUrl || '',
    name: slot.pokemon?.name || '',
    grade: slot.grade || 'E',
    accumulated: slot.accumulated || 0,
    maxPerSlot: slot.maxPerSlot || 10,
  };
}

function pickTarget(fw: number, fh: number) {
  const grassTop = fh * 0.52;
  return {
    x: 80 + Math.random() * (fw - 160),
    y: grassTop + 20 + Math.random() * (fh - grassTop - 60),
  };
}

export default function FarmPage() {
  const { updateTickets } = useAuth();
  const [slots, setSlots] = useState<FarmSlot[]>([]);
  const [myCards, setMyCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectingSlot, setSelectingSlot] = useState<number | null>(null);
  const [collectAnim, setCollectAnim] = useState<{ slot: number; amount: number } | null>(null);
  const [badgeDrop, setBadgeDrop] = useState<{ badgeId: number; badgeName: string } | null>(null);
  const [pokeStates, setPokeStates] = useState<PokemonState[]>([]);
  const farmRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);

  const isMobile = useIsMobile();
  const FW = isMobile ? Math.min(window.innerWidth - 24, 400) : 900;
  const FH = isMobile ? Math.round(FW * 0.5) : 420;

  const loadData = useCallback(() => {
    Promise.all([
      api.get('/farm/status'),
      api.get('/collection/cards'),
    ]).then(([farmRes, cardsRes]) => {
      setSlots(farmRes.data.slots);
      setMyCards(cardsRes.data);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 포켓몬 상태 동기화
  useEffect(() => {
    const deployed = slots.filter(s => !s.empty);
    setPokeStates(prev => {
      const next: PokemonState[] = [];
      for (const s of deployed) {
        const existing = prev.find(p => p.slot === s.slot);
        if (existing) {
          next.push({ ...existing, spriteUrl: s.pokemon?.spriteUrl || '', name: s.pokemon?.name || '',
            grade: s.grade || 'E', accumulated: s.accumulated || 0, maxPerSlot: s.maxPerSlot || 10 });
        } else {
          next.push(initPokemonState(s, FW, FH));
        }
      }
      return next;
    });
  }, [slots]);

  // AI 루프
  useEffect(() => {
    const tick = () => {
      setPokeStates(prev => {
        if (!prev.length) return prev;
        const next = prev.map(p => ({ ...p }));
        for (const p of next) {
          if (p.action === 'idle') {
            p.idleTimer--;
            if (p.idleTimer <= 0) {
              if (next.length > 1 && Math.random() < 0.15) {
                const others = next.filter(o => o.slot !== p.slot);
                const t = others[Math.floor(Math.random() * others.length)];
                const a = Math.atan2(t.y - p.y, t.x - p.x);
                p.targetX = t.x + Math.cos(a + Math.PI) * 45;
                p.targetY = t.y + Math.sin(a + Math.PI) * 45;
                p.action = 'interacting';
                p.interactWith = t.slot;
              } else {
                const t = pickTarget(FW, FH);
                p.targetX = t.x; p.targetY = t.y;
                p.action = 'walking';
              }
            }
          } else {
            const dx = p.targetX - p.x, dy = p.targetY - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 3) {
              const was = p.action;
              p.x = p.targetX; p.y = p.targetY;
              p.action = 'idle'; p.interactWith = null;
              p.idleTimer = was === 'interacting' ? 80 + Math.random() * 60 : 60 + Math.random() * 120;
            } else {
              p.x += (dx / dist) * 0.6;
              p.y += (dy / dist) * 0.6;
              p.facingLeft = dx < 0;
            }
          }
        }
        return next;
      });
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  // 타이머
  useEffect(() => {
    const timer = setInterval(() => {
      setSlots(prev => prev.map(s => {
        if (s.empty || !s.minutesPerTicket) return s;
        const n = s.nextTicketInSeconds;
        if (n === null || n === undefined) return s;
        if (n <= 1) {
          const acc = Math.min((s.accumulated || 0) + 1, s.maxPerSlot || 10);
          return { ...s, accumulated: acc,
            nextTicketInSeconds: acc >= (s.maxPerSlot || 10) ? null : s.minutesPerTicket * 60 };
        }
        return { ...s, nextTicketInSeconds: n - 1 };
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const deployCard = async (slot: number, cardId: number) => {
    try {
      const res = await api.post('/farm/deploy', { slot, cardId });
      setSlots(res.data.slots); setSelectingSlot(null);
      api.get('/gacha/status').then(r => updateTickets(r.data.tickets));
    } catch (err: any) { alert(err.response?.data?.error || '배치 실패'); }
  };

  const collectSlot = async (slot: number) => {
    try {
      const res = await api.post('/farm/collect', { slot });
      setCollectAnim({ slot, amount: res.data.collected });
      updateTickets(res.data.totalTickets);
      if (res.data.badgeDrop) {
        setTimeout(() => setBadgeDrop(res.data.badgeDrop), 800);
        setTimeout(() => setBadgeDrop(null), 4000);
      }
      setTimeout(() => { setCollectAnim(null); loadData(); }, 1200);
    } catch (err: any) { alert(err.response?.data?.error || '수확 실패'); }
  };

  const collectAllSlots = async () => {
    try {
      const res = await api.post('/farm/collect-all');
      if (res.data.collected > 0) {
        setCollectAnim({ slot: -1, amount: res.data.collected });
        updateTickets(res.data.totalTickets);
        if (res.data.badgeDrop) {
          setTimeout(() => setBadgeDrop(res.data.badgeDrop), 800);
          setTimeout(() => setBadgeDrop(null), 4000);
        }
        setTimeout(() => { setCollectAnim(null); loadData(); }, 1200);
      }
    } catch (err: any) { alert(err.response?.data?.error || '수확 실패'); }
  };

  const removeCard = async (slot: number) => {
    try {
      const res = await api.post('/farm/remove', { slot });
      updateTickets(res.data.totalTickets); loadData();
    } catch (err: any) { alert(err.response?.data?.error || '회수 실패'); }
  };

  const totalAccumulated = slots.reduce((sum, s) => sum + (s.accumulated || 0), 0);
  const deployedCardIds = new Set(slots.filter(s => !s.empty).map(s => s.cardId));
  const emptySlots = slots.filter(s => s.empty);

  const formatTime = (sec: number | null | undefined) => {
    if (sec === null || sec === undefined) return '완료';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%',
          border: '3px solid rgba(108,92,231,0.2)', borderTopColor: 'var(--accent)',
          animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{
            fontSize: 26, fontWeight: 900, margin: 0,
            background: 'linear-gradient(135deg, #22c55e, #4ade80)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            포켓몬 농장
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#8888a0' }}>
            포켓몬을 배치하면 뽑기권을 모아옵니다
          </p>
        </div>
        {totalAccumulated > 0 && (
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={collectAllSlots}
            style={{
              padding: '10px 24px', borderRadius: 0, fontSize: 14, fontWeight: 700,
              background: '#4a8', color: '#fff', border: `${PX}px solid #396`,
              cursor: 'pointer', imageRendering: 'pixelated',
              boxShadow: `${PX}px ${PX}px 0 #274`,
              fontFamily: 'monospace',
            }}>
            전체 수확 +{totalAccumulated}
          </motion.button>
        )}
      </div>

      {/* 수확 플로팅 */}
      <AnimatePresence>
        {collectAnim && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: -40 }}
            exit={{ opacity: 0, y: -80 }} transition={{ duration: 1 }}
            style={{
              position: 'fixed', top: '40%', left: '50%', transform: 'translateX(-50%)',
              zIndex: 200, pointerEvents: 'none', fontSize: 28, fontWeight: 900,
              color: '#4f8', fontFamily: 'monospace',
              textShadow: '2px 2px 0 #040, -1px -1px 0 #040',
            }}>
            +{collectAnim.amount} 뽑기권!
          </motion.div>
        )}
      </AnimatePresence>

      {/* 뱃지 드랍 알림 */}
      <AnimatePresence>
        {badgeDrop && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            style={{
              position: 'fixed', top: '30%', left: '50%', transform: 'translateX(-50%)',
              zIndex: 300, padding: '20px 32px', borderRadius: '16px',
              background: 'linear-gradient(135deg, #2a1a4a, #1a2a4a)',
              border: '2px solid #f0c040',
              boxShadow: '0 0 40px rgba(240,192,64,0.4)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '14px', color: '#f0c040', fontWeight: 800, marginBottom: '8px', fontFamily: 'monospace' }}>
              뱃지 획득!
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: '#fff' }}>
              {badgeDrop.badgeName}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              컬렉션에서 확인하세요
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== 도트 농장 ===== */}
      <div ref={farmRef} className="pixel-farm" style={{
        width: '100%', maxWidth: FW, height: FH, margin: '0 auto 20px',
        overflow: 'hidden', position: 'relative',
        border: `${PX}px solid #2a3a20`,
        imageRendering: 'pixelated',
        background: '#87CEEB',
      }}>
        {/* 하늘 그라데이션 (도트 디더링 느낌) */}
        <div style={{ position: 'absolute', inset: 0, background:
          'linear-gradient(180deg, #6eb5ff 0%, #87CEEB 30%, #a8dba8 52%, #5a9a48 55%, #4a8a38 100%)',
        }} />

        {/* 도트 태양 */}
        <PixelSun />

        {/* 도트 구름 */}
        <PixelCloud left={60} top={30} speed={45} />
        <PixelCloud left={350} top={18} speed={55} />
        <PixelCloud left={650} top={40} speed={38} />

        {/* 뒷산 (계단식 도트) */}
        <div style={{
          position: 'absolute', bottom: '47%', left: 0, right: 0, height: 60,
        }}>
          {/* 산1 */}
          {[40, 36, 32, 28, 24, 20, 16, 12, 8].map((w, i) => (
            <div key={`m1-${i}`} style={{
              position: 'absolute', bottom: i * PX,
              left: `calc(20% - ${w / 2}px)`, width: w * 2, height: PX,
              background: i < 3 ? '#3a6a30' : '#4a7a40',
            }} />
          ))}
          {/* 산2 */}
          {[50, 44, 38, 32, 26, 20, 14, 8].map((w, i) => (
            <div key={`m2-${i}`} style={{
              position: 'absolute', bottom: i * PX,
              left: `calc(65% - ${w / 2}px)`, width: w * 2, height: PX,
              background: i < 3 ? '#306028' : '#408030',
            }} />
          ))}
        </div>

        {/* 잔디 바닥 */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '48%',
          background: '#4a8a38',
        }} />

        {/* 잔디 패턴 (바둑판 도트) */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '48%',
          backgroundImage:
            `repeating-linear-gradient(90deg, transparent, transparent ${PX * 3}px, rgba(60,120,40,0.3) ${PX * 3}px, rgba(60,120,40,0.3) ${PX * 4}px)`,
          backgroundSize: `${PX * 4}px ${PX * 4}px`,
        }} />

        {/* 밭 줄 (어두운 흙 줄) */}
        {[0, 1, 2].map(i => (
          <div key={`row-${i}`} style={{
            position: 'absolute',
            bottom: `${8 + i * 14}%`,
            left: '10%', width: '80%', height: PX * 2,
            background: '#5a7a30',
          }}>
            {/* 작물 도트 */}
            {[...Array(8)].map((_, j) => (
              <div key={j} style={{
                position: 'absolute',
                left: `${j * 12.5 + 3}%`, top: -PX * 3,
                width: PX * 2, height: PX * 3,
                background: j % 3 === 0 ? '#e44' : j % 3 === 1 ? '#eb4' : '#8d5',
              }}>
                {/* 줄기 */}
                <div style={{
                  position: 'absolute', bottom: -PX, left: PX / 2,
                  width: PX, height: PX * 2, background: '#3a6a20',
                }} />
              </div>
            ))}
          </div>
        ))}

        {/* 도트 나무 */}
        <PixelTree left={30} bottom="46%" size={1} />
        <PixelTree left={820} bottom="46%" size={0.9} />
        <PixelTree left={440} bottom="48%" size={0.7} />

        {/* 도트 울타리 */}
        <div style={{ position: 'absolute', bottom: '44%', left: 60, right: 60, height: PX * 6 }}>
          {[...Array(18)].map((_, i) => (
            <div key={i} style={{
              position: 'absolute', left: `${i * 5.55}%`, bottom: 0,
              width: PX, height: PX * 6, background: '#8a6a40',
            }} />
          ))}
          <div style={{ position: 'absolute', bottom: PX * 4, left: 0, right: 0, height: PX, background: '#9a7a50' }} />
          <div style={{ position: 'absolute', bottom: PX, left: 0, right: 0, height: PX, background: '#7a5a30' }} />
        </div>

        {/* 도트 꽃 */}
        {[
          { x: '12%', y: '60%', c: '#f66' }, { x: '25%', y: '75%', c: '#ff6' },
          { x: '45%', y: '68%', c: '#f9f' }, { x: '60%', y: '80%', c: '#6cf' },
          { x: '78%', y: '65%', c: '#ff6' }, { x: '88%', y: '78%', c: '#f66' },
          { x: '35%', y: '85%', c: '#6f6' }, { x: '70%', y: '90%', c: '#f9f' },
        ].map((f, i) => (
          <div key={i} style={{
            position: 'absolute', left: f.x, top: f.y,
          }}>
            {/* 꽃잎 (십자형 도트) */}
            <div style={{ position: 'relative', width: PX * 3, height: PX * 3 }}>
              <div style={{ position: 'absolute', top: 0, left: PX, width: PX, height: PX, background: f.c }} />
              <div style={{ position: 'absolute', top: PX, left: 0, width: PX, height: PX, background: f.c }} />
              <div style={{ position: 'absolute', top: PX, left: PX, width: PX, height: PX, background: '#ff8' }} />
              <div style={{ position: 'absolute', top: PX, left: PX * 2, width: PX, height: PX, background: f.c }} />
              <div style={{ position: 'absolute', top: PX * 2, left: PX, width: PX, height: PX, background: f.c }} />
            </div>
            {/* 줄기 */}
            <div style={{ width: PX, height: PX * 2, background: '#3a7a20', marginLeft: PX }} />
          </div>
        ))}

        {/* 빈 슬롯 (도트 스타일 + 버튼) */}
        {emptySlots.map((s) => {
          const positions = [
            { x: 15, y: 65 }, { x: 33, y: 72 }, { x: 52, y: 64 },
            { x: 70, y: 74 }, { x: 87, y: 67 },
          ];
          const pos = positions[s.slot - 1];
          return (
            <motion.div key={`e-${s.slot}`}
              whileHover={{ scale: 1.15 }}
              onClick={() => setSelectingSlot(s.slot)}
              style={{
                position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
                width: PX * 10, height: PX * 10,
                border: `${PX}px dashed rgba(255,255,255,0.5)`,
                background: 'rgba(0,0,0,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: 5,
              }}>
              <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', fontWeight: 900 }}>+</span>
            </motion.div>
          );
        })}

        {/* 포켓몬 */}
        {pokeStates.map(p => {
          const isFull = p.accumulated >= p.maxPerSlot;
          return (
            <div key={p.slot} style={{
              position: 'absolute', left: p.x, top: p.y,
              transform: `translate(-50%, -50%) scaleX(${p.facingLeft ? -1 : 1})`,
              zIndex: Math.floor(p.y), cursor: 'pointer',
            }}
              onClick={() => {
                const sd = slots.find(s => s.slot === p.slot);
                if (sd && (sd.accumulated || 0) > 0) collectSlot(p.slot);
              }}
            >
              {/* 그림자 (도트) */}
              <div style={{
                position: 'absolute', bottom: -PX, left: '50%', transform: 'translateX(-50%)',
                width: PX * 8, height: PX * 2, background: 'rgba(0,0,0,0.2)',
              }} />

              {/* 스프라이트 */}
              <motion.img src={p.spriteUrl} alt={p.name}
                animate={
                  p.action !== 'idle'
                    ? { y: [0, -6, 0] }
                    : { y: [0, -2, 0] }
                }
                transition={
                  p.action !== 'idle'
                    ? { duration: 0.3, repeat: Infinity }
                    : { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                }
                style={{
                  width: 52, height: 52, imageRendering: 'pixelated',
                  filter: isFull ? 'drop-shadow(0 0 4px #4f8) drop-shadow(0 0 8px #4f8)' : 'none',
                }}
                draggable={false}
              />

              {/* 이름 + 등급 */}
              <div style={{
                position: 'absolute', bottom: -PX * 4, left: '50%',
                transform: `translateX(-50%) scaleX(${p.facingLeft ? -1 : 1})`,
                fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap',
                fontFamily: 'monospace', color: '#fff',
                textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
              }}>
                <span style={{ color: GRADE_COLORS[p.grade] }}>{p.grade}</span> {getKoreanName(p.name)}
              </div>

              {/* 뽑기권 말풍선 (도트) */}
              {p.accumulated > 0 && (
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  style={{
                    position: 'absolute', top: -PX * 5, left: '50%',
                    transform: `translateX(-50%) scaleX(${p.facingLeft ? -1 : 1})`,
                    background: isFull ? '#4a4' : '#222',
                    border: `${PX / 2}px solid ${isFull ? '#6f6' : '#555'}`,
                    padding: `${PX / 2}px ${PX * 2}px`,
                    fontSize: 10, fontWeight: 900, fontFamily: 'monospace',
                    color: isFull ? '#fff' : '#4f8',
                    whiteSpace: 'nowrap',
                    animation: isFull ? 'px-blink 1s step-start infinite' : 'none',
                  }}>
                  +{p.accumulated}
                </motion.div>
              )}

              {/* 상호작용 이모지 */}
              {p.action === 'interacting' && (
                <motion.div
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: [0, 1, 1, 0], y: -20 }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{
                    position: 'absolute', top: -PX * 8, left: '50%',
                    transform: `translateX(-50%) scaleX(${p.facingLeft ? -1 : 1})`,
                    fontSize: 12,
                  }}>
                  {p.slot % 2 === 0 ? '\u2665' : '\u266A'}
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* ===== 슬롯 패널 ===== */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 8, marginBottom: 14,
      }}>
        {slots.map(slot => {
          const isFull = (slot.accumulated || 0) >= (slot.maxPerSlot || 10);
          const hasTickets = (slot.accumulated || 0) > 0;
          const progress = slot.empty ? 0 : ((slot.accumulated || 0) / (slot.maxPerSlot || 10)) * 100;

          if (slot.empty) {
            return (
              <div key={slot.slot} onClick={() => setSelectingSlot(slot.slot)}
                style={{
                  padding: '14px 8px', textAlign: 'center', cursor: 'pointer',
                  background: '#1a2a14', border: `${PX / 2}px dashed #3a5a30`,
                }}>
                <div style={{ fontSize: 18, color: '#3a5a30', fontFamily: 'monospace' }}>+</div>
                <div style={{ fontSize: 9, color: '#3a5a30', fontFamily: 'monospace' }}>SLOT {slot.slot}</div>
              </div>
            );
          }

          return (
            <div key={slot.slot} style={{
              background: '#1a2a14', position: 'relative', overflow: 'hidden',
              border: `${PX / 2}px solid ${isFull ? '#4a4' : '#2a3a20'}`,
            }}>
              {isFull && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: PX / 2,
                  background: '#4f4', animation: 'px-blink 1s step-start infinite',
                }} />
              )}

              <div style={{ padding: '8px 6px 4px', textAlign: 'center', position: 'relative' }}>
                <button onClick={() => removeCard(slot.slot)} style={{
                  position: 'absolute', top: 2, right: 4, fontSize: 9, color: '#555',
                  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace',
                }}>X</button>
                <img src={slot.pokemon?.spriteUrl} alt={slot.pokemon?.name}
                  style={{ width: 36, height: 36, imageRendering: 'pixelated' }} />
                <div style={{
                  fontSize: 9, fontWeight: 700, color: '#cdc', fontFamily: 'monospace',
                  marginTop: 2,
                }}>
                  {slot.pokemon?.name ? getKoreanName(slot.pokemon.name) : ''}
                </div>
                <div style={{ fontSize: 8, color: '#686', fontFamily: 'monospace' }}>
                  <span style={{ color: GRADE_COLORS[slot.grade || 'E'] }}>{slot.grade}</span>
                  {' '}{GRADE_TICKET_TIME[slot.grade || 'E']}
                </div>
              </div>

              {/* 프로그레스 바 (도트) */}
              <div style={{ padding: '0 6px', marginBottom: PX }}>
                <div style={{ height: PX, background: '#0a1a08' }}>
                  <div style={{
                    height: '100%', width: `${progress}%`,
                    background: isFull ? '#4f4' : '#6c5ce7',
                    transition: 'width 0.5s step-end',
                  }} />
                </div>
              </div>

              <div style={{
                padding: '4px 6px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderTop: `${PX / 2}px solid #2a3a20`,
              }}>
                <div>
                  <span style={{
                    fontSize: 13, fontWeight: 900, fontFamily: 'monospace',
                    color: hasTickets ? '#4f8' : '#353',
                  }}>
                    {slot.accumulated || 0}
                  </span>
                  <span style={{ fontSize: 8, color: '#464', fontFamily: 'monospace' }}>/{slot.maxPerSlot}</span>
                  {!isFull && slot.nextTicketInSeconds != null && (
                    <div style={{ fontSize: 8, color: '#353', fontFamily: 'monospace' }}>{formatTime(slot.nextTicketInSeconds)}</div>
                  )}
                </div>
                {hasTickets && (
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => collectSlot(slot.slot)}
                    style={{
                      padding: `${PX / 2}px ${PX * 2}px`, fontSize: 9, fontWeight: 700,
                      fontFamily: 'monospace',
                      background: isFull ? '#4a4' : '#2a3a20',
                      color: isFull ? '#fff' : '#4f8',
                      border: `${PX / 2}px solid ${isFull ? '#6f6' : '#3a5a30'}`,
                      cursor: 'pointer',
                    }}>
                    수확
                  </motion.button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 등급 정보 */}
      <div style={{
        display: 'flex', gap: 4, flexWrap: 'wrap', padding: '8px 12px',
        background: '#1a2a14', border: `${PX / 2}px solid #2a3a20`,
      }}>
        <span style={{ fontSize: 9, color: '#686', fontFamily: 'monospace', lineHeight: '18px', marginRight: 4 }}>속도:</span>
        {Object.entries(GRADE_TICKET_TIME).map(([grade, time]) => (
          <span key={grade} style={{
            fontSize: 8, padding: '1px 5px', fontFamily: 'monospace',
            background: '#0a1a08', border: `1px solid #2a3a20`,
          }}>
            <span style={{ color: GRADE_COLORS[grade], fontWeight: 700 }}>{grade}</span>
            <span style={{ color: '#464', marginLeft: 3 }}>{time}</span>
          </span>
        ))}
      </div>

      {/* 카드 선택 모달 */}
      <AnimatePresence>
        {selectingSlot !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(6,6,18,0.95)', backdropFilter: 'blur(8px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '24px 16px', overflowY: 'auto',
            }}>
            <div style={{ maxWidth: 800, width: '100%' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 24, paddingBottom: 16,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div>
                  <h3 style={{ fontSize: 20, fontWeight: 900, color: '#e8e8f0', margin: 0 }}>
                    슬롯 {selectingSlot}에 배치할 포켓몬
                  </h3>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#8888a0' }}>
                    높은 등급일수록 빠르게 수집합니다
                  </p>
                </div>
                <button onClick={() => setSelectingSlot(null)} style={{
                  padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: 'rgba(255,255,255,0.06)', color: '#8888a0',
                  border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                }}>취소</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                {myCards
                  .sort((a, b) => {
                    const order = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E'];
                    return order.indexOf(a.grade) - order.indexOf(b.grade);
                  })
                  .map(card => {
                    const isDeployed = deployedCardIds.has(card.id);
                    return (
                      <motion.div key={card.id}
                        whileHover={!isDeployed ? { scale: 1.03 } : {}}
                        whileTap={!isDeployed ? { scale: 0.97 } : {}}
                        onClick={() => !isDeployed && deployCard(selectingSlot!, card.id)}
                        style={{
                          padding: 8, borderRadius: 12,
                          cursor: isDeployed ? 'not-allowed' : 'pointer',
                          border: '2px solid rgba(255,255,255,0.04)',
                          background: 'rgba(255,255,255,0.02)',
                          opacity: isDeployed ? 0.25 : 1, position: 'relative',
                        }}>
                        {isDeployed && (
                          <div style={{
                            position: 'absolute', top: 6, right: 6, zIndex: 5,
                            padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                            background: 'rgba(34,197,94,0.2)', color: '#22c55e',
                            border: '1px solid rgba(34,197,94,0.3)',
                          }}>배치중</div>
                        )}
                        <PokemonCard name={card.pokemon.name} artworkUrl={card.pokemon.artworkUrl}
                          grade={card.grade} level={card.level} size="small" enableTilt={false} />
                        <div style={{ textAlign: 'center', marginTop: 4, fontSize: 10, color: '#8888a0' }}>
                          <span style={{ color: GRADE_COLORS[card.grade], fontWeight: 700 }}>{card.grade}</span>
                          <span style={{ marginLeft: 6 }}>{GRADE_TICKET_TIME[card.grade]}/개</span>
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes cloud-drift {
          0% { transform: translateX(-120px); }
          100% { transform: translateX(960px); }
        }
        @keyframes px-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

/* ===== 도트 태양 ===== */
function PixelSun() {
  const P = PX;
  return (
    <div style={{ position: 'absolute', top: 20, right: 70, width: P * 10, height: P * 10 }}>
      {/* 코어 */}
      <div style={{ position: 'absolute', top: P * 3, left: P * 3, width: P * 4, height: P * 4, background: '#ffe066' }} />
      {/* 상하좌우 광선 */}
      <div style={{ position: 'absolute', top: P, left: P * 4, width: P * 2, height: P * 2, background: '#ffe066' }} />
      <div style={{ position: 'absolute', top: P * 7, left: P * 4, width: P * 2, height: P * 2, background: '#ffe066' }} />
      <div style={{ position: 'absolute', top: P * 4, left: P, width: P * 2, height: P * 2, background: '#ffe066' }} />
      <div style={{ position: 'absolute', top: P * 4, left: P * 7, width: P * 2, height: P * 2, background: '#ffe066' }} />
      {/* 대각선 광선 */}
      <div style={{ position: 'absolute', top: P * 2, left: P * 2, width: P, height: P, background: '#ffcc33' }} />
      <div style={{ position: 'absolute', top: P * 2, left: P * 7, width: P, height: P, background: '#ffcc33' }} />
      <div style={{ position: 'absolute', top: P * 7, left: P * 2, width: P, height: P, background: '#ffcc33' }} />
      <div style={{ position: 'absolute', top: P * 7, left: P * 7, width: P, height: P, background: '#ffcc33' }} />
      {/* 연장선 */}
      <div style={{ position: 'absolute', top: 0, left: P * 4.5, width: P, height: P, background: '#ffdd55' }} />
      <div style={{ position: 'absolute', top: P * 9, left: P * 4.5, width: P, height: P, background: '#ffdd55' }} />
      <div style={{ position: 'absolute', top: P * 4.5, left: 0, width: P, height: P, background: '#ffdd55' }} />
      <div style={{ position: 'absolute', top: P * 4.5, left: P * 9, width: P, height: P, background: '#ffdd55' }} />
    </div>
  );
}

/* ===== 도트 구름 ===== */
function PixelCloud({ left, top, speed }: { left: number; top: number; speed: number }) {
  const P = PX;
  // 구름 형태: 2줄짜리 도트 블록
  return (
    <div style={{
      position: 'absolute', top, left,
      animation: `cloud-drift ${speed}s linear infinite`,
    }}>
      {/* 윗줄 */}
      <div style={{ display: 'flex' }}>
        <div style={{ width: P * 2, height: P * 2 }} />
        <div style={{ width: P * 2, height: P * 2, background: 'rgba(255,255,255,0.35)' }} />
        <div style={{ width: P * 4, height: P * 2, background: 'rgba(255,255,255,0.4)' }} />
        <div style={{ width: P * 2, height: P * 2, background: 'rgba(255,255,255,0.35)' }} />
      </div>
      {/* 아랫줄 */}
      <div style={{ display: 'flex' }}>
        <div style={{ width: P * 2, height: P * 2, background: 'rgba(255,255,255,0.3)' }} />
        <div style={{ width: P * 8, height: P * 2, background: 'rgba(255,255,255,0.4)' }} />
        <div style={{ width: P * 2, height: P * 2, background: 'rgba(255,255,255,0.3)' }} />
      </div>
    </div>
  );
}

/* ===== 도트 나무 ===== */
function PixelTree({ left, bottom, size }: { left: number; bottom: string; size: number }) {
  const P = PX;
  return (
    <div style={{
      position: 'absolute', left, bottom,
      transform: `scale(${size})`, transformOrigin: 'bottom center',
    }}>
      {/* 잎 (계단형 피라미드) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* 1단 */}
        <div style={{ width: P * 2, height: P * 2, background: '#3a8a28' }} />
        {/* 2단 */}
        <div style={{ width: P * 6, height: P * 2, background: '#4a9a38' }} />
        {/* 3단 */}
        <div style={{ width: P * 10, height: P * 2, background: '#3a8a28' }} />
        {/* 4단 */}
        <div style={{ width: P * 6, height: P * 2, background: '#4a9a38' }} />
        {/* 5단 */}
        <div style={{ width: P * 10, height: P * 2, background: '#2d7a20' }} />
        {/* 6단 */}
        <div style={{ width: P * 14, height: P * 2, background: '#3a8a28' }} />
      </div>
      {/* 줄기 */}
      <div style={{
        width: P * 4, height: P * 6, background: '#6a4a28',
        margin: '0 auto', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', left: -P, top: 0,
          width: P, height: P * 3, background: '#7a5a38',
        }} />
      </div>
    </div>
  );
}
