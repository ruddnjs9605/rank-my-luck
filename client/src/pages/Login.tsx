// client/src/pages/Login.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { tossLoginWithCode } from "../lib/api";
import { appLogin } from "@apps-in-toss/web-framework";

export default function Login() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleTossLogin = async () => {
    try {
      setLoading(true);

      // 1) 앱인토스 공식 로그인 호출 → authorizationCode, referrer 획득
      const { authorizationCode, referrer } = await appLogin();

      // 2) 서버에 로그인 요청
      const res = await tossLoginWithCode(authorizationCode, referrer ?? null);

      if ("error" in res) {
        console.error("tossLogin error:", res);
        alert(res.message || "토스 로그인 API 오류가 발생했어요.");
        return;
      }

      // 3) 닉네임 여부에 따라 라우팅
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
        </div>
      </div>
    </div>
  );
}
