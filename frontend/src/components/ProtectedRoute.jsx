// src/components/ProtectedRoute.jsx — защита маршрутов
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Spinner } from './UI';
import { ROUTES } from '../constants/routes';

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={role === 'admin' ? ROUTES.ADMIN_LOGIN : ROUTES.LOGIN} replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? ROUTES.ADMIN_DASHBOARD : ROUTES.DASHBOARD} replace />;
  }

  return children;
}