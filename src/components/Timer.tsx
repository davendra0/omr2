import { useState, useEffect, useRef } from 'react';

interface TimerProps {
  totalSeconds: number;
  onTimeUp: () => void;
  showCountdown?: boolean;
  showWallClock?: boolean;
  wallClockStartTime?: string; // HH:MM
}

const Timer = ({ totalSeconds, onTimeUp, showCountdown = true, showWallClock = false, wallClockStartTime }: TimerProps) => {
  const [remaining, setRemaining] = useState(totalSeconds);
  const [paused, setPaused] = useState(false);
  const [totalPausedTime, setTotalPausedTime] = useState(0);
  const [wallClock, setWallClock] = useState(new Date());
  const pauseStartRef = useRef<number | null>(null);
  const testStartRef = useRef(Date.now());

  useEffect(() => {
    if (paused) {
      pauseStartRef.current = Date.now();
      return;
    }
    if (pauseStartRef.current) {
      setTotalPausedTime((prev) => prev + Math.round((Date.now() - pauseStartRef.current!) / 1000));
      pauseStartRef.current = null;
    }
    if (remaining <= 0) {
      onTimeUp();
      return;
    }
    const id = setInterval(() => {
      setRemaining((r) => r - 1);
      setWallClock(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, [remaining, onTimeUp, paused]);

  useEffect(() => {
    if (!paused) return;
    const id = setInterval(() => setWallClock(new Date()), 1000);
    return () => clearInterval(id);
  }, [paused]);

  const hours = Math.floor(remaining / 3600);
  const mins = Math.floor((remaining % 3600) / 60);
  const secs = remaining % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  const pct = remaining / totalSeconds;
  const colorClass = pct > 0.25 ? 'text-[hsl(var(--success))]' : pct > 0.1 ? 'text-[hsl(var(--review))]' : 'text-destructive';

  const formatPaused = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

  const [livePause, setLivePause] = useState(0);
  useEffect(() => {
    if (!paused) { setLivePause(0); return; }
    const id = setInterval(() => {
      if (pauseStartRef.current) setLivePause(Math.round((Date.now() - pauseStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [paused]);

  const displayPausedTotal = totalPausedTime + livePause;

  // Wall clock: if wallClockStartTime is set, compute simulated time based on elapsed
  let wallStr: string;
  if (wallClockStartTime) {
    const [startH, startM] = wallClockStartTime.split(':').map(Number);
    const elapsedSecs = totalSeconds - remaining;
    const totalMins = startH * 60 + startM + Math.floor(elapsedSecs / 60);
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    wallStr = `${pad(h)}:${pad(m)}`;
  } else {
    wallStr = `${pad(wallClock.getHours())}:${pad(wallClock.getMinutes())}`;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {showCountdown && (
        <span className={`font-mono text-xl font-bold ${colorClass} transition-colors`}>
          ⏱ {pad(hours)}:{pad(mins)}:{pad(secs)}
        </span>
      )}
      {showWallClock && (
        <span className="font-mono text-lg font-bold text-foreground">
          🕐 {wallStr}
        </span>
      )}
    </div>
  );
};

export default Timer;
