"use client";

import dynamic from 'next/dynamic';

const MapItinerary = dynamic(() => import('@/components/MapItinerary'), {
  ssr: false,
  loading: () => (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-4">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm font-mono animate-pulse">Loading Itinerary...</p>
    </div>
  )
});

export default function Home() {
  return <MapItinerary />;
}