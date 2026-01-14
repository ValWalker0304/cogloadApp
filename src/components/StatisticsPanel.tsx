import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface StatisticsPanelProps {
  data: Array<{ day: string; breaks: number; screenTime: number }>;
}

export function StatisticsPanel({ data }: StatisticsPanelProps) {
  return (
    <div className="h-full flex flex-col space-y-6 text-white">
      <div className="pb-4 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white/90">Usage Statistics</h3>
        <p className="text-xs text-white/50 mt-1">Weekly analysis of your focus and breaks</p>
      </div>

      {/* Chart 1: Breaks */}
      <div className="space-y-2 flex-1 min-h-[140px]">
        <div className="flex items-center justify-between">
           <h4 className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Breaks (Last 7 Days)</h4>
           <span className="text-xs font-mono text-purple-400">Total: {data.reduce((acc, curr) => acc + curr.breaks, 0)}</span>
        </div>
        <div className="h-[140px] w-full bg-white/5 rounded-lg p-2 border border-white/5">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 12, left: 12, bottom: 0 }}>
              <defs>
                <linearGradient id="colorBreaks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: 'rgba(255,255,255,0.4)', fontSize: 10}} 
                dy={10}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#0f172a', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  fontSize: '12px', 
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="breaks" 
                stroke="#8b5cf6" 
                strokeWidth={2} 
                fill="url(#colorBreaks)" 
                activeDot={{r: 4, strokeWidth: 0}}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Screen Time */}
      <div className="space-y-2 flex-1 min-h-[140px]">
        <div className="flex items-center justify-between">
           <h4 className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Screen Time (Hours)</h4>
           <span className="text-xs font-mono text-blue-400">Avg: {(data.reduce((acc, curr) => acc + curr.screenTime, 0) / data.length).toFixed(1)}h</span>
        </div>
        <div className="h-[140px] w-full bg-white/5 rounded-lg p-2 border border-white/5">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 12, left: 12, bottom: 0 }}>
              <defs>
                <linearGradient id="colorScreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: 'rgba(255,255,255,0.4)', fontSize: 10}} 
                dy={10}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#0f172a', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  fontSize: '12px', 
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="screenTime" 
                stroke="#3b82f6" 
                strokeWidth={2} 
                fill="url(#colorScreen)" 
                activeDot={{r: 4, strokeWidth: 0}}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}