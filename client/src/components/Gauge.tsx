import React from "react";

type Props = { value: number; onChange: (v:number)=>void; };

export default function Gauge({ value, onChange }: Props) {
  return (
    <div>
      <input type="range" min={0.1} max={0.9} step={0.1}
             value={value} onChange={e=>onChange(Number(e.target.value))}/>
      <div style={{marginTop:4}}>선택 확률: {value.toFixed(1)}</div>
    </div>
  );
}
