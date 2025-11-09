import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { wallet } from "../lib/api";

export default function TopBar(){
  const { pathname } = useLocation();
  const [coins, setCoins] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      try {
        const w = await wallet();
        setCoins(w?.coins ?? 0);
      } catch {}
    };
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="topbar">
      <div className="topbar-title">나의 운은 몇등?</div>
      <nav className="topbar-nav" style={{alignItems:"center", gap:12}}>
        <Link to="/play" className={`topbar-link ${pathname==="/play"?"active":""}`}>플레이</Link>
        <Link to="/leaderboard" className={`topbar-link ${pathname==="/leaderboard"?"active":""}`}>랭킹</Link>
        <div style={{
          display:"inline-flex", alignItems:"center",
          padding:"4px 8px", border:"1px solid var(--border)",
          borderRadius:12, background:"#fff", fontWeight:700
        }}>
          🪙 {coins}
        </div>
      </nav>
    </div>
  );
}
