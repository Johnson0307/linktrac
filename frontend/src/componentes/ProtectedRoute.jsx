import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { permiteRota } from '../ajuda/acessos';

export default function ProtectedRoute() {
  const { user, loading, sessionError, retrySession, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ padding: '2rem', color: '#334155' }}>Carregando...</div>;
  }

  if (sessionError) {
    return (
      <div style={{ padding: '2rem', color: '#334155' }}>
        <p role="alert">{sessionError}</p>
        <button type="button" onClick={retrySession}>
          Tentar novamente
        </button>{' '}
        <button type="button" onClick={logout}>
          Sair
        </button>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!permiteRota(user, location.pathname.toLowerCase().replace(/\/+$/, ''))) {
    return <p role="alert">Esta função não está liberada para sua empresa.</p>;
  }
  return <Outlet />;
}
