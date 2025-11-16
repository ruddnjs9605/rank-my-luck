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
    if (!nick.trim()) return;

    setLoading(true);
    try {
      const res = await setNicknameApi(nick.trim());
      setLoading(false);

      // 닉네임 중복 처리
      if ("error" in res && res.error === "DUPLICATE_NICKNAME") {
        alert("이미 사용중인 닉네임입니다. 다른 이름을 사용해 주세요.");
        return;
      }

      // ref 보상 처리
      const savedRef = localStorage.getItem("ref");
      if (savedRef) {
        await claimReferral(savedRef);
        localStorage.removeItem("ref");
      }

      // 성공 → 플레이 화면 이동
      nav("/play");
    } catch (e: any) {
      setLoading(false);
      alert("닉네임 설정 실패: " + (e?.message || e));
    }
  };

  return (
    <div className="section">
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>닉네임 설정</div>
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          placeholder="닉네임 입력"
          className="input"
        />
      </div>

      <div className="cta">
        <Button full onClick={submit} disabled={loading}>
          {loading ? "저장 중…" : "저장하고 시작"}
        </Button>
      </div>
    </div>
  );
}
