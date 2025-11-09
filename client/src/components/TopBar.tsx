import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function TopBar(){
  const { pathname } = useLocation();
  return (
    <div className="topbar">
      <div className="topbar-title">나의 운은 몇등?</div>
      <nav className="topbar-nav">
        <Link to="/play" className={`topbar-link ${pathname==="/play"?"active":""}`}>플레이</Link>
        <Link to="/leaderboard" className={`topbar-link ${pathname==="/leaderboard"?"active":""}`}>랭킹</Link>
      </nav>
    </div>
  );
}
