import React, { useEffect, useState } from "react";
import { fetchHistoryDates, fetchHistoryRanking, fetchHistoryWinners } from "../lib/api";

const fmtProb = (p: number) => {
  const pct = p * 100;
  if (pct >= 0.01) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(12).replace(/0+$/, "")}%`;
};

type RankRow = { rank: number; best_prob: number; nickname: string | null };
type WinnerRow = { nickname: string | null; amount: number; prize: string | null };

export default function History() {
  const [dates, setDates] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [ranking, setRanking] = useState<RankRow[]>([]);
  const [winners, setWinners] = useState<WinnerRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHistoryDates()
      .then((res) => {
        const d = res.dates || [];
        setDates(d);
        if (d.length > 0) setSelected(d[0]);
      })
      .catch((err) => {
        console.error("history dates error:", err);
      });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    Promise.all([fetchHistoryRanking(selected), fetchHistoryWinners(selected)])
      .then(([ranksRes, winnersRes]) => {
        setRanking(ranksRes.rows || []);
        setWinners(winnersRes.winners || []);
      })
      .catch((err) => console.error("history load error:", err))
      .finally(() => setLoading(false));
  }, [selected]);

  return (
    <div className="section" style={{ display: "grid", gap: 12 }}>
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>과거 랭킹</div>
        <select
          value={selected ?? ""}
          onChange={(e) => setSelected(e.target.value || null)}
          style={{ width: "100%", height: 40, borderRadius: 10, padding: "0 12px" }}
        >
          {dates.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="card">불러오는 중...</div>}

      {!loading && winners.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>당일 경품 당첨자</div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {winners.map((w, idx) => (
              <li key={`${w.nickname ?? "익명"}-${idx}`} className="stat">
                <div className="label">{w.nickname ?? "익명"}</div>
                <div className="value">
                  {w.prize ?? ""} {w.amount ? `(${w.amount}원)` : ""}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && ranking.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Top 100</div>
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {ranking.map((r) => (
              <li key={r.rank} className="stat">
                <div className="label">
                  {r.rank}. {r.nickname ?? "익명"}
                </div>
                <div className="value">{fmtProb(r.best_prob)}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
