import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(username, password);
    } catch (err: any) {
      setError(err.response?.data?.error || '회원가입 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', padding: '20px',
    }}>
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: '16px',
        padding: '48px 40px', width: '100%', maxWidth: '400px',
        border: '1px solid var(--border)',
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '8px', fontSize: '28px', fontWeight: 900 }}>
          회원가입
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '14px' }}>
          무료 뽑기 10회 지급!
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="text" placeholder="아이디 (2자 이상)" value={username}
            onChange={e => setUsername(e.target.value)}
            style={{ width: '100%' }}
          />
          <input
            type="password" placeholder="비밀번호 (4자 이상)" value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: '100%' }}
          />
          {error && <div style={{ color: 'var(--danger)', fontSize: '13px' }}>{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={loading}
            style={{ width: '100%', padding: '12px', fontSize: '16px' }}>
            {loading ? '로딩중...' : '회원가입'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          이미 계정이 있으신가요? <Link to="/login" style={{ color: 'var(--accent-light)' }}>로그인</Link>
        </p>
      </div>
    </div>
  );
}
