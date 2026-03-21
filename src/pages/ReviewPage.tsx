import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Menu, X, Home, ArrowLeft, Moon, Sun, ChevronLeft, ChevronRight, MessageSquare, Info, BarChart2 } from 'lucide-react';
import { useTestStore } from '@/store/testStore';
import { getAnnotationsForTest, type QuestionAnnotation, MISTAKE_TYPES } from '@/lib/mistakeStore';
import { AnnotationEditor } from '@/components/AnnotationEditor';
import type { Option, TestResult, AnswerKey } from '@/types/test';
import { useTheme } from 'next-themes';
import { db } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const options: Option[] = ['A', 'B', 'C', 'D'];

const ReviewPage = () => {
  const { result: storeResult, answerKey: storeAnswerKey } = useTestStore();
  const navigate = useNavigate();
  const { submissionId } = useParams();
  const { theme, setTheme } = useTheme();
  
  const [currentQ, setCurrentQ] = useState(1);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<QuestionAnnotation[]>([]);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const [loading, setLoading] = useState(!!submissionId);
  const [remoteData, setRemoteData] = useState<{ result: TestResult; answerKey: AnswerKey; annotations: QuestionAnnotation[] } | null>(null);

  const result = submissionId ? remoteData?.result : storeResult;
  const answerKey = submissionId ? remoteData?.answerKey : storeAnswerKey;

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
        const subData = subDoc.data();
        const testDoc = await getDoc(doc(db, 'tests', subData.testId));
        if (!testDoc.exists()) {
          toast.error("Associated test not found");
          navigate('/');
          return;
        }
        const testData = testDoc.data();
        
        // Reconstruct result and answerKey
        const responses = Object.entries(subData.answers).map(([qNo, selected]) => ({
          questionNo: parseInt(qNo),
          selected: selected as string | null,
          timeSpent: 0 // Not stored in submission currently
        }));

        const reconstructedResult: TestResult = {
          config: {
            testId: subData.testId,
            title: testData.title,
            totalQuestions: testData.numQuestions,
            startFrom: testData.startFrom,
            timeInMinutes: testData.timeInMinutes,
            sections: testData.sections,
            isServerTest: true
          },
          responses,
          startTime: subData.completedAt?.toMillis() || Date.now(),
          endTime: subData.completedAt?.toMillis() || Date.now()
        };

        const reconstructedAnswerKey: AnswerKey = {};
        (testData.questions || []).forEach((q: any) => {
          reconstructedAnswerKey[q.id] = q.correctAnswer;
        });

        setRemoteData({ 
          result: reconstructedResult, 
          answerKey: reconstructedAnswerKey,
          annotations: subData.annotations || []
        });
      } catch (error) {
        console.error("Error fetching submission:", error);
        toast.error("Failed to load submission data");
      } finally {
        setLoading(false);
      }
    };

    fetchSubmission();
  }, [submissionId, navigate]);

  useEffect(() => {
    if (!result && !loading) {
      navigate('/');
      return;
    }
    if (result) {
      if (submissionId && remoteData) {
        setAnnotations(remoteData.annotations);
      } else {
        const testId = result.config.testId || 'local-test';
        setAnnotations(getAnnotationsForTest(testId));
      }
    }
  }, [result, navigate, loading, submissionId, remoteData]);

  const refreshAnnotations = () => {
    if (!result) return;
    const testId = result.config.testId || 'local-test';
    setAnnotations(getAnnotationsForTest(testId));
  };

  const currentResponse = useMemo(() => {
    return result?.responses.find(r => r.questionNo === currentQ);
  }, [result, currentQ]);

  const currentAnnotation = useMemo(() => {
    return annotations.find(a => a.questionNo === currentQ);
  }, [annotations, currentQ]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-mono text-muted-foreground">Loading Review Data...</p>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const getQuestionType = (qNo: number) => {
    if (!result.config.sections) return 'mcq';
    const section = result.config.sections.find(s => qNo >= s.startQ && qNo <= s.endQ);
    return section?.type || 'mcq';
  };

  const getQuestionImage = (qNo: number) => {
    // Check if there's a question image in the test config or annotation
    const ann = annotations.find(a => a.questionNo === qNo);
    if (ann?.imageData) return ann.imageData;
    
    // If the test config has images (not implemented yet in OMR, but good for future)
    // return result.config.questions?.[qNo]?.image;
    return null;
  };

  const qType = getQuestionType(currentQ);
  const correctAns = answerKey?.[currentQ];
  const selectedAns = currentResponse?.selected;
  const isCorrect = selectedAns && correctAns && selectedAns === correctAns;
  const isWrong = selectedAns && correctAns && selectedAns !== correctAns;
  const isSkipped = !selectedAns;
  const qImage = getQuestionImage(currentQ);

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
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
          <div className="flex flex-col items-center justify-center h-full gap-8 p-6">
            <div className="text-center space-y-2">
              <h1 className="text-lg font-bold font-mono text-foreground">
                {result.config.title}
              </h1>
              <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest">
                Review Mode
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
              <button
                onClick={() => navigate(-1)}
                className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-xl hover:bg-muted transition-colors"
              >
                <ArrowLeft size={24} />
                <span className="text-xs font-bold">Back</span>
              </button>
              <button
                onClick={() => navigate('/results')}
                className="flex flex-col items-center gap-2 p-4 bg-card border border-border rounded-xl hover:bg-muted transition-colors"
              >
                <BarChart2 size={24} />
                <span className="text-xs font-bold">Results</span>
              </button>
              <button
                onClick={() => setShowMenu(false)}
                className="flex flex-col items-center gap-2 p-4 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-opacity col-span-2"
              >
                <X size={24} />
                <span className="text-xs font-bold">Close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Header */}
      <header className="hidden md:flex h-14 border-b border-border bg-card px-4 items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(submissionId ? '/admin' : '/results')}
            className="p-1 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
            title="Back"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold font-mono truncate max-w-md">
              {result.config.title}
            </h1>
            <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
              {submissionId ? 'Admin View' : 'Review Mode'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-muted rounded-full transition-colors"
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Question Grid */}
        <div className="w-full md:w-72 border-r border-border bg-card/50 flex flex-col h-[120px] sm:h-[140px] md:h-auto">
          <div className="px-3 py-1 border-b border-border bg-muted/30 flex justify-between items-center">
            <h2 className="text-[8px] font-bold font-mono text-muted-foreground uppercase tracking-widest">Questions</h2>
            <span className="text-[8px] font-mono text-muted-foreground">{currentQ}/{result.responses.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 sm:p-2">
            <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-4 gap-1 sm:gap-1.5">
              {result.responses.map((r) => {
                const qAns = answerKey?.[r.questionNo];
                const qSelected = r.selected;
                const qCorrect = qSelected && qAns && qSelected === qAns;
                const qWrong = qSelected && qAns && qSelected !== qAns;
                const hasAnn = annotations.some(a => a.questionNo === r.questionNo);

                return (
                  <button
                    key={r.questionNo}
                    onClick={() => { setCurrentQ(r.questionNo); setIsAnnotating(false); }}
                    className={`
                      relative h-7 sm:h-9 rounded-md border-2 font-mono text-[9px] sm:text-xs font-bold transition-all
                      ${currentQ === r.questionNo ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-105 z-10' : ''}
                      ${qCorrect ? 'bg-success/10 border-success text-success' : 
                        qWrong ? 'bg-destructive/10 border-destructive text-destructive' : 
                        !qSelected ? 'bg-muted/50 border-border text-muted-foreground' : 'bg-primary/10 border-primary text-primary'}
                    `}
                  >
                    {r.questionNo}
                    {hasAnn && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full border border-background" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Question Detail */}
        <div className="flex-1 overflow-y-auto bg-background p-3 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
            {/* Question Info Card */}
            <div className="bg-card border border-border rounded-xl p-3 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg sm:text-2xl font-bold font-mono text-muted-foreground">Q.{currentQ}</span>
                  {qType === 'numerical' && (
                    <span className="px-1 py-0.5 bg-primary/10 text-primary text-[7px] sm:text-[10px] font-bold rounded uppercase tracking-wider">Numerical</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {isCorrect && <span className="px-1.5 py-0.5 bg-success/10 text-success text-[8px] sm:text-[10px] font-bold rounded-full border border-success/20">✓ Correct</span>}
                  {isWrong && <span className="px-1.5 py-0.5 bg-destructive/10 text-destructive text-[8px] sm:text-[10px] font-bold rounded-full border border-destructive/20">✗ Wrong</span>}
                  {isSkipped && <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-[8px] sm:text-[10px] font-bold rounded-full">Skipped</span>}
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {/* Compact Answer Display */}
                <div className="flex flex-row gap-2 sm:gap-3">
                  <div className="flex-1 flex items-center justify-between p-2 sm:p-3 rounded-lg border border-border bg-muted/20">
                    <span className="text-[8px] sm:text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Your Ans</span>
                    <span className={`font-mono text-xs sm:text-sm font-bold ${
                      isCorrect ? 'text-success' : isWrong ? 'text-destructive' : 'text-muted-foreground/40'
                    }`}>
                      {selectedAns || '—'}
                    </span>
                  </div>
                  <div className="flex-1 flex items-center justify-between p-2 sm:p-3 rounded-lg border border-success/30 bg-success/5">
                    <span className="text-[8px] sm:text-[9px] font-bold text-success uppercase tracking-wider">Correct Ans</span>
                    <span className="text-success font-mono text-xs sm:text-sm font-bold">
                      {correctAns || '—'}
                    </span>
                  </div>
                </div>

                {/* Question Image if exists */}
                {qImage && (
                  <div className="border border-border rounded-lg overflow-hidden bg-muted/10">
                    <img 
                      src={qImage} 
                      alt={`Question ${currentQ}`} 
                      className="max-w-full mx-auto max-h-[200px] sm:max-h-[300px] object-contain cursor-pointer hover:opacity-90 transition-opacity" 
                      onClick={() => setFullscreenImage(qImage)}
                    />
                  </div>
                )}

                {qType === 'mcq' && (
                  <div className="flex justify-center gap-1.5 sm:gap-3 pt-1 sm:pt-2">
                    {options.map(opt => (
                      <div
                        key={opt}
                        className={`w-7 h-7 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center font-mono font-bold text-[10px] sm:text-xs
                          ${opt === correctAns ? 'bg-success text-success-foreground border-success' : 
                            opt === selectedAns ? 'bg-destructive text-destructive-foreground border-destructive' : 
                            'border-border text-muted-foreground/20'}
                        `}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Annotation Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-wider">Analysis & Notes</h3>
                {!isAnnotating && (
                  <button
                    onClick={() => setIsAnnotating(true)}
                    className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-bold hover:bg-primary/20 transition-colors flex items-center gap-1.5"
                  >
                    <span>{currentAnnotation ? '✎ Edit' : '+ Add Note'}</span>
                  </button>
                )}
              </div>

              {isAnnotating ? (
                <div className="bg-card border border-primary/30 rounded-xl overflow-hidden shadow-lg">
                  <AnnotationEditor
                    testId={result.config.testId || 'local-test'}
                    testName={result.config.title}
                    questionNo={currentQ}
                    selected={selectedAns}
                    correct={correctAns || null}
                    existing={currentAnnotation}
                    type={qType}
                    onSave={() => {
                      refreshAnnotations();
                      setIsAnnotating(false);
                    }}
                    onCancel={() => setIsAnnotating(false)}
                  />
                </div>
              ) : currentAnnotation ? (
                <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                      {MISTAKE_TYPES[currentAnnotation.mistakeType].icon}
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-foreground">
                        {MISTAKE_TYPES[currentAnnotation.mistakeType].label}
                      </div>
                    </div>
                  </div>

                  {currentAnnotation.notes && (
                    <div className="p-3 bg-muted/30 rounded-lg border border-border/50 italic text-xs text-foreground font-serif">
                      "{currentAnnotation.notes}"
                    </div>
                  )}

                  {currentAnnotation.tags && currentAnnotation.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {currentAnnotation.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-mono font-bold rounded-full">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-muted/10 border-2 border-dashed border-border rounded-xl p-6 sm:p-10 text-center">
                  <p className="text-[11px] text-muted-foreground">No analysis added yet.</p>
                  <button
                    onClick={() => setIsAnnotating(true)}
                    className="mt-2 text-[10px] font-bold text-primary hover:underline"
                  >
                    Categorize mistake
                  </button>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-4 sm:pt-6 border-t border-border">
              <button
                disabled={currentQ === 1}
                onClick={() => { setCurrentQ(prev => prev - 1); setIsAnnotating(false); }}
                className="px-4 py-2 border border-border rounded-lg text-xs font-bold hover:bg-muted disabled:opacity-30 transition-all"
              >
                ← Prev
              </button>
              <div className="text-[10px] font-mono text-muted-foreground">
                {currentQ} / {result.responses.length}
              </div>
              <button
                disabled={currentQ === result.responses.length}
                onClick={() => { setCurrentQ(prev => prev + 1); setIsAnnotating(false); }}
                className="px-4 py-2 bg-foreground text-background rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-30 transition-all"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </main>
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

export default ReviewPage;
