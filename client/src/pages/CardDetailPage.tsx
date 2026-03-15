import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/client.ts';
import PokemonCard from '../components/card/PokemonCard.tsx';
import CardPopover from '../components/card/CardPopover.tsx';
import { getKoreanName } from '../constants/pokemonNames.ts';

const GRADE_COLORS: Record<string, string> = {
  E: '#8B8B8B', D: '#6B8E23', C: '#4682B4', B: '#9370DB',
  A: '#FF6347', S: '#FFD700', SS: '#FF4500', SSS: '#FF00FF',
};

interface CardDetail {
  id: number;
  pokemonId: number;
  grade: string;
  level: number;
  atk: number;
  def: number;
  hp: number;
  dupeCount: number;
  dupesNeeded: number;
  currentDupesForLevel: number;
  canEnhance: boolean;
  pokemon: { id: number; name: string; spriteUrl: string; artworkUrl: string; type1: string; type2: string | null };
}

export default function CardDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from');
  const [card, setCard] = useState<CardDetail | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    api.get(`/collection/cards/${id}`).then(res => setCard(res.data)).catch(() => navigate('/collection'));
  }, [id, navigate]);

  const handleEnhance = async () => {
    if (!card || enhancing) return;
    setEnhancing(true);
    try {
      const res = await api.post(`/collection/cards/${id}/enhance`);
      setCard(prev => prev ? {
        ...prev,
        level: res.data.level,
        atk: res.data.atk,
        def: res.data.def,
        hp: res.data.hp,
        canEnhance: false,
      } : null);
      setEnhanced(true);
      setTimeout(() => setEnhanced(false), 2000);
    } catch (err: any) {
      alert(err.response?.data?.error || '강화 실패');
    } finally {
      setEnhancing(false);
    }
  };

  if (!card) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>로딩중...</div>;

  const color = GRADE_COLORS[card.grade] || '#888';
  const totalStats = card.atk + card.def + card.hp;
  const maxStat = Math.max(card.atk, card.def, card.hp);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <button onClick={() => navigate(from === 'mycards' ? '/collection?tab=mycards' : from === 'pokedex' ? '/collection?tab=pokedex' : '/collection')} style={{
        background: 'none', color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px',
      }}>
        ← 컬렉션으로 돌아가기
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}
      >
        {/* Enhanced flash */}
        {enhanced && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.5 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: `radial-gradient(circle, ${color}40, transparent 70%)`,
              pointerEvents: 'none',
            }}
          />
        )}

        <PokemonCard
          name={card.pokemon.name}
          artworkUrl={card.pokemon.artworkUrl}
          grade={card.grade}
          level={card.level}
          atk={card.atk}
          def={card.def}
          hp={card.hp}
          size="large"
          showStats
          onClick={() => setPopoverOpen(true)}
        />

        <CardPopover
          open={popoverOpen}
          onClose={() => setPopoverOpen(false)}
          name={card.pokemon.name}
          artworkUrl={card.pokemon.artworkUrl}
          grade={card.grade}
          level={card.level}
        />

        {/* Stats Detail */}
        <div style={{
          width: '100%', background: 'var(--bg-secondary)', borderRadius: '12px',
          padding: '20px', border: '1px solid var(--border)',
        }}>
          <h3 style={{ fontSize: '16px', marginBottom: '16px' }}>
            {getKoreanName(card.pokemon.name)} <span style={{ color, fontWeight: 900 }}>{card.grade}</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: '공격', value: card.atk, color: '#ff6b6b' },
              { label: '방어', value: card.def, color: '#4ecdc4' },
              { label: '체력', value: card.hp, color: '#45b7d1' },
            ].map(stat => (
              <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ width: '36px', fontSize: '12px', fontWeight: 700, color: stat.color }}>{stat.label}</span>
                <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: 'var(--border)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(stat.value / Math.max(maxStat, 300)) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    style={{
                      height: '100%', borderRadius: '4px',
                      background: `linear-gradient(90deg, ${stat.color}80, ${stat.color})`,
                    }}
                  />
                </div>
                <span style={{ width: '36px', fontSize: '13px', fontWeight: 600, textAlign: 'right' }}>{stat.value}</span>
              </div>
            ))}
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', marginTop: '16px',
            paddingTop: '16px', borderTop: '1px solid var(--border)',
            fontSize: '13px', color: 'var(--text-secondary)',
          }}>
            <span>합계: <strong style={{ color: 'var(--text-primary)' }}>{totalStats}</strong></span>
            <span>레벨: <strong style={{ color: '#ffd700' }}>{card.level}/10</strong></span>
            <span>중복 수: <strong style={{ color: 'var(--text-primary)' }}>{card.dupeCount}</strong></span>
          </div>
        </div>

        {/* Enhancement */}
        <div style={{
          width: '100%', background: 'var(--bg-secondary)', borderRadius: '12px',
          padding: '20px', border: '1px solid var(--border)',
        }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>강화</h3>

          {card.level >= 10 ? (
            <p style={{ color: '#ffd700', fontSize: '14px', fontWeight: 600 }}>MAX 레벨!</p>
          ) : (
            <>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                다음 레벨까지 필요한 중복 카드: {card.currentDupesForLevel} / {card.dupesNeeded}
              </div>
              <div style={{ height: '6px', borderRadius: '3px', background: 'var(--border)', marginBottom: '16px' }}>
                <div style={{
                  height: '100%', borderRadius: '3px',
                  background: card.canEnhance ? '#ffd700' : 'var(--accent)',
                  width: `${Math.min((card.currentDupesForLevel / card.dupesNeeded) * 100, 100)}%`,
                  transition: 'width 0.3s',
                }} />
              </div>
              <button
                className="btn btn-primary"
                disabled={!card.canEnhance || enhancing}
                onClick={handleEnhance}
                style={{
                  width: '100%',
                  background: card.canEnhance ? 'linear-gradient(135deg, #ffd700, #ff8c00)' : undefined,
                  color: card.canEnhance ? '#000' : undefined,
                }}
              >
                {enhancing ? '강화 중...' : card.canEnhance ? '강화하기!' : '중복 카드 필요'}
              </button>
            </>
          )}
        </div>

        {/* Type info */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{
            padding: '4px 12px', borderRadius: '12px', fontSize: '12px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            textTransform: 'capitalize',
          }}>
            {card.pokemon.type1}
          </span>
          {card.pokemon.type2 && (
            <span style={{
              padding: '4px 12px', borderRadius: '12px', fontSize: '12px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              textTransform: 'capitalize',
            }}>
              {card.pokemon.type2}
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
