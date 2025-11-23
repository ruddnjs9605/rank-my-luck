import React, { useEffect, useState } from "react";
import { fetchRanking } from "../lib/api";          // ✅ leaderboard → fetchRanking 로 변경
import Button from "../components/Button";
import { shareMyRank } from "../lib/share";
import { useLocation } from "react-router-dom";

const fmt = (p: number) => {
  const pct = p * 100;
  if (pct >= 0.01) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(12).replace(/0+$/, "")}%`;
};

type TopRow = {
  nickname: string;
  best_score: number;
};

// 백엔드에서 오는 row 타입 (best_prob AS bestProb)
type ApiRow = {
  nickname: string;
  bestProb: number | null;
};

export default function Leaderboard() {
  const [top, setTop] = useState<TopRow[]>([]);
  const [me, setMe] = useState<{ nickname: string | null; best_score: number | null; rank: number | null } | null>(null);
  const [event, setEvent] = useState<{
    participants: number;
    prizePool: number;
    threshold: number;
    maxPrize: number;
    nextReset: string;
    lastWinner: { date: string; prizePool: number; nickname: string | null; best: number | null } | null;
  } | null>(null);
  const [sharedInfo, setSharedInfo] = useState<{ rank?: string; best?: string; nickname?: string } | null>(null);
  const location = useLocation();

  // 공유 링크 파라미터 배지
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const rank = q.get("rank") || undefined;
    const best = q.get("best") || undefined;
    const nickname = q.get("nickname") || undefined;
    if (rank || best || nickname) setSharedInfo({ rank, best, nickname });
  }, [location.search]);

  // Top100 로드 (현재는 내 순위(me) 정보는 백엔드에서 아직 안 주기 때문에 null 유지)
  useEffect(() => {
    fetchRanking()
      .then((res) => {
        const rows = (res.rows as ApiRow[] | undefined) ?? [];

        // bestProb 를 우리가 쓰던 best_score 로 매핑
        const mapped: TopRow[] = rows
          .filter((r) => r.bestProb != null)
          .map((r) => ({
            nickname: r.nickname,
            best_score: r.bestProb as number,
          }));

        setTop(mapped);
        setMe(res.me ?? null);
        setEvent(res.event ?? null);
      })
      .catch((err) => {
        console.error("랭킹 불러오기 실패:", err);
      });
  }, []);

  return (
    <>
      <div className="section">
        {sharedInfo && (
          <div
            className="card"
            style={{ background: "#f0f7ff", borderColor: "#d9e8ff", marginBottom: 12 }}
          >
            <div style={{ fontSize: 13, color: "#1f5fbf", marginBottom: 6 }}>공유된 기록</div>
            <div style={{ fontWeight: 700 }}>
              {(sharedInfo.nickname ?? "플레이어")}{" "}
              {sharedInfo.rank ? `— ${sharedInfo.rank}등` : ""}{" "}
              {sharedInfo.best ? `· ${fmt(Number(sharedInfo.best))}` : ""}
            </div>
          </div>
        )}

        {/* Top 100 리스트 */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Top 100</div>
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {top.map((u, i) => {
              const rankNum = i + 1;
              const isMe = me?.nickname && u.nickname === me.nickname; // 간단 매칭(닉네임 기준)
              return (
                <li
                  key={`${u.nickname}-${i}`}
                  className="stat"
                  style={
                    isMe ? { background: "#f9fbff", borderRadius: 8, padding: "12px" } : undefined
                  }
                >
                  <div className="label">
                    {rankNum}. {u.nickname ?? "(비공개)"}
                    {isMe && (
                      <span style={{ marginLeft: 6, color: "var(--primary)", fontWeight: 700 }}>
                        나
                      </span>
                    )}
                  </div>
                  <div className="value">{fmt(u.best_score)}</div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* 이벤트 정보 */}
        {event && (
          <div className="card" style={{ marginTop: 12, background: "#f9fbff", borderColor: "#d9e8ff" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>오늘의 이벤트</div>
            <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 8 }}>
              매일 22:00 리셋 · 참여자 1000명↑ 시 상금 풀 생성 (최대 {event.maxPrize.toLocaleString()}P)
            </div>
            <div className="stat">
              <div className="label">참여자</div>
              <div className="value">
                {event.participants}명 / {event.threshold}명
              </div>
            </div>
            <div className="stat">
              <div className="label">상금 풀</div>
              <div className="value">
                {event.prizePool > 0 ? `${event.prizePool.toLocaleString()}P` : "조건 미충족"}
                <span style={{ marginLeft: 6, color: "#6b7280", fontWeight: 600 }}>
                  (최대 {event.maxPrize.toLocaleString()}P)
                </span>
              </div>
            </div>
            <div className="stat">
              <div className="label">다음 리셋</div>
              <div className="value">
                {new Date(event.nextReset).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false })}
              </div>
            </div>
            {event.lastWinner && (
              <div className="stat">
                <div className="label">어제 우승</div>
                <div className="value">
                  {event.lastWinner.nickname ?? "익명"} · {event.lastWinner.prizePool.toLocaleString()}P
                </div>
              </div>
            )}
          </div>
        )}

        {/* 내 순위 카드 (현재는 me 정보가 없으니 표시 안 될 수 있음) */}
        {me && (
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>내 순위</div>
            <div className="stat">
              <div className="label">랭킹</div>
              <div className="value">{me.rank ?? "-"}</div>
            </div>
            <div className="stat">
              <div className="label">내 기록</div>
              <div className="value">{fmt(me.best_score ?? 1)}</div>
            </div>

            <div style={{ marginTop: 10 }}>
              <Button
                variant="ghost"
                full
                onClick={() =>
                  shareMyRank({
                    best: me.best_score ?? 1,
                    rank: me.rank ?? null,
                    nickname: me.nickname ?? undefined,
                  })
                }
              >
                내 랭킹 공유하기
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
