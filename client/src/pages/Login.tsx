import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { devLogin, setToken, me } from "../lib/api";
import Button from "../components/Button";

export default function Login(){
  const nav = useNavigate();
  const [userId, setUserId] = useState("dev-user-1");
  const [loading, setLoading] = useState(false);

  const onDevLogin = async () => {
    try{
      setLoading(true);
      const { token } = await devLogin(userId);
      if(!token){ alert("토큰 발급 실패"); return; }
      setToken(token);
      const profile = await me();
      if (profile?.nickname) nav("/play");
      else nav("/nickname");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="section">
        <div className="card" style={{gap:12}}>
          <div style={{fontWeight:700, fontSize:16, marginBottom:6}}>로그인</div>
          <div style={{fontSize:13, color:"var(--muted)", marginBottom:12}}>
            토스 인앱 OAuth 연동 전 개발용 로그인입니다.
          </div>
          <input className="input" value={userId} onChange={e=>setUserId(e.target.value)} placeholder="user_id" />
        </div>
      </div>
      <div className="cta">
        <Button onClick={onDevLogin} disabled={loading} full>
          {loading ? "로그인 중…" : "개발 로그인"}
        </Button>
      </div>
    </>
  );
}
