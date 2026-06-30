import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { queryClient } from './lib/queryClient';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { CallbackPage } from './pages/CallbackPage';
import { DashboardPage } from './pages/DashboardPage';
import { NewDashboardPage } from './pages/NewDashboardPage';
import { EposDataPage } from './pages/EposDataPage';
import { ClockTimePage } from './pages/ClockTimePage';
import AreaCompletionPage from './pages/AreaCompletionPage';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<CallbackPage />} />
          
          {/* Protected routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/new-dashboard" element={
            <ProtectedRoute>
              <NewDashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/epos-data" element={
            <ProtectedRoute>
              <EposDataPage />
            </ProtectedRoute>
          } />
          <Route path="/clock-time" element={
            <ProtectedRoute>
              <ClockTimePage />
            </ProtectedRoute>
          } />
          <Route path="/area-completion" element={
            <ProtectedRoute>
              <AreaCompletionPage />
            </ProtectedRoute>
          } />
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
