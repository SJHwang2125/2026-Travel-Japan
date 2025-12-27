import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import * as dotenv from "dotenv";
import { resolve } from "path";
import { TRIP_DATA, BUDGET_DATA, TODO_DATA } from "../data/tripData";

// .env.local 파일 로드
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

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
  console.log("🚀 Firebase 데이터 업로드 시작...");
  try {
    const docRef = doc(db, "trips", "japan2026");
    await setDoc(docRef, {
      hubs: TRIP_DATA,
      budget: BUDGET_DATA,
      todos: TODO_DATA,
      lastUpdated: new Date().toISOString(),
    });
    console.log("✅ 업로드 성공! 이제 사이트에서 확인하세요.");
    process.exit(0);
  } catch (error) {
    console.error("❌ 업로드 실패:", error);
    process.exit(1);
  }
}

seed();