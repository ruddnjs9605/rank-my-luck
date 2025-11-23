import React, { useEffect, useRef, useState } from "react";
import { me, play, rewardAd } from "../lib/api";
import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { shareMyRank } from "../lib/share";
import { wallet } from "../lib/api";
import { showRewardedAd } from "../lib/ads";

const fmtProb = (p: number) => {
  const pct = p * 100;
  if (pct === 0) return "0%";
  if (pct >= 0.01) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(12).replace(/0+$/,"")}%`;
};

export default function Play() {
  const nav = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [chosen, setChosen] = useState(0.5);
  const [current, setCurrent] = useState(1.0);
  const [best, setBest] = useState(1.0);
  const [rank, setRank] = useState<number | null>(null);
  const [result, setResult] = useState<"success" | "fail" | null>(null);
  const [nickname, setNickname] = useState<string | undefined>(undefined);
  const [coins, setCoins] = useState<number>(0);

  const [pendingTop10, setPendingTop10] = useState<{ rank: number; best: number } | null>(null);
  const [adAvailable, setAdAvailable] = useState<boolean>(true);

  // 3D 코인
  const [rot, setRot] = useState(0); // 0=success 앞면, 180=fail 뒷면
  const [spinning, setSpinning] = useState(false);

  // 효과음
  const audioEl = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const el = new Audio();
    el.src = "/sounds/coin.mp3";
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
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = 800;
        g.gain.value = 0.03;
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start();
        setTimeout(() => {
          osc.stop();
          ctx.close();
        }, 120);
      }
    } catch {}
  };

  // 프로필 + 닉네임 확인
  useEffect(() => {
    const load = async () => {
      try {
        const p = await me();
        const storedNick = localStorage.getItem("nickname") || undefined;
        const nick = p?.nickname ?? storedNick;

        if (!nick) {
          // 서버/로컬 어디에도 닉네임이 없으면 닉네임 설정 페이지로
          nav("/nickname");
          return;
        }

        setBest(p.best_score ?? 1.0);
        setNickname(nick);
        setCoins(p.coins ?? 0);
        setLoaded(true);
        setRot(0);
      } catch (e) {
        console.error("me() error:", e);
        // 서버 호출 실패 시에도 localStorage 닉네임이 있으면 플레이 허용
        const storedNick = localStorage.getItem("nickname") || undefined;
        if (!storedNick) {
          nav("/nickname");
          return;
        }
        setBest(1.0);
        setNickname(storedNick);
        setCoins(0);
        setLoaded(true);
        setRot(0);
      }

      // 광고 가능 여부 확인 (토스 미니앱)
      const anyWindow = window as any;
      setAdAvailable(Boolean(anyWindow?.Toss?.AdMob?.loadRewardedAd));
    };

    load();
  }, [nav]);

  const toss = async () => {
    if (spinning) return;
    if (coins <= 0) {
      alert("코인이 부족해요. 광고를 보거나 추천인을 통해 코인을 얻어주세요!");
      return;
    }
    setSpinning(true);
    setResult(null);
    playSound();
    setRot((prev) => prev + 720);

    setTimeout(async () => {
      const res = await play(chosen, current);

      // 코인 부족 처리
      if (res?.error === "NO_COINS") {
        setSpinning(false);
        alert("코인이 부족해요. 광고를 보거나 친구에게 공유해 충전해 주세요!");
        try {
          const w = await wallet();
          setCoins(w?.coins ?? 0);
        } catch {}
        return;
      }

      setCurrent(res.current_score);
      setBest(res.best_score);
      setRank(res.rank);
      setResult(res.result);

      if (res.result === "success") {
        if (res.best_score === res.current_score && res.rank && res.rank <= 10) {
          setPendingTop10({ rank: res.rank, best: res.best_score });
        }
        setRot((prev) => {
          const want = 0;
          const mod = ((prev % 360) + 360) % 360;
          const delta = (want - mod + 360) % 360;
          return prev + delta;
        });
      } else {
        if (pendingTop10) {
          alert(`🎉 축하합니다! 현재 ${pendingTop10.rank}등 (확률 ${(pendingTop10.best * 100).toFixed(6)}%)`);
          setPendingTop10(null);
        }
        setCurrent(1.0);
        setRot((prev) => {
          const want = 180;
          const mod = ((prev % 360) + 360) % 360;
          const delta = (want - mod + 360) % 360;
          return prev + delta;
        });
      }

      setTimeout(() => setSpinning(false), 200);

      // 최신 코인 동기화
      try {
        const w = await wallet();
        setCoins(w?.coins ?? coins);
      } catch {}
    }, 700);
  };

  const onRewardAd = async () => {
    const ok = await showRewardedAd();
    if (ok) {
      try {
        const w = await wallet();
        setCoins(w?.coins ?? coins);
      } catch {}
    }
  };

  if (!loaded) return null;

  return (
    <>
      <div className="section" style={{ display: "grid", gap: 12 }}>
        <div className="card">
          <div className="stat">
            <div className="label">보유 코인</div>
            <div className="value">{coins ?? 0}</div>
          </div>
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

        {/* 3D 코인 */}
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
                textAlign: "center",
              }}
            >
              결과: {result === "success" ? "성공" : "실패"}
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="cta" style={{ display: "grid", gap: 8 }}>
        <Button full onClick={toss} disabled={spinning}>
          {spinning ? "TOSS…" : "TOSS"}
        </Button>
        <Button full variant="outline" onClick={onRewardAd} disabled={spinning}>
          {adAvailable ? (coins <= 0 ? "코인 얻기 (광고보기)" : "광고 보고 코인 +20") : "토스 앱에서 광고 보기"}
        </Button>
        <Button
          full
          variant="ghost"
          onClick={() =>
            shareMyRank({
              best,
              rank,
              nickname, // string | undefined
              // referrer: ... (나중에 user id 추가 가능)
            })
          }
          disabled={spinning}
        >
          내 랭킹 공유하기
        </Button>
      </div>
    </>
  );
}
