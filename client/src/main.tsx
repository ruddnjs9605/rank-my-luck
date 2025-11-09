import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import Login from "./pages/Login";
import Nickname from "./pages/Nickname";
import Play from "./pages/Play";
import Leaderboard from "./pages/Leaderboard";
import "./styles.css";



createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />}>
        <Route index element={<Navigate to="/login" />} />
        <Route path="login" element={<Login />} />
        <Route path="nickname" element={<Nickname />} />
        <Route path="play" element={<Play />} />
        <Route path="leaderboard" element={<Leaderboard />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
