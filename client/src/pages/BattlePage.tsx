import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext.tsx';
import api from '../api/client.ts';
import PokemonCard from '../components/card/PokemonCard.tsx';
import { useIsMobile } from '../hooks/useIsMobile.tsx';
import { getKoreanName } from '../constants/pokemonNames.ts';

const GRADE_COLORS: Record<string, string> = {
  E: '#8B8B8B', D: '#6B8E23', C: '#4682B4', B: '#9370DB',
  A: '#FF6347', S: '#FFD700', SS: '#FF4500', SSS: '#FF00FF',
};

interface CardData {
  id: number;
  pokemonId: number;
  grade: string;
  level: number;
  atk: number;
  def: number;
  hp: number;
  dupeCount: number;
  pokemon: { id: number; name: string; spriteUrl: string; artworkUrl: string; type1: string; type2: string | null };
}

interface DeckSlot {
  slot: number;
  cardId: number;
  grade: string;
  level: number;
  atk: number;
  def: number;
  hp: number;
  pokemon: { id: number; name: string; spriteUrl: string; artworkUrl: string; type1: string; type2: string | null };
}

interface BattleLogEntry {
  timestamp: number;
  actor: 'challenger' | 'defender';
  actorName: string;
  skillName: string;
  damage: number;
  remainingHp: { challenger: number; defender: number };
  isCritical: boolean;
  typeEffect: 'super_effective' | 'not_effective' | 'immune' | 'normal';
}

interface RoundResult {
  round: number;
  challengerCard: CardData;
  defenderCard: CardData;
  winnerId: number;
  battleLog?: BattleLogEntry[];
  maxHp?: { challenger: number; defender: number };
  typeMultipliers?: { challenger: number; defender: number };
}

interface BattleResult {
  winnerId: number;
  challengerUsername: string;
  defenderUsername: string;
  challengerWins: number;
  defenderWins: number;
  rounds: RoundResult[];
  tickets?: number;
  isTest?: boolean;
}

interface Opponent {
  id: number;
  username: string;
  pullTickets: number;
  rankingScore: number;
  totalCards: number;
  bestGrade: string | null;
  hasDefenseDeck: boolean;
  canChallenge: boolean;
  battledToday: boolean;
}

type BattlePhase = 'idle' | 'round-intro' | 'entrance' | 'battle-log' | 'clash' | 'impact' | 'round-result' | 'final-result';

// 스파크 파티클 생성
function generateSparks(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    tx: (Math.random() - 0.5) * 200,
    ty: (Math.random() - 0.5) * 200,
    duration: 0.4 + Math.random() * 0.4,
    delay: Math.random() * 0.15,
    size: 2 + Math.random() * 4,
  }));
}

export default function BattlePage() {
  const { user, updateTickets } = useAuth();
  const isMobile = useIsMobile();
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [myCards, setMyCards] = useState<CardData[]>([]);
  const [attackDeck, setAttackDeck] = useState<DeckSlot[]>([]);
  const [defenseDeck, setDefenseDeck] = useState<DeckSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'deck' | 'battle' | 'history'>('deck');
  const [history, setHistory] = useState<any[]>([]);

  const [editingDeck, setEditingDeck] = useState<'attack' | 'defense' | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const [showAnimation, setShowAnimation] = useState(false);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [phase, setPhase] = useState<BattlePhase>('idle');
  const [roundScores, setRoundScores] = useState<{ me: number; opp: number }>({ me: 0, opp: 0 });
  const [battling, setBattling] = useState(false);

  const [visibleLogCount, setVisibleLogCount] = useState(0);
  const [attackingActor, setAttackingActor] = useState<'challenger' | 'defender' | null>(null);
  const [hitActor, setHitActor] = useState<'challenger' | 'defender' | null>(null);
  const [damagePopup, setDamagePopup] = useState<{ actor: 'challenger' | 'defender'; damage: number; isCritical: boolean; typeEffect: string; key: number } | null>(null);
  const [popupKey, setPopupKey] = useState(0);

  const shakeControls = useAnimationControls();
  const sparks = useMemo(() => generateSparks(24), []);

  const deckReady = attackDeck.length === 3 && defenseDeck.length === 3;

  useEffect(() => { loadData(); }, []);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/battle/deck'),
      api.get('/collection/cards'),
      api.get('/battle/opponents'),
    ]).then(([deckRes, cardsRes, oppRes]) => {
      setAttackDeck(deckRes.data.attack);
      setDefenseDeck(deckRes.data.defense);
      setMyCards(cardsRes.data);
      setOpponents(oppRes.data);
    }).finally(() => setLoading(false));
  };

  const loadHistory = () => {
    api.get('/battle/history').then(res => setHistory(res.data));
  };

  const startEditDeck = (type: 'attack' | 'defense') => {
    const current = type === 'attack' ? attackDeck : defenseDeck;
    setSelectedIds(current.map(s => s.cardId));
    setEditingDeck(type);
  };

  const toggleCardSelect = (cardId: number) => {
    const otherDeck = editingDeck === 'attack' ? defenseDeck : attackDeck;
    if (otherDeck.some(s => s.cardId === cardId)) return;
    setSelectedIds(prev => {
      if (prev.includes(cardId)) return prev.filter(id => id !== cardId);
      if (prev.length >= 3) return prev;
      return [...prev, cardId];
    });
  };

  const saveDeck = async () => {
    if (!editingDeck || selectedIds.length !== 3) return;
    setSaving(true);
    try {
      const res = await api.post('/battle/deck', { deckType: editingDeck, cardIds: selectedIds });
      setAttackDeck(res.data.attack);
      setDefenseDeck(res.data.defense);
      setEditingDeck(null);
    } catch (err: any) {
      alert(err.response?.data?.error || '덱 저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const triggerShake = () => {
    shakeControls.start({
      x: [0, -8, 8, -6, 6, -3, 3, 0],
      transition: { duration: 0.4 },
    });
  };

  const runBattleAnimation = async (result: BattleResult) => {
    setBattleResult(result);
    setRoundScores({ me: 0, opp: 0 });
    let meWins = 0, oppWins = 0;

    for (let i = 0; i < 3; i++) {
      setCurrentRound(i);
      setVisibleLogCount(0);
      setPhase('round-intro');
      await sleep(900);
      setPhase('entrance');
      await sleep(1000);

      // 전투 로그 페이즈
      const log = result.rounds[i].battleLog;
      if (log && log.length > 0) {
        setPhase('battle-log');
        setAttackingActor(null);
        setHitActor(null);
        setDamagePopup(null);
        await sleep(600);
        // 로그 엔트리를 하나씩 표시 + 모션
        for (let j = 0; j < log.length; j++) {
          const entry = log[j];
          const target: 'challenger' | 'defender' = entry.actor === 'challenger' ? 'defender' : 'challenger';

          // 공격 모션
          setAttackingActor(entry.actor);
          await sleep(250);

          // 피격 모션 + 데미지 팝업
          setAttackingActor(null);
          setHitActor(target);
          setPopupKey(prev => prev + 1);
          setDamagePopup({ actor: target, damage: entry.damage, isCritical: entry.isCritical, typeEffect: entry.typeEffect, key: popupKey + j + 1 });
          setVisibleLogCount(j + 1);
          await sleep(350);

          setHitActor(null);

          // 다음 엔트리까지 짧은 대기
          const gap = j < log.length - 1
            ? Math.min(400, Math.max(100, (log[j + 1].timestamp - log[j].timestamp) * 0.15))
            : 300;
          await sleep(gap);
          setDamagePopup(null);
        }
        await sleep(600);
      } else {
        // 로그 없으면 기존 애니메이션
        setPhase('clash');
        await sleep(600);
        setPhase('impact');
        triggerShake();
        await sleep(500);
      }

      const roundWinner = result.rounds[i].winnerId;
      if (roundWinner === user?.id) meWins++;
      else oppWins++;
      setRoundScores({ me: meWins, opp: oppWins });

      setPhase('round-result');
      await sleep(1800);
    }
    setPhase('final-result');
  };

  const challenge = async (defenderId: number) => {
    if (battling || !deckReady) return;
    setBattling(true);
    setShowAnimation(true);
    setPhase('idle');
    setBattleResult(null);
    try {
      const res = await api.post('/battle/challenge', { defenderId });
      if (res.data.tickets !== undefined) updateTickets(res.data.tickets);
      await runBattleAnimation(res.data);
      api.get('/battle/opponents').then(r => setOpponents(r.data));
    } catch (err: any) {
      alert(err.response?.data?.error || '배틀 실패');
      setShowAnimation(false);
      setPhase('idle');
    } finally {
      setBattling(false);
    }
  };

  const testChallenge = async () => {
    if (battling || !deckReady) return;
    setBattling(true);
    setShowAnimation(true);
    setPhase('idle');
    setBattleResult(null);
    try {
      const res = await api.post('/battle/test-challenge');
      await runBattleAnimation(res.data);
    } catch (err: any) {
      alert(err.response?.data?.error || '테스트 배틀 실패');
      setShowAnimation(false);
      setPhase('idle');
    } finally {
      setBattling(false);
    }
  };

  const closeBattle = () => {
    setShowAnimation(false);
    setBattleResult(null);
    setPhase('idle');
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '3px solid rgba(108,92,231,0.2)', borderTopColor: 'var(--accent)',
          animation: 'spin 1s linear infinite', margin: '0 auto 16px',
        }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>로딩중...</p>
      </div>
    </div>
  );

  const round = battleResult?.rounds[currentRound];
  const winnerIsMe = battleResult?.winnerId === user?.id;
  const meWonRound = round ? round.winnerId === user?.id : false;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* ===== 배틀 애니메이션 오버레이 ===== */}
      <AnimatePresence>
        {showAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: '#050510',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {/* 배경 — 대각선 분할 + 에너지 라인 */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              {/* 좌측 영역 (플레이어) */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(135deg, rgba(108,92,231,0.06) 0%, transparent 60%)',
                clipPath: 'polygon(0 0, 55% 0, 45% 100%, 0 100%)',
              }} />
              {/* 우측 영역 (상대) */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(225deg, rgba(239,68,68,0.06) 0%, transparent 60%)',
                clipPath: 'polygon(55% 0, 100% 0, 100% 100%, 45% 100%)',
              }} />
              {/* 중앙 에너지 라인 */}
              <motion.div
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  position: 'absolute', top: 0, bottom: 0,
                  left: '50%', width: 2, transform: 'translateX(-50%) rotate(8deg)',
                  background: 'linear-gradient(180deg, transparent, rgba(108,92,231,0.4), rgba(239,68,68,0.4), transparent)',
                }}
              />
              {/* 어비언트 파티클 */}
              {[...Array(15)].map((_, i) => (
                <motion.div key={i}
                  animate={{
                    y: [0, -30, 0],
                    opacity: [0.1, 0.4, 0.1],
                    scale: [1, 1.5, 1],
                  }}
                  transition={{ duration: 3 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 3 }}
                  style={{
                    position: 'absolute',
                    width: 3, height: 3, borderRadius: '50%',
                    background: i % 2 === 0 ? 'rgba(108,92,231,0.5)' : 'rgba(239,68,68,0.4)',
                    left: `${5 + Math.random() * 90}%`,
                    top: `${10 + Math.random() * 80}%`,
                  }}
                />
              ))}
            </div>

            {/* 셰이크 컨테이너 */}
            <motion.div
              animate={shakeControls}
              style={{
                width: '100%', height: '100%',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}
            >
              {/* 로딩 */}
              {!battleResult && (
                <div style={{ textAlign: 'center', zIndex: 10 }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{
                      width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
                      border: '3px solid rgba(108,92,231,0.15)', borderTopColor: '#6c5ce7',
                    }}
                  />
                  <p style={{ color: '#666', fontSize: 13, letterSpacing: '0.15em' }}>PREPARING...</p>
                </div>
              )}

              {battleResult && round && (
                <>
                  {/* ── 라운드 트래커 (상단) ── */}
                  <div style={{
                    position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', alignItems: 'center', gap: 8, zIndex: 20,
                  }}>
                    {[0, 1, 2].map(i => {
                      const isActive = i === currentRound && phase !== 'final-result';
                      const resolved = i < currentRound || phase === 'final-result';
                      const won = resolved ? battleResult.rounds[i].winnerId === user?.id : null;

                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <motion.div
                            animate={isActive ? {
                              boxShadow: ['0 0 0px rgba(108,92,231,0)', '0 0 16px rgba(108,92,231,0.5)', '0 0 0px rgba(108,92,231,0)'],
                            } : {}}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            style={{
                              width: 36, height: 36, borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 800,
                              background: won === true ? 'rgba(34,197,94,0.15)'
                                : won === false ? 'rgba(239,68,68,0.15)'
                                : isActive ? 'rgba(108,92,231,0.15)' : 'rgba(255,255,255,0.03)',
                              border: `2px solid ${
                                won === true ? 'rgba(34,197,94,0.6)'
                                : won === false ? 'rgba(239,68,68,0.6)'
                                : isActive ? 'rgba(108,92,231,0.6)' : 'rgba(255,255,255,0.08)'
                              }`,
                              color: won === true ? '#22c55e'
                                : won === false ? '#ef4444'
                                : isActive ? '#a29bfe' : 'rgba(255,255,255,0.2)',
                            }}
                          >
                            {won === true ? '\u2713' : won === false ? '\u2715' : i + 1}
                          </motion.div>
                          {i < 2 && (
                            <div style={{
                              width: 32, height: 2, borderRadius: 1,
                              background: resolved && i < currentRound
                                ? 'linear-gradient(90deg, #6c5ce7, #a29bfe)' : 'rgba(255,255,255,0.06)',
                            }} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── 스코어보드 ── */}
                  <div style={{
                    position: 'absolute', top: 72, left: 0, right: 0,
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 40,
                    zIndex: 20,
                  }}>
                    {/* 나 */}
                    <div style={{ textAlign: 'right', minWidth: 100 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: 'rgba(162,155,254,0.7)',
                        letterSpacing: '0.15em', marginBottom: 2,
                      }}>
                        {battleResult.challengerUsername}
                      </div>
                      <motion.div
                        key={`me-${roundScores.me}`}
                        initial={{ scale: 1.6, color: '#fff' }}
                        animate={{ scale: 1, color: '#e8e8f0' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                        style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
                      >
                        {roundScores.me}
                      </motion.div>
                    </div>

                    <div style={{
                      width: 1, height: 40,
                      background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.1), transparent)',
                    }} />

                    {/* 상대 */}
                    <div style={{ textAlign: 'left', minWidth: 100 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: 'rgba(239,68,68,0.7)',
                        letterSpacing: '0.15em', marginBottom: 2,
                      }}>
                        {battleResult.defenderUsername}
                      </div>
                      <motion.div
                        key={`opp-${roundScores.opp}`}
                        initial={{ scale: 1.6, color: '#fff' }}
                        animate={{ scale: 1, color: '#e8e8f0' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                        style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
                      >
                        {roundScores.opp}
                      </motion.div>
                    </div>
                  </div>

                  {/* ── 라운드 인트로 ── */}
                  <AnimatePresence mode="wait">
                    {phase === 'round-intro' && (
                      <motion.div
                        key={`intro-${currentRound}`}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.8, filter: 'blur(8px)' }}
                        transition={{ duration: 0.5, ease: [0.175, 0.885, 0.32, 1.275] }}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          gap: 8, zIndex: 15,
                        }}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: 60 }}
                          transition={{ delay: 0.2, duration: 0.3 }}
                          style={{ height: 2, background: 'rgba(108,92,231,0.5)', borderRadius: 1 }}
                        />
                        <div style={{
                          fontSize: 14, fontWeight: 700, color: 'rgba(162,155,254,0.6)',
                          letterSpacing: '0.3em',
                        }}>
                          ROUND
                        </div>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: [0, 1.3, 1] }}
                          transition={{ delay: 0.15, duration: 0.4, ease: [0.175, 0.885, 0.32, 1.275] }}
                          style={{
                            fontSize: 72, fontWeight: 900, lineHeight: 1,
                            background: 'linear-gradient(180deg, #fff 30%, rgba(162,155,254,0.6) 100%)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                          }}
                        >
                          {currentRound + 1}
                        </motion.div>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: 60 }}
                          transition={{ delay: 0.2, duration: 0.3 }}
                          style={{ height: 2, background: 'rgba(108,92,231,0.5)', borderRadius: 1 }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── 전투 로그 영역 (포켓몬 배틀 스타일) ── */}
                  {phase === 'battle-log' && round?.battleLog && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        width: '100%', maxWidth: 700, padding: '0 16px',
                        display: 'flex', flexDirection: 'column', gap: 0,
                        zIndex: 15, marginTop: 50,
                      }}
                    >
                      {/* ── 배틀 필드 (포켓몬 스프라이트 대결) ── */}
                      <div style={{
                        position: 'relative', width: '100%', height: isMobile ? 200 : 240,
                        borderRadius: '16px 16px 0 0',
                        background: 'linear-gradient(180deg, rgba(20,20,40,0.9) 0%, rgba(30,50,30,0.4) 60%, rgba(40,80,40,0.3) 100%)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderBottom: 'none',
                        overflow: 'hidden',
                      }}>
                        {/* 바닥 그라데이션 */}
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
                          background: 'linear-gradient(180deg, transparent, rgba(34,120,34,0.15))',
                        }} />

                        {/* ── 도전자 포켓몬 (좌측 하단, 뒷모습 느낌) ── */}
                        <motion.div
                          animate={
                            attackingActor === 'challenger'
                              ? { x: 40, y: -10, scale: 1.1 }
                              : hitActor === 'challenger'
                                ? { x: [-3, 5, -5, 3, 0], opacity: [1, 0.3, 1, 0.3, 1] }
                                : { x: 0, y: 0, scale: 1, opacity: 1 }
                          }
                          transition={
                            attackingActor === 'challenger'
                              ? { type: 'spring', stiffness: 500, damping: 15 }
                              : hitActor === 'challenger'
                                ? { duration: 0.3 }
                                : { type: 'spring', stiffness: 200, damping: 20 }
                          }
                          style={{
                            position: 'absolute',
                            left: isMobile ? '8%' : '12%',
                            bottom: isMobile ? 20 : 28,
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                          }}
                        >
                          {/* 그림자 */}
                          <div style={{
                            position: 'absolute', bottom: -6,
                            width: isMobile ? 60 : 80, height: 10,
                            borderRadius: '50%',
                            background: 'rgba(0,0,0,0.35)',
                            filter: 'blur(4px)',
                          }} />
                          <motion.img
                            src={round.challengerCard.pokemon.spriteUrl}
                            alt=""
                            animate={
                              !attackingActor && !hitActor
                                ? { y: [0, -3, 0] } : {}
                            }
                            transition={
                              !attackingActor && !hitActor
                                ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : {}
                            }
                            style={{
                              width: isMobile ? 72 : 96,
                              height: isMobile ? 72 : 96,
                              imageRendering: 'pixelated',
                              filter: hitActor === 'challenger'
                                ? 'brightness(2) drop-shadow(0 0 12px rgba(239,68,68,0.8))'
                                : attackingActor === 'challenger'
                                  ? 'drop-shadow(0 0 16px rgba(108,92,231,0.8))'
                                  : 'drop-shadow(0 0 6px rgba(108,92,231,0.3))',
                              transition: 'filter 0.15s',
                            }}
                          />
                          {/* 데미지 팝업 (도전자가 맞았을 때) */}
                          <AnimatePresence>
                            {damagePopup && damagePopup.actor === 'challenger' && (
                              <motion.div
                                key={damagePopup.key}
                                initial={{ opacity: 1, y: 0, scale: 0.5 }}
                                animate={{ opacity: 0, y: -50, scale: damagePopup.isCritical ? 1.6 : 1.2 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.7, ease: 'easeOut' }}
                                style={{
                                  position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
                                  fontSize: damagePopup.isCritical ? 22 : 16,
                                  fontWeight: 900, whiteSpace: 'nowrap',
                                  color: damagePopup.isCritical ? '#ffd700'
                                    : damagePopup.typeEffect === 'super_effective' ? '#ff4444'
                                    : damagePopup.typeEffect === 'not_effective' ? '#60a5fa' : '#fff',
                                  textShadow: '0 0 8px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.5)',
                                  pointerEvents: 'none',
                                }}
                              >
                                -{damagePopup.damage.toLocaleString()}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>

                        {/* ── 수비자 포켓몬 (우측 상단) ── */}
                        <motion.div
                          animate={
                            attackingActor === 'defender'
                              ? { x: -40, y: 10, scale: 1.1 }
                              : hitActor === 'defender'
                                ? { x: [3, -5, 5, -3, 0], opacity: [1, 0.3, 1, 0.3, 1] }
                                : { x: 0, y: 0, scale: 1, opacity: 1 }
                          }
                          transition={
                            attackingActor === 'defender'
                              ? { type: 'spring', stiffness: 500, damping: 15 }
                              : hitActor === 'defender'
                                ? { duration: 0.3 }
                                : { type: 'spring', stiffness: 200, damping: 20 }
                          }
                          style={{
                            position: 'absolute',
                            right: isMobile ? '8%' : '12%',
                            top: isMobile ? 16 : 20,
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                          }}
                        >
                          <div style={{
                            position: 'absolute', bottom: -6,
                            width: isMobile ? 50 : 65, height: 8,
                            borderRadius: '50%',
                            background: 'rgba(0,0,0,0.3)',
                            filter: 'blur(3px)',
                          }} />
                          <motion.img
                            src={round.defenderCard.pokemon.spriteUrl}
                            alt=""
                            animate={
                              !attackingActor && !hitActor
                                ? { y: [0, -3, 0] } : {}
                            }
                            transition={
                              !attackingActor && !hitActor
                                ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 } : {}
                            }
                            style={{
                              width: isMobile ? 56 : 72,
                              height: isMobile ? 56 : 72,
                              imageRendering: 'pixelated',
                              filter: hitActor === 'defender'
                                ? 'brightness(2) drop-shadow(0 0 12px rgba(239,68,68,0.8))'
                                : attackingActor === 'defender'
                                  ? 'drop-shadow(0 0 16px rgba(239,68,68,0.8))'
                                  : 'drop-shadow(0 0 6px rgba(239,68,68,0.3))',
                              transition: 'filter 0.15s',
                            }}
                          />
                          <AnimatePresence>
                            {damagePopup && damagePopup.actor === 'defender' && (
                              <motion.div
                                key={damagePopup.key}
                                initial={{ opacity: 1, y: 0, scale: 0.5 }}
                                animate={{ opacity: 0, y: -50, scale: damagePopup.isCritical ? 1.6 : 1.2 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.7, ease: 'easeOut' }}
                                style={{
                                  position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)',
                                  fontSize: damagePopup.isCritical ? 22 : 16,
                                  fontWeight: 900, whiteSpace: 'nowrap',
                                  color: damagePopup.isCritical ? '#ffd700'
                                    : damagePopup.typeEffect === 'super_effective' ? '#ff4444'
                                    : damagePopup.typeEffect === 'not_effective' ? '#60a5fa' : '#fff',
                                  textShadow: '0 0 8px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.5)',
                                  pointerEvents: 'none',
                                }}
                              >
                                -{damagePopup.damage.toLocaleString()}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>

                        {/* ── 도전자 HP 패널 (좌하단) ── */}
                        <div style={{
                          position: 'absolute', left: isMobile ? '35%' : '32%', bottom: isMobile ? 12 : 18,
                          width: isMobile ? '30%' : '28%',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#a29bfe' }}>
                              {getKoreanName(round.challengerCard.pokemon.name)}
                            </span>
                            <span style={{
                              fontSize: 8, padding: '1px 4px', borderRadius: 3,
                              background: GRADE_COLORS[round.challengerCard.grade] + '30',
                              color: GRADE_COLORS[round.challengerCard.grade],
                              fontWeight: 700,
                            }}>{round.challengerCard.grade}</span>
                          </div>
                          <div style={{
                            position: 'relative', height: 10, borderRadius: 5,
                            background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
                            overflow: 'hidden',
                          }}>
                            {(() => {
                              const currentHp = visibleLogCount > 0
                                ? (round.battleLog[Math.min(visibleLogCount, round.battleLog.length) - 1]?.remainingHp.challenger ?? round.maxHp!.challenger)
                                : round.maxHp!.challenger;
                              const ratio = currentHp / round.maxHp!.challenger;
                              const barColor = ratio > 0.5 ? '#22c55e' : ratio > 0.2 ? '#eab308' : '#ef4444';
                              return (
                                <motion.div
                                  animate={{ width: `${Math.max(0, ratio * 100)}%` }}
                                  transition={{ duration: 0.4, ease: 'easeOut' }}
                                  style={{
                                    height: '100%', borderRadius: 4,
                                    background: barColor,
                                    boxShadow: `0 0 6px ${barColor}60`,
                                  }}
                                />
                              );
                            })()}
                          </div>
                          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 2, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {(visibleLogCount > 0
                              ? Math.max(0, round.battleLog[Math.min(visibleLogCount, round.battleLog.length) - 1]?.remainingHp.challenger ?? 0)
                              : round.maxHp!.challenger
                            ).toLocaleString()} / {round.maxHp!.challenger.toLocaleString()}
                          </div>
                        </div>

                        {/* ── 수비자 HP 패널 (우상단) ── */}
                        <div style={{
                          position: 'absolute', right: isMobile ? '35%' : '32%', top: isMobile ? 12 : 18,
                          width: isMobile ? '30%' : '28%',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3, justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#ff6b6b' }}>
                              {getKoreanName(round.defenderCard.pokemon.name)}
                            </span>
                            <span style={{
                              fontSize: 8, padding: '1px 4px', borderRadius: 3,
                              background: GRADE_COLORS[round.defenderCard.grade] + '30',
                              color: GRADE_COLORS[round.defenderCard.grade],
                              fontWeight: 700,
                            }}>{round.defenderCard.grade}</span>
                          </div>
                          <div style={{
                            position: 'relative', height: 10, borderRadius: 5,
                            background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)',
                            overflow: 'hidden',
                          }}>
                            {(() => {
                              const currentHp = visibleLogCount > 0
                                ? (round.battleLog[Math.min(visibleLogCount, round.battleLog.length) - 1]?.remainingHp.defender ?? round.maxHp!.defender)
                                : round.maxHp!.defender;
                              const ratio = currentHp / round.maxHp!.defender;
                              const barColor = ratio > 0.5 ? '#22c55e' : ratio > 0.2 ? '#eab308' : '#ef4444';
                              return (
                                <motion.div
                                  animate={{ width: `${Math.max(0, ratio * 100)}%` }}
                                  transition={{ duration: 0.4, ease: 'easeOut' }}
                                  style={{
                                    height: '100%', borderRadius: 4,
                                    background: barColor,
                                    boxShadow: `0 0 6px ${barColor}60`,
                                  }}
                                />
                              );
                            })()}
                          </div>
                          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 2, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {(visibleLogCount > 0
                              ? Math.max(0, round.battleLog[Math.min(visibleLogCount, round.battleLog.length) - 1]?.remainingHp.defender ?? 0)
                              : round.maxHp!.defender
                            ).toLocaleString()} / {round.maxHp!.defender.toLocaleString()}
                          </div>
                        </div>

                        {/* 타입 상성 표시 */}
                        {round.typeMultipliers && (round.typeMultipliers.challenger !== 1 || round.typeMultipliers.defender !== 1) && (
                          <div style={{
                            position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)',
                            display: 'flex', gap: 8, fontSize: 9, fontWeight: 600,
                          }}>
                            {round.typeMultipliers.challenger > 1 && (
                              <span style={{ color: '#a29bfe', background: 'rgba(108,92,231,0.15)', padding: '2px 6px', borderRadius: 4 }}>
                                {getKoreanName(round.challengerCard.pokemon.name)} 효과발군!
                              </span>
                            )}
                            {round.typeMultipliers.defender > 1 && (
                              <span style={{ color: '#ff6b6b', background: 'rgba(239,68,68,0.15)', padding: '2px 6px', borderRadius: 4 }}>
                                {getKoreanName(round.defenderCard.pokemon.name)} 효과발군!
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── 전투 로그 텍스트 (하단 메시지 박스) ── */}
                      <div style={{
                        maxHeight: 130, overflowY: 'auto', padding: '10px 14px',
                        borderRadius: '0 0 16px 16px',
                        background: 'rgba(0,0,0,0.6)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderTop: '2px solid rgba(255,255,255,0.08)',
                        display: 'flex', flexDirection: 'column', gap: 3,
                      }}
                        ref={el => { if (el) el.scrollTop = el.scrollHeight; }}
                      >
                        {round.battleLog.slice(0, visibleLogCount).map((entry, idx) => {
                          const isChallenger = entry.actor === 'challenger';
                          const color = isChallenger ? '#a29bfe' : '#ff6b6b';
                          const pokemonName = isChallenger
                            ? getKoreanName(round.challengerCard.pokemon.name)
                            : getKoreanName(round.defenderCard.pokemon.name);

                          return (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: idx === visibleLogCount - 1 ? 1 : 0.5, y: 0 }}
                              transition={{ duration: 0.15 }}
                              style={{
                                fontSize: 11, lineHeight: 1.5,
                                padding: '2px 0',
                              }}
                            >
                              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, marginRight: 6, fontVariantNumeric: 'tabular-nums' }}>
                                {(entry.timestamp / 1000).toFixed(1)}s
                              </span>
                              <span style={{ color, fontWeight: 700 }}>{pokemonName}</span>
                              <span style={{ color: 'rgba(255,255,255,0.6)' }}>의 </span>
                              <span style={{
                                color: entry.isCritical ? '#ffd700' : entry.typeEffect === 'super_effective' ? '#ef4444' : 'rgba(255,255,255,0.9)',
                                fontWeight: entry.isCritical || entry.typeEffect === 'super_effective' ? 700 : 400,
                              }}>
                                {entry.skillName}!
                              </span>
                              <span style={{ color: 'rgba(255,255,255,0.5)' }}> → </span>
                              <span style={{
                                fontWeight: 700,
                                color: entry.isCritical ? '#ffd700' : entry.damage >= 200 ? '#ff4444' : '#e0e0e0',
                              }}>
                                {entry.damage.toLocaleString()}
                              </span>
                              <span style={{ color: 'rgba(255,255,255,0.4)' }}> 데미지</span>
                              {entry.isCritical && <span style={{ color: '#ffd700', marginLeft: 4, fontSize: 10 }}>크리티컬!</span>}
                              {entry.typeEffect === 'super_effective' && <span style={{ color: '#ef4444', marginLeft: 4, fontSize: 10 }}>효과발군!</span>}
                              {entry.typeEffect === 'not_effective' && <span style={{ color: '#60a5fa', marginLeft: 4, fontSize: 10 }}>효과미미</span>}
                            </motion.div>
                          );
                        })}

                        {visibleLogCount >= round.battleLog.length && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            style={{
                              textAlign: 'center', padding: '6px 0', marginTop: 4,
                              fontSize: 13, fontWeight: 800, letterSpacing: '0.05em',
                              color: round.winnerId === user?.id ? '#22c55e' : '#ef4444',
                              borderTop: '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            {(() => {
                              const winnerName = round.winnerId === user?.id
                                ? getKoreanName(round.challengerCard.pokemon.name)
                                : getKoreanName(round.defenderCard.pokemon.name);
                              const loserName = round.winnerId === user?.id
                                ? getKoreanName(round.defenderCard.pokemon.name)
                                : getKoreanName(round.challengerCard.pokemon.name);
                              return `${loserName}(은)는 쓰러졌다! ${winnerName} 승리!`;
                            })()}
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* ── 카드 대결 영역 ── */}
                  {phase !== 'round-intro' && phase !== 'final-result' && phase !== 'battle-log' && (
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '100%', position: 'relative', height: 380,
                      marginTop: 20,
                    }}>
                      {/* 왼쪽 카드 (나) */}
                      <motion.div
                        key={`left-${currentRound}`}
                        initial={{ x: -500, opacity: 0, rotateZ: -20, scale: 0.8 }}
                        animate={
                          phase === 'entrance' ? { x: -130, opacity: 1, rotateZ: 0, scale: 1 }
                          : phase === 'clash' ? { x: -15, opacity: 1, rotateZ: 5, scale: 1.05 }
                          : phase === 'impact' ? { x: -80, opacity: 1, rotateZ: -2, scale: 1 }
                          : phase === 'round-result'
                            ? meWonRound
                              ? { x: -130, y: -10, opacity: 1, rotateZ: 0, scale: 1.08 }
                              : { x: -130, y: 10, opacity: 0.4, rotateZ: -3, scale: 0.92 }
                            : { x: -130, opacity: 1, rotateZ: 0, scale: 1 }
                        }
                        transition={
                          phase === 'entrance'
                            ? { type: 'spring', stiffness: 120, damping: 14 }
                            : phase === 'clash'
                              ? { type: 'spring', stiffness: 400, damping: 20 }
                              : phase === 'round-result'
                                ? { type: 'spring', stiffness: 200, damping: 15, delay: 0.15 }
                                : { duration: 0.25 }
                        }
                        style={{
                          position: 'absolute', textAlign: 'center', zIndex: 2,
                          filter: phase === 'round-result' && meWonRound
                            ? 'drop-shadow(0 0 24px rgba(108,92,231,0.6))' : 'none',
                          transition: 'filter 0.4s',
                        }}
                      >
                        <PokemonCard
                          name={round.challengerCard.pokemon.name}
                          artworkUrl={round.challengerCard.pokemon.artworkUrl}
                          grade={round.challengerCard.grade}
                          level={round.challengerCard.level}
                          size="small"
                          enableTilt={false}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 }}
                          style={{
                            marginTop: 10, fontSize: 10, fontWeight: 600,
                            color: 'rgba(162,155,254,0.6)', letterSpacing: '0.08em',
                            display: 'flex', gap: 8, justifyContent: 'center',
                          }}
                        >
                          <span>ATK {round.challengerCard.atk}</span>
                          <span style={{ opacity: 0.3 }}>/</span>
                          <span>DEF {round.challengerCard.def}</span>
                          <span style={{ opacity: 0.3 }}>/</span>
                          <span>HP {round.challengerCard.hp}</span>
                        </motion.div>

                        {/* 승리 글로우 이펙트 */}
                        {phase === 'round-result' && meWonRound && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: [0, 0.6, 0], scale: [0.5, 1.5, 2] }}
                            transition={{ duration: 1.2 }}
                            style={{
                              position: 'absolute', top: '50%', left: '50%',
                              transform: 'translate(-50%, -50%)',
                              width: 200, height: 200, borderRadius: '50%',
                              background: 'radial-gradient(circle, rgba(108,92,231,0.3) 0%, transparent 70%)',
                              pointerEvents: 'none', zIndex: -1,
                            }}
                          />
                        )}
                      </motion.div>

                      {/* 중앙 충돌 이펙트 */}
                      <AnimatePresence>
                        {phase === 'clash' && (
                          <motion.div
                            key="clash-fx"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0.8] }}
                            exit={{ scale: 2, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            style={{
                              position: 'absolute', zIndex: 10,
                              width: 80, height: 80,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            {/* 에너지 링 */}
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 0.6, ease: 'linear' }}
                              style={{
                                width: 80, height: 80, borderRadius: '50%',
                                border: '2px solid rgba(255,200,50,0.4)',
                                position: 'absolute',
                              }}
                            />
                            <motion.div
                              animate={{ rotate: -360 }}
                              transition={{ duration: 0.8, ease: 'linear' }}
                              style={{
                                width: 60, height: 60, borderRadius: '50%',
                                border: '1px solid rgba(255,255,255,0.2)',
                                position: 'absolute',
                              }}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* 충돌 스파크 파티클 */}
                      <AnimatePresence>
                        {phase === 'impact' && sparks.map(s => (
                          <motion.div
                            key={`spark-${s.id}`}
                            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                            animate={{ opacity: 0, x: s.tx, y: s.ty, scale: 0 }}
                            transition={{ duration: s.duration, delay: s.delay, ease: 'easeOut' }}
                            style={{
                              position: 'absolute', zIndex: 12,
                              width: s.size, height: s.size, borderRadius: '50%',
                              background: '#fff',
                              boxShadow: `0 0 ${s.size * 2}px rgba(255,200,80,0.8)`,
                            }}
                          />
                        ))}
                      </AnimatePresence>

                      {/* 충돌 플래시 */}
                      {phase === 'impact' && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 0.6, 0] }}
                          transition={{ duration: 0.35 }}
                          style={{
                            position: 'absolute', inset: 0, zIndex: 11, pointerEvents: 'none',
                            background: 'radial-gradient(circle at 50% 50%, rgba(255,220,100,0.4) 0%, transparent 45%)',
                          }}
                        />
                      )}

                      {/* 오른쪽 카드 (상대) */}
                      <motion.div
                        key={`right-${currentRound}`}
                        initial={{ x: 500, opacity: 0, rotateZ: 20, scale: 0.8 }}
                        animate={
                          phase === 'entrance' ? { x: 130, opacity: 1, rotateZ: 0, scale: 1 }
                          : phase === 'clash' ? { x: 15, opacity: 1, rotateZ: -5, scale: 1.05 }
                          : phase === 'impact' ? { x: 80, opacity: 1, rotateZ: 2, scale: 1 }
                          : phase === 'round-result'
                            ? !meWonRound
                              ? { x: 130, y: -10, opacity: 1, rotateZ: 0, scale: 1.08 }
                              : { x: 130, y: 10, opacity: 0.4, rotateZ: 3, scale: 0.92 }
                            : { x: 130, opacity: 1, rotateZ: 0, scale: 1 }
                        }
                        transition={
                          phase === 'entrance'
                            ? { type: 'spring', stiffness: 120, damping: 14 }
                            : phase === 'clash'
                              ? { type: 'spring', stiffness: 400, damping: 20 }
                              : phase === 'round-result'
                                ? { type: 'spring', stiffness: 200, damping: 15, delay: 0.15 }
                                : { duration: 0.25 }
                        }
                        style={{
                          position: 'absolute', textAlign: 'center', zIndex: 2,
                          filter: phase === 'round-result' && !meWonRound
                            ? 'drop-shadow(0 0 24px rgba(239,68,68,0.6))' : 'none',
                          transition: 'filter 0.4s',
                        }}
                      >
                        <PokemonCard
                          name={round.defenderCard.pokemon.name}
                          artworkUrl={round.defenderCard.pokemon.artworkUrl}
                          grade={round.defenderCard.grade}
                          level={round.defenderCard.level}
                          size="small"
                          enableTilt={false}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 }}
                          style={{
                            marginTop: 10, fontSize: 10, fontWeight: 600,
                            color: 'rgba(239,68,68,0.6)', letterSpacing: '0.08em',
                            display: 'flex', gap: 8, justifyContent: 'center',
                          }}
                        >
                          <span>ATK {round.defenderCard.atk}</span>
                          <span style={{ opacity: 0.3 }}>/</span>
                          <span>DEF {round.defenderCard.def}</span>
                          <span style={{ opacity: 0.3 }}>/</span>
                          <span>HP {round.defenderCard.hp}</span>
                        </motion.div>

                        {/* 승리 글로우 이펙트 */}
                        {phase === 'round-result' && !meWonRound && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: [0, 0.6, 0], scale: [0.5, 1.5, 2] }}
                            transition={{ duration: 1.2 }}
                            style={{
                              position: 'absolute', top: '50%', left: '50%',
                              transform: 'translate(-50%, -50%)',
                              width: 200, height: 200, borderRadius: '50%',
                              background: 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, transparent 70%)',
                              pointerEvents: 'none', zIndex: -1,
                            }}
                          />
                        )}
                      </motion.div>

                      {/* 라운드 결과 — 하단 표시 */}
                      <AnimatePresence>
                        {phase === 'round-result' && (
                          <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
                            style={{
                              position: 'absolute', bottom: 20, zIndex: 20,
                              display: 'flex', alignItems: 'center', gap: 12,
                            }}
                          >
                            {/* 승리 카드쪽 이름 강조 */}
                            <div style={{
                              padding: '8px 24px', borderRadius: 20,
                              background: meWonRound
                                ? 'linear-gradient(135deg, rgba(108,92,231,0.2), rgba(162,155,254,0.1))'
                                : 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(255,107,107,0.1))',
                              border: `1px solid ${meWonRound ? 'rgba(108,92,231,0.3)' : 'rgba(239,68,68,0.3)'}`,
                              display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                              <motion.div
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 0.6 }}
                                style={{
                                  width: 8, height: 8, borderRadius: '50%',
                                  background: meWonRound ? '#a29bfe' : '#ef4444',
                                  boxShadow: `0 0 10px ${meWonRound ? '#a29bfe' : '#ef4444'}`,
                                }}
                              />
                              <span style={{
                                fontSize: 13, fontWeight: 700,
                                color: meWonRound ? '#a29bfe' : '#ff6b6b',
                              }}>
                                {meWonRound ? battleResult.challengerUsername : battleResult.defenderUsername}
                              </span>
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                                라운드 {currentRound + 1} 선취
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* ── 최종 결과 ── */}
                  <AnimatePresence>
                    {phase === 'final-result' && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{
                          position: 'absolute', inset: 0, zIndex: 30,
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {/* 시네마틱 레터박스 */}
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 60 }}
                          transition={{ duration: 0.4 }}
                          style={{
                            position: 'absolute', top: 0, left: 0, right: 0,
                            background: '#000', zIndex: 31,
                          }}
                        />
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: 60 }}
                          transition={{ duration: 0.4 }}
                          style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            background: '#000', zIndex: 31,
                          }}
                        />

                        {/* 배경 블러 */}
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3 }}
                          style={{
                            position: 'absolute', inset: 0, zIndex: 30,
                            background: winnerIsMe
                              ? 'radial-gradient(ellipse at 50% 40%, rgba(108,92,231,0.12) 0%, rgba(5,5,16,0.95) 60%)'
                              : 'radial-gradient(ellipse at 50% 40%, rgba(239,68,68,0.08) 0%, rgba(5,5,16,0.95) 60%)',
                          }}
                        />

                        <div style={{
                          zIndex: 32, display: 'flex', flexDirection: 'column',
                          alignItems: 'center', gap: 24,
                        }}>
                          {/* 라운드 리플레이 요약 (카드 미니 카드 포함) */}
                          <motion.div
                            initial={{ y: -30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            style={{ display: 'flex', gap: 20, alignItems: 'center' }}
                          >
                            {battleResult.rounds.map((r, i) => {
                              const won = r.winnerId === user?.id;
                              return (
                                <motion.div
                                  key={i}
                                  initial={{ scale: 0, rotateZ: 10 }}
                                  animate={{ scale: 1, rotateZ: 0 }}
                                  transition={{ delay: 0.5 + i * 0.12, type: 'spring', stiffness: 300, damping: 18 }}
                                  style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                    padding: '12px 14px', borderRadius: 14,
                                    background: won ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                                    border: `1px solid ${won ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
                                  }}
                                >
                                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.1em' }}>
                                    R{i + 1}
                                  </div>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <img
                                      src={r.challengerCard.pokemon.artworkUrl}
                                      alt=""
                                      style={{
                                        width: 28, height: 28, objectFit: 'contain',
                                        opacity: won ? 1 : 0.4,
                                        filter: won ? 'none' : 'grayscale(0.8)',
                                      }}
                                    />
                                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>vs</span>
                                    <img
                                      src={r.defenderCard.pokemon.artworkUrl}
                                      alt=""
                                      style={{
                                        width: 28, height: 28, objectFit: 'contain',
                                        opacity: !won ? 1 : 0.4,
                                        filter: !won ? 'none' : 'grayscale(0.8)',
                                      }}
                                    />
                                  </div>
                                  <div style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: won ? '#22c55e' : '#ef4444',
                                    boxShadow: `0 0 8px ${won ? '#22c55e' : '#ef4444'}`,
                                  }} />
                                </motion.div>
                              );
                            })}
                          </motion.div>

                          {/* 결과 타이틀 */}
                          <motion.div
                            initial={{ scale: 0.3, opacity: 0, filter: 'blur(12px)' }}
                            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
                            transition={{ delay: 0.8, type: 'spring', stiffness: 200, damping: 12 }}
                            style={{ textAlign: 'center' }}
                          >
                            {winnerIsMe ? (
                              <>
                                <div style={{
                                  fontSize: 56, fontWeight: 900, letterSpacing: '0.12em', lineHeight: 1,
                                  background: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 40%, #ffd700 80%)',
                                  backgroundSize: '200% 200%',
                                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                  animation: 'shimmer 2s ease infinite',
                                  filter: 'drop-shadow(0 0 20px rgba(255,200,50,0.3))',
                                }}>
                                  승리
                                </div>
                                {/* 빅토리 파티클 */}
                                <div style={{ position: 'relative', width: 0, height: 0, margin: '0 auto' }}>
                                  {[...Array(12)].map((_, i) => (
                                    <motion.div
                                      key={i}
                                      initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                                      animate={{
                                        opacity: 0,
                                        x: (Math.random() - 0.5) * 300,
                                        y: -50 - Math.random() * 150,
                                        scale: 0,
                                      }}
                                      transition={{ duration: 1 + Math.random() * 0.5, delay: 0.9 + Math.random() * 0.3 }}
                                      style={{
                                        position: 'absolute',
                                        width: 4 + Math.random() * 4, height: 4 + Math.random() * 4,
                                        borderRadius: '50%',
                                        background: ['#ffd700', '#ff8c00', '#fff', '#a29bfe'][Math.floor(Math.random() * 4)],
                                        boxShadow: '0 0 6px rgba(255,200,80,0.6)',
                                      }}
                                    />
                                  ))}
                                </div>
                              </>
                            ) : (
                              <div style={{
                                fontSize: 56, fontWeight: 900, letterSpacing: '0.12em', lineHeight: 1,
                                color: '#444',
                                filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5))',
                              }}>
                                패배
                              </div>
                            )}
                          </motion.div>

                          {/* 스코어 */}
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.1 }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 16,
                              fontSize: 28, fontWeight: 900,
                            }}
                          >
                            <span style={{ color: '#a29bfe' }}>{roundScores.me}</span>
                            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.15)' }}>-</span>
                            <span style={{ color: '#ef4444' }}>{roundScores.opp}</span>
                          </motion.div>

                          {/* 보상 */}
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.3 }}
                            style={{
                              fontSize: 12, color: '#666',
                              padding: '6px 16px', borderRadius: 8,
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            {battleResult.isTest
                              ? '연습 대전 — 보상 없음'
                              : winnerIsMe
                                ? '뽑기권 +10 / 랭킹 +10'
                                : '뽑기권 -10'}
                          </motion.div>

                          {/* 닫기 */}
                          <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.5 }}
                            onClick={closeBattle}
                            whileHover={{ scale: 1.05, boxShadow: '0 6px 24px rgba(108,92,231,0.5)' }}
                            whileTap={{ scale: 0.97 }}
                            style={{
                              padding: '12px 44px', borderRadius: 12,
                              background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
                              color: '#fff', fontSize: 14, fontWeight: 700,
                              border: 'none', cursor: 'pointer',
                              boxShadow: '0 4px 20px rgba(108,92,231,0.3)',
                            }}
                          >
                            돌아가기
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== 덱 편집 모달 ===== */}
      <AnimatePresence>
        {editingDeck && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(6,6,18,0.95)', backdropFilter: 'blur(8px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '24px 16px', overflowY: 'auto',
            }}
          >
            <div style={{ maxWidth: 800, width: '100%' }}>
              {/* 헤더 */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 24, paddingBottom: 16,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div>
                  <h3 style={{
                    fontSize: 22, fontWeight: 900, color: '#e8e8f0', margin: 0,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                      background: editingDeck === 'attack' ? '#ef4444' : '#3b82f6',
                      boxShadow: `0 0 10px ${editingDeck === 'attack' ? '#ef4444' : '#3b82f6'}`,
                    }} />
                    {editingDeck === 'attack' ? '공격덱' : '방어덱'} 편집
                  </h3>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#8888a0' }}>
                    카드 {selectedIds.length}장 / 3장 선택됨
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setEditingDeck(null)}
                    style={{
                      padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                      background: 'rgba(255,255,255,0.06)', color: '#8888a0',
                      border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                    }}>
                    취소
                  </button>
                  <button
                    disabled={selectedIds.length !== 3 || saving}
                    onClick={saveDeck}
                    style={{
                      padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                      background: selectedIds.length === 3
                        ? 'linear-gradient(135deg, #6c5ce7, #a29bfe)' : 'rgba(255,255,255,0.06)',
                      color: selectedIds.length === 3 ? '#fff' : '#555',
                      border: 'none', cursor: selectedIds.length === 3 ? 'pointer' : 'not-allowed',
                      boxShadow: selectedIds.length === 3 ? '0 4px 15px rgba(108,92,231,0.3)' : 'none',
                    }}>
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>

              {/* 선택된 3장 슬롯 */}
              <div style={{
                display: 'flex', gap: 16, justifyContent: 'center',
                marginBottom: 28, padding: 20,
                background: 'rgba(255,255,255,0.02)', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
                {[0, 1, 2].map(i => {
                  const card = myCards.find(c => c.id === selectedIds[i]);
                  const deckColor = editingDeck === 'attack' ? '#ef4444' : '#3b82f6';
                  return (
                    <motion.div
                      key={i}
                      layout
                      style={{
                        width: 110, height: 150, borderRadius: 12,
                        border: card ? `2px solid ${deckColor}` : '2px dashed rgba(255,255,255,0.1)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        background: card ? `rgba(${editingDeck === 'attack' ? '239,68,68' : '59,130,246'},0.08)` : 'rgba(255,255,255,0.02)',
                        position: 'relative', overflow: 'hidden',
                      }}
                    >
                      {card ? (
                        <>
                          <img src={card.pokemon.artworkUrl} alt={getKoreanName(card.pokemon.name)}
                            style={{ width: 64, height: 64, objectFit: 'contain' }} />
                          <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: '#e8e8f0' }}>
                            {getKoreanName(card.pokemon.name)}
                          </div>
                          <div style={{ fontSize: 10, marginTop: 2 }}>
                            <span style={{ color: GRADE_COLORS[card.grade], fontWeight: 700 }}>{card.grade}</span>
                            <span style={{ color: '#8888a0', marginLeft: 4 }}>{card.atk + card.def + card.hp}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            border: '2px dashed rgba(255,255,255,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: 6,
                          }}>
                            <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.15)' }}>+</span>
                          </div>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>슬롯 {i + 1}</span>
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* 카드 목록 */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 10,
              }}>
                {myCards
                  .sort((a, b) => (b.atk + b.def + b.hp) - (a.atk + a.def + a.hp))
                  .map(card => {
                    const isSelected = selectedIds.includes(card.id);
                    const otherDeck = editingDeck === 'attack' ? defenseDeck : attackDeck;
                    const inOtherDeck = otherDeck.some(s => s.cardId === card.id);

                    return (
                      <motion.div
                        key={card.id}
                        whileHover={!inOtherDeck ? { scale: 1.03 } : {}}
                        whileTap={!inOtherDeck ? { scale: 0.97 } : {}}
                        onClick={() => !inOtherDeck && toggleCardSelect(card.id)}
                        style={{
                          padding: 8, borderRadius: 12,
                          cursor: inOtherDeck ? 'not-allowed' : 'pointer',
                          border: isSelected ? '2px solid var(--accent)' : '2px solid rgba(255,255,255,0.04)',
                          background: isSelected ? 'rgba(108,92,231,0.1)' : 'rgba(255,255,255,0.02)',
                          opacity: inOtherDeck ? 0.25 : 1,
                          transition: 'border-color 0.2s, background 0.2s',
                          position: 'relative',
                        }}
                      >
                        {isSelected && (
                          <div style={{
                            position: 'absolute', top: 6, right: 6, zIndex: 5,
                            width: 20, height: 20, borderRadius: '50%',
                            background: 'var(--accent)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: '#fff',
                          }}>
                            {selectedIds.indexOf(card.id) + 1}
                          </div>
                        )}
                        <PokemonCard
                          name={card.pokemon.name}
                          artworkUrl={card.pokemon.artworkUrl}
                          grade={card.grade}
                          level={card.level}
                          size="small"
                          enableTilt={false}
                        />
                        <div style={{
                          textAlign: 'center', fontSize: 10, marginTop: 4,
                          color: '#8888a0', fontWeight: 500,
                        }}>
                          {card.atk + card.def + card.hp}
                          {inOtherDeck && <span style={{ color: '#ef4444', marginLeft: 4 }}>사용중</span>}
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== 헤더 ===== */}
      <div style={{
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? 12 : 0, marginBottom: isMobile ? 16 : 28,
      }}>
        <div>
          <h2 style={{
            fontSize: isMobile ? 20 : 26, fontWeight: 900, margin: 0, letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #e8e8f0, #a29bfe)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            배틀 아레나
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#8888a0' }}>
            3라운드 Best of 3
          </p>
        </div>
        <div style={{
          display: 'flex', gap: 4, padding: 4, borderRadius: 12,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          {(['deck', 'battle', 'history'] as const).map(t => (
            <button key={t}
              onClick={() => { setTab(t); if (t === 'history') loadHistory(); }}
              style={{
                padding: isMobile ? '8px 12px' : '8px 18px', borderRadius: 8,
                fontSize: 13, fontWeight: 600, flex: isMobile ? 1 : undefined,
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? '#fff' : '#8888a0',
                boxShadow: tab === t ? '0 2px 10px rgba(108,92,231,0.3)' : 'none',
              }}>
              {t === 'deck' ? '덱 편성' : t === 'battle' ? '대전' : '기록'}
            </button>
          ))}
        </div>
      </div>

      {/* ===== 덱 편성 탭 ===== */}
      {tab === 'deck' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {myCards.length < 6 && (
            <div style={{
              background: 'rgba(245,158,11,0.08)', borderRadius: 12,
              padding: '14px 18px', border: '1px solid rgba(245,158,11,0.2)',
              fontSize: 13, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>!</span>
              카드가 최소 6장 필요합니다 (공격 3장 + 방어 3장). 현재 {myCards.length}장 보유 중.
            </div>
          )}

          <div style={{
            display: 'flex', gap: 8, padding: '12px 16px', borderRadius: 12,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: deckReady ? '#22c55e' : '#ef4444',
                boxShadow: `0 0 8px ${deckReady ? '#22c55e' : '#ef4444'}`,
              }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: deckReady ? '#22c55e' : '#ef4444' }}>
                {deckReady ? '전투 준비 완료' : '덱 설정 필요'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#8888a0' }}>
              공격 {attackDeck.length}/3 | 방어 {defenseDeck.length}/3
            </div>
          </div>

          <DeckSection title="공격덱" subtitle="상대 방어덱과 대결합니다" color="#ef4444"
            deck={attackDeck} onEdit={() => startEditDeck('attack')} disabled={myCards.length < 3} />
          <DeckSection title="방어덱" subtitle="다른 플레이어의 공격을 방어합니다" color="#3b82f6"
            deck={defenseDeck} onEdit={() => startEditDeck('defense')} disabled={myCards.length < 3} />
        </div>
      )}

      {/* ===== 대전 탭 ===== */}
      {tab === 'battle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!deckReady && (
            <div style={{
              background: 'rgba(239,68,68,0.08)', borderRadius: 12,
              padding: '14px 18px', border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>!</span>
              덱 편성을 먼저 완료해주세요 (공격 3장 + 방어 3장)
            </div>
          )}

          <div style={{
            background: 'linear-gradient(135deg, rgba(108,92,231,0.08) 0%, rgba(162,155,254,0.04) 100%)',
            borderRadius: 16, padding: 20,
            border: '1px solid rgba(108,92,231,0.15)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -20, right: -20,
              width: 100, height: 100, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(108,92,231,0.1) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{
                  fontSize: 16, fontWeight: 800, color: '#e8e8f0', margin: '0 0 6px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, borderRadius: 6,
                    background: 'rgba(108,92,231,0.2)', fontSize: 12,
                  }}>
                    NPC
                  </span>
                  연습 대전
                </h3>
                <p style={{ fontSize: 12, color: '#8888a0', margin: 0 }}>
                  NPC 트레이너와 3라운드 연습. 보상 없이 무한 도전
                </p>
              </div>
              <button
                disabled={!deckReady || battling}
                onClick={testChallenge}
                style={{
                  padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: deckReady && !battling
                    ? 'linear-gradient(135deg, #6c5ce7, #a29bfe)' : 'rgba(255,255,255,0.05)',
                  color: deckReady && !battling ? '#fff' : '#555',
                  border: 'none', cursor: deckReady && !battling ? 'pointer' : 'not-allowed',
                  whiteSpace: 'nowrap',
                  boxShadow: deckReady && !battling ? '0 4px 15px rgba(108,92,231,0.25)' : 'none',
                  transition: 'all 0.2s',
                }}>
                {!deckReady ? '덱 미완성' : battling ? '대전 중...' : '연습 시작'}
              </button>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e8e8f0', margin: '0 0 12px' }}>
              도전 가능한 트레이너
            </h3>
            {opponents.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: 48,
                background: 'rgba(255,255,255,0.02)', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <p style={{ color: '#8888a0', fontSize: 14 }}>대전 가능한 상대가 없습니다</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {opponents.map((opp, idx) => {
                  const noTicket = (user?.pullTickets || 0) < 10;
                  const isDisabled = !deckReady || !opp.canChallenge || battling || noTicket;
                  const reason = !deckReady ? '덱 미완성'
                    : opp.battledToday ? '오늘 도전 완료'
                    : !opp.hasDefenseDeck ? '방어덱 없음'
                    : noTicket ? '티켓 부족'
                    : '도전';

                  return (
                    <motion.div key={opp.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '16px 20px', borderRadius: 14,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        transition: 'border-color 0.2s, background 0.2s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'rgba(108,92,231,0.2)';
                        e.currentTarget.style.background = 'rgba(108,92,231,0.04)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: 700, fontSize: 15, color: '#e8e8f0',
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          {opp.username}
                          {opp.rankingScore > 0 && (
                            <span style={{
                              fontSize: 11, fontWeight: 600, color: '#a29bfe',
                              padding: '2px 8px', borderRadius: 6,
                              background: 'rgba(108,92,231,0.1)',
                            }}>
                              {opp.rankingScore}pt
                            </span>
                          )}
                        </div>
                        <div style={{
                          fontSize: 12, color: '#8888a0', marginTop: 4,
                          display: 'flex', alignItems: 'center', gap: 12,
                        }}>
                          <span>카드 {opp.totalCards}장</span>
                          {opp.bestGrade && (
                            <span>
                              최고 <span style={{ color: GRADE_COLORS[opp.bestGrade] || '#888', fontWeight: 700 }}>{opp.bestGrade}</span>
                            </span>
                          )}
                          {!opp.hasDefenseDeck && (
                            <span style={{ color: '#ef4444' }}>방어덱 없음</span>
                          )}
                        </div>
                      </div>
                      <button
                        disabled={isDisabled}
                        onClick={() => challenge(opp.id)}
                        style={{
                          padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                          background: !isDisabled
                            ? 'linear-gradient(135deg, #ef4444, #ff6b6b)' : 'rgba(255,255,255,0.04)',
                          color: !isDisabled ? '#fff' : '#555',
                          border: 'none', cursor: !isDisabled ? 'pointer' : 'not-allowed',
                          boxShadow: !isDisabled ? '0 4px 12px rgba(239,68,68,0.2)' : 'none',
                          transition: 'all 0.2s',
                        }}>
                        {reason}
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== 기록 탭 ===== */}
      {tab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {history.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 48,
              background: 'rgba(255,255,255,0.02)', borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.05)',
            }}>
              <p style={{ color: '#8888a0', fontSize: 14 }}>전투 기록이 없습니다</p>
            </div>
          ) : (
            history.map((b: any, idx: number) => {
              const won = b.winnerId === user?.id;
              return (
                <motion.div key={b.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '14px 18px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, marginRight: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: won ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    border: `1px solid ${won ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    fontSize: 13, fontWeight: 800,
                    color: won ? '#22c55e' : '#ef4444',
                  }}>
                    {won ? '\u2713' : '\u2715'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0' }}>
                      <span>{b.challengerUsername}</span>
                      <span style={{ color: '#555', margin: '0 8px', fontSize: 11 }}>VS</span>
                      <span>{b.defenderUsername}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#666', marginTop: 3 }}>
                      {b.battleDate}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 12, fontWeight: 700,
                    color: won ? '#22c55e' : '#ef4444',
                    padding: '4px 12px', borderRadius: 8,
                    background: won ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  }}>
                    {won ? '승리' : '패배'}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}

/* ===== 덱 섹션 컴포넌트 ===== */
function DeckSection({ title, subtitle, color, deck, onEdit, disabled }: {
  title: string;
  subtitle: string;
  color: string;
  deck: DeckSlot[];
  onEdit: () => void;
  disabled: boolean;
}) {
  const isReady = deck.length === 3;

  return (
    <div style={{
      borderRadius: 16, padding: 24, position: 'relative', overflow: 'hidden',
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${isReady ? `${color}20` : 'rgba(255,255,255,0.05)'}`,
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: isReady
          ? `linear-gradient(90deg, transparent, ${color}, transparent)` : 'transparent',
        opacity: 0.5,
      }} />

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20,
      }}>
        <div>
          <h3 style={{
            fontSize: 17, fontWeight: 800, color: '#e8e8f0', margin: 0,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: color, boxShadow: `0 0 8px ${color}`,
              display: 'inline-block',
            }} />
            {title}
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 10px',
              borderRadius: 6,
              background: isReady ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: isReady ? '#22c55e' : '#ef4444',
            }}>
              {isReady ? '준비 완료' : '미설정'}
            </span>
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#8888a0' }}>{subtitle}</p>
        </div>
        <button
          onClick={onEdit}
          disabled={disabled}
          style={{
            padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: 'rgba(255,255,255,0.05)', color: '#a29bfe',
            border: '1px solid rgba(108,92,231,0.2)', cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            if (!disabled) {
              e.currentTarget.style.background = 'rgba(108,92,231,0.15)';
              e.currentTarget.style.borderColor = 'rgba(108,92,231,0.4)';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.borderColor = 'rgba(108,92,231,0.2)';
          }}
        >
          편집
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
        {isReady ? deck.map((slot, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            style={{ textAlign: 'center' }}
          >
            <div style={{
              fontSize: 10, fontWeight: 600, color: '#8888a0',
              marginBottom: 6, letterSpacing: '0.05em',
            }}>
              SLOT {i + 1}
            </div>
            <div style={{
              padding: 4, borderRadius: 12,
              background: `${color}10`,
              border: `1px solid ${color}20`,
            }}>
              <PokemonCard
                name={slot.pokemon.name}
                artworkUrl={slot.pokemon.artworkUrl}
                grade={slot.grade}
                level={slot.level}
                size="small"
                enableTilt={false}
              />
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: '#8888a0' }}>
              {slot.atk + slot.def + slot.hp}
            </div>
          </motion.div>
        )) : (
          <div style={{ display: 'flex', gap: 16, padding: '20px 0' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 100, height: 140, borderRadius: 12,
                border: '2px dashed rgba(255,255,255,0.06)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.02)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: '2px dashed rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 6,
                }}>
                  <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.1)' }}>+</span>
                </div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>슬롯 {i + 1}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
