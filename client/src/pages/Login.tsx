import React, { useState } from 'react';
import { appLogin } from '@apps-in-toss/web-framework';
import { api } from '../lib/api';
import { useNavigate } from "react-router-dom";
const navigate = useNavigate();
navigate("/play");




export default function Login() {
  const [log, setLog] = useState<string>('');

  const handleTossLogin = async () => {
    try {
      setLog('토스 로그인 준비...');
      const { authorizationCode, referrer } = await appLogin();
      setLog(`인가코드 수신: ${authorizationCode} (referrer=${referrer})`);

      const ex = await api.post('/toss/exchange', { code: authorizationCode });
      const accessToken = ex.token.accessToken;

      const me = await api.post('/toss/me', { accessToken });
      setLog(`유저 조회 완료: ${JSON.stringify(me.user)}`);

      if (!me.user?.nickname) {
        setLog((p: string) => p + '\n닉네임이 없어 닉네임 설정 화면으로 이동하세요.');
        // 닉네임 입력 UI는 여기서 이어서 구현
      } else {
        setLog((p: string) => p + '\n로그인 완료! 플레이 화면으로 이동 준비.');
      }
    } catch (e: any) {
      setLog(`로그인 실패: ${e?.message || e}`);
    }
  };

  const [nickname, setNickname] = useState('');
  const [tossUserKey, setTossUserKey] = useState(''); // 테스트 시 수동 입력 가능(실전은 me 결과에서 사용)

  const createNickname = async () => {
    try {
      const resp = await api.post('/api/auth/nickname', { nickname, tossUserKey: tossUserKey || undefined });
      setLog(`닉네임 생성 완료: ${JSON.stringify(resp.user)}`);
    } catch (e: any) {
      setLog(`닉네임 생성 실패: ${e?.message || e}`);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <button onClick={handleTossLogin} style={{ padding: 12, fontWeight: 700 }}>
        토스 로그인
      </button>

      <div style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
        <h3>닉네임 설정 (토스 최초 로그인 시)</h3>
        <input
          placeholder="원하는 닉네임"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          style={{ padding: 8 }}
        />
        <input
          placeholder="(테스트용) tossUserKey"
          value={tossUserKey}
          onChange={(e) => setTossUserKey(e.target.value)}
          style={{ padding: 8 }}
        />
        <button onClick={createNickname} style={{ padding: 10 }}>닉네임 생성</button>
      </div>

      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f8f8f8', padding: 12 }}>
        {log || '로그가 여기에 표시됩니다.'}
      </pre>
    </div>
  );
}
