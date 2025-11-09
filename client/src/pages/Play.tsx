import React, { useEffect, useRef, useState } from "react";
import { me, play } from "../lib/api";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { shareMyRank } from "../lib/share";

const fmtProb = (p: number) => {
  const pct = p * 100;
  if (pct === 0) return "0%";
  if (pct >= 0.01) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(12).replace(/0+$/,"")}%`;
};

export default function Play(){
  const nav = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [chosen, setChosen] = useState(0.5);
  const [current, setCurrent] = useState(1.0);
  const [best, setBest] = useState(1.0);
  const [rank, setRank] = useState<number | null>(null);
  const [result, setResult] = useState<"success"|"fail"|null>(null);
  const [nickname, setNickname] = useState<string | null>(null);

  // Top10 축하 보류(실패 시점에만 노출)
  const [pendingTop10, setPendingTop10] = useState<{rank:number; best:number} | null>(null);

  // 3D 코인 상태: 회전 각도/회전 중 여부
  const [rot, setRot] = useState(0);        // 0deg = 앞면(success.png), 180deg = 뒷면(fail.png)
  const [spinning, setSpinning] = useState(false);

  // 효과음
  const audioEl = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const el = new Audio();
    el.src = "/sounds/coin.mp3";   // 없으면 무음(아래에서 폴백)
    el.preload = "auto";
    audioEl.current = el;
  }, []);
  const playSound = async () => {
    try {
      if (audioEl.current?.src) {
        audioEl.current.currentTime = 0;
        await audioEl.current.play();
      } else {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = "triangle"; osc.frequency.value = 800; g.gain.value = 0.03;
        osc.connect(g); g.connect(ctx.destination);
        osc.start(); setTimeout(()=>{ osc.stop(); ctx.close(); }, 120);
      }
    } catch {}
  };

  // 프로필 로드
  useEffect(() => {
    me().then(p => {
      if (!p?.nickname) { nav("/nickname"); return; }
      setBest(p.best_score ?? 1.0);
      setNickname(p.nickname ?? null);
      setLoaded(true);
      setRot(0); // 처음 화면은 success.png(앞면) 보이도록
    });
  }, [nav]);

  const toss = async () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    playSound();

    // 1차: 2바퀴(720deg) 회전 시작
    setRot(prev => prev + 720);

    // 0.7초 정도 회전 후 결과 확정 → 면 방향 맞춰 마무리
    setTimeout(async () => {
      const res = await play(chosen, current);
      setCurrent(res.current_score);
      setBest(res.best_score);
      setRank(res.rank);
      setResult(res.result);

      if (res.result === "success") {
        // 성공으로 best 갱신 + Top10이면 보류 저장
        if (res.best_score === res.current_score && res.rank && res.rank <= 10) {
          setPendingTop10({ rank: res.rank, best: res.best_score });
        }
        // 앞면(0deg)으로 멈추도록 보정
        setRot(prev => {
          const want = 0; // 성공 = 앞면
          const mod = ((prev % 360) + 360) % 360;
          const delta = (want - mod + 360) % 360; // 0/180 중 필요한 보정
          return prev + delta;
        });
      } else {
        // 실패면 보류된 축하를 지금 노출
        if (pendingTop10) {
          alert(`🎉 축하합니다! 현재 ${pendingTop10.rank}등 (확률 ${(pendingTop10.best * 100).toFixed(6)}%)`);
          setPendingTop10(null);
        }
        setCurrent(1.0);
        // 뒷면(180deg)으로 멈추도록 보정
        setRot(prev => {
          const want = 180; // 실패 = 뒷면
          const mod = ((prev % 360) + 360) % 360;
          const delta = (want - mod + 360) % 360;
          return prev + delta;
        });
      }

      // 살짝 텀을 두고 스피닝 상태 해제
      setTimeout(() => setSpinning(false), 200);
    }, 700);
  };

  if (!loaded) return null;

  return (
    <>
      <div className="section" style={{display:"grid", gap:12}}>
        <div className="card">
          <div className="gauge-wrap">
            <div className="gauge-label">
              선택 확률: <b>{chosen.toFixed(1)}</b>
            </div>
            <input
              className="range"
              type="range"
              min={0.1}
              max={0.9}
              step={0.1}
              value={chosen}
              onChange={(e) => setChosen(Number(e.target.value))}
            />
          </div>
        </div>

        {/* 중앙 3D 코인 (앞: success.png, 뒤: fail.png) */}
        <div className="card">
          <div className="coin-stage">
            <div
              className={`coin3d ${spinning ? "spin" : ""}`}
              style={{ transform: `rotateY(${rot}deg)` }}
              aria-label="coin"
            >
              <div className="coin-face front">
                <img src="/success.png" alt="success" />
              </div>
              <div className="coin-face back">
                <img src="/fail.png" alt="fail" />
              </div>
            </div>
          </div>

          <div className="stat">
            <div className="label">현재 누적 확률</div>
            <div className="value">{fmtProb(current)}</div>
          </div>
          <div className="stat">
            <div className="label">나의 최고 기록</div>
            <div className="value">{fmtProb(best)}</div>
          </div>
          <div className="stat">
            <div className="label">내 현재 랭킹</div>
            <div className="value">{rank ?? "-"}</div>
          </div>
          {result && (
            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                color: result === "success" ? "var(--success)" : "var(--danger)",
                textAlign: "center"
              }}
            >
              결과: {result === "success" ? "성공" : "실패"}
            </div>
          )}
        </div>
      </div>

      {/* 하단 CTA: 텍스트를 'TOSS' 로 */}
      <div className="cta" style={{display:"grid", gap:8}}>
        <Button full onClick={toss} disabled={spinning}>
          {spinning ? "TOSS…" : "TOSS"}
        </Button>
        <Button
          full
          variant="ghost"
          onClick={() => shareMyRank({ best, rank, nickname })}
          disabled={spinning}
        >
          내 랭킹 공유하기
        </Button>
      </div>
    </>
  );
}
