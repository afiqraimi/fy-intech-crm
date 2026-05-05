import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
  
  if (!isAuthenticated) {
    // Redirect to the login page if not authenticated
    // replace={true} ensures that the current history entry is replaced
    // preventing the user from going back to a protected page after logout
    return <Navigate to="/login" replace />;
  }
  
  return children;
}
