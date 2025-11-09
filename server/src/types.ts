export type User = {
    id: number;
    user_id: string;
    nickname: string | null;
    best_score: number; // smaller is better
    created_at: string;
  };
  