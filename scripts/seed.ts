import { config } from "dotenv";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

// Load .env.local for standalone script execution
config({ path: ".env.local" });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
  console.log("🏨 시드 데이터 생성 중...");

  // Check if rooms already exist
  const existingRooms = await getDocs(collection(db, "rooms"));
  if (!existingRooms.empty) {
    console.log("⚠️ 데이터가 이미 존재합니다. 시드를 건너뜁니다.");
    console.log("\n📋 기존 객실 목록:");
    existingRooms.forEach((d) => {
      const r = d.data();
      console.log(`  ${r.roomNumber}호 (${r.floor}) - QR ID: ${r.roomId}`);
    });
    process.exit(0);
  }

  // Seed rooms
  const roomData = [];
  for (let floor = 1; floor <= 3; floor++) {
    for (let room = 1; room <= 5; room++) {
      const roomNumber = `${floor}0${room}`;
      roomData.push({
        roomNumber,
        roomId: uuidv4(),
        floor: `${floor}층`,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
    }
  }

  for (const room of roomData) {
    await setDoc(doc(db, "rooms", room.roomId), room);
  }
  console.log(`✅ ${roomData.length}개 객실 생성 완료`);

  // Seed categories
  const categories = [
    { name: "음료", displayOrder: 1, isActive: true },
    { name: "과자/스낵", displayOrder: 2, isActive: true },
    { name: "라면/즉석식품", displayOrder: 3, isActive: true },
    { name: "생활용품", displayOrder: 4, isActive: true },
  ];

  const categoryIds: string[] = [];
  for (const cat of categories) {
    const catId = doc(collection(db, "menuCategories")).id;
    categoryIds.push(catId);
    await setDoc(doc(db, "menuCategories", catId), { ...cat, id: catId });
  }
  console.log(`✅ ${categories.length}개 카테고리 생성 완료`);

  // Seed menu items
  const menuItemsData = [
    // 음료 (category index 0)
    { catIdx: 0, name: "코카콜라 355ml", price: 2000, displayOrder: 1 },
    { catIdx: 0, name: "스프라이트 355ml", price: 2000, displayOrder: 2 },
    { catIdx: 0, name: "제주 삼다수 500ml", price: 1500, displayOrder: 3 },
    { catIdx: 0, name: "카페라떼 200ml", price: 2500, displayOrder: 4 },
    { catIdx: 0, name: "오렌지주스 200ml", price: 2500, displayOrder: 5 },
    { catIdx: 0, name: "맥주 카스 355ml", price: 4000, displayOrder: 6 },
    { catIdx: 0, name: "소주 참이슬", price: 5000, displayOrder: 7 },
    { catIdx: 0, name: "이온음료 포카리 500ml", price: 2000, displayOrder: 8 },
    // 과자/스낵 (category index 1)
    { catIdx: 1, name: "새우깡", price: 2000, displayOrder: 1 },
    { catIdx: 1, name: "포카칩 오리지널", price: 2500, displayOrder: 2 },
    { catIdx: 1, name: "칙촉 초코칩쿠키", price: 2500, displayOrder: 3 },
    { catIdx: 1, name: "빼빼로 초코", price: 2000, displayOrder: 4 },
    { catIdx: 1, name: "허니버터칩", price: 3000, displayOrder: 5 },
    { catIdx: 1, name: "오징어땅콩", price: 2500, displayOrder: 6 },
    { catIdx: 1, name: "마이쮸 딸기", price: 1500, displayOrder: 7 },
    { catIdx: 1, name: "컵라면 육개장", price: 1500, displayOrder: 8 },
    // 라면/즉석식품 (category index 2)
    { catIdx: 2, name: "신라면", price: 2000, displayOrder: 1 },
    { catIdx: 2, name: "짜파게티", price: 2000, displayOrder: 2 },
    { catIdx: 2, name: "불닭볶음면", price: 2500, displayOrder: 3 },
    { catIdx: 2, name: "진라면 매운맛", price: 2000, displayOrder: 4 },
    { catIdx: 2, name: "삼양라면", price: 2000, displayOrder: 5 },
    { catIdx: 2, name: "햇반 210g", price: 2000, displayOrder: 6 },
    { catIdx: 2, name: "김치찌개 즉석밥", price: 4500, displayOrder: 7 },
    { catIdx: 2, name: "참치마요 삼각김밥", price: 1500, displayOrder: 8 },
    // 생활용품 (category index 3)
    { catIdx: 3, name: "칫솔세트", price: 3000, displayOrder: 1 },
    { catIdx: 3, name: "면도기", price: 3000, displayOrder: 2 },
    { catIdx: 3, name: "샴푸 미니", price: 2500, displayOrder: 3 },
    { catIdx: 3, name: "바디워시 미니", price: 2500, displayOrder: 4 },
    { catIdx: 3, name: "충전케이블 (C타입)", price: 5000, displayOrder: 5 },
    { catIdx: 3, name: "충전케이블 (8핀)", price: 5000, displayOrder: 6 },
    { catIdx: 3, name: "물티슈", price: 1500, displayOrder: 7 },
    { catIdx: 3, name: "일회용 슬리퍼", price: 2000, displayOrder: 8 },
  ];

  for (const item of menuItemsData) {
    const itemId = doc(collection(db, "menuItems")).id;
    await setDoc(doc(db, "menuItems", itemId), {
      id: itemId,
      categoryId: categoryIds[item.catIdx],
      name: item.name,
      description: null,
      price: item.price,
      imageUrl: null,
      isAvailable: true,
      displayOrder: item.displayOrder,
      createdAt: new Date().toISOString(),
    });
  }
  console.log(`✅ ${menuItemsData.length}개 메뉴 아이템 생성 완료`);

  // Seed service categories
  const serviceCategories = [
    {
      name: "연박 청소",
      type: "cleaning",
      icon: "Sparkles",
      description: "객실 청소 서비스",
      isActive: true,
      displayOrder: 1,
    },
    {
      name: "체크아웃 연장",
      type: "checkout_extension",
      icon: "Clock",
      description: "체크아웃 시간 연장",
      isActive: true,
      displayOrder: 2,
      hourlyRate: 10000,
    },
    {
      name: "비품 요청",
      type: "amenity",
      icon: "Package",
      description: "추가 비품 요청",
      isActive: true,
      displayOrder: 3,
    },
  ];

  const serviceCategoryIds: string[] = [];
  for (const cat of serviceCategories) {
    const catId = doc(collection(db, "serviceCategories")).id;
    serviceCategoryIds.push(catId);
    await setDoc(doc(db, "serviceCategories", catId), {
      ...cat,
      id: catId,
      createdAt: new Date().toISOString(),
    });
  }
  console.log(`✅ ${serviceCategories.length}개 서비스 카테고리 생성 완료`);

  // Seed service items (amenity category)
  const amenityCatId = serviceCategoryIds[2]; // "비품 요청"
  const serviceItems = [
    { name: "수건", icon: "Droplets", displayOrder: 1 },
    { name: "생수", icon: "Droplets", displayOrder: 2 },
    { name: "어메니티 세트", icon: "Package", displayOrder: 3 },
    { name: "베개", icon: "Package", displayOrder: 4 },
    { name: "담요", icon: "Package", displayOrder: 5 },
  ];

  for (const item of serviceItems) {
    const itemId = doc(collection(db, "serviceItems")).id;
    await setDoc(doc(db, "serviceItems", itemId), {
      id: itemId,
      categoryId: amenityCatId,
      name: item.name,
      icon: item.icon,
      isAvailable: true,
      displayOrder: item.displayOrder,
      createdAt: new Date().toISOString(),
    });
  }
  console.log(`✅ ${serviceItems.length}개 서비스 아이템 생성 완료`);

  console.log("🎉 시드 데이터 생성 완료!");

  // Print rooms for reference
  console.log("\n📋 생성된 객실 목록:");
  roomData.forEach((r) => {
    console.log(`  ${r.roomNumber}호 (${r.floor}) - QR ID: ${r.roomId}`);
  });

  process.exit(0);
}

seed().catch((e) => {
  console.error("시드 오류:", e);
  process.exit(1);
});
