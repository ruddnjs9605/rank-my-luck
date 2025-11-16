import React, { useState } from 'react';
import { api } from '../lib/api';
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [nickname, setNickname] = useState('');
  const [log, setLog] = useState('');
  const navigate = useNavigate();

  // 테스트용 로그인(닉네임 있으면 플레이로 이동)
  const fakeLogin = async () => {
    if (!nickname.trim()) {
      alert("닉네임을 입력하세요.");
      return;
    }

    try {
      // 1) 닉네임 생성 or 중복 체크
      const r = await api.post('/api/auth/nickname', {
        nickname: nickname.trim()
      });

      setLog("로그인 성공: " + JSON.stringify(r));
      navigate("/play");
    } catch (e: any) {
      setLog("로그인 실패: " + (e?.message || e));
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>로그인(테스트 모드)</h2>

      <input
        placeholder="닉네임"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        style={{ padding: 8 }}
      />

      <button onClick={fakeLogin} style={{ padding: 12, fontWeight: 700 }}>
        로그인하기
      </button>

      <pre style={{ whiteSpace: 'pre-wrap', background: "#eee", padding: 12 }}>
        {log}
      </pre>
    </div>
  );
}
