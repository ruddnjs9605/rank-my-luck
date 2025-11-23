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
    <div className="login-hero">
      <div className="login-glass">
        <div className="login-pill">나의 운은 몇등?</div>
        <h1 className="login-title">토스에서 바로 즐기는 운 테스트</h1>
        <p className="login-sub">
          토스 계정으로 1초 만에 시작하고,<br />
          기록을 친구와 공유해보세요.
        </p>

        <div className="login-actions">
          <Button full onClick={handleTossLogin} disabled={loading}>
            {loading ? "로그인 중…" : "토스로 로그인"}
          </Button>
          <div className="login-hint">
            토스 미니앱에서 실행 중인지 확인해주세요.
          </div>
        </div>
      </div>
    </div>
  );
}
