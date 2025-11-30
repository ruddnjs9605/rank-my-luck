import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import TopBar from "./components/TopBar";
import Login from "./pages/Login";
import Nickname from "./pages/Nickname";
import Play from "./pages/Play";
import Leaderboard from "./pages/Leaderboard";
import History from "./pages/History";

const DEFAULT_PATH = "/login";

export default function App() {
  return (
    <>
      <TopBar />
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px" }}>
        <Routes>
          <Route path="/" element={<Navigate to={DEFAULT_PATH} replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/nickname" element={<Nickname />} />
          <Route path="/play" element={<Play />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/history" element={<History />} />
          <Route path="*" element={<Navigate to={DEFAULT_PATH} replace />} />
        </Routes>
      </div>
    </>
  );
}
