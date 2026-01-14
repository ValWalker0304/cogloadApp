import { Clock } from "lucide-react";

interface Break {
  id: string;
  timestamp: Date;
  duration: number;
}

interface BreakHistoryProps {
  breaks: Break[];
}

export function BreakHistory({ breaks }: BreakHistoryProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="w-full space-y-3">
      <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
        {breaks.length === 0 ? (
          <div className="text-sm opacity-40 text-center py-8">
            No breaks taken yet
          </div>
        ) : (
          breaks.map((breakItem) => (
            <div 
              key={breakItem.id}
              className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 opacity-50" />
                <span className="text-sm">{formatTime(breakItem.timestamp)}</span>
              </div>
              <span className="text-sm opacity-60">{formatDuration(breakItem.duration)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}