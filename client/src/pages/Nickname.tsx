import React, { useState } from "react";
import { setNickname } from "../lib/api";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";

export default function Nickname(){
  const nav = useNavigate();
  const [nick, setNick] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if(!nick.trim()) return;
    setLoading(true);
    const res = await setNickname(nick.trim());
    setLoading(false);
    if (res?.error === "DUPLICATE_NICKNAME") {
      alert("이미 사용중인 닉네임이에요. 다른 이름을 시도해 주세요.");
      return;
    }
    nav("/play");
  };

  return (
    <>
      <div className="section">
        <div className="card">
          <div style={{fontWeight:700, fontSize:16, marginBottom:8}}>닉네임 설정</div>
          <input className="input" value={nick} onChange={e=>setNick(e.target.value)} placeholder="닉네임(중복불가)" />
        </div>
      </div>
      <div className="cta">
        <Button full onClick={submit} disabled={loading || !nick.trim()}>
          {loading ? "저장 중…" : "저장하고 시작"}
        </Button>
      </div>
    </>
  );
}
