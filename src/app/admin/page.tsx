"use client";

import { useState } from "react";
import { uploadInitialData } from "@/services/tripService";

export default function AdminPage() {
  const [status, setStatus] = useState("Idle");

  const handleUpload = async () => {
    setStatus("Uploading...");
    const success = await uploadInitialData();
    if (success) {
      setStatus("Success! Data uploaded to Firebase.");
    } else {
      setStatus("Error uploading data. Check console.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-white gap-6">
      <h1 className="text-3xl font-bold">Trip Admin</h1>
      <p className="text-slate-400">
        Upload the hardcoded local data to Firestore to initialize the database.
      </p>
      
      <button
        onClick={handleUpload}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-all active:scale-95"
      >
        Upload Initial Data
      </button>

      <div className="text-sm font-mono text-yellow-400">
        Status: {status}
      </div>
    </div>
  );
}