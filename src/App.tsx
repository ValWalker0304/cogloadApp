import { useState, useEffect, useRef } from "react"; // Added useRef
import { Power, Keyboard, Mouse, BarChart3, X } from "lucide-react";
import { Slider } from "./components/ui/slider";
import { Switch } from "./components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import { BreakHistory } from "./components/BreakHistory";
import { StatisticsPanel } from "./components/StatisticsPanel";
import { motion, AnimatePresence } from "motion/react";

const ipcRenderer = (window as any).require ? (window as any).require('electron').ipcRenderer : null;
const API_URL = "http://localhost:80/api";

interface Break {
  id: string;
  timestamp: Date;
  duration: number;
}

function App() {
  // --- STATE ---
  const [isEnabled, setIsEnabled] = useState(false);
  const [snoozeEnabled, setSnoozeEnabled] = useState(true);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [focusLevel, setFocusLevel] = useState(0.8);
  
  // UI Only State
  const [showKeyboard, setShowKeyboard] = useState(true);
  const [snoozeTime, setSnoozeTime] = useState([10]); // Slider state
  const [breakTime, setBreakTime] = useState([5]);
  const [showStatistics, setShowStatistics] = useState(false);
  const [breaks, setBreaks] = useState<Break[]>([
    { id: '1', timestamp: new Date(), duration: 5 },
    { id: '2', timestamp: new Date(), duration: 5 },
    { id: '3', timestamp: new Date(), duration: 5 },
    { id: '4', timestamp: new Date(), duration: 5 },
  ]);

  // Ref to track if it's the initial load to prevent unnecessary API calls
  const isInitialMount = useRef(true);

  const [statisticsData, setStatisticsData] = useState([
    { day: 'Mon', breaks: 4, screenTime: 7.5 },
    { day: 'Tue', breaks: 5, screenTime: 8.2 },
    { day: 'Wed', breaks: 3, screenTime: 6.8 },
    { day: 'Thu', breaks: 6, screenTime: 9.1 },
    { day: 'Fri', breaks: 2, screenTime: 5.4 },
    { day: 'Sat', breaks: 4, screenTime: 7.0 },
    { day: 'Sun', breaks: 5, screenTime: 8.5 },
  ]);

  // --- API INTEGRATION ---

  const fetchSystemState = async () => {
    try {
      const stateRes = await fetch(`${API_URL}/system/state`);
      const stateData = await stateRes.json();
      setIsEnabled(stateData.monitoring_active);
      
      if (stateData.break_history) {
        const history: Break[] = stateData.break_history.map((b: any) => ({
          id: b.id,
          timestamp: new Date(b.timestamp),
          duration: b.duration
        }));
        setBreaks(history);
      }

      const settingsRes = await fetch(`${API_URL}/settings`);
      const settingsData = await settingsRes.json();
      setSnoozeEnabled(settingsData.snooze_feature_enabled);
      setAutoStartEnabled(settingsData.auto_start_enabled);
      
      // Sync slider with backend value on load (if valid)
      if (settingsData.snooze_timer) {
         setSnoozeTime([parseInt(settingsData.snooze_timer)]);
      }

      const focusRes = await fetch(`${API_URL}/data/focus-level`);
      const focusData = await focusRes.json();
      setFocusLevel(focusData.focus_level);

    } catch (error) {
      console.error("Failed to connect to backend:", error);
    }
  };

  useEffect(() => {
    fetchSystemState();
    const interval = setInterval(fetchSystemState, 30000);
    return () => clearInterval(interval);
  }, []);

  // --- NEW LOGIC: AUTO-SAVE SNOOZE TIMER ---
  useEffect(() => {
    // Skip the first render to avoid sending the default state immediately
    if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
    }

    // Set a timer to save after 5 seconds of inactivity
    const timeoutId = setTimeout(async () => {
        try {
            console.log("Auto-saving snooze timer:", snoozeTime[0]);
            await fetch(`${API_URL}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    snooze_timer: snoozeTime[0]
                })
            });
        } catch (error) {
            console.error("Error auto-saving snooze timer:", error);
        }
    }, 5000); // 5000ms = 5 seconds

    // Cleanup: If the user moves the slider again before 5s, clear the old timer
    return () => clearTimeout(timeoutId);
  }, [snoozeTime]); // Triggers whenever snoozeTime changes


  const toggleMonitoring = async () => {
    const endpoint = isEnabled ? '/system/stop' : '/system/start';
    try {
      await fetch(`${API_URL}${endpoint}`, { method: 'POST' });
      setIsEnabled(!isEnabled);
    } catch (error) {
      console.error("Error toggling system:", error);
    }
  };

  const updateSettings = async (setting: string, value: boolean) => {
    if (setting === 'snooze') setSnoozeEnabled(value);
    if (setting === 'autostart') setAutoStartEnabled(value);
    if (ipcRenderer) {
          ipcRenderer.send('toggle-auto-start', value);
        }
        
    try {
      await fetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snooze_feature_enabled: setting === 'snooze' ? value : snoozeEnabled,
          auto_start_enabled: setting === 'autostart' ? value : autoStartEnabled
        })
      });
    } catch (error) {
      console.error("Error updating settings:", error);
      fetchSystemState(); 
    }
  };

  useEffect(() => {
      let timeoutId: NodeJS.Timeout;
      const cycleMonitoringText = () => {
        setShowKeyboard((prev) => !prev);
        const randomDelay = Math.floor(Math.random() * (30000 - 10000 + 1) + 10000);
        timeoutId = setTimeout(cycleMonitoringText, randomDelay);
      };
      cycleMonitoringText();
      return () => clearTimeout(timeoutId);
    }, []);

const handleToggleStats = () => {
    if (!showStatistics) {
      if (ipcRenderer) ipcRenderer.send('resize-window', true);
      setTimeout(() => setShowStatistics(true), 50); 
    } else {
      setShowStatistics(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-start justify-center p-2 bg-transparent overflow-hidden font-sans">
      <style>{`
        .drag-region { -webkit-app-region: drag; }
        .no-drag { -webkit-app-region: no-drag; }
        ::-webkit-scrollbar { width: 0px; background: transparent; }
      `}</style>

      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex gap-4 w-full h-full max-w-[900px] drag-region rounded-3xl overflow-hidden bg-slate-900/60 backdrop-blur-md border border-white/10"
      >
        <div className="w-[400px] shrink-0 flex flex-col gap-3 bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-4 overflow-hidden relative transition-all">
          
          <div className="flex items-center justify-between px-1 shrink-0">
            <h1 className="text-base font-semibold text-white/90">Activity Monitor</h1>
            <button
              onClick={() => { try { window.close(); } catch(e){} }}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors no-drag group"
            >
              <X className="w-4 h-4 text-white/50 group-hover:text-white" />
            </button>
          </div>

          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="no-drag">
                  <motion.button
                    onClick={toggleMonitoring}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full p-4 rounded-xl transition-all relative overflow-hidden group flex items-center gap-4 shrink-0 ${
                      isEnabled
                        ? 'bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg shadow-purple-900/20'
                        : 'bg-white/5 hover:bg-white/10 opacity-70 blur-[0.5px] hover:blur-0 hover:opacity-100'
                    }`}
                  >
                    <div className={`p-2 rounded-full ${isEnabled ? 'bg-white/20' : 'bg-white/5'}`}>
                      <Power className={`w-5 h-5 ${!isEnabled && 'opacity-40'}`} />
                    </div>
                    <div className="text-left flex-1">
                      <div className="text-base font-medium leading-none mb-1">
                        {isEnabled ? 'Monitoring Active' : 'Monitoring Paused'}
                      </div>
                      <div className="text-[11px] opacity-70 ">
                        {isEnabled ? `Focus Level: ${(focusLevel * 100).toFixed(0)}%` : 'Tap to resume tracking'}
                      </div>
                    </div>
                  </motion.button>
                </div>
              </TooltipTrigger>
              {!isEnabled && (
                 <TooltipContent side="bottom" className="bg-slate-800 border-slate-700 text-white">
                   <p>Monitoring system is currently disabled</p>
                 </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          <div className="h-4 flex items-center justify-center shrink-0">
            <motion.div
              key={showKeyboard ? 'k' : 'm'}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 0.5, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white font-medium"
            >
              {isEnabled && (
                <>
                  {showKeyboard ? <Keyboard className="w-3 h-3" /> : <Mouse className="w-3 h-3" />}
                  <span>{showKeyboard ? 'Keyboard Monitored' : 'Mouse Monitored'}</span>
                </>
              )}
            </motion.div>
          </div>

          <div className="grid grid-cols-2 gap-3 no-drag shrink-0">
            <div className="p-3 rounded-lg bg-white/5 flex items-center justify-between border border-white/5">
              <span className="text-xs font-medium text-white/80">Snooze</span>
              <Switch 
                checked={snoozeEnabled} 
                onCheckedChange={(val) => updateSettings('snooze', val)}
                className="scale-75 origin-right" 
              />
            </div>
            <div className="p-3 rounded-lg bg-white/5 flex items-center justify-between border border-white/5">
              <span className="text-xs font-medium text-white/80">Auto-start</span>
              <Switch 
                checked={autoStartEnabled} 
                onCheckedChange={(val) => updateSettings('autostart', val)}
                className="scale-75 origin-right" 
              />
            </div>
          </div>

          <div className="space-y-4 p-4 rounded-lg bg-white/5 border border-white/5 no-drag shrink-0">
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-medium text-white/50">
                <span>SNOOZE DURATION</span>
                <span className="text-white/90">{snoozeTime[0]} min</span>
              </div>
              <Slider value={snoozeTime} onValueChange={setSnoozeTime} min={5} max={60} step={5} className="py-1" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-medium text-white/50">
                <span>BREAK DURATION</span>
                <span className="text-white/90">{breakTime[0]} min</span>
              </div>
              <Slider value={breakTime} onValueChange={setBreakTime} min={1} max={30} step={1} className="py-1" />
            </div>
          </div>

          <div className="flex-1 min-h-0 bg-white/5 rounded-lg border border-white/5 overflow-hidden no-drag flex flex-col">
             <div className="p-3 border-b border-white/5">
                <h3 className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Recent Breaks</h3>
             </div>
             <div className="flex-1 overflow-y-auto p-2">
                <BreakHistory breaks={breaks} />
             </div>
          </div>

          <button
            onClick={handleToggleStats}
            className={`w-full p-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 no-drag shrink-0 ${
              showStatistics 
                ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20' 
                : 'bg-white/5 hover:bg-white/10 text-white/70 border border-transparent'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            {showStatistics ? 'Hide Statistics' : 'View Detailed Statistics'}
          </button>
        </div>

        <AnimatePresence
          onExitComplete={() => {
             if (ipcRenderer) ipcRenderer.send('resize-window', false);
          }}
        >
          {showStatistics && (
            <motion.div
              initial={{ width: 0, opacity: 0, x: -20 }}
              animate={{ width: "auto", opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: -20 }} 
              transition={{ duration: 0.3, ease: "easeInOut" }} 
              className="flex-1 overflow-hidden h-full"
            >
              <div className="h-full w-full bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-5 overflow-y-auto no-drag">
                <StatisticsPanel data={statisticsData} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default App;