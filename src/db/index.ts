import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import path from "path";

const dbPath = path.resolve(process.cwd(), process.env.DATABASE_URL || "sqlite.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// 앱 시작 시 자동 마이그레이션 - 테이블이 없으면 생성
try {
  migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
} catch (e) {
  console.error("Migration error:", e);
}
