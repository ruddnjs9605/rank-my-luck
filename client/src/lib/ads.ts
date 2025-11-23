import { rewardAd } from "./api";
import { toast } from "./toast";

// Toss 보상형 광고 호출 → 보상 지급 API 연동
export async function showRewardedAd(): Promise<boolean> {
  // 요청 키
  const key = (crypto as any).randomUUID ? crypto.randomUUID() : String(Date.now());

  try {
    // Toss AdMob 보상형 광고 (미니앱 환경)
    const anyWindow = window as any;
    const adMob = anyWindow?.Toss?.AdMob;
    if (!adMob?.loadRewardedAd) {
      toast("토스 미니앱에서만 광고를 볼 수 있어요.");
      return false;
    }

    const rewarded = await adMob.loadRewardedAd({
      // TODO: 실제 adUnitId로 교체
      adUnitId: "TEST_REWARDED",
      requestNonPersonalizedAdsOnly: false,
    });
    await rewarded.show({
      onReward: async () => {
        await rewardAd(key);
        toast("코인 20개가 지급됐어요!");
      },
    });
    return true;
  } catch (e) {
    console.warn("showRewardedAd error:", e);
  }

  toast("광고 보상 처리에 실패했어요.");
  return false;
}
