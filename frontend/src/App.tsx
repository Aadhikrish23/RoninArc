import { useState, type JSX } from "react";

import "./App.css";
import Login from "./routes/Login";
import Signup from "./routes/Signup";
import Home from "./routes/Home";
import { Navigate, Route, Routes } from "react-router-dom";
import SettingsPage from "./routes/Settings";
import DashboardPage from "./routes/Dashboard";

function RequireAuth({ children }: { children: JSX.Element }) {
  const token = localStorage.getItem("roninarc_token") || sessionStorage.getItem("roninarc_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const [count, setCount] = useState(0);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
       <Route
            path="/settings"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />
           <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
           <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
