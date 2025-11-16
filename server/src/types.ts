export type UserRow = {
  id: number;
  nickname: string | null;
  toss_user_key: string | null;
  best_prob: number | null; // 가장 낮은(=가장 희박한) 성공 확률
  created_at: string;
};
