import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Nickname from "./pages/Nickname";
import Play from "./pages/Play";
import Leaderboard from "./pages/Leaderboard";
import TopBar from "./components/TopBar";

export default function App() {
  return (
    <BrowserRouter>
      <TopBar />
      <div style={{ maxWidth: 480, margin: "0 auto", padding: 16 }}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/nickname" element={<Nickname />} />
          <Route path="/play" element={<Play />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
