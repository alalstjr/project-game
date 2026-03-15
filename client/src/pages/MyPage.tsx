import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/client.ts';
import PokemonCard from '../components/card/PokemonCard.tsx';
import BadgeIcon from '../components/BadgeIcon.tsx';
import ProfileAvatar from '../components/ProfileAvatar.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useIsMobile } from '../hooks/useIsMobile.tsx';
import { getKoreanName } from '../constants/pokemonNames.ts';

interface PokedexEntry {
  id: number;
  name: string;
  spriteUrl: string;
  artworkUrl: string;
  type1: string;
  type2: string | null;
  collected: boolean;
}

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

interface BadgeData {
  id: number;
  name: string;
  engName: string;
  leader: string;
  type: string;
  color: string;
  owned: boolean;
  obtainedAt: string | null;
}

const DUPES_TO_NEXT_LEVEL = [1, 1, 2, 2, 3, 3, 4, 5, 7, 10];
const MAX_LEVEL = 10;

function getCumulativeDupes(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) total += DUPES_TO_NEXT_LEVEL[i];
  return total;
}

function canEnhance(card: CardData): boolean {
  if (card.level >= MAX_LEVEL) return false;
  const dupesNeeded = DUPES_TO_NEXT_LEVEL[card.level - 1];
  const currentDupes = card.dupeCount - getCumulativeDupes(card.level - 1);
  return currentDupes >= dupesNeeded;
}

const TYPE_LABELS: Record<string, string> = {
  rock: '바위', water: '물', electric: '전기', grass: '풀',
  poison: '독', psychic: '에스퍼', fire: '불꽃', ground: '땅',
};

export default function MyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pokedex, setPokedex] = useState<PokedexEntry[]>([]);
  const [cards, setCards] = useState<CardData[]>([]);
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = tabParam === 'mycards' ? 'cards' : tabParam === 'badges' ? 'badges' : 'pokedex';
  const [view, setView] = useState<'pokedex' | 'cards' | 'badges'>(initialTab);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'power' | 'grade' | 'level' | 'enhance'>('power');
  const [enhancingAll, setEnhancingAll] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const isMobile = useIsMobile();
  const [profileData, setProfileData] = useState<{ profileType: string | null; profileValue: number | null; profileImage: string | null }>({ profileType: null, profileValue: null, profileImage: null });

  useEffect(() => {
    Promise.all([
      api.get('/collection/pokedex'),
      api.get('/collection/cards'),
      api.get('/badge/list'),
      api.get('/badge/profile'),
    ]).then(([pokedexRes, cardsRes, badgesRes, profileRes]) => {
      setPokedex(pokedexRes.data);
      setCards(cardsRes.data);
      setBadges(badgesRes.data);
      setProfileData({
        profileType: profileRes.data.profileType,
        profileValue: profileRes.data.profileValue,
        profileImage: profileRes.data.profileType === 'pokemon'
          ? (pokedexRes.data as PokedexEntry[]).find((p: PokedexEntry) => p.id === profileRes.data.profileValue)?.spriteUrl || null
          : profileRes.data.profileType === 'badge'
            ? `badge:${profileRes.data.profileValue}`
            : null,
      });
    }).finally(() => setLoading(false));
  }, []);

  const GRADE_ORDER: Record<string, number> = { SSS: 0, SS: 1, S: 2, A: 3, B: 4, C: 5, D: 6, E: 7 };

  const sortedCards = [...cards].sort((a, b) => {
    switch (sortBy) {
      case 'power':
        return (b.atk + b.def + b.hp) - (a.atk + a.def + a.hp);
      case 'grade':
        return (GRADE_ORDER[a.grade] ?? 99) - (GRADE_ORDER[b.grade] ?? 99);
      case 'level':
        return b.level - a.level;
      case 'enhance':
        return (canEnhance(b) ? 1 : 0) - (canEnhance(a) ? 1 : 0);
      default:
        return 0;
    }
  });

  const collectedCount = pokedex.filter(p => p.collected).length;
  const ownedBadgeCount = badges.filter(b => b.owned).length;

  const setProfile = async (type: string | null, value: number | null) => {
    try {
      await api.post('/badge/profile', { type, value });
      let profileImage: string | null = null;
      if (type === 'pokemon') {
        const p = pokedex.find(p => p.id === value);
        if (p) profileImage = p.spriteUrl;
      } else if (type === 'badge') {
        profileImage = `badge:${value}`;
      }
      setProfileData({ profileType: type, profileValue: value, profileImage });
      setShowProfileModal(false);
    } catch (err: any) {
      alert(err.response?.data?.error || '프로필 설정 실패');
    }
  };

  const handleEnhanceAll = async () => {
    if (enhancingAll) return;
    setEnhancingAll(true);
    try {
      const res = await api.post('/collection/cards/enhance-all');
      if (res.data.enhancedCount > 0) {
        alert(`${res.data.enhancedCount}장 강화 완료!`);
        // 카드 목록 새로고침
        const cardsRes = await api.get('/collection/cards');
        setCards(cardsRes.data);
      } else {
        alert('강화 가능한 카드가 없습니다.');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || '일괄 강화 실패');
    } finally {
      setEnhancingAll(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>로딩중...</div>;

  return (
    <div>
      <div style={{
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? '12px' : '0', marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            onClick={() => setShowProfileModal(true)}
            style={{ cursor: 'pointer', position: 'relative', flexShrink: 0 }}
            title="프로필 변경"
          >
            <ProfileAvatar profileImage={profileData.profileImage} size={isMobile ? 48 : 64} username={user?.username} />
            <div style={{
              position: 'absolute', bottom: -2, right: -2,
              width: isMobile ? 18 : 22, height: isMobile ? 18 : 22, borderRadius: '50%',
              background: 'var(--accent)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: isMobile ? '10px' : '12px', color: 'white',
              border: '2px solid var(--bg-primary)',
            }}>
              ✎
            </div>
          </div>
          <div>
            <h2 style={{ fontSize: isMobile ? '18px' : '24px', fontWeight: 900 }}>컬렉션</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: isMobile ? '12px' : '14px' }}>
              {collectedCount} / 151 수집 | 뱃지 {ownedBadgeCount} / 8
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['pokedex', 'cards', 'badges'] as const).map(tab => (
            <button
              key={tab}
              className="btn"
              onClick={() => setView(tab)}
              style={{
                background: view === tab ? 'var(--accent)' : 'var(--bg-card)',
                color: view === tab ? 'white' : 'var(--text-secondary)',
                flex: isMobile ? 1 : undefined,
                padding: isMobile ? '8px 8px' : undefined,
                fontSize: isMobile ? '13px' : undefined,
              }}
            >
              {tab === 'pokedex' ? '포켓덱스' : tab === 'cards' ? '내 카드' : '뱃지'}
            </button>
          ))}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        height: '6px', borderRadius: '3px', background: 'var(--border)', marginBottom: '24px',
      }}>
        <div style={{
          height: '100%', borderRadius: '3px',
          background: 'linear-gradient(90deg, var(--accent), var(--accent-light))',
          width: `${(collectedCount / 151) * 100}%`,
          transition: 'width 0.5s ease',
        }} />
      </div>

      {view === 'pokedex' ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: isMobile ? '8px' : '12px',
        }}>
          {pokedex.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.01, 1) }}
              onClick={() => {
                if (p.collected) {
                  const card = cards.find(c => c.pokemonId === p.id);
                  if (card) navigate(`/card/${card.id}?from=pokedex`);
                }
              }}
              style={{
                background: 'var(--bg-card)', borderRadius: '10px',
                padding: '12px 8px', textAlign: 'center',
                border: '1px solid var(--border)',
                cursor: p.collected ? 'pointer' : 'default',
                transition: 'transform 0.2s, border-color 0.2s',
              }}
              whileHover={p.collected ? { scale: 1.05, borderColor: 'var(--accent)' } : {}}
            >
              <div style={{ marginBottom: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}>
                #{String(p.id).padStart(3, '0')}
              </div>
              <img
                src={p.artworkUrl || p.spriteUrl}
                alt={p.collected ? p.name : '???'}
                style={{
                  width: isMobile ? '60px' : '90px', height: isMobile ? '60px' : '90px', objectFit: 'contain',
                  filter: p.collected ? 'none' : 'brightness(0) opacity(0.3)',
                  transition: 'filter 0.3s',
                }}
                draggable={false}
              />
              <div style={{
                fontSize: '11px', fontWeight: 600, marginTop: '4px',
                color: p.collected ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}>
                {p.collected ? getKoreanName(p.name) : '???'}
              </div>
            </motion.div>
          ))}
        </div>
      ) : view === 'cards' ? (
        <>
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {([
            { key: 'power', label: '전투력순' },
            { key: 'grade', label: '등급순' },
            { key: 'level', label: '레벨순' },
            { key: 'enhance', label: '강화 가능순' },
          ] as const).map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              style={{
                padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                background: sortBy === opt.key ? 'var(--accent)' : 'var(--bg-card)',
                color: sortBy === opt.key ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${sortBy === opt.key ? 'var(--accent)' : 'var(--border)'}`,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={handleEnhanceAll}
            disabled={enhancingAll || sortedCards.every(c => !canEnhance(c))}
            style={{
              marginLeft: 'auto',
              padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
              background: 'linear-gradient(135deg, #ff6b00, #ff9500)',
              color: '#fff',
              border: 'none',
              cursor: enhancingAll ? 'not-allowed' : 'pointer',
              opacity: enhancingAll || sortedCards.every(c => !canEnhance(c)) ? 0.5 : 1,
              transition: 'all 0.2s',
            }}
          >
            {enhancingAll ? '강화 중...' : '일괄 강화'}
          </button>
        </div>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center',
        }}>
          {sortedCards.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', padding: '40px' }}>
              카드가 없습니다! 먼저 뽑기를 해주세요.
            </p>
          ) : (
            sortedCards.map((card, i) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(i * 0.03, 1) }}
                style={{ position: 'relative' }}
              >
                {canEnhance(card) && (
                  <div style={{
                    position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 20, background: 'linear-gradient(135deg, #ff6b00, #ff9500)',
                    color: '#fff', fontSize: '11px', fontWeight: 800,
                    padding: '3px 10px', borderRadius: '10px',
                    boxShadow: '0 2px 8px rgba(255,107,0,0.5)',
                    whiteSpace: 'nowrap',
                    animation: 'enhancePulse 2s ease-in-out infinite',
                  }}>
                    강화 가능
                  </div>
                )}
                <PokemonCard
                  name={card.pokemon.name}
                  artworkUrl={card.pokemon.artworkUrl}
                  grade={card.grade}
                  level={card.level}
                  atk={card.atk}
                  def={card.def}
                  hp={card.hp}
                  count={card.dupeCount + 1}
                  size="medium"
                  showStats
                  onClick={() => navigate(`/card/${card.id}?from=mycards`)}
                />
              </motion.div>
            ))
          )}
        </div>
        </>
      ) : (
        /* 뱃지 탭 */
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: isMobile ? '10px' : '16px',
        }}>
          {badges.map((badge, i) => (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                background: badge.owned
                  ? `linear-gradient(135deg, ${badge.color}15, ${badge.color}08)`
                  : 'var(--bg-card)',
                borderRadius: '12px',
                padding: '20px',
                border: badge.owned
                  ? `1px solid ${badge.color}40`
                  : '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                transition: 'all 0.3s',
              }}
            >
              <BadgeIcon badgeId={badge.id} size={56} owned={badge.owned} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '15px', fontWeight: 800,
                  color: badge.owned ? badge.color : 'var(--text-secondary)',
                  marginBottom: '4px',
                }}>
                  {badge.owned ? badge.name : '???'}
                </div>
                <div style={{
                  fontSize: '11px', color: 'var(--text-secondary)',
                  marginBottom: '2px',
                }}>
                  {badge.owned ? `${badge.leader} 관장 | ${TYPE_LABELS[badge.type] || badge.type} 타입` : '미발견'}
                </div>
                {badge.owned && (
                  <div style={{
                    fontSize: '10px', color: 'var(--text-secondary)',
                    opacity: 0.7,
                  }}>
                    농장에서 획득
                  </div>
                )}
              </div>
              {badge.owned && (
                <div style={{
                  fontSize: '10px', color: badge.color,
                  fontWeight: 700, background: `${badge.color}15`,
                  padding: '3px 8px', borderRadius: '6px',
                  whiteSpace: 'nowrap',
                }}>
                  보유중
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* 프로필 설정 모달 */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowProfileModal(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--bg-secondary)', borderRadius: isMobile ? '12px' : '16px',
                padding: isMobile ? '16px' : '24px', width: '480px', maxWidth: '92vw',
                maxHeight: '80vh', overflowY: 'auto',
                border: '1px solid var(--border)',
              }}
            >
              <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px' }}>프로필 설정</h3>

              {/* 현재 프로필 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <ProfileAvatar profileImage={profileData.profileImage} size={48} username={user?.username} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>{user?.username}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {profileData.profileType ? '프로필 설정됨' : '기본 프로필'}
                  </div>
                </div>
                {profileData.profileType && (
                  <button
                    onClick={() => setProfile(null, null)}
                    style={{
                      marginLeft: 'auto', padding: '4px 10px', borderRadius: '6px',
                      fontSize: '11px', background: 'var(--bg-card)',
                      color: 'var(--text-secondary)', border: '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  >
                    초기화
                  </button>
                )}
              </div>

              {/* 뱃지 선택 */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--accent-light)' }}>
                  뱃지
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {badges.filter(b => b.owned).map(badge => (
                    <div
                      key={badge.id}
                      onClick={() => setProfile('badge', badge.id)}
                      style={{
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '8px',
                        border: profileData.profileType === 'badge' && profileData.profileValue === badge.id
                          ? `2px solid ${badge.color}`
                          : '2px solid transparent',
                        background: 'var(--bg-card)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                        transition: 'all 0.2s',
                      }}
                      title={badge.name}
                    >
                      <BadgeIcon badgeId={badge.id} size={36} />
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{badge.name}</span>
                    </div>
                  ))}
                  {badges.filter(b => b.owned).length === 0 && (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      보유한 뱃지가 없습니다. 농장에서 수확하면 획득할 수 있어요!
                    </p>
                  )}
                </div>
              </div>

              {/* 포켓몬 선택 */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: 'var(--accent-light)' }}>
                  내 포켓몬
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {pokedex.filter(p => p.collected).map(p => (
                    <div
                      key={p.id}
                      onClick={() => setProfile('pokemon', p.id)}
                      style={{
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '8px',
                        border: profileData.profileType === 'pokemon' && profileData.profileValue === p.id
                          ? '2px solid var(--accent)'
                          : '2px solid transparent',
                        background: 'var(--bg-card)',
                        transition: 'all 0.2s',
                      }}
                      title={getKoreanName(p.name)}
                    >
                      <img
                        src={p.spriteUrl}
                        alt={getKoreanName(p.name)}
                        style={{ width: 36, height: 36, objectFit: 'contain' }}
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setShowProfileModal(false)}
                style={{
                  marginTop: '16px', width: '100%', padding: '10px',
                  borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                  background: 'var(--bg-card)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', cursor: 'pointer',
                }}
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
