import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTestStore } from '@/store/testStore';
import { exportTestAsHtml } from '@/lib/exportHtml';
import { saveTest } from '@/lib/testHistory';
import { markPlannedTestCompleted } from '@/lib/plannedTestStore';
import DarkModeToggle from '@/components/DarkModeToggle';
import type { Option } from '@/types/test';
import { db, auth } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

const options: Option[] = ['A', 'B', 'C', 'D'];

const ResultsPage = () => {
  const { result, answerKey, reset } = useTestStore();
  const navigate = useNavigate();
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportName, setExportName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const submitToServer = async () => {
      if (!result || !result.config.isServerTest || !result.config.testId || submitted || submitting) return;
      
      setSubmitting(true);
      try {
        const adminPasscode = localStorage.getItem('admin_passcode');
        const isAdmin = adminPasscode === "Davendra@07";
        const userId = isAdmin ? 'admin_davendra' : auth.currentUser?.uid;

        if (!userId) {
          console.warn("No user ID for submission. User must be logged in or admin.");
          setSubmitting(false);
          return;
        }

        const answers: Record<string, string | null> = {};
        result.responses.forEach(r => {
          answers[r.questionNo.toString()] = r.selected;
        });

        let score = 0;
        if (answerKey) {
          result.responses.forEach((r) => {
            if (r.selected) {
              if (answerKey[r.questionNo] && r.selected === answerKey[r.questionNo]) {
                score += 4;
              } else if (answerKey[r.questionNo]) {
                score -= 1;
              }
            }
          });
        }

        await addDoc(collection(db, 'submissions'), {
          testId: result.config.testId,
          userId,
          answers,
          score,
          completedAt: serverTimestamp(),
          // Include passcode if admin to bypass rules if needed (though rules now check test doc)
          ...(isAdmin ? { passcode: "Davendra@07" } : {})
        });

        setSubmitted(true);
        toast.success("Results submitted to server!");
      } catch (error) {
        console.error("Error submitting results:", error);
        toast.error("Failed to submit results to server.");
      } finally {
        setSubmitting(false);
      }
    };

    submitToServer();
  }, [result, answerKey, submitted, submitting]);

  const sectionScores = useMemo(() => {
    if (!result?.config?.sections || result.config.sections.length === 0 || !answerKey) return null;
    return result.config.sections.map(sec => {
      const secResponses = (result.responses || []).filter(r => r.questionNo >= sec.startQ && r.questionNo <= sec.endQ);
      let secScore = 0;
      let secCorrect = 0;
      let secIncorrect = 0;
      secResponses.forEach(r => {
        if (r.selected) {
          if (answerKey[r.questionNo] && r.selected === answerKey[r.questionNo]) {
            secScore += 4;
            secCorrect++;
          } else if (answerKey[r.questionNo]) {
            secScore -= 1;
            secIncorrect++;
          }
        }
      });
      return { name: sec.name, score: secScore, correct: secCorrect, incorrect: secIncorrect, total: secResponses.length };
    });
  }, [result?.config.sections, result?.responses, answerKey]);

  if (!result) {
    navigate('/');
    return null;
  }

  const { responses, startTime, endTime } = result;
  const totalTimeSec = Math.round((endTime - startTime) / 1000);
  const answered = responses.filter((r) => r.selected !== null).length;
  const unanswered = responses.length - answered;
  const reviewed = responses.filter((r) => r.markedForReview).length;

  let correct = 0, incorrect = 0, score = 0;
  if (answerKey) {
    responses.forEach((r) => {
      if (r.selected) {
        if (answerKey[r.questionNo] && r.selected === answerKey[r.questionNo]) {
          correct++;
          score += 4;
        } else if (answerKey[r.questionNo]) {
          incorrect++;
          score -= 1;
        }
      }
    });
  }

  const maxScore = responses.length * 4;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  const getBubbleClass = (r: typeof responses[0], opt: Option) => {
    if (!answerKey) {
      return r.selected === opt
        ? 'bg-primary text-primary-foreground border-primary'
        : 'border-border text-muted-foreground';
    }
    const correctOpt = answerKey[r.questionNo];
    if (opt === correctOpt && opt === r.selected) return 'bg-success text-success-foreground border-success';
    if (opt === r.selected && opt !== correctOpt) return 'bg-destructive text-destructive-foreground border-destructive';
    if (opt === correctOpt) return 'bg-success/20 text-success border-success';
    return 'border-border/40 text-muted-foreground/40';
  };

  const getQuestionType = (qNo: number) => {
    if (!result.config.sections) return 'mcq';
    const section = result.config.sections.find(s => qNo >= s.startQ && qNo <= s.endQ);
    return section?.type || 'mcq';
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
         <div className="flex items-center justify-between flex-wrap gap-3">
           <h1 className="text-2xl font-bold font-mono text-foreground">Response Sheet</h1>
           <div className="flex gap-2 flex-wrap">
             <button
               onClick={() => navigate('/')}
               className="px-2 py-2 border border-border rounded text-sm text-foreground hover:bg-muted"
               title="Home"
             >
               🏠
             </button>
             <DarkModeToggle />
            <button
              onClick={() => navigate('/answer-key')}
              className="px-3 py-2 border border-border rounded text-sm font-medium text-foreground hover:bg-muted"
            >
              📝 Answer Key
            </button>
            {answerKey && (
              <button
                onClick={() => navigate('/analysis')}
                className="px-3 py-2 border border-border rounded text-sm font-medium text-foreground hover:bg-muted"
              >
                📊 Analysis
              </button>
            )}
            <button
              onClick={() => { setSaveName(''); setSaved(false); setShowSaveDialog(true); }}
              className="px-3 py-2 border border-success/50 rounded text-sm font-medium text-foreground hover:bg-success/10"
            >
              💾 Save
            </button>
            <button
              onClick={() => { setExportName(''); setShowExportDialog(true); }}
              className="px-3 py-2 border border-border rounded text-sm font-medium text-foreground hover:bg-muted"
            >
              📥 Export HTML
            </button>
            <button
              onClick={() => { reset(); navigate('/'); }}
              className="px-3 py-2 bg-secondary text-secondary-foreground rounded text-sm font-medium hover:opacity-80"
            >
              ↺ New Test
            </button>
          </div>
        </div>

        {/* Stats */}
        {result.config.isServerTest && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-primary uppercase tracking-wider">Server Test</span>
              <span className="text-xs text-muted-foreground">— {result.config.title}</span>
            </div>
            <div className="flex items-center gap-2">
              {submitting ? (
                <span className="text-[10px] font-mono text-muted-foreground animate-pulse">Submitting to server...</span>
              ) : submitted ? (
                <span className="text-[10px] font-mono text-success font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  Submitted to Server
                </span>
              ) : (
                <span className="text-[10px] font-mono text-destructive font-bold">Not Submitted</span>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold font-mono text-primary">{answered}</div>
            <div className="text-xs text-muted-foreground mt-1">✓ Answered</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold font-mono text-muted-foreground">{unanswered}</div>
            <div className="text-xs text-muted-foreground mt-1">— Unanswered</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold font-mono text-review">{reviewed}</div>
            <div className="text-xs text-muted-foreground mt-1">⚑ Reviewed</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold font-mono text-foreground">{formatTime(totalTimeSec)}</div>
            <div className="text-xs text-muted-foreground mt-1">⏱ Time</div>
          </div>
        </div>

        {/* Score section */}
        {answerKey && (
          <div className="space-y-4">
            <div className="bg-card border-2 border-primary/30 rounded-lg p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-3xl font-bold font-mono text-primary">{score}</div>
                  <div className="text-xs text-muted-foreground mt-1">Score (out of {maxScore})</div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono text-success">{correct}</div>
                  <div className="text-xs text-muted-foreground mt-1">Correct (+{correct * 4})</div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono text-destructive">{incorrect}</div>
                  <div className="text-xs text-muted-foreground mt-1">Incorrect (−{incorrect})</div>
                </div>
                <div>
                  <div className="text-2xl font-bold font-mono text-foreground">
                    {responses.length > 0 ? Math.round((correct / responses.length) * 100) : 0}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Accuracy</div>
                </div>
              </div>
            </div>

            {sectionScores && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sectionScores.map(sec => (
                  <div key={sec.name} className="bg-card border border-border rounded-lg p-3">
                    <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider mb-2">{sec.name}</div>
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-xl font-bold font-mono text-primary">{sec.score}</div>
                        <div className="text-[10px] text-muted-foreground">Score / {sec.total * 4}</div>
                      </div>
                      <div className="text-right text-[10px] font-mono">
                        <div className="text-success">✓ {sec.correct}</div>
                        <div className="text-destructive">✗ {sec.incorrect}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* OMR Response Sheet - Row format */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-muted border-b border-border">
            <span className="font-mono text-xs text-muted-foreground font-bold">RESPONSE SHEET</span>
          </div>
          {responses.map((r, idx) => {
            const isNumerical = getQuestionType(r.questionNo) === 'numerical';
            const correctAns = answerKey?.[r.questionNo];
            const isCorrect = r.selected && correctAns && r.selected === correctAns;
            const isWrong = r.selected && correctAns && r.selected !== correctAns;

            return (
              <div
                key={r.questionNo}
                className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/30
                  ${idx % 2 === 0 ? '' : 'bg-muted/20'}
                `}
              >
                <span className="font-mono text-sm font-bold text-muted-foreground w-14 text-right shrink-0">
                  Q.{r.questionNo}
                </span>
                <div className="flex items-center gap-2 flex-1">
                  {isNumerical ? (
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`px-3 py-1.5 rounded-lg border-2 font-mono text-sm font-bold min-w-[60px] text-center
                        ${isCorrect ? 'bg-success text-success-foreground border-success' : 
                          isWrong ? 'bg-destructive text-destructive-foreground border-destructive' : 
                          r.selected ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground/40'}
                      `}>
                        {r.selected || '—'}
                      </div>
                      {answerKey && isWrong && (
                        <div className="text-[10px] font-mono text-muted-foreground">
                          Correct: <span className="text-success font-bold">{correctAns}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {options.map((opt) => (
                        <div
                          key={opt}
                          className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold font-mono ${getBubbleClass(r, opt)}`}
                        >
                          {opt}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {answerKey && r.selected && (
                  <span className="ml-2 font-mono text-xs font-bold">
                    {isCorrect ? (
                      <span className="text-success">+4</span>
                    ) : (
                      <span className="text-destructive">−1</span>
                    )}
                  </span>
                )}
                {answerKey && !r.selected && (
                  <span className="ml-2 font-mono text-xs text-muted-foreground">0</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Export dialog */}
      {showExportDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-lg font-bold text-foreground">Export as HTML</h2>
            <p className="text-sm text-muted-foreground">
              Enter a name for this test. The exported file will be a self-contained interactive HTML page.
            </p>
            <input
              type="text"
              value={exportName}
              onChange={(e) => setExportName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && exportName.trim()) {
                  exportTestAsHtml({ testName: exportName.trim(), result: result!, answerKey });
                  setShowExportDialog(false);
                }
              }}
              placeholder="e.g. JEE Mains Mock 3"
              autoFocus
              className="w-full px-3 py-2 border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowExportDialog(false)}
                className="px-4 py-2 border border-border rounded text-sm font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (exportName.trim()) {
                    exportTestAsHtml({ testName: exportName.trim(), result: result!, answerKey });
                    setShowExportDialog(false);
                  }
                }}
                disabled={!exportName.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-bold hover:opacity-90 disabled:opacity-50"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-lg font-bold text-foreground">💾 Save Test</h2>
            <p className="text-sm text-muted-foreground">
              Save this test locally so you can view it later from the home screen.
            </p>
            {saved ? (
              <div className="text-center py-4">
                <div className="text-3xl mb-2">✅</div>
                <div className="text-sm text-success font-bold">Saved successfully!</div>
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="mt-4 px-4 py-2 border border-border rounded text-sm font-medium text-foreground hover:bg-muted"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && saveName.trim()) {
                      saveTest(saveName.trim(), result!, answerKey);
                      const pid = sessionStorage.getItem('planned_test_id');
                      if (pid) { markPlannedTestCompleted(pid); sessionStorage.removeItem('planned_test_id'); }
                      setSaved(true);
                    }
                  }}
                  placeholder="e.g. JEE Mains Mock 3"
                  autoFocus
                  className="w-full px-3 py-2 border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowSaveDialog(false)}
                    className="px-4 py-2 border border-border rounded text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (saveName.trim()) {
                        saveTest(saveName.trim(), result!, answerKey);
                        const pid = sessionStorage.getItem('planned_test_id');
                        if (pid) { markPlannedTestCompleted(pid); sessionStorage.removeItem('planned_test_id'); }
                        setSaved(true);
                      }
                    }}
                    disabled={!saveName.trim()}
                    className="px-4 py-2 bg-success text-success-foreground rounded text-sm font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsPage;
