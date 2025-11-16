import React from "react";
import { Routes, Route } from "react-router-dom";
import TopBar from "./components/TopBar";
import Login from "./pages/Login";
import Nickname from "./pages/Nickname";
import Play from "./pages/Play";
import Leaderboard from "./pages/Leaderboard";

export default function App() {
  return (
    <>
      <TopBar />
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px" }}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/nickname" element={<Nickname />} />
          <Route path="/play" element={<Play />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </div>
    </>
  );
}
