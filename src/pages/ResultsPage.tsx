import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Menu, X, ArrowLeft, Save, Download, RotateCcw, BarChart2, Key, FileText, Home } from 'lucide-react';
import { useTestStore } from '@/store/testStore';
import { exportTestAsHtml } from '@/lib/exportHtml';
import { getAnnotationsForTest, saveAnnotation, MISTAKE_TYPES } from '@/lib/mistakeStore';
import { saveTest } from '@/lib/testHistory';
import { markPlannedTestCompleted } from '@/lib/plannedTestStore';
import { db, auth } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import AnalysisPage from './AnalysisPage';
import type { TestResult, AnswerKey } from '@/types/test';
import type { QuestionAnnotation, MistakeType } from '@/lib/mistakeStore';

const ResultsPage = () => {
  const { result: storeResult, answerKey: storeAnswerKey, reset } = useTestStore();
  const navigate = useNavigate();
  const { submissionId } = useParams();
  const { theme, setTheme } = useTheme();
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportName, setExportName] = useState('');
  const [includeDetailed, setIncludeDetailed] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'analysis' | 'paper'>('overview');
  const [paperFilter, setPaperFilter] = useState<'all' | 'correct' | 'wrong' | 'fastest' | 'slowest' | 'attempt-order'>('all');
  const [markedFilter, setMarkedFilter] = useState<MistakeType[]>([]);
  const [showMarkedDropdown, setShowMarkedDropdown] = useState(false);
  const [openMarkDropdown, setOpenMarkDropdown] = useState<number | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  const [loading, setLoading] = useState(!!submissionId);
  const [remoteData, setRemoteData] = useState<{ result: TestResult; answerKey: AnswerKey; annotations: QuestionAnnotation[] } | null>(null);
  const [annotations, setAnnotations] = useState<QuestionAnnotation[]>([]);

  const result = submissionId ? remoteData?.result : storeResult;
  const answerKey = submissionId ? remoteData?.answerKey : storeAnswerKey;

  useEffect(() => {
    if (result) {
      if (submissionId && remoteData) {
        setAnnotations(remoteData.annotations);
      } else {
        const testId = result.config.testId || 'local-test';
        setAnnotations(getAnnotationsForTest(testId));
      }
    }
  }, [result, submissionId, remoteData]);

  useEffect(() => {
    const fetchSubmission = async () => {
      if (!submissionId) return;
      setLoading(true);
      try {
        const subDoc = await getDoc(doc(db, 'submissions', submissionId));
        if (!subDoc.exists()) {
          toast.error("Submission not found");
          navigate('/');
          return;
        }
        const data = subDoc.data();
        setRemoteData({
          result: data.result,
          answerKey: data.answerKey,
          annotations: data.annotations || []
        });
        setSubmitted(true);
      } catch (error) {
        console.error("Error fetching submission:", error);
        toast.error("Failed to load submission");
      } finally {
        setLoading(false);
      }
    };

    fetchSubmission();
  }, [submissionId, navigate]);

  useEffect(() => {
    if (!result && !loading) {
      navigate('/');
    }
  }, [result, navigate, loading]);

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

  const attemptOrder = useMemo(() => {
    if (!result) return new Map<number, number>();
    const answered = result.responses
      .filter(r => r.answeredAt !== null)
      .sort((a, b) => a.answeredAt! - b.answeredAt!);
    const map = new Map<number, number>();
    answered.forEach((r, i) => map.set(r.questionNo, i + 1));
    let next = answered.length + 1;
    result.responses.filter(r => r.answeredAt === null).forEach(r => map.set(r.questionNo, next++));
    return map;
  }, [result]);

  const [submissionDocId, setSubmissionDocId] = useState<string | null>(submissionId || null);

  useEffect(() => {
    const submitToServer = async () => {
      if (!result || !result.config.isServerTest || !result.config.testId || submitted || submitting || submissionId || submissionDocId) return;
      
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

        const annotations = getAnnotationsForTest(result.config.testId || 'local-test');

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

        const docRef = await addDoc(collection(db, 'submissions'), {
          testId: result.config.testId,
          testOwnerId: result.config.testOwnerId || null,
          userId,
          answers,
          annotations,
          score,
          completedAt: serverTimestamp(),
          // Include passcode if admin to bypass rules if needed (though rules now check test doc)
          ...(isAdmin ? { passcode: "Davendra@07" } : {})
        });

        setSubmissionDocId(docRef.id);
        setSubmitted(true);
        toast.success("Results submitted to server!");
        
        // After successful server submission, prompt to save locally
        setTimeout(() => {
          setSaveName(result.config.title || '');
          setShowSaveDialog(true);
        }, 1500);
      } catch (error) {
        console.error("Error submitting results:", error);
        toast.error("Failed to submit results to server.");
      } finally {
        setSubmitting(false);
      }
    };

    submitToServer();
  }, [result, answerKey, submitted, submitting, submissionDocId, submissionId]);

  const handleMark = async (questionNo: number, mistakeType: MistakeType) => {
    if (!result) return;
    const testId = result.config.testId || 'local-test';
    const r = result.responses.find(r => r.questionNo === questionNo);
    const correctAns = answerKey?.[questionNo] || null;
    
    const annotation: QuestionAnnotation = {
      testId,
      testName: result.config.title,
      questionNo,
      mistakeType,
      notes: '',
      selected: r?.selected || null,
      correct: correctAns,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    let updatedAnnotations: QuestionAnnotation[];
    
    if (submissionId && remoteData) {
      // Update remoteData annotations
      const existing = remoteData.annotations || [];
      const idx = existing.findIndex(a => a.questionNo === questionNo);
      updatedAnnotations = [...existing];
      if (idx >= 0) {
        updatedAnnotations[idx] = annotation;
      } else {
        updatedAnnotations.push(annotation);
      }
      setRemoteData({ ...remoteData, annotations: updatedAnnotations });
    } else {
      // Update local storage
      saveAnnotation(annotation);
      updatedAnnotations = getAnnotationsForTest(testId);
    }
    
    setAnnotations(updatedAnnotations);
    
    if (submissionDocId) {
      try {
        await updateDoc(doc(db, 'submissions', submissionDocId), {
          annotations: updatedAnnotations
        });
      } catch (error) {
        console.error("Error updating annotations on server:", error);
      }
    }
  };

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

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 relative">
      {/* Floating Menu Button for Mobile */}
      <div className="fixed top-3 right-3 z-50 md:hidden">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-10 h-10 bg-card border border-border rounded-full shadow-lg flex items-center justify-center text-foreground hover:bg-muted transition-colors"
        >
          {showMenu ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {showMenu && (
        <div className="fixed inset-0 z-40 md:hidden bg-background/95 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col items-center justify-center h-full gap-6 p-6 overflow-y-auto">
            <h1 className="text-xl font-bold font-mono text-foreground mb-4">Response Sheet</h1>
            
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
              <button
                onClick={() => navigate(-1)}
                className="flex flex-col items-center gap-1.5 p-3 bg-card border border-border rounded-xl hover:bg-muted transition-colors"
              >
                <ArrowLeft size={20} />
                <span className="text-[10px] font-bold">Back</span>
              </button>
              <button
                onClick={() => navigate('/answer-key')}
                className="flex flex-col items-center gap-1.5 p-3 bg-card border border-border rounded-xl hover:bg-muted transition-colors"
              >
                <Key size={20} />
                <span className="text-[10px] font-bold">Key</span>
              </button>
              <button
                onClick={() => { setShowMenu(false); setSaveName(''); setSaved(false); setShowSaveDialog(true); }}
                className="flex flex-col items-center gap-1.5 p-3 bg-card border border-success/30 rounded-xl hover:bg-success/5 transition-colors"
              >
                <Save size={20} className="text-success" />
                <span className="text-[10px] font-bold">Save</span>
              </button>
              <button
                onClick={() => { setShowMenu(false); setExportName(''); setShowExportDialog(true); }}
                className="flex flex-col items-center gap-1.5 p-3 bg-card border border-border rounded-xl hover:bg-muted transition-colors"
              >
                <Download size={20} />
                <span className="text-[10px] font-bold">Export</span>
              </button>
              <button
                onClick={() => { reset(); navigate('/'); }}
                className="flex flex-col items-center gap-1.5 p-3 bg-secondary text-secondary-foreground rounded-xl hover:opacity-80 transition-opacity col-span-2"
              >
                <RotateCcw size={20} />
                <span className="text-[10px] font-bold">New Test</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Desktop Header */}
         <div className="hidden md:flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 px-3 py-2 border border-border rounded text-sm text-foreground hover:bg-muted"
              title="Home"
            >
              <Home size={16} />
              Home
            </button>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 px-3 py-2 border border-border rounded text-sm text-foreground hover:bg-muted"
              title="Back"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <h1 className="text-2xl font-bold font-mono text-foreground">Response Sheet</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate('/answer-key')}
              className="px-2 py-1.5 sm:py-2 border border-border rounded text-[10px] sm:text-sm font-medium text-foreground hover:bg-muted flex items-center gap-1.5"
            >
              <Key size={14} /> Key
            </button>
            <button
              onClick={() => { setSaveName(''); setSaved(false); setShowSaveDialog(true); }}
              className="px-2 py-1.5 sm:py-2 border border-success/50 rounded text-[10px] sm:text-sm font-medium text-foreground hover:bg-success/10 flex items-center gap-1.5"
            >
              <Save size={14} className="text-success" /> Save
            </button>
            <button
              onClick={() => { setExportName(''); setShowExportDialog(true); }}
              className="px-2 py-1.5 sm:py-2 border border-border rounded text-[10px] sm:text-sm font-medium text-foreground hover:bg-muted flex items-center gap-1.5"
            >
              <Download size={14} /> Export
            </button>
            <button
              onClick={() => { reset(); navigate('/'); }}
              className="px-2 py-1.5 sm:py-2 bg-secondary text-secondary-foreground rounded text-[10px] sm:text-sm font-medium hover:opacity-80 flex items-center gap-1.5"
            >
              <RotateCcw size={14} /> New
            </button>
          </div>
        </div>

        {/* Mobile Header (Minimal) */}
        <div className="md:hidden flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="flex items-center justify-center w-8 h-8 border border-border rounded text-foreground hover:bg-muted"
              title="Home"
            >
              <Home size={16} />
            </button>
            <h1 className="text-lg font-bold font-mono text-foreground">Response Sheet</h1>
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

            {/* Tabs */}
            <div className="grid grid-cols-2 gap-4 mt-8">
              <button
                onClick={() => setActiveTab(activeTab === 'analysis' ? 'overview' : 'analysis')}
                className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all ${
                  activeTab === 'analysis' 
                    ? 'border-primary bg-primary/10 text-primary shadow-sm' 
                    : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:bg-muted'
                }`}
              >
                <BarChart2 size={32} className="mb-2" />
                <span className="font-bold font-mono text-lg">Analysis</span>
                <span className="text-xs opacity-80 mt-1">Charts & Insights</span>
              </button>
              
              <button
                onClick={() => setActiveTab(activeTab === 'paper' ? 'overview' : 'paper')}
                className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all ${
                  activeTab === 'paper' 
                    ? 'border-accent bg-accent/10 text-accent shadow-sm' 
                    : 'border-border bg-card text-muted-foreground hover:border-accent/50 hover:bg-muted'
                }`}
              >
                <FileText size={32} className="mb-2" />
                <span className="font-bold font-mono text-lg">See Paper</span>
                <span className="text-xs opacity-80 mt-1">Review all questions</span>
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'analysis' && (
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <AnalysisPage isEmbedded={true} />
              </div>
            )}

            {activeTab === 'paper' && (
              <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <span className="text-sm font-bold text-muted-foreground whitespace-nowrap">View:</span>
                  {(['all', 'correct', 'wrong', 'fastest', 'slowest', 'attempt-order'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setPaperFilter(f)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold font-mono whitespace-nowrap transition-colors ${paperFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                    >
                      {f.replace('-', ' ').toUpperCase()}
                    </button>
                  ))}
                  
                  <div className="relative">
                    <button
                      onClick={() => setShowMarkedDropdown(!showMarkedDropdown)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold font-mono whitespace-nowrap transition-colors flex items-center gap-1 ${markedFilter.length > 0 ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                    >
                      MARKED {markedFilter.length > 0 && `(${markedFilter.length})`}
                    </button>
                    
                    {showMarkedDropdown && (
                      <div className="absolute top-full mt-2 left-0 w-48 bg-card border border-border rounded-lg shadow-lg z-50 p-2 flex flex-col gap-1">
                        {(Object.entries(MISTAKE_TYPES) as [MistakeType, { label: string; icon: string; color: string }][]).map(([key, { label, icon }]) => {
                          const isSelected = markedFilter.includes(key);
                          return (
                            <button
                              key={key}
                              onClick={() => {
                                setMarkedFilter(prev => 
                                  isSelected ? prev.filter(k => k !== key) : [...prev, key]
                                );
                              }}
                              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors ${isSelected ? 'bg-accent/20 text-accent font-bold' : 'hover:bg-muted text-foreground'}`}
                            >
                              <span>{icon}</span>
                              <span>{label}</span>
                            </button>
                          );
                        })}
                        {markedFilter.length > 0 && (
                          <button
                            onClick={() => setMarkedFilter([])}
                            className="mt-2 pt-2 border-t border-border text-xs text-center text-muted-foreground hover:text-foreground"
                          >
                            Clear Filters
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {(() => {
                  let filtered = [...responses];
                  if (paperFilter === 'correct') {
                    filtered = filtered.filter(r => answerKey && r.selected === answerKey[r.questionNo]);
                  } else if (paperFilter === 'wrong') {
                    filtered = filtered.filter(r => answerKey && r.selected && r.selected !== answerKey[r.questionNo]);
                  } else if (paperFilter === 'fastest') {
                    filtered = filtered.sort((a, b) => (timeGaps[a.questionNo] || 0) - (timeGaps[b.questionNo] || 0));
                  } else if (paperFilter === 'slowest') {
                    filtered = filtered.sort((a, b) => (timeGaps[b.questionNo] || 0) - (timeGaps[a.questionNo] || 0));
                  } else if (paperFilter === 'attempt-order') {
                    filtered = filtered.sort((a, b) => (attemptOrder.get(a.questionNo) || 0) - (attemptOrder.get(b.questionNo) || 0));
                  }
                  
                  if (markedFilter.length > 0) {
                    filtered = filtered.filter(r => {
                      const ann = annotations.find(a => a.questionNo === r.questionNo);
                      return ann && markedFilter.includes(ann.mistakeType);
                    });
                  }
                  
                  return filtered.map((r) => {
                    const correctAns = answerKey?.[r.questionNo];
                    const isCorrect = r.selected && correctAns && r.selected === correctAns;
                    const isWrong = r.selected && correctAns && r.selected !== correctAns;
                    const isSkipped = !r.selected;
                    
                    const ann = annotations.find(a => a.questionNo === r.questionNo);
                    const qImage = ann?.imageData || result.config.questionImages?.[r.questionNo];
                    
                    return (
                      <div key={r.questionNo} className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-bold font-mono text-lg">Q. {r.questionNo}</h3>
                            {timeGaps[r.questionNo] !== undefined && (
                              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                                ⏱ {formatTime(timeGaps[r.questionNo])}
                              </span>
                            )}
                            
                            <div className="relative">
                              <button
                                onClick={() => setOpenMarkDropdown(openMarkDropdown === r.questionNo ? null : r.questionNo)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold font-mono transition-colors ${ann ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                              >
                                {ann ? (
                                  <>
                                    <span>{MISTAKE_TYPES[ann.mistakeType].icon}</span>
                                    <span>{MISTAKE_TYPES[ann.mistakeType].label}</span>
                                  </>
                                ) : (
                                  <>
                                    <FileText size={12} />
                                    <span>Mark</span>
                                  </>
                                )}
                              </button>
                              
                              {openMarkDropdown === r.questionNo && (
                                <div className="absolute top-full mt-2 left-0 w-48 bg-card border border-border rounded-lg shadow-lg z-50 p-2 flex flex-col gap-1">
                                  {(Object.entries(MISTAKE_TYPES) as [MistakeType, { label: string; icon: string; color: string }][]).map(([key, { label, icon }]) => (
                                    <button
                                      key={key}
                                      onClick={() => {
                                        handleMark(r.questionNo, key);
                                        setOpenMarkDropdown(null);
                                      }}
                                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors ${ann?.mistakeType === key ? 'bg-accent/20 text-accent font-bold' : 'hover:bg-muted text-foreground'}`}
                                    >
                                      <span>{icon}</span>
                                      <span>{label}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {isCorrect && <span className="px-2 py-1 bg-success/20 text-success rounded text-xs font-bold font-mono">Correct (+4)</span>}
                            {isWrong && <span className="px-2 py-1 bg-destructive/20 text-destructive rounded text-xs font-bold font-mono">Incorrect (-1)</span>}
                            {isSkipped && <span className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs font-bold font-mono">Skipped (0)</span>}
                          </div>
                        </div>
                        
                        {qImage && (
                          <div className="border border-border rounded-lg overflow-hidden bg-white/5 p-2 flex justify-center">
                            <img 
                              src={qImage} 
                              alt={`Question ${r.questionNo}`} 
                              className="max-w-full h-auto object-contain max-h-[400px] cursor-pointer hover:opacity-90 transition-opacity" 
                              onClick={() => setFullscreenImage(qImage)}
                            />
                          </div>
                        )}
                        
                        <div className="flex flex-wrap gap-4 items-center bg-muted/30 p-3 rounded-lg border border-border/50">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono font-bold">Marked:</span>
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold font-mono border-2 ${r.selected ? (isCorrect ? 'bg-success text-success-foreground border-success' : 'bg-destructive text-destructive-foreground border-destructive') : 'bg-muted text-muted-foreground border-border'}`}>
                            {r.selected || '-'}
                          </span>
                        </div>
                        
                        {answerKey && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-mono font-bold">Correct:</span>
                            <span className="w-8 h-8 rounded-full flex items-center justify-center font-bold font-mono border-2 bg-success/20 text-success border-success">
                              {correctAns}
                            </span>
                          </div>
                        )}
                      </div>

                      {(isWrong || isSkipped) && ann?.mistakeType && ann.mistakeType.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                          {ann.mistakeType.map(type => {
                            const mistakeInfo = MISTAKE_TYPES.find(m => m.id === type);
                            if (!mistakeInfo) return null;
                            const Icon = mistakeInfo.icon;
                            return (
                              <div key={type} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium" style={{ borderColor: mistakeInfo.color, color: mistakeInfo.color, backgroundColor: `${mistakeInfo.color}15` }}>
                                <Icon size={14} />
                                {mistakeInfo.label}
                              </div>
                            );
                          })}
                          {ann.note && (
                            <div className="w-full mt-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg border border-border/50">
                              <span className="font-bold text-foreground mr-2">Note:</span>
                              {ann.note}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                  });
                })()}
              </div>
            )}
          </div>
        )}
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
                  const annotations = includeDetailed ? getAnnotationsForTest(result!.id) : [];
                  exportTestAsHtml({ 
                    testName: exportName.trim(), 
                    result: result!, 
                    answerKey,
                    includeAnnotations: includeDetailed,
                    annotations
                  });
                  setShowExportDialog(false);
                }
              }}
              placeholder="e.g. JEE Mains Mock 3"
              autoFocus
              className="w-full px-3 py-2 border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={includeDetailed}
                onChange={(e) => setIncludeDetailed(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-xs font-mono text-foreground group-hover:text-primary transition-colors">
                Include Question Paper & Detailed Review
              </span>
            </label>
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
                    const annotations = includeDetailed ? getAnnotationsForTest(result!.id) : [];
                    exportTestAsHtml({ 
                      testName: exportName.trim(), 
                      result: result!, 
                      answerKey,
                      includeAnnotations: includeDetailed,
                      annotations
                    });
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
      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <button 
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
            onClick={(e) => { e.stopPropagation(); setFullscreenImage(null); }}
          >
            <X size={24} />
          </button>
          <img 
            src={fullscreenImage} 
            alt="Fullscreen" 
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default ResultsPage;
