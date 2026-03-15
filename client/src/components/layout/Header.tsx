import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useEffect } from 'react';
import api from '../../api/client.ts';
import { useIsMobile } from '../../hooks/useIsMobile.tsx';

export default function Header() {
  const { user, logout, updateTickets } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchStatus = () => {
      api.get('/gacha/status').then(res => {
        updateTickets(res.data.tickets);
      }).catch(() => {});
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { path: '/', label: '뽑기' },
    { path: '/collection', label: '컬렉션' },
    { path: '/farm', label: '농장' },
    { path: '/battle', label: '배틀' },
    ...(isMobile ? [{ path: '/ranking', label: '랭킹' }] : []),
  ];

  if (isMobile) {
    return (
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(10, 10, 26, 0.95)', backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--border)',
      }}>
        {/* 상단: 로고 + 뽑기권 + 로그아웃 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px',
        }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/pokemon-logo.png" alt="포켓몬 가챠" style={{ height: '28px' }} />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '6px',
              background: 'rgba(108,92,231,0.1)',
              border: '1px solid rgba(108,92,231,0.2)',
            }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>뽑기권</span>
              <span style={{ fontSize: '14px', color: 'var(--accent-light)', fontWeight: 800 }}>
                {user?.pullTickets || 0}
              </span>
            </div>
            <button onClick={logout} style={{
              padding: '4px 10px', borderRadius: '6px', fontSize: '11px',
              background: 'var(--bg-card)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}>
              로그아웃
            </button>
          </div>
        </div>
        {/* 하단: 네비게이션 */}
        <nav style={{
          display: 'flex', justifyContent: 'space-around',
          padding: '6px 8px 8px',
        }}>
          {navItems.map(item => (
            <Link key={item.path} to={item.path} style={{
              padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
              color: location.pathname === item.path ? 'white' : 'var(--text-secondary)',
              background: location.pathname === item.path ? 'var(--accent)' : 'transparent',
              transition: 'all 0.2s', flex: 1, textAlign: 'center',
            }}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
    );
  }

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(10, 10, 26, 0.95)', backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--border)', padding: '0 20px', height: '64px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/pokemon-logo.png" alt="포켓몬 가챠" style={{ height: '36px' }} />
        </Link>
        <nav style={{ display: 'flex', gap: '4px' }}>
          {navItems.map(item => (
            <Link key={item.path} to={item.path} style={{
              padding: '8px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 600,
              color: location.pathname === item.path ? 'white' : 'var(--text-secondary)',
              background: location.pathname === item.path ? 'var(--accent)' : 'transparent',
              transition: 'all 0.2s',
            }}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 14px', borderRadius: '8px',
          background: 'rgba(108,92,231,0.1)',
          border: '1px solid rgba(108,92,231,0.2)',
        }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>뽑기권</span>
          <span style={{ fontSize: '15px', color: 'var(--accent-light)', fontWeight: 800 }}>
            {user?.pullTickets || 0}
          </span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {user?.username}
        </div>
        <button onClick={logout} style={{
          padding: '6px 12px', borderRadius: '6px', fontSize: '12px',
          background: 'var(--bg-card)', color: 'var(--text-secondary)',
          border: '1px solid var(--border)', cursor: 'pointer',
        }}>
          로그아웃
        </button>
      </div>
    </header>
  );
}
