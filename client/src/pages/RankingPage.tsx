import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext.tsx';
import api from '../api/client.ts';
import ProfileAvatar from '../components/ProfileAvatar.tsx';

interface RankEntry {
  id: number;
  username: string;
  ranking_score: number;
  profileImage: string | null;
}

const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function RankingPage() {
  const { user } = useAuth();
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/battle/ranking').then(res => setRanking(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>로딩중...</div>;

  const myRankIdx = ranking.findIndex(e => e.id === user?.id);

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '20px', textAlign: 'center' }}>
        랭킹
      </h2>

      {ranking.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
          아직 기록이 없습니다. 배틀에서 승리하세요!
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {ranking.map((entry, i) => {
            const isMe = entry.id === user?.id;
            const hasMedal = i < 3;
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: isMe
                    ? 'rgba(108, 92, 231, 0.15)'
                    : hasMedal
                      ? `rgba(${i === 0 ? '255,215,0' : i === 1 ? '192,192,192' : '205,127,50'},0.08)`
                      : 'var(--bg-secondary)',
                  border: isMe
                    ? '1px solid rgba(108, 92, 231, 0.3)'
                    : '1px solid var(--border)',
                }}
              >
                <div style={{
                  width: '28px', textAlign: 'center', flexShrink: 0,
                  fontSize: hasMedal ? '20px' : '14px',
                  fontWeight: 800,
                  color: hasMedal ? MEDAL_COLORS[i] : 'var(--text-secondary)',
                }}>
                  {hasMedal ? MEDAL[i] : i + 1}
                </div>
                <ProfileAvatar profileImage={entry.profileImage} size={36} username={entry.username} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '14px', fontWeight: 700,
                    color: isMe ? 'var(--accent-light)' : '#fff',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {entry.username}
                    {isMe && <span style={{ fontSize: '11px', marginLeft: '6px', color: 'var(--accent)' }}>(나)</span>}
                  </div>
                  <div style={{
                    fontSize: '13px', fontWeight: 600,
                    color: hasMedal ? MEDAL_COLORS[i] : 'var(--text-secondary)',
                  }}>
                    {entry.ranking_score}점
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {myRankIdx === -1 && user && (
        <div style={{
          marginTop: '20px', padding: '14px',
          borderRadius: '12px',
          background: 'rgba(108, 92, 231, 0.1)',
          border: '1px solid rgba(108, 92, 231, 0.2)',
          textAlign: 'center',
          fontSize: '13px', color: 'var(--text-secondary)',
        }}>
          아직 랭킹에 등록되지 않았습니다. 배틀에서 승리하세요!
        </div>
      )}
    </div>
  );
}
