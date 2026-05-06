import { Navigate } from 'react-router-dom';
import { hasAuthSession } from '../utils/auth';

export default function ProtectedRoute({ children }) {
  const isAuthenticated = hasAuthSession();
  
  if (!isAuthenticated) {
    // Redirect to the login page if not authenticated
    // replace={true} ensures that the current history entry is replaced
    // preventing the user from going back to a protected page after logout
    return <Navigate to="/login" replace />;
  }
  
  return children;
}
