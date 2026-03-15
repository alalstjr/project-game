import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import Header from './components/layout/Header.tsx';
import RankingSidebar from './components/layout/RankingSidebar.tsx';
import LoginPage from './pages/LoginPage.tsx';
import RegisterPage from './pages/RegisterPage.tsx';
import GachaPage from './pages/GachaPage.tsx';
import MyPage from './pages/MyPage.tsx';
import CardDetailPage from './pages/CardDetailPage.tsx';
import BattlePage from './pages/BattlePage.tsx';
import FarmPage from './pages/FarmPage.tsx';
import RankingPage from './pages/RankingPage.tsx';
import { useIsMobile } from './hooks/useIsMobile.tsx';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  return (
    <>
      {user && <Header />}
      {user && !isMobile && <RankingSidebar />}
      <div className="container" style={{
        paddingTop: user ? (isMobile ? '120px' : '80px') : '0',
        paddingBottom: '40px',
        marginLeft: user && !isMobile ? '184px' : '0',
        maxWidth: user && !isMobile ? 'calc(100% - 200px)' : '100%',
      }}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
          <Route path="/register" element={user ? <Navigate to="/" /> : <RegisterPage />} />
          <Route path="/" element={<ProtectedRoute><GachaPage /></ProtectedRoute>} />
          <Route path="/collection" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
          <Route path="/card/:id" element={<ProtectedRoute><CardDetailPage /></ProtectedRoute>} />
          <Route path="/farm" element={<ProtectedRoute><FarmPage /></ProtectedRoute>} />
          <Route path="/battle" element={<ProtectedRoute><BattlePage /></ProtectedRoute>} />
          <Route path="/ranking" element={<ProtectedRoute><RankingPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
