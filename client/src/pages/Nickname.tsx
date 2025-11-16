import React, { useState, useEffect } from "react";
import { setNicknameApi, claimReferral } from "../lib/api";
import Button from "../components/Button";
import { useNavigate } from "react-router-dom";

export default function Nickname() {
  const nav = useNavigate();
  const [nick, setNick] = useState("");
  const [loading, setLoading] = useState(false);

  // ref 파라미터 저장
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const ref = q.get("ref");
    if (ref) localStorage.setItem("ref", ref);
  }, []);

  const submit = async () => {
    const trimmed = nick.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const res = await setNicknameApi(trimmed);
      console.log("setNicknameApi res:", res);

      // 닉네임 중복 처리
      if ("error" in res && res.error === "DUPLICATE_NICKNAME") {
        alert("이미 사용중인 닉네임입니다. 다른 이름을 사용해 주세요.");
        setLoading(false);
        return;
      }

      // 내 닉네임을 프론트에서도 기억 (나중에 API 헤더 등에 사용 가능)
      localStorage.setItem("nickname", trimmed);

      // ref 보상 처리
      const savedRef = localStorage.getItem("ref");
      if (savedRef) {
        try {
          await claimReferral(savedRef);
        } catch (e) {
          console.warn("claimReferral error:", e);
        }
        localStorage.removeItem("ref");
      }

      setLoading(false);

      // ✅ 1차: React Router 로 이동
      console.log("navigate('/play') 호출");
      nav("/play");

      // ✅ 2차: 혹시 Router 컨텍스트 문제로 nav 가 안 먹으면 브라우저 강제 이동
      setTimeout(() => {
        if (window.location.pathname !== "/play") {
          console.log("fallback redirect to /play");
          window.location.href = "/play";
        }
      }, 0);
    } catch (e: any) {
      console.error("setNicknameApi error:", e);
      setLoading(false);
      alert("닉네임 설정 실패: " + (e?.message || e));
    }
  };

  return (
    <div className="section">
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>닉네임 설정</div>
        <input
          id="nickname"
          name="nickname"
          type="text"
          autoComplete="nickname"
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          placeholder="닉네임 입력"
          className="input"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) submit();
          }}
        />
      </div>

      <div className="cta">
        <Button full onClick={submit} disabled={loading || !nick.trim()}>
          {loading ? "저장 중…" : "저장하고 시작"}
        </Button>
      </div>
    </div>
  );
}
