import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTestStore } from '@/store/testStore';
import Timer from '@/components/Timer';
import DarkModeToggle from '@/components/DarkModeToggle';
import type { Option, MarkType } from '@/types/test';
import { MARK_ICONS } from '@/types/test';

const optionsList: Option[] = ['A', 'B', 'C', 'D'];
const AUTOSAVE_KEY = 'omr_autosave';

const TestPage = () => {
  const { config, responses, selectOption, toggleMark, endTest } = useTestStore();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showQuitWarning, setShowQuitWarning] = useState(false);
  const [eliminated, setEliminated] = useState<Record<number, Set<string>>>({});
  const [showPanel, setShowPanel] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Autosave — save on every response change + periodic
  useEffect(() => {
    if (!config) return;
    const save = () => {
      const state = useTestStore.getState();
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
        config: state.config,
        responses: state.responses,
        startTime: state.startTime,
        savedAt: Date.now(),
      }));
    };
    save(); // immediate save
    const id = setInterval(save, 5000); // every 5 seconds
    return () => clearInterval(id);
  }, [config, responses]); // re-runs on every response change

  // Also save on visibility change (tab switch, minimize)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && config) {
        const state = useTestStore.getState();
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
          config: state.config,
          responses: state.responses,
          startTime: state.startTime,
          savedAt: Date.now(),
        }));
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [config]);

  const handleEnd = useCallback(() => {
    localStorage.removeItem(AUTOSAVE_KEY);
    endTest();
    navigate('/results');
  }, [endTest, navigate]);

  const sections = useMemo(() => {
    if (!config) return [];
    if (config.sections && config.sections.length > 0) return config.sections;
    return [{ name: 'All', startQ: config.startFrom, endQ: config.startFrom + config.totalQuestions - 1 }];
  }, [config]);

  const currentSection = sections[activeSection] || sections[0];
  const sectionResponses = useMemo(() => {
    if (!currentSection) return responses;
    return responses.filter(r => r.questionNo >= currentSection.startQ && r.questionNo <= currentSection.endQ);
  }, [responses, currentSection]);

  const stats = useMemo(() => {
    const answered = responses.filter((r) => r.selected !== null).length;
    const marked = responses.filter((r) => r.marks.length > 0).length;
    return { answered, marked, total: responses.length, left: responses.length - answered };
  }, [responses]);

  const sectionStats = useMemo(() => {
    const answered = sectionResponses.filter((r) => r.selected !== null).length;
    return { answered, total: sectionResponses.length };
  }, [sectionResponses]);

  const handleRightClick = (e: React.MouseEvent, questionNo: number, opt: string) => {
    e.preventDefault();
    setEliminated((prev) => {
      const set = new Set(prev[questionNo] || []);
      if (set.has(opt)) set.delete(opt); else set.add(opt);
      return { ...prev, [questionNo]: set };
    });
  };

  const handleLeftClick = (questionNo: number, opt: Option, isEliminated: boolean) => {
    if (isEliminated) {
      setEliminated((prev) => { const set = new Set(prev[questionNo] || []); set.delete(opt!); return { ...prev, [questionNo]: set }; });
    } else {
      selectOption(questionNo, opt!);
    }
  };

  const getQuestionType = (qNo: number) => {
    if (config?.questionTypes?.[qNo]) return config.questionTypes[qNo];
    if (!config?.sections) return 'mcq';
    const section = config.sections.find(s => qNo >= s.startQ && qNo <= s.endQ);
    return section?.type || 'mcq';
  };

  const scrollToQuestion = (qNo: number) => {
    if (config?.isServerTest) {
      const idx = responses.findIndex(r => r.questionNo === qNo);
      if (idx >= 0) setCurrentQIndex(idx);
      setShowPanel(false);
      return;
    }
    rowRefs.current[qNo]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const secIdx = sections.findIndex(s => qNo >= s.startQ && qNo <= s.endQ);
    if (secIdx >= 0) setActiveSection(secIdx);
  };

  if (!config) { navigate('/'); return null; }

  const dp = config.displayPrefs;
  const currentQ = responses[currentQIndex];
  const qImage = config.questionImages?.[currentQ?.questionNo];

  const handlePrev = () => setCurrentQIndex(prev => Math.max(0, prev - 1));
  const handleNext = () => setCurrentQIndex(prev => Math.min(responses.length - 1, prev + 1));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-50 bg-card border-b-2 border-border px-4 py-2">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowQuitWarning(true)} className="px-2 py-2 border border-border rounded text-sm text-foreground hover:bg-muted" title="Home">🏠</button>
            <Timer
              totalSeconds={config.timeInMinutes * 60}
              onTimeUp={handleEnd}
              showCountdown={dp.showCountdown}
              showWallClock={dp.showWallClock}
              wallClockStartTime={config.wallClockStartTime}
            />
          </div>
          <div className="flex items-center gap-3 text-sm font-mono flex-wrap">
            {config.isServerTest && (
              <span className="text-primary font-bold text-xs">Q{currentQ?.questionNo}</span>
            )}
            {dp.showQuestionRange && !config.isServerTest && (
              <span className="text-muted-foreground text-xs">Q{config.startFrom}–{config.startFrom + config.totalQuestions - 1}</span>
            )}
            {dp.showAnswered && (
              <span className="text-primary font-bold text-xs">✓ {stats.answered}/{stats.total}</span>
            )}
            {dp.showQuestionsLeft && (
              <span className="text-muted-foreground text-xs">○ {stats.left} left</span>
            )}
            {dp.showMarked && stats.marked > 0 && (
              <span className="text-[hsl(var(--review))] font-bold text-xs">⚑ {stats.marked}</span>
            )}
            <DarkModeToggle />
            <button onClick={() => setShowPanel(p => !p)} className="px-2 py-1.5 border border-border rounded text-xs font-bold text-foreground hover:bg-muted" title="Question Panel">
              {showPanel ? '✕' : '▦'}
            </button>
            <button onClick={() => setShowConfirm(true)} className="px-3 py-1.5 bg-primary text-primary-foreground font-bold rounded text-sm hover:opacity-90 transition-opacity">
              Submit
            </button>
          </div>
        </div>

        {sections.length > 1 && !config.isServerTest && (
          <div className="max-w-5xl mx-auto flex gap-1 mt-2 overflow-x-auto">
            {sections.map((sec, i) => {
              const secR = responses.filter(r => r.questionNo >= sec.startQ && r.questionNo <= sec.endQ);
              const secAns = secR.filter(r => r.selected !== null).length;
              return (
                <button key={i} onClick={() => setActiveSection(i)}
                  className={`px-3 py-1.5 rounded-t text-xs font-mono font-bold transition-colors whitespace-nowrap ${
                    activeSection === i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}>
                  {sec.name} <span className="opacity-70">({secAns}/{secR.length})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-1 max-w-5xl mx-auto w-full relative">
        <div className="flex-1 p-4 pt-2 flex flex-col">
          {config.isServerTest ? (
            <div className="flex-1 flex flex-col space-y-4">
              {/* Question Image Area */}
              <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden flex flex-col items-center justify-center p-4 min-h-[300px] relative">
                {qImage ? (
                  <img 
                    src={qImage} 
                    alt={`Question ${currentQ?.questionNo}`} 
                    className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-muted-foreground text-sm font-mono flex flex-col items-center gap-2">
                    <span className="text-4xl opacity-20">🖼️</span>
                    No image for Question {currentQ?.questionNo}
                  </div>
                )}
                
                {/* Mark indicators */}
                <div className="absolute top-4 right-4 flex flex-col gap-1">
                  {(Object.entries(MARK_ICONS) as [MarkType, typeof MARK_ICONS[MarkType]][]).map(([type, meta]) => {
                    const active = currentQ?.marks.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleMark(currentQ?.questionNo, type)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all shadow-sm border-2 ${
                          active 
                            ? `${meta.color.replace('text-', 'bg-').replace('[hsl', '[hsl')} text-white border-primary scale-110 shadow-md` 
                            : 'bg-muted/50 text-border border-transparent hover:text-muted-foreground hover:bg-muted'
                        }`}
                        style={active ? { backgroundColor: meta.color.includes('review') ? 'hsl(var(--review))' : meta.color.includes('accent') ? 'hsl(var(--accent))' : meta.color.includes('destructive') ? 'hsl(var(--destructive))' : 'hsl(var(--primary))' } : {}}
                        title={meta.label}
                      >
                        {meta.icon}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* OMR Options Area */}
              <div className="bg-card border-t-2 border-border p-6 rounded-t-2xl shadow-[0_-4px_10px_rgba(0,0,0,0.05)] sticky bottom-0 z-10">
                <div className="flex flex-col gap-4 max-w-md mx-auto">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-lg text-primary">Q{currentQ?.questionNo}</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={handlePrev} 
                        disabled={currentQIndex === 0}
                        className="p-2 border border-border rounded-lg disabled:opacity-30 hover:bg-muted transition-colors"
                      >
                        ← Prev
                      </button>
                      <button 
                        onClick={handleNext} 
                        disabled={currentQIndex === responses.length - 1}
                        className="p-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-30 hover:opacity-90 transition-opacity font-bold"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center gap-2">
                    {getQuestionType(currentQ?.questionNo) === 'numerical' ? (
                      <div className="flex-1 flex flex-col gap-2">
                        <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Numerical Answer</label>
                        <input
                          type="number"
                          value={currentQ?.selected || ''}
                          onChange={(e) => selectOption(currentQ?.questionNo, e.target.value)}
                          placeholder="Enter integer..."
                          className="w-full h-14 bg-muted border-2 border-border rounded-xl px-4 font-mono text-xl font-bold focus:border-primary focus:outline-none transition-colors"
                        />
                      </div>
                    ) : (
                      optionsList.map((opt) => {
                        const isSelected = currentQ?.selected === opt;
                        const qEliminated = eliminated[currentQ?.questionNo] || new Set();
                        const isElim = qEliminated.has(opt!);
                        
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleLeftClick(currentQ?.questionNo, opt, isElim)}
                            onContextMenu={(e) => handleRightClick(e, currentQ?.questionNo, opt!)}
                            className={`flex-1 h-14 rounded-xl border-2 font-bold font-mono text-lg transition-all relative
                              ${isSelected
                                ? 'bg-primary text-primary-foreground border-primary scale-105 shadow-md'
                                : isElim
                                  ? 'border-border text-muted-foreground/30 line-through'
                                  : 'border-border text-muted-foreground hover:border-primary hover:text-foreground hover:scale-105'
                              }
                            `}
                          >
                            {opt}
                            {isElim && (
                              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <svg viewBox="0 0 40 40" className="w-10 h-10 text-destructive/60">
                                  <line x1="8" y1="8" x2="32" y2="32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                  <line x1="32" y1="8" x2="8" y2="32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                </svg>
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                  <p className="text-[10px] text-center text-muted-foreground italic">
                    Tip: Right-click an option to eliminate it.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground italic mb-2">
                💡 Right-click to eliminate. Auto-saving continuously.
              </p>

              {sections.length > 1 && (
                <div className="text-sm font-mono font-bold text-foreground mb-2">
                  {currentSection.name} — Q{currentSection.startQ}–{currentSection.endQ}
                  <span className="text-muted-foreground font-normal ml-2">({sectionStats.answered}/{sectionStats.total} answered)</span>
                </div>
              )}

              <div className="bg-card border border-border rounded-lg overflow-hidden">
                {sectionResponses.map((r, idx) => {
                  const qEliminated = eliminated[r.questionNo] || new Set();
                  return (
                    <div
                      key={r.questionNo}
                      ref={(el) => { rowRefs.current[r.questionNo] = el; }}
                      className={`flex items-center gap-2 px-3 py-2.5 border-b border-border/50 transition-colors
                        ${r.marks.length > 0 ? 'bg-[hsl(var(--review))]/8' : idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}
                        ${r.selected ? 'border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}
                      `}
                    >
                      <span className="font-mono text-sm font-bold text-muted-foreground w-12 text-right shrink-0">
                        {r.questionNo}
                      </span>
                      <div className="flex items-center gap-1.5 flex-1">
                        {getQuestionType(r.questionNo) === 'numerical' ? (
                          <input
                            type="number"
                            value={r.selected || ''}
                            onChange={(e) => selectOption(r.questionNo, e.target.value)}
                            placeholder="Value"
                            className="w-full h-10 bg-muted border-2 border-border rounded-lg px-3 font-mono text-sm font-bold focus:border-primary focus:outline-none transition-colors"
                          />
                        ) : (
                          optionsList.map((opt) => {
                            const isElim = qEliminated.has(opt!);
                            const isSelected = r.selected === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleLeftClick(r.questionNo, opt, isElim)}
                                onContextMenu={(e) => handleRightClick(e, r.questionNo, opt!)}
                                className={`w-10 h-10 rounded-full border-2 font-bold font-mono text-sm transition-all relative
                                  ${isSelected
                                    ? 'bg-primary text-primary-foreground border-primary scale-110'
                                    : isElim
                                      ? 'border-border text-muted-foreground/30 line-through'
                                      : 'border-border text-muted-foreground hover:border-primary hover:text-foreground hover:scale-105'
                                  }
                                `}
                              >
                                {opt}
                                {isElim && (
                                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <svg viewBox="0 0 40 40" className="w-8 h-8 text-destructive/60">
                                      <line x1="8" y1="8" x2="32" y2="32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                      <line x1="32" y1="8" x2="8" y2="32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                                    </svg>
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 ml-auto">
                        {(Object.entries(MARK_ICONS) as [MarkType, typeof MARK_ICONS[MarkType]][]).map(([type, meta]) => {
                          const active = r.marks.includes(type);
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => toggleMark(r.questionNo, type)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all border-2 ${
                                active 
                                  ? 'text-white border-primary scale-110 shadow-sm' 
                                  : 'text-border border-transparent hover:text-muted-foreground hover:bg-muted/50'
                              }`}
                              style={active ? { backgroundColor: meta.color.includes('review') ? 'hsl(var(--review))' : meta.color.includes('accent') ? 'hsl(var(--accent))' : meta.color.includes('destructive') ? 'hsl(var(--destructive))' : 'hsl(var(--primary))' } : {}}
                              title={meta.label}
                            >
                              {meta.icon}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {showPanel && (
          <div className="fixed lg:sticky top-0 lg:top-[4.5rem] right-0 z-[60] w-64 lg:w-56 shrink-0 border-l border-border bg-card p-3 overflow-y-auto h-screen lg:h-[calc(100vh-4.5rem)] shadow-xl lg:shadow-none">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-mono font-bold text-muted-foreground">QUESTION PANEL</div>
              <button onClick={() => setShowPanel(false)} className="lg:hidden p-1 text-muted-foreground hover:text-foreground">✕</button>
            </div>
            {sections.map((sec, si) => (
              <div key={si} className="mb-3">
                {sections.length > 1 && (
                  <div className="text-[10px] font-mono font-bold text-foreground mb-1">{sec.name}</div>
                )}
                <div className="grid grid-cols-5 gap-1">
                  {responses
                    .filter(r => r.questionNo >= sec.startQ && r.questionNo <= sec.endQ)
                    .map(r => {
                      const hasMarks = r.marks.length > 0;
                      const isAnswered = r.selected !== null;
                      return (
                        <button
                          key={r.questionNo}
                          onClick={() => scrollToQuestion(r.questionNo)}
                          className={`w-8 h-8 rounded text-[10px] font-mono font-bold transition-all border ${
                            isAnswered && hasMarks
                              ? 'bg-primary/70 text-primary-foreground border-[hsl(var(--review))] border-2'
                              : isAnswered
                                ? 'bg-primary text-primary-foreground border-primary'
                                : hasMarks
                                  ? 'bg-[hsl(var(--review))]/20 text-[hsl(var(--review))] border-[hsl(var(--review))]/50'
                                  : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
                          }`}
                          title={`Q${r.questionNo}${isAnswered ? ` (${r.selected})` : ''}${hasMarks ? ` [${r.marks.join(',')}]` : ''}`}
                        >
                          {r.questionNo}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
            <div className="mt-3 space-y-1 text-[9px] font-mono text-muted-foreground border-t border-border pt-2">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-primary" /> Answered</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[hsl(var(--review))]/20 border border-[hsl(var(--review))]/50" /> Marked</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-muted border border-border" /> Unanswered</div>
            </div>
          </div>
        )}
      </div>

      {/* Submit confirmation */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-lg font-bold text-foreground">Submit Test?</h2>
            <p className="text-sm text-muted-foreground">
              You have answered <strong>{stats.answered}</strong> out of <strong>{stats.total}</strong> questions.
              {stats.marked > 0 && ` ${stats.marked} marked.`}
            </p>
            {sections.length > 1 && (
              <div className="space-y-1 text-xs">
                {sections.map((sec, i) => {
                  const secR = responses.filter(r => r.questionNo >= sec.startQ && r.questionNo <= sec.endQ);
                  const ans = secR.filter(r => r.selected !== null).length;
                  return (
                    <div key={i} className="flex justify-between font-mono text-muted-foreground">
                      <span>{sec.name}</span>
                      <span>{ans}/{secR.length}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 border border-border rounded text-sm font-medium text-foreground hover:bg-muted">Continue Test</button>
              <button onClick={handleEnd} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-bold hover:opacity-90">Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* Quit warning */}
      {showQuitWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-lg font-bold text-destructive">⚠ Quit Test?</h2>
            <p className="text-sm text-muted-foreground">
              Your progress is auto-saved. You have answered <strong>{stats.answered}/{stats.total}</strong> questions.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowQuitWarning(false)} className="px-4 py-2 border border-border rounded text-sm font-medium text-foreground hover:bg-muted">Continue Test</button>
              <button onClick={handleEnd} className="px-4 py-2 bg-[hsl(var(--review))] text-foreground rounded text-sm font-bold hover:opacity-90">Submit & Exit</button>
              <button onClick={() => navigate('/')} className="px-4 py-2 bg-destructive text-destructive-foreground rounded text-sm font-bold hover:opacity-90">Quit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestPage;
