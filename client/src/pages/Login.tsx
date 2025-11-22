// client/src/pages/Login.tsx
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
      const { authorizationCode, referrer } = await (window as any).TossApp.invoke(
        "login"
      );

      // 3) 우리 서버에 로그인 요청
      const res = await tossLogin(authorizationCode, referrer);

      // ✅ 타입 가드: 에러 응답인 경우 먼저 처리
      if ("error" in res) {
        console.error("tossLogin error:", res);
        alert(res.message || "토스 로그인 API 오류가 발생했어요.");
        return;
      }

      // ✅ 여기부터는 hasNickname 이 항상 존재하는 성공 응답 타입
      if (res.hasNickname) {
        nav("/play");
      } else {
        nav("/nickname");
      }
    } catch (e: any) {
      console.error(e);
      alert("토스 로그인 실패: " + String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section">
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>로그인</div>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
          토스 계정으로 로그인 후, 나의 운을 테스트해 보세요.
        </p>
        <Button full onClick={handleTossLogin} disabled={loading}>
          {loading ? "로그인 중…" : "토스로 로그인"}
        </Button>
      </div>
    </div>
  );
}
