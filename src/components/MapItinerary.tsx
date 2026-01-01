"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import { fetchTripData, updateTripData } from "@/services/tripService";
import { Hub, BudgetItem, TodoItem, TRIP_DATA, BUDGET_DATA, TODO_DATA } from "@/data/tripData";
import { Clock, MapPin, Navigation, Menu, X, ArrowLeft, ExternalLink, RefreshCw, Plus, Trash2, CheckCircle2, Circle, ArrowRight, Calendar } from "lucide-react";

export default function MapItinerary() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  
  // Data State
  const [tripData, setTripData] = useState<Hub[]>([]);
  const [budgetData, setBudgetData] = useState<BudgetItem[]>([]);
  const [todoData, setTodoData] = useState<TodoItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [viewState, setViewState] = useState<'hubs' | 'days' | 'spots'>('hubs');
  const [activeTab, setActiveTab] = useState<'itinerary' | 'budget' | 'todo'>('itinerary');
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);
  const [activeSpotIndex, setActiveSpotIndex] = useState<number>(0);

  const [currentTime, setCurrentTime] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);
  const [headerTitle, setHeaderTitle] = useState("여행 전체 일정");

  // Nav Params Memo
  const navParams = useMemo(() => {
    if (!selectedHubId || selectedDayIdx === null || !tripData.length) return { prev: null, next: null };
    
    const hubIdx = tripData.findIndex(h => h.id === selectedHubId);
    const hub = tripData[hubIdx];
    if (!hub) return { prev: null, next: null };

    let prev = null;
    let next = null;

    // Prev
    if (selectedDayIdx > 0) {
        prev = { hId: selectedHubId, dIdx: selectedDayIdx - 1, title: hub.days[selectedDayIdx - 1].title, date: hub.days[selectedDayIdx - 1].date };
    } else if (hubIdx > 0) {
        const prevHub = tripData[hubIdx - 1];
        prev = { hId: prevHub.id, dIdx: prevHub.days.length - 1, title: prevHub.days[prevHub.days.length - 1].title, date: prevHub.days[prevHub.days.length - 1].date };
    }

    // Next
    if (selectedDayIdx < hub.days.length - 1) {
        next = { hId: selectedHubId, dIdx: selectedDayIdx + 1, title: hub.days[selectedDayIdx + 1].title, date: hub.days[selectedDayIdx + 1].date };
    } else if (hubIdx < tripData.length - 1) {
        const nextHub = tripData[hubIdx + 1];
        next = { hId: nextHub.id, dIdx: 0, title: nextHub.days[0].title, date: nextHub.days[0].date };
    }

    return { prev, next };
  }, [tripData, selectedHubId, selectedDayIdx]);


  // Fetch Data on Mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const data = await fetchTripData();
      if (data) {
        setTripData(data.hubs);
        setBudgetData(data.budget);
        setTodoData(data.todos || []);
      } else {
        console.warn("Failed to load data from Firebase, or DB is empty. Using local fallback.");
        setTripData(TRIP_DATA);
        setBudgetData(BUDGET_DATA);
        setTodoData(TODO_DATA);
      }
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('ko-KR', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Map Init
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      const map = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false }).setView([34.2, 133], 7);
      
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(map);
      
      markersRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    } catch (e) {
      console.error("Map initialization failed", e);
    }
  }, []);

  // Sync Map with View State & Data
  useEffect(() => {
    if (!mapRef.current || !markersRef.current || isLoading) return;

    if (viewState === 'hubs') {
        renderHubsOnMap();
        setHeaderTitle("여행 전체 일정");
    } else if (viewState === 'days' && selectedHubId) {
        renderDaysOnMap(selectedHubId);
    } else if (viewState === 'spots' && selectedHubId && selectedDayIdx !== null) {
        renderSpotsOnMap(selectedHubId, selectedDayIdx);
    }
  }, [viewState, selectedHubId, selectedDayIdx, tripData, isLoading]);

  // Mobile: Sync Map with Carousel Active Index
  useEffect(() => {
    if (viewState === 'spots' && selectedHubId && selectedDayIdx !== null && mapRef.current) {
        const hub = tripData.find(h => h.id === selectedHubId);
        if (hub) {
            // Adjust index for Prev Card
            const spotIndex = activeSpotIndex - (navParams.prev ? 1 : 0);
            const spot = hub.days[selectedDayIdx].spots[spotIndex];
            
            if (spot) {
                mapRef.current.flyTo(spot.p, 16, { duration: 0.6, easeLinearity: 0.5 });
                
                // Highlight marker
                renderSpotsOnMap(selectedHubId, selectedDayIdx); 
            }
        }
    }
  }, [activeSpotIndex, navParams]);


  const renderHubsOnMap = () => {
    const layer = markersRef.current;
    if (!layer || !mapRef.current) return;
    
    layer.clearLayers();
    if (routeLineRef.current) {
        routeLineRef.current.remove();
        routeLineRef.current = null;
    }

    tripData.forEach(hub => {
        const marker = L.marker(hub.hubPos, { 
            icon: L.divIcon({ className: '', html: '<div class="hub-marker"></div>', iconSize:[24,24] }) 
        });
        
        marker.addTo(layer).bindPopup(`<b class="text-slate-900">${hub.city}</b>`);
        marker.on('click', () => {
            setSelectedHubId(hub.id);
            setViewState('days');
        });
    });

    if (tripData.length > 0) {
        mapRef.current.flyToBounds(tripData.map(h => h.hubPos), { padding: [80, 80], duration: 1.5 });
    }
  };

  const renderDaysOnMap = (hubId: string) => {
    const hub = tripData.find(h => h.id === hubId);
    const layer = markersRef.current;
    if (!hub || !layer || !mapRef.current) return;

    setHeaderTitle(`${hub.city} 일정`);
    layer.clearLayers();
    if (routeLineRef.current) {
        routeLineRef.current.remove();
        routeLineRef.current = null;
    }

    // Show Hub Marker
    L.marker(hub.hubPos, { 
        icon: L.divIcon({ className: '', html: '<div class="hub-marker"></div>', iconSize:[24,24] }) 
    }).addTo(layer);

    mapRef.current.flyTo(hub.hubPos, 11, { duration: 1.2 });
  };

  const renderSpotsOnMap = (hubId: string, dayIdx: number) => {
    const hub = tripData.find(h => h.id === hubId);
    if (!hub) return;
    const day = hub.days[dayIdx];
    const layer = markersRef.current;
    if (!layer || !mapRef.current) return;

    setHeaderTitle(`${hub.city} > ${day.title.split(':')[0]}`);
    layer.clearLayers();
    
    const points: [number, number][] = [];

    day.spots.forEach((spot, idx) => {
        points.push(spot.p);
        
        // Adjust for Prev Card
        const adjustedActiveIdx = activeSpotIndex - (navParams.prev ? 1 : 0);
        const isActive = idx === adjustedActiveIdx;

        // Highlight active marker with a different class or size
        const markerClass = isActive ? "spot-marker active-marker" : "spot-marker";
        const zIndex = isActive ? 1000 : 0;
        
        const iconHtml = `<div id="marker-${idx}" class="${markerClass}"></div>`;
        const marker = L.marker(spot.p, { 
            icon: L.divIcon({ className: '', html: iconHtml, iconSize:[14,14] }),
            zIndexOffset: zIndex
        });
        
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.n)}`;
        const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.p[0]},${spot.p[1]}`;

        marker.addTo(layer).bindPopup(`
            <div class="text-center min-w-[120px]">
                <b class="text-slate-900 block mb-1">${spot.n}</b>
                <div class="flex justify-center gap-2 text-xs mt-1">
                    <a href="${googleMapsUrl}" target="_blank" class="text-slate-600 underline">지도</a>
                    <span class="text-slate-400">|</span>
                    <a href="${dirUrl}" target="_blank" class="text-blue-600 underline">경로</a>
                </div>
            </div>
        `);
        
        // On marker click, scroll carousel to this item
        marker.on('click', () => {
            // Need to add offset back
            const carouselIdx = idx + (navParams.prev ? 1 : 0);
            setActiveSpotIndex(carouselIdx);
            if (carouselRef.current) {
                const cardWidth = 320; // Approx card width + gap
                carouselRef.current.scrollTo({ left: carouselIdx * cardWidth, behavior: 'smooth' });
            }
        });
    });

    if (points.length > 0) {
        if (routeLineRef.current) routeLineRef.current.remove();
        routeLineRef.current = L.polyline(points, { 
            color: '#3b82f6', weight: 3, dashArray: '5, 10', opacity: 0.6, lineCap: 'round' 
        }).addTo(mapRef.current);
    }
  };

  const showMyLocation = () => {
    if(!navigator.geolocation) {
        alert('GPS를 지원하지 않는 브라우저입니다.');
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            if(mapRef.current) {
                L.marker([lat, lng], { 
                    icon: L.divIcon({ 
                        className: '', 
                        html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg pulse"></div>', 
                        iconSize:[16,16] 
                    }) 
                }).addTo(mapRef.current).bindPopup("현재 위치").openPopup();
                mapRef.current.flyTo([lat, lng], 16);
            }
        },
        (err) => {
            alert('위치 정보를 가져올 수 없습니다: ' + err.message);
        }
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    const success = await updateTripData(tripData, budgetData, todoData);
    if (success) {
      alert("변경 사항이 저장되었습니다!");
      setIsEditMode(false);
    } else {
      alert("저장 중 오류가 발생했습니다. (Firebase 권한 설정을 확인하세요)");
    }
    setIsSaving(false);
  };

  const handleSpotChange = (hubId: string, dayIdx: number, spotIdx: number, field: string, value: string) => {
    const newData = [...tripData];
    const hub = newData.find(h => h.id === hubId);
    if (hub) {
        const spot = hub.days[dayIdx].spots[spotIdx];
        (spot as any)[field] = value;
        setTripData(newData);
    }
  };

  const handleAddSpot = (hubId: string, dayIdx: number) => {
    const newData = [...tripData];
    const hub = newData.find(h => h.id === hubId);
    if (hub) {
        const daySpots = hub.days[dayIdx].spots;
        const defaultPos = daySpots.length > 0 ? daySpots[daySpots.length - 1].p : hub.hubPos;
        
        hub.days[dayIdx].spots.push({
            t: "00:00",
            n: "새로운 장소",
            p: defaultPos,
            d: "설명을 입력하세요"
        });
        setTripData(newData);
    }
  };

  const handleDeleteSpot = (hubId: string, dayIdx: number, spotIdx: number) => {
    if (!confirm("정말 이 장소를 삭제하시겠습니까?")) return;
    
    const newData = [...tripData];
    const hub = newData.find(h => h.id === hubId);
    if (hub) {
        hub.days[dayIdx].spots.splice(spotIdx, 1);
        setTripData(newData);
    }
  };

  // --- Budget Handlers ---
  const handleBudgetChange = (idx: number, field: 'item' | 'cost', value: string | number) => {
    const newData = [...budgetData];
    (newData[idx] as any)[field] = value;
    setBudgetData(newData);
  };

  const handleAddBudget = () => {
    setBudgetData([...budgetData, { item: "새 항목", cost: 0 }]);
  };

  const handleDeleteBudget = (idx: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const newData = [...budgetData];
    newData.splice(idx, 1);
    setBudgetData(newData);
  };

  // --- Todo Handlers ---
  const handleTodoToggle = (idx: number) => {
    const newData = [...todoData];
    newData[idx].completed = !newData[idx].completed;
    setTodoData(newData);
  };

  const handleTodoChange = (idx: number, text: string) => {
    const newData = [...todoData];
    newData[idx].text = text;
    setTodoData(newData);
  };

  const handleAddTodo = () => {
    setTodoData([...todoData, { id: Date.now().toString(), text: "새 할 일", completed: false }]);
  };

  const handleDeleteTodo = (idx: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    const newData = [...todoData];
    newData.splice(idx, 1);
    setTodoData(newData);
  };

  // Helper to handle back button
  const handleBack = () => {
    if (viewState === 'spots') {
        setViewState('days');
        setSelectedDayIdx(null);
    } else if (viewState === 'days') {
        setViewState('hubs');
        setSelectedHubId(null);
    }
  };

  const handleCarouselScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const cardWidth = 300; // rough width of card + gap
    // Simple logic: find which index is closest to scrollLeft
    const newIndex = Math.round(container.scrollLeft / cardWidth);
    if (newIndex !== activeSpotIndex) {
        setActiveSpotIndex(newIndex);
    }
  };

  // --- Render Helpers ---

  const renderItineraryList = () => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-500">
                <RefreshCw className="animate-spin" />
                <p className="text-xs">일정을 불러오고 있습니다...</p>
            </div>
        );
    }

    if (tripData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-500">
                <p className="text-sm">데이터가 없습니다.</p>
                <a href="/admin" className="text-xs text-blue-400 underline">데이터 업로드하기 (Admin)</a>
            </div>
        );
    }

    if (viewState === 'hubs') {
        return (
            <div className="space-y-3 animate-in">
                <div className="mb-4 pl-2 border-l-4 border-blue-600">
                    <h2 className="text-lg font-bold text-white">지역 선택</h2>
                    <p className="text-xs text-slate-500">여행할 도시를 선택하세요</p>
                </div>
                {tripData.map(hub => (
                    <div key={hub.id} 
                        onClick={() => { setSelectedHubId(hub.id); setViewState('days'); }}
                        className="group bg-slate-900/50 p-5 rounded-xl border border-slate-800 cursor-pointer hover:border-blue-500/50 hover:bg-slate-800 transition-all duration-300">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] bg-blue-900/40 text-blue-200 px-2 py-0.5 rounded font-mono border border-blue-500/20">{hub.dates}</span>
                            <span className="text-xs text-slate-600 group-hover:text-blue-400 transition-colors">상세보기 →</span>
                        </div>
                        <h3 className="text-xl font-bold text-white group-hover:text-blue-100 transition">{hub.city}</h3>
                        <p className="text-xs text-slate-500 mt-1">{hub.desc}</p>
                    </div>
                ))}
            </div>
        );
    }

    if (viewState === 'days' && selectedHubId) {
        const hub = tripData.find(h => h.id === selectedHubId);
        if (!hub) return null;
        
        // Check for Pass Dates (2/4 ~ 2/10)
        const passDates = ['2/4', '2/5', '2/6', '2/7', '2/8', '2/9', '2/10'];

        return (
            <div className="space-y-3 animate-in">
                <button onClick={handleBack} className="flex items-center text-xs text-blue-400 mb-4 hover:text-blue-300 transition">
                    <ArrowLeft size={12} className="mr-1" /> 지역 목록으로
                </button>
                <h2 className="text-3xl font-extrabold text-white mb-1 tracking-tight">{hub.city}</h2>
                <p className="text-sm text-slate-500 mb-6 font-light">{hub.desc}</p>

                {hub.days.map((day, idx) => {
                    const isPassDay = passDates.some(d => day.date.includes(d));
                    const dateStyle = isPassDay ? 'italic text-yellow-400 font-bold' : 'text-blue-400';
                    const passBadge = isPassDay ? <span className="ml-2 text-[10px] bg-yellow-600/40 text-yellow-200 px-1.5 py-0.5 rounded border border-yellow-500/30 not-italic">SETOUCHI PASS</span> : null;

                    return (
                        <div key={idx} 
                            onClick={() => { setSelectedDayIdx(idx); setViewState('spots'); setActiveSpotIndex(navParams.prev ? 1 : 0); setMobileSidebarOpen(false); }}
                            className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-800 hover:border-slate-700 transition">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-mono bg-blue-900/20 px-1.5 rounded ${dateStyle}`}>
                                    {day.date}
                                </span>
                                {passBadge}
                                <div className="h-px bg-slate-800 flex-1"></div>
                            </div>
                            <h3 className="font-bold text-slate-200 text-lg">{day.title}</h3>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                <MapPin size={10} /> {day.spots.length}개 장소
                            </p>
                        </div>
                    );
                })}
            </div>
        );
    }

    if (viewState === 'spots' && selectedHubId && selectedDayIdx !== null) {
        const hub = tripData.find(h => h.id === selectedHubId);
        if (!hub) return null;
        const day = hub.days[selectedDayIdx];

        const passDates = ['2/4', '2/5', '2/6', '2/7', '2/8', '2/9', '2/10'];
        const isPassDay = passDates.some(d => day.date.includes(d));
        const dateClass = isPassDay ? 'italic text-yellow-400 font-bold' : 'text-slate-500';
        const passBadge = isPassDay ? <span className="ml-2 text-[10px] bg-yellow-600/40 text-yellow-200 px-1.5 py-0.5 rounded border border-yellow-500/30 not-italic">SETOUCHI PASS</span> : null;

        return (
            <div className="animate-in pb-32 md:pb-0"> 
                <div className="flex justify-between items-center mb-4">
                    <button onClick={handleBack} className="flex items-center text-xs text-blue-400 hover:text-blue-300 transition">
                        <ArrowLeft size={12} className="mr-1" /> 날짜 목록으로
                    </button>
                    <div className="flex gap-2">
                        {isEditMode ? (
                            <button onClick={handleSave} disabled={isSaving} className="text-[10px] bg-green-600 hover:bg-green-500 px-2 py-1 rounded flex items-center gap-1 transition">
                                {isSaving ? <RefreshCw size={10} className="animate-spin" /> : "저장"}
                            </button>
                        ) : (
                            <button onClick={() => setIsEditMode(true)} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition border border-slate-700">
                                편집
                            </button>
                        )}
                    </div>
                </div>

                <h2 className="text-xl font-bold text-white mb-1 leading-tight">{day.title}</h2>
                <div className={`text-xs mb-8 font-mono border-b border-slate-800 pb-4 flex items-center ${dateClass}`}>
                    {day.date} {passBadge}
                </div>

                <div className="relative pl-6 pb-10 border-l border-slate-800 ml-2 space-y-8">
                    {day.spots.map((spot, idx) => {
                        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.n)}`;
                        const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${spot.p[0]},${spot.p[1]}`;
                        const adjustedActiveIdx = activeSpotIndex - (navParams.prev ? 1 : 0);
                        const isActive = idx === adjustedActiveIdx;

                        return (
                            <div key={idx} 
                                id={`list-spot-${idx}`}
                                className={`relative group transition-all duration-500 ${isActive ? 'opacity-100 scale-100' : 'opacity-60 scale-95'}`}
                            >
                                <div className={`absolute -left-[31px] top-1.5 w-3 h-3 rounded-full border border-slate-900 z-10 transition-colors shadow-[0_0_0_4px_rgba(2,6,23,1)] ${isActive ? 'bg-blue-500 animate-pulse' : 'bg-slate-700 group-hover:bg-blue-500'}`}></div>
                                
                                <div className="flex gap-2 items-start">
                                    <div className="flex-1 space-y-2">
                                        {isEditMode ? (
                                            <div className="bg-slate-900/80 p-3 rounded-lg border border-blue-500/30 space-y-2">
                                                <input 
                                                    className="w-full bg-slate-800 text-blue-300 text-[10px] px-2 py-1 rounded border border-slate-700 focus:outline-none"
                                                    value={spot.t} 
                                                    onChange={(e) => handleSpotChange(selectedHubId!, selectedDayIdx!, idx, 't', e.target.value)} 
                                                />
                                                <input 
                                                    className="w-full bg-slate-800 text-white text-sm font-bold px-2 py-1 rounded border border-slate-700 focus:outline-none"
                                                    value={spot.n} 
                                                    onChange={(e) => handleSpotChange(selectedHubId!, selectedDayIdx!, idx, 'n', e.target.value)} 
                                                />
                                                <textarea 
                                                    className="w-full bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded border border-slate-700 focus:outline-none resize-none"
                                                    value={spot.d} 
                                                    rows={2}
                                                    onChange={(e) => handleSpotChange(selectedHubId!, selectedDayIdx!, idx, 'd', e.target.value)} 
                                                />
                                            </div>
                                        ) : (
                                            <div className="cursor-pointer" onClick={() => { setActiveSpotIndex(idx + (navParams.prev ? 1 : 0)); }}>
                                                <span className={`text-[10px] font-mono text-blue-300 bg-blue-900/30 px-1.5 py-0.5 rounded mb-1 inline-block border border-blue-500/10 ${isActive ? 'text-blue-200 bg-blue-600/50 border-blue-400' : ''}`}>{spot.t}</span>
                                                <h4 className={`text-sm font-bold transition ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'}`}>{spot.n}</h4>
                                                <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{spot.d}</p>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {isEditMode && (
                                        <button 
                                            onClick={() => handleDeleteSpot(selectedHubId!, selectedDayIdx!, idx)}
                                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition"
                                            title="삭제"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>

                                {!isEditMode && isActive && (
                                    <div className="flex gap-3 mt-2 animate-in slide-in-from-top-2 fade-in">
                                        <a href={googleMapsUrl} target="_blank" className="inline-flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-400 transition">
                                            <ExternalLink size={10} /> Google Map
                                        </a>
                                        <a href={dirUrl} target="_blank" className="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-400 transition">
                                            <Navigation size={10} /> 경로 찾기
                                        </a>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Add Spot Button */}
                    {isEditMode && (
                        <button 
                            onClick={() => handleAddSpot(selectedHubId!, selectedDayIdx!)}
                            className="w-full py-3 mt-4 border border-dashed border-slate-700 rounded-xl text-slate-400 hover:text-blue-400 hover:border-blue-500/50 hover:bg-slate-800/50 transition flex items-center justify-center gap-2 text-xs font-bold"
                        >
                            <Plus size={14} /> 장소 추가하기
                        </button>
                    )}

                    {/* Next Day Navigation (Desktop) */}
                    {!isEditMode && navParams.next && (
                        <div 
                            onClick={() => { setSelectedHubId(navParams.next.hId); setSelectedDayIdx(navParams.next.dIdx); setActiveSpotIndex(navParams.next.dIdx > 0 ? 0 : 0); }}
                            className="mt-8 p-4 rounded-xl border border-dashed border-slate-700 hover:border-blue-500 hover:bg-slate-800/50 cursor-pointer transition text-center group animate-in"
                        >
                            <p className="text-xs text-slate-500 group-hover:text-blue-400 mb-1">다음 날 일정 이어보기</p>
                            <h3 className="font-bold text-slate-200 group-hover:text-white flex items-center justify-center gap-2">
                                {navParams.next.title} 
                                <ArrowLeft size={16} className="rotate-180" />
                            </h3>
                        </div>
                    )}
                </div>
            </div>
        );
    }
  };

  const renderBudgetList = () => {
    const total = budgetData.reduce((acc, curr) => acc + curr.cost, 0);
    return (
        <div className="p-2 animate-in">
            <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-800 shadow-inner">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-blue-400 flex items-center gap-2">
                        <span>💰</span> 1인 기준 예산
                    </h3>
                    <div className="flex gap-2">
                        {isEditMode ? (
                            <button onClick={handleSave} disabled={isSaving} className="text-[10px] bg-green-600 hover:bg-green-500 px-2 py-1 rounded flex items-center gap-1 transition">
                                {isSaving ? <RefreshCw size={10} className="animate-spin" /> : "저장"}
                            </button>
                        ) : (
                            <button onClick={() => setIsEditMode(true)} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition border border-slate-700">
                                편집
                            </button>
                        )}
                    </div>
                </div>
                <div className="space-y-3 text-sm">
                    {budgetData.map((b, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-slate-950/50 rounded-lg text-slate-300 text-xs border border-slate-800/50 hover:border-blue-500/30 transition group">
                            {isEditMode ? (
                                <>
                                    <input 
                                        className="bg-slate-800 text-white px-2 py-1 rounded border border-slate-700 w-[60%] focus:outline-none"
                                        value={b.item}
                                        onChange={(e) => handleBudgetChange(idx, 'item', e.target.value)}
                                    />
                                    <input 
                                        type="number"
                                        className="bg-slate-800 text-white px-2 py-1 rounded border border-slate-700 w-[30%] text-right focus:outline-none font-mono"
                                        value={b.cost}
                                        onChange={(e) => handleBudgetChange(idx, 'cost', parseInt(e.target.value) || 0)}
                                    />
                                    <button onClick={() => handleDeleteBudget(idx)} className="text-slate-500 hover:text-red-400"><Trash2 size={12}/></button>
                                </>
                            ) : (
                                <>
                                    <span>{b.item}</span>
                                    <span className="text-slate-100 font-mono font-bold">₩{b.cost.toLocaleString()}</span>
                                </>
                            )}
                        </div>
                    ))}
                    {isEditMode && (
                        <button onClick={handleAddBudget} className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-800/50 text-xs flex items-center justify-center gap-1">
                            <Plus size={12} /> 항목 추가
                        </button>
                    )}
                </div>
                <div className="mt-6 pt-5 border-t border-slate-700/50 flex justify-between items-center">
                    <span className="text-slate-400 text-sm font-medium">Total Estimations</span>
                    <span className="text-xl font-bold text-white tracking-tight">₩{total.toLocaleString()}</span>
                </div>
            </div>
            <div className="mt-4 p-4 rounded-xl bg-blue-900/10 border border-blue-900/30 text-xs text-blue-300 leading-relaxed">
                💡 현지 물가 변동 및 쇼핑 계획에 따라 실제 경비는 달라질 수 있습니다.
            </div>
        </div>
    );
  };

  const renderTodoList = () => {
    return (
        <div className="p-4 animate-in">
            <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 shadow-inner">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-green-400 flex items-center gap-2">
                        <span>✅</span> 체크리스트
                    </h3>
                    <div className="flex gap-2">
                        {isEditMode ? (
                            <button onClick={handleSave} disabled={isSaving} className="text-[10px] bg-green-600 hover:bg-green-500 px-2 py-1 rounded flex items-center gap-1 transition">
                                {isSaving ? <RefreshCw size={10} className="animate-spin" /> : "저장"}
                            </button>
                        ) : (
                            <button onClick={() => setIsEditMode(true)} className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition border border-slate-700">
                                편집
                            </button>
                        )}
                    </div>
                </div>
                <div className="space-y-2">
                    {todoData.map((todo, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-slate-950/50 rounded-lg border border-slate-800/50 hover:border-green-500/30 transition group">
                            <button onClick={() => handleTodoToggle(idx)} className={`shrink-0 ${todo.completed ? 'text-green-500' : 'text-slate-600'}`}>
                                {todo.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                            </button>
                            
                            {isEditMode ? (
                                <input 
                                    className="flex-1 bg-slate-800 text-white px-2 py-1 rounded border border-slate-700 focus:outline-none text-sm"
                                    value={todo.text}
                                    onChange={(e) => handleTodoChange(idx, e.target.value)}
                                />
                            ) : (
                                <span className={`flex-1 text-sm ${todo.completed ? 'text-slate-600 line-through' : 'text-slate-200'}`}>
                                    {todo.text}
                                </span>
                            )}

                            {isEditMode && (
                                <button onClick={() => handleDeleteTodo(idx)} className="text-slate-500 hover:text-red-400"><Trash2 size={14}/></button>
                            )}
                        </div>
                    ))}
                    {isEditMode && (
                        <button onClick={handleAddTodo} className="w-full py-2 border border-dashed border-slate-700 rounded-lg text-slate-500 hover:text-green-400 hover:bg-slate-800/50 text-xs flex items-center justify-center gap-1">
                            <Plus size={12} /> 할 일 추가
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full relative">
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-4 z-40 shrink-0 glass-strong shadow-lg">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => {setViewState('hubs'); setSelectedHubId(null); setSelectedDayIdx(null);}}>
                <span className="text-xl filter drop-shadow">🇯🇵</span>
                <div className="flex flex-col leading-none">
                    <h1 className="font-bold text-sm text-slate-100 tracking-wide">Japan 2026</h1>
                    <span className="text-[10px] text-blue-400 font-medium">Travel Log</span>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="hidden md:block text-xs text-slate-400 font-mono border border-slate-700 rounded px-2 py-0.5 bg-slate-900/50 animate-pulse">
                    {headerTitle}
                </div>
                <div className="text-xs font-mono text-slate-500 w-[60px] text-right">{currentTime}</div>
                <button className="md:hidden text-slate-300" onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}>
                    {mobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>
        </header>

        <div className="flex-1 flex overflow-hidden relative">
            {/* Sidebar */}
            <aside className={`
                w-full md:w-[420px] glass border-r-0 md:border-r border-slate-800 flex flex-col z-30 shadow-2xl 
                absolute md:relative h-full transition-transform duration-300 transform 
                ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <nav className="flex p-2 gap-1 border-b border-slate-800/50 shrink-0 bg-slate-950/50">
                    <button onClick={() => {setViewState('hubs'); setSelectedHubId(null); setSelectedDayIdx(null);}} className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="홈으로">
                        <Navigation size={18} />
                    </button>
                    <div className="w-px h-6 bg-slate-800 my-auto mx-1"></div>
                    <button 
                        onClick={() => setActiveTab('itinerary')} 
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${activeTab === 'itinerary' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                        일정
                    </button>
                    <button 
                        onClick={() => setActiveTab('budget')} 
                        className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${activeTab === 'budget' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                        예산
                    </button>
                    <button 
                        onClick={() => setActiveTab('todo')} 
                        className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${activeTab === 'todo' ? 'bg-green-600 text-white shadow-lg shadow-green-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}>
                        To-do
                    </button>
                </nav>

                <div className="flex-1 overflow-y-auto custom-scrollbar relative p-0 pb-32 md:pb-10">
                    {activeTab === 'itinerary' && (
                        <div className="p-4">{renderItineraryList()}</div>
                    )}
                    {activeTab === 'budget' && renderBudgetList()}
                    {activeTab === 'todo' && renderTodoList()}
                </div>
            </aside>

            {/* Map Area */}
            <main className="flex-1 relative w-full h-full bg-black">
                <div ref={mapContainerRef} className="absolute inset-0 z-0 outline-none" />
                <button onClick={showMyLocation} className="gps-btn" title="내 위치 보기">
                    <Navigation size={20} className="fill-white" />
                </button>
                
                {/* Mobile Spot Carousel (Bottom) */}
                {viewState === 'spots' && selectedHubId && selectedDayIdx !== null && (
                    <div className="md:hidden absolute bottom-6 left-0 right-0 z-[500] px-4 pointer-events-none">
                        <div 
                            ref={carouselRef}
                            onScroll={handleCarouselScroll}
                            className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-4 hide-scrollbar pointer-events-auto"
                            style={{ scrollBehavior: 'smooth' }}
                        >
                            <div className="w-[calc(50vw-150px)] shrink-0 snap-center"></div>
                            
                            {/* Prev Card */}
                            {navParams.prev && (
                                <div 
                                    onClick={() => { setSelectedHubId(navParams.prev.hId); setSelectedDayIdx(navParams.prev.dIdx); setActiveSpotIndex(0); }}
                                    className={`w-[300px] shrink-0 snap-center bg-slate-950/90 border border-slate-800 backdrop-blur-md p-6 rounded-2xl shadow-2xl flex flex-col justify-center items-center text-center cursor-pointer transition-all duration-300 transform ${activeSpotIndex === 0 ? 'border-blue-500 scale-100 opacity-100' : 'scale-95 opacity-70'}`}
                                >
                                    <div className="text-slate-500 text-xs font-mono mb-2">{navParams.prev.date}</div>
                                    <h3 className="text-lg font-bold text-slate-300 flex items-center gap-2">
                                        <ArrowLeft size={18} /> 이전 일정
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">{navParams.prev.title}</p>
                                </div>
                            )}

                            {tripData.find(h => h.id === selectedHubId)?.days[selectedDayIdx].spots.map((spot, idx) => {
                                // Adjust index logic for highlighting active state
                                const visualIndex = idx + (navParams.prev ? 1 : 0);
                                const isActive = activeSpotIndex === visualIndex;

                                return (
                                    <div 
                                        key={idx} 
                                        onClick={() => setActiveSpotIndex(visualIndex)}
                                        className={`w-[300px] shrink-0 snap-center bg-slate-900/90 border backdrop-blur-md p-4 rounded-2xl shadow-2xl transition-all duration-300 transform ${isActive ? 'border-blue-500 scale-100 opacity-100' : 'border-slate-800 scale-95 opacity-70'}`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <span className="text-[10px] font-mono bg-blue-500/20 text-blue-200 px-2 py-0.5 rounded border border-blue-500/30">{spot.t}</span>
                                            <div className="flex gap-2">
                                                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.n)}`} target="_blank" className="p-1.5 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-blue-600 transition">
                                                    <ExternalLink size={12} />
                                                </a>
                                                <a href={`https://www.google.com/maps/dir/?api=1&destination=${spot.p[0]},${spot.p[1]}`} target="_blank" className="p-1.5 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-blue-600 transition">
                                                    <Navigation size={12} />
                                                </a>
                                            </div>
                                        </div>
                                        <h3 className="text-base font-bold text-white mb-1 line-clamp-1">{spot.n}</h3>
                                        <p className="text-xs text-slate-400 line-clamp-2">{spot.d}</p>
                                    </div>
                                );
                            })}

                            {/* Next Card */}
                            {navParams.next && (
                                <div 
                                    onClick={() => { setSelectedHubId(navParams.next.hId); setSelectedDayIdx(navParams.next.dIdx); setActiveSpotIndex(0); }}
                                    className={`w-[300px] shrink-0 snap-center bg-slate-950/90 border border-slate-800 backdrop-blur-md p-6 rounded-2xl shadow-2xl flex flex-col justify-center items-center text-center cursor-pointer transition-all duration-300 transform ${activeSpotIndex === (tripData.find(h => h.id === selectedHubId)?.days[selectedDayIdx].spots.length || 0) + (navParams.prev ? 1 : 0) ? 'border-blue-500 scale-100 opacity-100' : 'scale-95 opacity-70'}`}
                                >
                                    <div className="text-slate-500 text-xs font-mono mb-2">{navParams.next.date}</div>
                                    <h3 className="text-lg font-bold text-slate-300 flex items-center gap-2">
                                        다음 일정 <ArrowRight size={18} />
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">{navParams.next.title}</p>
                                </div>
                            )}

                            <div className="w-[calc(50vw-150px)] shrink-0 snap-center"></div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    </div>
  );
}