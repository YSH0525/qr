import { config } from "dotenv";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { writeFileSync } from "fs";
import { join } from "path";

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

// 카테고리별 색상 테마
const CATEGORY_THEMES: Record<
  string,
  { bg: string; accent: string; emoji: string; gradient: string }
> = {
  음료: {
    bg: "#dbeafe",
    accent: "#1d4ed8",
    emoji: "🥤",
    gradient: "#93c5fd",
  },
  "과자/스낵": {
    bg: "#fef3c7",
    accent: "#b45309",
    emoji: "🍪",
    gradient: "#fcd34d",
  },
  "라면/즉석식품": {
    bg: "#fee2e2",
    accent: "#b91c1c",
    emoji: "🍜",
    gradient: "#fca5a5",
  },
  생활용품: {
    bg: "#d1fae5",
    accent: "#047857",
    emoji: "🧴",
    gradient: "#6ee7b7",
  },
};

// 상품별 이모지
const ITEM_EMOJIS: Record<string, string> = {
  코카콜라: "🥤",
  스프라이트: "🥤",
  삼다수: "💧",
  카페라떼: "☕",
  오렌지주스: "🍊",
  맥주: "🍺",
  카스: "🍺",
  소주: "🍶",
  참이슬: "🍶",
  이온음료: "💪",
  포카리: "💪",
  새우깡: "🦐",
  포카칩: "🥔",
  칙촉: "🍪",
  빼빼로: "🍫",
  허니버터칩: "🍯",
  오징어땅콩: "🥜",
  마이쮸: "🍬",
  컵라면: "🍜",
  신라면: "🌶️",
  짜파게티: "🍝",
  불닭: "🔥",
  진라면: "🍜",
  삼양라면: "🍜",
  햇반: "🍚",
  김치찌개: "🥘",
  삼각김밥: "🍙",
  칫솔: "🪥",
  면도기: "🪒",
  샴푸: "🧴",
  바디워시: "🧼",
  충전케이블: "🔌",
  C타입: "🔌",
  "8핀": "🔌",
  물티슈: "🧻",
  슬리퍼: "🩴",
};

function getItemEmoji(name: string, fallback: string): string {
  for (const [key, emoji] of Object.entries(ITEM_EMOJIS)) {
    if (name.includes(key)) return emoji;
  }
  return fallback;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateSVG(
  name: string,
  bg: string,
  accent: string,
  gradient: string,
  emoji: string
): string {
  // 이름 줄바꿈 처리
  const maxLen = 9;
  let lines: string[];
  if (name.length <= maxLen) {
    lines = [name];
  } else {
    const mid = Math.ceil(name.length / 2);
    const spaceIdx = name.lastIndexOf(" ", mid);
    const slashIdx = name.lastIndexOf("/", mid);
    const breakIdx = Math.max(spaceIdx, slashIdx);
    if (breakIdx > 2) {
      lines = [name.slice(0, breakIdx), name.slice(breakIdx + 1)];
    } else {
      lines = [name.slice(0, mid), name.slice(mid)];
    }
  }

  const textY = lines.length === 1 ? 228 : 215;
  const textLines = lines
    .map(
      (line, i) =>
        `  <text x="160" y="${textY + i * 30}" text-anchor="middle" font-family="'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif" font-size="22" font-weight="700" fill="${accent}">${escapeXml(line)}</text>`
    )
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${gradient}"/>
    </linearGradient>
  </defs>
  <rect width="320" height="320" rx="20" fill="url(#bg)"/>
  <circle cx="160" cy="120" r="56" fill="white" opacity="0.7"/>
  <text x="160" y="140" text-anchor="middle" font-size="56">${emoji}</text>
${textLines}
</svg>`;
}

function slugify(name: string): string {
  return name
    .replace(/\s+/g, "-")
    .replace(/[/]/g, "-")
    .replace(/[()]/g, "")
    .toLowerCase();
}

async function main() {
  console.log("🖼️  플레이스홀더 이미지 생성 시작...\n");

  const outDir = join(process.cwd(), "public", "menu-images");

  // 카테고리 로드
  const catSnap = await getDocs(collection(db, "menuCategories"));
  const categories: Record<string, string> = {};
  catSnap.forEach((d) => {
    categories[d.id] = d.data().name;
  });
  console.log(`📂 카테고리 ${Object.keys(categories).length}개 로드됨`);

  // 메뉴 아이템 로드
  const itemsSnap = await getDocs(collection(db, "menuItems"));
  const items: {
    id: string;
    name: string;
    categoryId: string;
    imageUrl: string | null;
  }[] = [];
  itemsSnap.forEach((d) => {
    const data = d.data();
    items.push({
      id: d.id,
      name: data.name,
      categoryId: data.categoryId,
      imageUrl: data.imageUrl,
    });
  });
  console.log(`🍽️  메뉴 아이템 ${items.length}개 로드됨\n`);

  let created = 0;
  let skipped = 0;

  for (const item of items) {
    if (item.imageUrl) {
      console.log(`  ⏩ ${item.name} - 이미 이미지 있음`);
      skipped++;
      continue;
    }

    const catName = categories[item.categoryId] || "기타";
    const theme = CATEGORY_THEMES[catName] || {
      bg: "#f3f4f6",
      accent: "#6b7280",
      emoji: "📦",
      gradient: "#d1d5db",
    };
    const emoji = getItemEmoji(item.name, theme.emoji);

    // SVG 생성 및 로컬 저장
    const svg = generateSVG(
      item.name,
      theme.bg,
      theme.accent,
      theme.gradient,
      emoji
    );
    const fileName = `${slugify(item.name)}.svg`;
    const filePath = join(outDir, fileName);
    writeFileSync(filePath, svg, "utf-8");

    // Firestore 업데이트 (public 폴더 상대 경로)
    const imageUrl = `/menu-images/${fileName}`;
    await updateDoc(doc(db, "menuItems", item.id), { imageUrl });

    console.log(`  ✅ ${emoji} ${item.name} → ${fileName}`);
    created++;
  }

  console.log(`\n🎉 완료! 생성: ${created}개, 건너뜀: ${skipped}개`);
  console.log(`📁 이미지 위치: public/menu-images/`);
  process.exit(0);
}

main().catch((e) => {
  console.error("오류:", e);
  process.exit(1);
});
