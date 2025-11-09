import React from "react";

// 매우 작은 확률도 0.0000000001% 같이 보여주기
const fmtProb = (p: number) => {
  const pct = p * 100;
  if (pct === 0) return "0%";
  if (pct >= 0.01) return `${pct.toFixed(2)}%`;
  // 너무 작으면 지수표기 대신 고정 소수점 up to 12자리
  return `${pct.toFixed(12).replace(/0+$/,"")}%`;
};

export default function StatCard({ title, value }: {title:string; value:number}) {
  return (
    <div style={{border:"1px solid #eee", borderRadius:12, padding:12, margin:"8px 0"}}>
      <div style={{fontSize:12, color:"#666"}}>{title}</div>
      <div style={{fontSize:18, fontWeight:700}}>{fmtProb(value)}</div>
    </div>
  );
}
