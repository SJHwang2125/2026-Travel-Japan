import { db } from "@/lib/firebase";
import { collection, doc, getDoc, setDoc } from "firebase/firestore";
import { TRIP_DATA, BUDGET_DATA, TODO_DATA, Hub, BudgetItem, TodoItem } from "@/data/tripData";

const TRIP_COLLECTION = "trips";
const TRIP_DOC_ID = "japan2026"; // Single document for this trip

export interface TripDocument {
  hubs: Hub[];
  budget: BudgetItem[];
  todos: TodoItem[];
  lastUpdated: string;
}

// Fetch Trip Data from Firestore
export const fetchTripData = async (): Promise<TripDocument | null> => {
  try {
    const docRef = doc(db, TRIP_COLLECTION, TRIP_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as TripDocument;
    } else {
      console.log("No such document!");
      return null;
    }
  } catch (error) {
    console.error("Error fetching trip data:", error);
    return null;
  }
};

// Upload (Seed) Hardcoded Data to Firestore
export const uploadInitialData = async () => {
  try {
    const docRef = doc(db, TRIP_COLLECTION, TRIP_DOC_ID);
    const data: TripDocument = {
      hubs: TRIP_DATA,
      budget: BUDGET_DATA,
      todos: TODO_DATA,
      lastUpdated: new Date().toISOString(),
    };
    
    await setDoc(docRef, data);
    console.log("Document successfully written!");
    return true;
  } catch (error) {
    console.error("Error writing document: ", error);
    return false;
  }
};

// Update Trip Data (Allow anyone to save)
export const updateTripData = async (hubs: Hub[], budget: BudgetItem[], todos: TodoItem[]) => {
  try {
    const docRef = doc(db, TRIP_COLLECTION, TRIP_DOC_ID);
    const data: TripDocument = {
      hubs,
      budget,
      todos,
      lastUpdated: new Date().toISOString(),
    };
    await setDoc(docRef, data);
    return true;
  } catch (error) {
    console.error("Error updating document: ", error);
    return false;
  }
};