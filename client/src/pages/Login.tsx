import React, { useState } from "react";
import { devLogin, setToken, me } from "../lib/api";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";

export default function Login() {
  const [userId, setUserId] = useState("dev-user-1");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const onDevLogin = async () => {
    try {
      setLoading(true);
      // 1) 토큰 발급
      const r = await devLogin(userId.trim());
      if (!r?.token) {
        alert("토큰 발급 실패");
        setLoading(false);
        return;
      }
      // 2) 저장
      setToken(r.token);
      // 3) 프로필 확인 후 라우팅
      const profile = await me();
      setLoading(false);
      if (!profile?.nickname) nav("/nickname" + window.location.search);
      else nav("/play" + window.location.search);
    } catch (e) {
      setLoading(false);
      alert("개발 로그인 실패: 네트워크/프록시 설정을 확인해주세요.");
    }
  };

  return (
    <>
      <div className="section">
        <div className="card">
          <div style={{fontWeight:700, fontSize:16, marginBottom:8}}>로그인</div>
          <div style={{color:"#667085", fontSize:13, marginBottom:12}}>
            토스 인앱 OAuth 연동 전 개발용 로그인입니다.
          </div>
          <input
            className="input"
            value={userId}
            onChange={(e)=>setUserId(e.target.value)}
            placeholder="dev-user-1"
          />
        </div>
      </div>
      <div className="cta">
        <Button full onClick={onDevLogin} disabled={loading || !userId.trim()}>
          {loading ? "로그인 중..." : "개발 로그인"}
        </Button>
      </div>
    </>
  );
}
