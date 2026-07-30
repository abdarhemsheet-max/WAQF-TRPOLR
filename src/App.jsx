import { Navigate, Route, Routes } from 'react-router-dom';
import { isDemo } from './lib/supabaseClient.js';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import DemoBanner from './components/DemoBanner.jsx';
import Login from './pages/Login.jsx';
import Gateway from './pages/Gateway.jsx';
import Dashboard from './pages/Dashboard.jsx';
import TeacherDashboard from './pages/TeacherDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import Qualifications from './pages/Qualifications.jsx';

export default function App() {
  return (
    <>
      {isDemo && <DemoBanner />}

      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/gateway"
          element={
            <ProtectedRoute>
              <Gateway />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute role="admin">
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/teacher"
          element={
            <ProtectedRoute role="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/qualifications"
          element={
            <ProtectedRoute>
              <Qualifications />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/gateway" replace />} />
      </Routes>
    </>
  );
}
