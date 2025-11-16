import React from 'react';
import Login from './pages/Login';

export default function App() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
      <h1>나의 운은 몇등?</h1>
      <Login />
      {/* 추후: 닉네임 설정 → 플레이 → 랭킹 컴포넌트 연결 */}
    </div>
  );
}
