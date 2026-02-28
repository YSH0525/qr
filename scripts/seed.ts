import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import * as schema from "../src/db/schema";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";

const dbPath = path.resolve(process.cwd(), "sqlite.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite, { schema });

// Run migrations
migrate(db, { migrationsFolder: "./drizzle" });

console.log("🏨 시드 데이터 생성 중...");

// Seed rooms (101~110)
const roomData = [];
for (let floor = 1; floor <= 3; floor++) {
  for (let room = 1; room <= 5; room++) {
    const roomNumber = `${floor}0${room}`;
    roomData.push({
      roomNumber,
      roomId: uuidv4(),
      floor: `${floor}층`,
    });
  }
}

for (const room of roomData) {
  db.insert(schema.rooms)
    .values(room)
    .onConflictDoNothing()
    .run();
}
console.log(`✅ ${roomData.length}개 객실 생성 완료`);

// Seed categories
const categories = [
  { name: "음료", displayOrder: 1 },
  { name: "과자/스낵", displayOrder: 2 },
  { name: "라면/즉석식품", displayOrder: 3 },
  { name: "생활용품", displayOrder: 4 },
];

for (const cat of categories) {
  db.insert(schema.menuCategories)
    .values(cat)
    .onConflictDoNothing()
    .run();
}
console.log(`✅ ${categories.length}개 카테고리 생성 완료`);

// Seed menu items
const menuItemsData = [
  // 음료 (categoryId: 1)
  { categoryId: 1, name: "코카콜라 355ml", price: 2000, displayOrder: 1 },
  { categoryId: 1, name: "스프라이트 355ml", price: 2000, displayOrder: 2 },
  { categoryId: 1, name: "제주 삼다수 500ml", price: 1500, displayOrder: 3 },
  { categoryId: 1, name: "카페라떼 200ml", price: 2500, displayOrder: 4 },
  { categoryId: 1, name: "오렌지주스 200ml", price: 2500, displayOrder: 5 },
  { categoryId: 1, name: "맥주 카스 355ml", price: 4000, displayOrder: 6 },
  { categoryId: 1, name: "소주 참이슬", price: 5000, displayOrder: 7 },
  { categoryId: 1, name: "이온음료 포카리 500ml", price: 2000, displayOrder: 8 },

  // 과자/스낵 (categoryId: 2)
  { categoryId: 2, name: "새우깡", price: 2000, displayOrder: 1 },
  { categoryId: 2, name: "포카칩 오리지널", price: 2500, displayOrder: 2 },
  { categoryId: 2, name: "칙촉 초코칩쿠키", price: 2500, displayOrder: 3 },
  { categoryId: 2, name: "빼빼로 초코", price: 2000, displayOrder: 4 },
  { categoryId: 2, name: "허니버터칩", price: 3000, displayOrder: 5 },
  { categoryId: 2, name: "오징어땅콩", price: 2500, displayOrder: 6 },
  { categoryId: 2, name: "마이쮸 딸기", price: 1500, displayOrder: 7 },
  { categoryId: 2, name: "컵라면 육개장", price: 1500, displayOrder: 8 },

  // 라면/즉석식품 (categoryId: 3)
  { categoryId: 3, name: "신라면", price: 2000, displayOrder: 1 },
  { categoryId: 3, name: "짜파게티", price: 2000, displayOrder: 2 },
  { categoryId: 3, name: "불닭볶음면", price: 2500, displayOrder: 3 },
  { categoryId: 3, name: "진라면 매운맛", price: 2000, displayOrder: 4 },
  { categoryId: 3, name: "삼양라면", price: 2000, displayOrder: 5 },
  { categoryId: 3, name: "햇반 210g", price: 2000, displayOrder: 6 },
  { categoryId: 3, name: "김치찌개 즉석밥", price: 4500, displayOrder: 7 },
  { categoryId: 3, name: "참치마요 삼각김밥", price: 1500, displayOrder: 8 },

  // 생활용품 (categoryId: 4)
  { categoryId: 4, name: "칫솔세트", price: 3000, displayOrder: 1 },
  { categoryId: 4, name: "면도기", price: 3000, displayOrder: 2 },
  { categoryId: 4, name: "샴푸 미니", price: 2500, displayOrder: 3 },
  { categoryId: 4, name: "바디워시 미니", price: 2500, displayOrder: 4 },
  { categoryId: 4, name: "충전케이블 (C타입)", price: 5000, displayOrder: 5 },
  { categoryId: 4, name: "충전케이블 (8핀)", price: 5000, displayOrder: 6 },
  { categoryId: 4, name: "물티슈", price: 1500, displayOrder: 7 },
  { categoryId: 4, name: "일회용 슬리퍼", price: 2000, displayOrder: 8 },
];

for (const item of menuItemsData) {
  db.insert(schema.menuItems)
    .values(item)
    .onConflictDoNothing()
    .run();
}
console.log(`✅ ${menuItemsData.length}개 메뉴 아이템 생성 완료`);

console.log("🎉 시드 데이터 생성 완료!");

// Print rooms for reference
const allRooms = db.select().from(schema.rooms).all();
console.log("\n📋 생성된 객실 목록:");
allRooms.forEach((r) => {
  console.log(`  ${r.roomNumber}호 (${r.floor}) - QR ID: ${r.roomId}`);
});

sqlite.close();
