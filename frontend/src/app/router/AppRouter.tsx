import { Navigate, Route, Routes } from "react-router-dom";
import type { JSX } from "react";

import Login from "../../features/auth/pages/Login";
import Signup from "../../features/auth/pages/Signup";

import LibraryPage from "../../features/library/pages/LibraryPage";
import DashboardPage from "../../features/dashboard/pages/Dashboard";
import SettingsPage from "../../features/settings/pages/SettingsPage";
import ProtectedLayout from "../layouts/ProtectedLayout";

import NotFound from "./NotFound";

import { useAuth } from "../../features/auth/context/AuthContext";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/signup" element={<Signup />} />

      <Route
        element={
          <RequireAuth>
            <ProtectedLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<LibraryPage />} />

        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
