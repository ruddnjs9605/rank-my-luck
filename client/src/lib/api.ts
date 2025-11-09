const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";

export const setToken = (t: string) => localStorage.setItem("token", t);
export const getToken = () => localStorage.getItem("token");

const headers = () => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${getToken()}`,
});

export const devLogin = async (user_id: string) => {
  const r = await fetch(`${API}/auth/toss/callback?user_id=${encodeURIComponent(user_id)}`);
  return r.json(); // { token }
};

export const me = async () => {
  const r = await fetch(`${API}/api/me`, { headers: headers() });
  return r.json();
};

export const setNickname = async (nickname: string) => {
  const r = await fetch(`${API}/api/nickname`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ nickname })
  });
  return r.json();
};

export const play = async (chosen_prob: number, prev_score?: number) => {
  const r = await fetch(`${API}/api/play`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ chosen_prob, prev_score })
  });
  return r.json();
};

export const leaderboard = async () => {
  const r = await fetch(`${API}/api/leaderboard`, { headers: headers() });
  return r.json();
};
