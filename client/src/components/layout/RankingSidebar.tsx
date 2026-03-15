import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.tsx';
import api from '../../api/client.ts';
import ProfileAvatar from '../ProfileAvatar.tsx';

interface RankEntry {
  id: number;
  username: string;
  ranking_score: number;
  profileImage: string | null;
}

const MEDAL = ['🥇', '🥈', '🥉'];
const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function RankingSidebar() {
  const { user } = useAuth();
  const [ranking, setRanking] = useState<RankEntry[]>([]);

  useEffect(() => {
    const fetch = () => {
      api.get('/battle/ranking').then(res => setRanking(res.data)).catch(() => {});
    };
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, []);

  const top3 = ranking.slice(0, 3);

  return (
    <div style={{
      position: 'fixed',
      left: '12px',
      top: '80px',
      width: '160px',
      background: 'rgba(10, 10, 26, 0.9)',
      backdropFilter: 'blur(10px)',
      borderRadius: '12px',
      border: '1px solid var(--border)',
      padding: '14px 12px',
      zIndex: 90,
    }}>
      <div style={{
        fontSize: '13px', fontWeight: 900, marginBottom: '12px',
        color: 'var(--accent-light)',
        textAlign: 'center',
        letterSpacing: '1px',
      }}>
        랭킹
      </div>

      {top3.length === 0 ? (
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>
          아직 기록 없음
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {top3.map((entry, i) => {
            const isMe = entry.id === user?.id;
            return (
              <div key={entry.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 8px',
                borderRadius: '8px',
                background: isMe
                  ? 'rgba(108, 92, 231, 0.15)'
                  : i === 0
                    ? 'rgba(255, 215, 0, 0.08)'
                    : 'transparent',
                border: isMe ? '1px solid rgba(108, 92, 231, 0.3)' : '1px solid transparent',
              }}>
                <span style={{ fontSize: '16px', lineHeight: 1 }}>
                  {MEDAL[i]}
                </span>
                <ProfileAvatar profileImage={entry.profileImage} size={24} username={entry.username} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '11px', fontWeight: 700,
                    color: isMe ? 'var(--accent-light)' : '#fff',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {entry.username}
                  </div>
                  <div style={{
                    fontSize: '11px', fontWeight: 600,
                    color: MEDAL_COLORS[i],
                  }}>
                    {entry.ranking_score}점
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 내 랭킹 표시 (Top 3 밖인 경우) */}
      {user && !top3.find(e => e.id === user.id) && ranking.find(e => e.id === user.id) && (() => {
        const myRank = ranking.findIndex(e => e.id === user.id);
        const myEntry = ranking[myRank];
        return (
          <>
            <div style={{
              borderTop: '1px solid var(--border)',
              margin: '10px 0 8px',
            }} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 8px', borderRadius: '8px',
              background: 'rgba(108, 92, 231, 0.1)',
              border: '1px solid rgba(108, 92, 231, 0.2)',
            }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', width: '20px', textAlign: 'center' }}>
                {myRank + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-light)' }}>
                  {myEntry.username}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {myEntry.ranking_score}점
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
