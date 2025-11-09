import { toast } from "./toast";

export function buildShareUrl(params: { best: number; rank: number | null; nickname?: string }) {
  const url = new URL(window.location.origin + "/leaderboard");
  if (params.rank != null) url.searchParams.set("rank", String(params.rank));
  url.searchParams.set("best", String(params.best));
  if (params.nickname) url.searchParams.set("nickname", params.nickname);
  return url.toString();
}

export async function shareMyRank(opts: { best: number; rank: number | null; nickname?: string }) {
  const url = buildShareUrl(opts);
  const pct = (opts.best * 100);
  const nice = pct >= 0.01 ? `${pct.toFixed(2)}%` : `${pct.toFixed(12).replace(/0+$/,"")}%`;
  const title = "나의 운은 몇등?";
  const text = `${opts.nickname ? `${opts.nickname}의 ` : ""}최고 기록 ${nice}${opts.rank ? ` · 현재 ${opts.rank}등` : ""}`;

  // Toss MiniApp SDK 분기 (추후 연결)
  if ((window as any).Toss?.shareLink) {
    try {
      await (window as any).Toss.shareLink.open({ title, description: text, url });
      toast("공유 창을 열었어요");
      return true;
    } catch {/* pass */}
  }

  // Web Share API
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      toast("공유 창을 열었어요");
      return true;
    } catch {/* pass */}
  }

  // 폴백: 클립보드
  try {
    await navigator.clipboard.writeText(`${title}\n${text}\n${url}`);
    toast("링크를 복사했어요");
    return true;
  } catch {
    prompt("아래 링크를 복사해 공유해 주세요:", url);
    return false;
  }
}
