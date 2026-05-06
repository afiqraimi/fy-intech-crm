import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Background3D from './components/Background3D';
import Intro3D from './components/Intro3D';
import LoginPage from './components/LoginPage';
import DashboardShell from './components/DashboardShell';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      {/* Background3D stays outside Routes so it persists seamlessly across all page transitions! */}
      <Background3D />
      <Routes>
        <Route path="/" element={<Intro3D />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardShell />
          </ProtectedRoute>
        } />
        {/* Catch all unknown routes and redirect to intro securely */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
