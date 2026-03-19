import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTestStore } from '@/store/testStore';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
  AreaChart, Area, ComposedChart,
} from 'recharts';
import {
  getAnnotation, saveAnnotation, getAnnotationsForTest,
  type QuestionAnnotation, type MistakeType, MISTAKE_TYPES,
} from '@/lib/mistakeStore';
import { getSavedTests } from '@/lib/testHistory';
import type { TestSection } from '@/types/test';

const COLORS = {
  correct: 'hsl(142, 71%, 40%)',
  incorrect: 'hsl(0, 84%, 60%)',
  unanswered: 'hsl(215, 16%, 47%)',
  primary: 'hsl(221, 83%, 53%)',
  warn: 'hsl(38, 92%, 50%)',
  speed: 'hsl(142, 71%, 45%)', // Green for d(score)/dt
};

const AnalysisPage = () => {
  const { result, answerKey } = useTestStore();
  const navigate = useNavigate();
  const [annotatingQ, setAnnotatingQ] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'overall' | 'combined' | string>('overall');
  const [selectedForCombined, setSelectedForCombined] = useState<string[]>([]);

  const currentTestId = useMemo(() => {
    if (!result) return '';
    const saved = getSavedTests();
    const match = saved.find(t => t.result.startTime === result.startTime);
    return match?.id || `unsaved_${result.startTime}`;
  }, [result]);

  const currentTestName = useMemo(() => {
    const saved = getSavedTests();
    const match = saved.find(t => t.id === currentTestId);
    return match?.name || 'Unsaved Test';
  }, [currentTestId]);

  const [annotations, setAnnotations] = useState<QuestionAnnotation[]>(() =>
    getAnnotationsForTest(currentTestId)
  );

  const refreshAnnotations = useCallback(() => {
    setAnnotations(getAnnotationsForTest(currentTestId));
  }, [currentTestId]);

  // Build sections from config
  const sections: TestSection[] = useMemo(() => {
    if (!result) return [];
    const cfg = result.config;
    if (cfg.sections && cfg.sections.length > 0) return cfg.sections;
    return [];
  }, [result]);

  const timeGaps = useMemo(() => {
    if (!result) return {};
    const answered = result.responses
      .filter((r) => r.answeredAt !== null)
      .sort((a, b) => a.answeredAt! - b.answeredAt!);
    const gaps: Record<number, number> = {};
    let prev = result.startTime;
    answered.forEach((r) => {
      gaps[r.questionNo] = Math.round((r.answeredAt! - prev) / 1000);
      prev = r.answeredAt!;
    });
    return gaps;
  }, [result]);

  // Attempt order mapping
  const attemptOrder = useMemo(() => {
    if (!result) return new Map<number, number>();
    const answered = result.responses
      .filter(r => r.answeredAt !== null)
      .sort((a, b) => a.answeredAt! - b.answeredAt!);
    const map = new Map<number, number>();
    answered.forEach((r, i) => map.set(r.questionNo, i + 1));
    // Unanswered get order after
    let next = answered.length + 1;
    result.responses.filter(r => r.answeredAt === null).forEach(r => map.set(r.questionNo, next++));
    return map;
  }, [result]);

  const analysis = useMemo(() => {
    if (!result || !answerKey) return [];
    return result.responses.map((r) => {
      const correct = answerKey[r.questionNo] ?? null;
      const isCorrect = r.selected !== null && r.selected === correct;
      const isWrong = r.selected !== null && correct !== null && r.selected !== correct;
      return {
        questionNo: r.questionNo,
        selected: r.selected,
        correct,
        isCorrect,
        isWrong,
        isSkipped: r.selected === null,
        marks: isCorrect ? 4 : isWrong ? -1 : 0,
        timeGap: timeGaps[r.questionNo] ?? null,
        answeredAt: r.answeredAt,
        attemptIdx: attemptOrder.get(r.questionNo) ?? 999,
      };
    });
  }, [result, answerKey, timeGaps, attemptOrder]);

  const fmt = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

  // Filter analysis for a section
  const getAnalysisForSection = useCallback((secNames: string[]) => {
    if (secNames.length === 0) return analysis;
    const matchedSections = sections.filter(s => secNames.includes(s.name));
    if (matchedSections.length === 0) return analysis;
    
    return analysis.filter(a => 
      matchedSections.some(s => a.questionNo >= s.startQ && a.questionNo <= s.endQ)
    );
  }, [analysis, sections]);

  const filteredAnalysis = useMemo(() => {
    if (activeTab === 'overall') return analysis;
    if (activeTab === 'combined') return getAnalysisForSection(selectedForCombined);
    return getAnalysisForSection([activeTab]);
  }, [activeTab, selectedForCombined, analysis, getAnalysisForSection]);

  if (!result || !answerKey) {
    navigate('/results');
    return null;
  }

  const toggleCombinedSection = (name: string) => {
    setSelectedForCombined(prev => {
      if (prev.includes(name)) return prev.filter(n => n !== name);
      if (prev.length >= 2) return [prev[1], name];
      return [...prev, name];
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-16">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="px-2 py-2 border border-border rounded text-sm text-foreground hover:bg-muted" title="Home">🏠</button>
          <button onClick={() => navigate('/results')} className="px-3 py-2 border border-border rounded text-sm text-foreground hover:bg-muted">← Back</button>
          <h1 className="text-xl font-bold font-mono text-foreground">Detailed Analysis</h1>
        </div>

        {/* Section tabs */}
        {sections.length > 0 && (
          <div className="space-y-3">
            <div className="flex gap-1 flex-wrap bg-muted rounded-lg p-1">
              <button onClick={() => setActiveTab('overall')}
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-colors ${activeTab === 'overall' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                📊 Overall
              </button>
              {sections.map(sec => (
                <button key={sec.name} onClick={() => setActiveTab(sec.name)}
                  className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-colors ${activeTab === sec.name ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  {sec.name}
                </button>
              ))}
              <button onClick={() => setActiveTab('combined')}
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-colors ${activeTab === 'combined' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                🔗 Combined
              </button>
            </div>

            {activeTab === 'combined' && (
              <div className="bg-muted/30 border border-border rounded-lg p-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="text-[10px] font-mono font-bold text-muted-foreground mb-2 uppercase tracking-wider">Select 2 sections to combine</div>
                <div className="flex gap-2 flex-wrap">
                  {sections.map(sec => {
                    const isSelected = selectedForCombined.includes(sec.name);
                    return (
                      <button
                        key={sec.name}
                        onClick={() => toggleCombinedSection(sec.name)}
                        className={`px-3 py-1.5 rounded-lg border-2 text-xs font-mono font-bold transition-all ${
                          isSelected 
                            ? 'bg-primary border-primary text-primary-foreground scale-105' 
                            : 'bg-card border-border text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        {sec.name}
                      </button>
                    );
                  })}
                </div>
                {selectedForCombined.length === 0 && (
                  <p className="text-[10px] text-muted-foreground mt-2 italic">Pick two sections above to see their combined performance.</p>
                )}
                {selectedForCombined.length === 1 && (
                  <p className="text-[10px] text-muted-foreground mt-2 italic">Select one more section.</p>
                )}
              </div>
            )}
          </div>
        )}

        <AnalysisContent
          analysis={filteredAnalysis}
          allAnalysis={analysis}
          result={result}
          fmt={fmt}
          sectionLabel={activeTab === 'overall' ? undefined : activeTab}
          testId={currentTestId}
          testName={currentTestName}
          annotations={annotations}
          annotatingQ={annotatingQ}
          setAnnotatingQ={setAnnotatingQ}
          onAnnotationSaved={refreshAnnotations}
        />
      </div>
    </div>
  );
};

function AnalysisContent({
  analysis, allAnalysis, result, fmt, sectionLabel, testId, testName, annotations, annotatingQ, setAnnotatingQ, onAnnotationSaved,
}: {
  analysis: any[]; allAnalysis: any[]; result: any; fmt: (s: number) => string;
  sectionLabel?: string;
  testId: string; testName: string;
  annotations: QuestionAnnotation[];
  annotatingQ: number | null;
  setAnnotatingQ: (q: number | null) => void;
  onAnnotationSaved: () => void;
}) {
  const total = analysis.length;
  const correctCount = analysis.filter((a) => a.isCorrect).length;
  const incorrectCount = analysis.filter((a) => a.isWrong).length;
  const skippedCount = analysis.filter((a) => a.isSkipped).length;
  const totalScore = analysis.reduce((sum: number, a: any) => sum + a.marks, 0);
  const maxScore = total * 4;
  const accuracy = total > 0 ? Math.round((correctCount / (correctCount + incorrectCount || 1)) * 100) : 0;
  const attemptRate = total > 0 ? Math.round(((total - skippedCount) / total) * 100) : 0;

  // Sort by attempt order for timeline
  const byAttempt = [...analysis].sort((a, b) => a.attemptIdx - b.attemptIdx);
  const answeredByAttempt = byAttempt.filter(a => a.answeredAt !== null);

  // Score progression vs timeline - smoothed by 1-min buckets for speed
  const scoreTimeline = useMemo(() => {
    if (answeredByAttempt.length === 0) return [];
    
    // First build raw data points
    let running = 0;
    const raw = answeredByAttempt.map((a) => {
      running += a.marks;
      const elapsed = (a.answeredAt - result.startTime) / 1000;
      return {
        time: Math.round(elapsed / 60 * 10) / 10,
        score: running,
        answeredAt: a.answeredAt,
        questionNo: a.questionNo,
      };
    });

    // Bucket by 1-minute intervals for speed (ques/min)
    const totalMins = Math.ceil((raw[raw.length - 1].time) || 1);
    const buckets = new Map<number, number>(); // minute -> count of questions
    answeredByAttempt.forEach(a => {
      const min = Math.floor((a.answeredAt - result.startTime) / 60000);
      buckets.set(min, (buckets.get(min) || 0) + 1);
    });

    // Build timeline with smoothed speed
    return raw.map((point) => {
      const minuteBucket = Math.floor(point.time);
      const quesPerMin = buckets.get(minuteBucket) || 0;
      return {
        time: point.time,
        timeLabel: `${point.time.toFixed(1)}m`,
        score: point.score,
        speed: quesPerMin, // questions per minute
        q: `Q${point.questionNo}`,
      };
    });
  }, [answeredByAttempt, result.startTime]);

  // Cumulative accuracy by attempt order
  const cumulativeAccuracy = (() => {
    let c = 0, t = 0;
    return byAttempt.map((a) => {
      t++;
      if (a.isCorrect) c++;
      return { q: `Q${a.questionNo}`, idx: a.attemptIdx, accuracy: Math.round((c / t) * 100) };
    });
  })();

  // Time per question by attempt order
  const timeChartData = answeredByAttempt
    .map((a) => ({ q: `Q${a.questionNo}`, time: a.timeGap!, marks: a.marks }));

  const answeredTimes = analysis.filter(a => a.timeGap !== null).map(a => a.timeGap!);
  const avgTime = answeredTimes.length > 0 ? Math.round(answeredTimes.reduce((a: number, b: number) => a + b, 0) / answeredTimes.length) : 0;
  const fastestQ = answeredTimes.length > 0 ? Math.min(...answeredTimes) : 0;
  const slowestQ = answeredTimes.length > 0 ? Math.max(...answeredTimes) : 0;

  const correctTimes = analysis.filter(a => a.isCorrect && a.timeGap !== null).map(a => a.timeGap!);
  const wrongTimes = analysis.filter(a => a.isWrong && a.timeGap !== null).map(a => a.timeGap!);
  const avgCorrectTime = correctTimes.length > 0 ? Math.round(correctTimes.reduce((a: number, b: number) => a + b, 0) / correctTimes.length) : 0;
  const avgWrongTime = wrongTimes.length > 0 ? Math.round(wrongTimes.reduce((a: number, b: number) => a + b, 0) / wrongTimes.length) : 0;

  let bestStreak = 0, worstStreak = 0, curGood = 0, curBad = 0;
  byAttempt.forEach((a) => {
    if (a.isCorrect) { curGood++; bestStreak = Math.max(bestStreak, curGood); curBad = 0; }
    else if (a.isWrong) { curBad++; worstStreak = Math.max(worstStreak, curBad); curGood = 0; }
    else { curGood = 0; curBad = 0; }
  });

  const pieData = [
    { name: 'Correct (+4)', value: correctCount, color: COLORS.correct },
    { name: 'Incorrect (−1)', value: incorrectCount, color: COLORS.incorrect },
    { name: 'Skipped (0)', value: skippedCount, color: COLORS.unanswered },
  ].filter(d => d.value > 0);

  const worstTimeWasted = analysis
    .filter(a => a.isWrong && a.timeGap !== null)
    .sort((a: any, b: any) => b.timeGap! - a.timeGap!)
    .slice(0, 5);

  // Annotation stats
  const sectionAnnotations = annotations.filter(a => analysis.some(q => q.questionNo === a.questionNo));
  const annotatedCount = sectionAnnotations.length;
  const mistakeBreakdown = Object.entries(MISTAKE_TYPES).map(([type, meta]) => ({
    type: type as MistakeType, ...meta,
    count: sectionAnnotations.filter(a => a.mistakeType === type).length,
  })).filter(b => b.count > 0);

  return (
    <>
      {sectionLabel && (
        <div className="text-lg font-bold font-mono text-primary">📂 {sectionLabel}</div>
      )}

      {/* Score summary */}
      <div className="bg-card border-2 border-primary/30 rounded-lg p-5">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
          <div>
            <div className="text-3xl font-bold font-mono text-primary">{totalScore}</div>
            <div className="text-xs text-muted-foreground mt-1">Score / {maxScore}</div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-[hsl(var(--success))]">+{correctCount * 4}</div>
            <div className="text-xs text-muted-foreground mt-1">{correctCount} Correct</div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-destructive">−{incorrectCount}</div>
            <div className="text-xs text-muted-foreground mt-1">{incorrectCount} Wrong</div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-foreground">{accuracy}%</div>
            <div className="text-xs text-muted-foreground mt-1">Accuracy</div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-[hsl(var(--accent))]">{attemptRate}%</div>
            <div className="text-xs text-muted-foreground mt-1">Attempt Rate</div>
          </div>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Avg Time/Q', value: fmt(avgTime) },
          { label: 'Fastest', value: fmt(fastestQ) },
          { label: 'Slowest', value: fmt(slowestQ) },
          { label: 'Skipped Marks', value: String(skippedCount * 4) },
        ].map((m) => (
          <div key={m.label} className="bg-card border border-border rounded-lg p-3 text-center">
            <div className="text-lg font-bold font-mono text-foreground">{m.value}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Time efficiency */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border border-[hsl(var(--success))]/30 rounded-lg p-3 text-center">
          <div className="text-lg font-bold font-mono text-[hsl(var(--success))]">{fmt(avgCorrectTime)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Avg Time on Correct</div>
        </div>
        <div className="bg-card border border-destructive/30 rounded-lg p-3 text-center">
          <div className="text-lg font-bold font-mono text-destructive">{fmt(avgWrongTime)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Avg Time on Wrong</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <div className="text-lg font-bold font-mono text-foreground">{bestStreak} ✓ / {worstStreak} ✗</div>
          <div className="text-[10px] text-muted-foreground mt-1">Best / Worst Streak (attempt order)</div>
        </div>
      </div>

      {annotatedCount > 0 && (
        <div className="bg-card border border-[hsl(var(--accent))]/30 rounded-lg p-4">
          <h3 className="font-mono text-sm text-foreground font-bold mb-3">🏷 Mistake Categorization ({annotatedCount})</h3>
          <div className="flex gap-3 flex-wrap">
            {mistakeBreakdown.map(b => (
              <div key={b.type} className="bg-muted rounded-lg px-3 py-2 text-center">
                <div className="text-lg">{b.icon}</div>
                <div className="text-sm font-mono font-bold text-foreground">{b.count}</div>
                <div className="text-[10px] text-muted-foreground">{b.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-mono text-sm text-muted-foreground font-bold mb-3">Score Breakdown</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={75} dataKey="value" strokeWidth={2} stroke="hsl(var(--background))">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${value} questions`, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Score Progression vs Timeline with smoothed speed */}
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-mono text-sm text-muted-foreground font-bold mb-1">Score Progression vs Time</h3>
          <p className="text-[10px] text-muted-foreground mb-2">Blue = cumulative score, Green = questions solved per minute</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={scoreTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 9 }} label={{ value: 'min', position: 'insideBottomRight', offset: -2, fontSize: 9 }} />
                <YAxis yAxisId="score" tick={{ fontSize: 10 }} width={35} />
                <YAxis yAxisId="speed" orientation="right" tick={{ fontSize: 9 }} width={30} />
                <Tooltip formatter={(v: number, name: string) => [name === 'speed' ? `${v} ques/min` : v, name === 'speed' ? 'Speed (ques/min)' : 'Score']}
                  labelFormatter={(l) => `${l} min`} />
                <Legend />
                <Area yAxisId="score" type="monotone" dataKey="score" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.1} strokeWidth={2} name="Score" />
                <Line yAxisId="speed" type="natural" dataKey="speed" stroke={COLORS.speed} strokeWidth={2} dot={false} name="Speed (ques/min)" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-mono text-sm text-muted-foreground font-bold mb-1">Accuracy Trend (attempt order)</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulativeAccuracy}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="q" tick={{ fontSize: 7 }} interval={Math.max(0, Math.floor(cumulativeAccuracy.length / 10) - 1)} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={35} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Accuracy']} />
                <Line type="monotone" dataKey="accuracy" stroke={COLORS.primary} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-mono text-sm text-muted-foreground font-bold mb-1">Time Per Question (attempt order)</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="q" tick={{ fontSize: 7 }} interval={Math.max(0, Math.floor(timeChartData.length / 12) - 1)} />
                <YAxis tick={{ fontSize: 10 }} width={35} />
                <Tooltip formatter={(v: number) => [fmt(v), 'Time']} />
                <Bar dataKey="time" radius={[2, 2, 0, 0]}>
                  {timeChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.marks > 0 ? COLORS.correct : entry.marks < 0 ? COLORS.incorrect : COLORS.unanswered} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Option distribution */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-mono text-sm text-muted-foreground font-bold mb-3">Option Distribution: Yours vs Key</h3>
        <div className="grid grid-cols-4 gap-4">
          {(['A', 'B', 'C', 'D'] as const).map((opt) => {
            const yours = analysis.filter(a => a.selected === opt).length;
            const key = analysis.filter(a => a.correct === opt).length;
            return (
              <div key={opt} className="text-center border border-border rounded-lg p-3">
                <div className="font-mono text-lg font-bold text-foreground">{opt}</div>
                <div className="mt-2 text-sm">
                  <div className="text-primary font-mono font-bold">{yours}</div>
                  <div className="text-[10px] text-muted-foreground">Your picks</div>
                </div>
                <div className="h-px bg-border my-2" />
                <div className="text-sm">
                  <div className="text-[hsl(var(--success))] font-mono font-bold">{key}</div>
                  <div className="text-[10px] text-muted-foreground">In key</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Worst time wasters */}
      {worstTimeWasted.length > 0 && (
        <div className="bg-card border border-destructive/30 rounded-lg p-4">
          <h3 className="font-mono text-sm text-destructive font-bold mb-3">⚠ Most Time Wasted on Wrong Answers</h3>
          <div className="space-y-2">
            {worstTimeWasted.map((a: any) => (
              <div key={a.questionNo} className="flex items-center justify-between py-2 px-3 bg-destructive/5 rounded">
                <span className="font-mono text-sm font-bold">Q.{a.questionNo}</span>
                <span className="text-xs text-muted-foreground">
                  You: <strong className="text-destructive">{a.selected}</strong> → Correct: <strong className="text-[hsl(var(--success))]">{a.correct}</strong>
                </span>
                <span className="font-mono text-sm text-destructive font-bold">{fmt(a.timeGap!)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Question-wise breakdown */}
      <QuestionTable
        analysis={analysis}
        fmt={fmt}
        testId={testId}
        testName={testName}
        annotations={annotations.filter(a => analysis.some((q: any) => q.questionNo === a.questionNo))}
        annotatingQ={annotatingQ}
        setAnnotatingQ={setAnnotatingQ}
        onAnnotationSaved={onAnnotationSaved}
      />
    </>
  );
}

type SortMode = 'default' | 'attempt' | 'time-desc' | 'time-asc' | 'wrong-slow' | 'wrong-only' | 'correct-only' | 'skipped-only' | 'annotated';

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'default', label: '# Order' },
  { value: 'attempt', label: '🕐 Attempt Order' },
  { value: 'time-desc', label: '⏱ Slowest' },
  { value: 'time-asc', label: '⚡ Fastest' },
  { value: 'wrong-slow', label: '✗ Wrong + Slow' },
  { value: 'wrong-only', label: '✗ Wrong only' },
  { value: 'correct-only', label: '✓ Correct only' },
  { value: 'skipped-only', label: '— Skipped' },
  { value: 'annotated', label: '🏷 Annotated' },
];

function QuestionTable({
  analysis, fmt, testId, testName, annotations, annotatingQ, setAnnotatingQ, onAnnotationSaved,
}: {
  analysis: any[]; fmt: (s: number) => string;
  testId: string; testName: string;
  annotations: QuestionAnnotation[];
  annotatingQ: number | null;
  setAnnotatingQ: (q: number | null) => void;
  onAnnotationSaved: () => void;
}) {
  const [sortMode, setSortMode] = useState<SortMode>('default');

  const sorted = useMemo(() => {
    let items = [...analysis];
    switch (sortMode) {
      case 'attempt': return items.sort((a, b) => a.attemptIdx - b.attemptIdx);
      case 'time-desc': return items.filter(a => a.timeGap != null).sort((a, b) => b.timeGap - a.timeGap);
      case 'time-asc': return items.filter(a => a.timeGap != null).sort((a, b) => a.timeGap - b.timeGap);
      case 'wrong-slow': return items.filter(a => a.isWrong && a.timeGap != null).sort((a, b) => b.timeGap - a.timeGap);
      case 'correct-only': return items.filter(a => a.isCorrect);
      case 'wrong-only': return items.filter(a => a.isWrong);
      case 'skipped-only': return items.filter(a => a.isSkipped);
      case 'annotated': {
        const annotatedQs = new Set(annotations.map(a => a.questionNo));
        return items.filter(a => annotatedQs.has(a.questionNo));
      }
      default: return items;
    }
  }, [analysis, sortMode, annotations]);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-muted border-b border-border flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-mono text-xs text-muted-foreground font-bold">QUESTION-WISE BREAKDOWN</h3>
        <div className="flex gap-1.5 flex-wrap">
          {SORT_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setSortMode(opt.value)}
              className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${
                sortMode === opt.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}>{opt.label}</button>
          ))}
        </div>
      </div>
      <p className="px-4 py-2 text-[10px] text-muted-foreground bg-[hsl(var(--accent))]/5 border-b border-border">
        💡 Click on any question to annotate — add notes, tags, categorize mistakes, or paste a question image
      </p>
      {sorted.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">No questions match this filter</div>
      ) : (
        <div>
          {sorted.map((item: any, idx: number) => {
            const ann = annotations.find(a => a.questionNo === item.questionNo);
            const isAnnotating = annotatingQ === item.questionNo;
            return (
              <div key={item.questionNo}>
                <div
                  onClick={() => setAnnotatingQ(isAnnotating ? null : item.questionNo)}
                  className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/30 cursor-pointer hover:bg-muted/30 transition-colors ${
                    item.isCorrect ? 'bg-[hsl(var(--success))]/5' : item.isWrong ? 'bg-destructive/5' : ''
                  } ${idx % 2 !== 0 ? 'bg-muted/10' : ''}`}
                >
                  <span className="font-mono text-sm font-bold text-muted-foreground w-14 text-right shrink-0">{item.questionNo}</span>
                  {sortMode === 'attempt' && (
                    <span className="font-mono text-[10px] text-muted-foreground w-8">#{item.attemptIdx}</span>
                  )}
                  <span className={`font-mono font-bold w-8 ${!item.selected ? 'text-muted-foreground/40' : 'text-foreground'}`}>{item.selected ?? '—'}</span>
                  <span className="font-mono font-bold w-8 text-primary">{item.correct ?? '—'}</span>
                  <span className="font-mono text-xs font-bold w-10">
                    {item.isSkipped ? <span className="text-muted-foreground">SKIP</span> : item.isCorrect ? <span className="text-[hsl(var(--success))]">✓</span> : <span className="text-destructive">✗</span>}
                  </span>
                  <span className={`font-mono font-bold text-xs w-10 text-right ${item.marks > 0 ? 'text-[hsl(var(--success))]' : item.marks < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {item.marks > 0 ? `+${item.marks}` : item.marks}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground w-12 text-right">{item.timeGap != null ? fmt(item.timeGap) : '—'}</span>
                  {ann && (
                    <span className="ml-auto text-xs" title={`${MISTAKE_TYPES[ann.mistakeType].label}: ${ann.notes}`}>
                      {MISTAKE_TYPES[ann.mistakeType].icon}
                      {ann.imageData && ' 🖼'}
                    </span>
                  )}
                  {!ann && <span className="ml-auto text-[10px] text-muted-foreground">+ annotate</span>}
                </div>
                {isAnnotating && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-lg rounded-xl border border-border shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">
                      <div className="absolute top-2 right-2 z-10">
                        <button onClick={() => setAnnotatingQ(null)} className="p-2 text-muted-foreground hover:text-foreground">✕</button>
                      </div>
                      <AnnotationEditor
                        testId={testId}
                        testName={testName}
                        questionNo={item.questionNo}
                        selected={item.selected}
                        correct={item.correct}
                        existing={ann}
                        onSave={() => { onAnnotationSaved(); setAnnotatingQ(null); }}
                        onCancel={() => setAnnotatingQ(null)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnnotationEditor({
  testId, testName, questionNo, selected, correct, existing, onSave, onCancel,
}: {
  testId: string; testName: string; questionNo: number;
  selected: string | null; correct: string | null;
  existing?: QuestionAnnotation;
  onSave: () => void; onCancel: () => void;
}) {
  const [mistakeType, setMistakeType] = useState<MistakeType>(existing?.mistakeType || 'silly');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [imageData, setImageData] = useState<string | undefined>(existing?.imageData);
  const [tags, setTags] = useState<string[]>(existing?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [lightbox, setLightbox] = useState(false);

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleImageFile(file);
        return;
      }
    }
  }, [handleImageFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  }, [handleImageFile]);

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const handleSave = () => {
    saveAnnotation({
      testId, testName, questionNo, mistakeType, notes, imageData, selected, correct, tags,
      createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now(),
    });
    onSave();
  };

  return (
    <div className="bg-muted/50 border-b border-border px-4 py-3 space-y-3" onPaste={handlePaste} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
      <div className="text-xs font-mono text-muted-foreground">
        Annotate Q.{questionNo} — You: <strong className="text-destructive">{selected}</strong> → Correct: <strong className="text-[hsl(var(--success))]">{correct}</strong>
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground font-bold">MISTAKE TYPE</label>
        <div className="flex gap-1.5 flex-wrap mt-1">
          {(Object.entries(MISTAKE_TYPES) as [MistakeType, typeof MISTAKE_TYPES[MistakeType]][]).map(([type, meta]) => (
            <button key={type} onClick={() => setMistakeType(type)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-colors ${
                mistakeType === type ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}>
              {meta.icon} {meta.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground font-bold">NOTES</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why was this wrong?"
          className="w-full mt-1 px-3 py-2 border border-border rounded-lg bg-background text-foreground text-xs min-h-[80px] font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground font-bold">TAGS</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-mono font-bold">
              #{tag}
              <button onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:text-destructive">×</button>
            </span>
          ))}
          <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) { e.preventDefault(); addTag(tagInput); }
              if (e.key === 'Backspace' && !tagInput && tags.length) setTags(tags.slice(0, -1));
            }}
            onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
            placeholder="Add tags..."
            className="flex-1 min-w-[120px] h-7 px-2 bg-transparent text-foreground text-[11px] font-mono focus:outline-none" />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground font-bold">QUESTION IMAGE</label>
        <div className="mt-1 border-2 border-dashed border-border rounded-lg p-4 text-center text-xs text-muted-foreground">
          {imageData ? (
            <div className="space-y-2">
              <img src={imageData} alt="Question" className="max-w-full max-h-48 mx-auto rounded-lg border border-border cursor-pointer hover:opacity-80" onClick={() => setLightbox(true)} />
              <div className="flex gap-2 justify-center">
                <button onClick={() => setLightbox(true)} className="text-primary text-[10px] hover:underline">🔍 View Full</button>
                <button onClick={() => setImageData(undefined)} className="text-destructive text-[10px] hover:underline">Remove</button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-2xl mb-1">📋</div>
              <div>Paste (Ctrl+V), drag & drop, or browse</div>
              <label className="inline-block px-3 py-1.5 bg-primary text-primary-foreground rounded text-[11px] font-bold cursor-pointer hover:opacity-90">
                📁 Browse File
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-xs">
          {existing ? 'Update' : 'Save'} Annotation
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-border rounded-lg text-xs text-foreground hover:bg-muted">Cancel</button>
      </div>

      {/* Lightbox */}
      {lightbox && imageData && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/90 backdrop-blur-sm" onClick={() => setLightbox(false)}>
          <img src={imageData} alt="Question" className="max-w-[90vw] max-h-[90vh] rounded-lg border border-border shadow-2xl" />
          <button onClick={() => setLightbox(false)} className="absolute top-4 right-4 text-foreground text-2xl font-bold hover:text-destructive">✕</button>
        </div>
      )}
    </div>
  );
}

export default AnalysisPage;
