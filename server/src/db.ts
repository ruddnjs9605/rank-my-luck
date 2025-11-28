import { Pool, type QueryResultRow } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DB_POOL_SIZE || 10),
});

export async function query<T extends QueryResultRow = any>(sql: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query<T>(toPg(sql), params);
  return res.rows;
}

export async function one<T extends QueryResultRow = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

export async function exec(sql: string, params: any[] = []): Promise<void> {
  await pool.query(toPg(sql), params);
}

export async function close() {
  await pool.end();
}

// SQLite 스타일 ? 플레이스홀더를 $1, $2... 로 변환
function toPg(sql: string): string {
  let idx = 0;
  return sql.replace(/\?/g, () => {
    idx += 1;
    return `$${idx}`;
  });
}

// 레거시 호환
export const get = one;
export const all = query;
export const run = exec;
