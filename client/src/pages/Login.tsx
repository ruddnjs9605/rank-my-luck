import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { tossLogin } from "../lib/api";

export default function Login() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleTossLogin = async () => {
    try {
      setLoading(true);

      // 1) 토스 미니앱 환경 체크
      const isToss = Boolean(
        (window as any).TossApp || (window as any).Toss
      );
      if (!isToss) {
        alert("토스 미니앱 환경이 아닙니다!");
        return;
      }

      // 2) 토스 로그인 요청 (네이티브 호출)
      const { authorizationCode, referrer } = await (window as any).TossApp.invoke("login");

      // 3) 우리 서버에 로그인 요청
      const res = await tossLogin(authorizationCode, referrer);

      if (res.hasNickname) {
        nav("/play");
      } else {
        nav("/nickname");
      }
    } catch (e: any) {
      console.error(e);
      alert("토스 로그인 실패: " + String(e));
    } finally {
      setLoading(false);
    }
  };

  // 로컬 테스트 (브라우저)
  const handleDevStart = () => {
    nav("/nickname");
  };

  return (
    <div className="section">
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          나의 운은 몇등?
        </div>
        <p style={{ fontSize: 14, marginBottom: 16, color: "#666" }}>
          토스로 간편하게 로그인하고 시작하세요.
        </p>

        <Button full onClick={handleTossLogin} disabled={loading}>
          {loading ? "로그인 중…" : "토스로 로그인"}
        </Button>

        <div style={{ marginTop: 16, fontSize: 12, color: "#999" }}>
          🔧 브라우저 개발 중이면 아래 버튼 사용
        </div>

        <Button
          full
          variant="outline"
          style={{ marginTop: 8 }}
          onClick={handleDevStart}
        >
          로컬 테스트로 시작하기
        </Button>
      </div>
    </div>
  );
}
