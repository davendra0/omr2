import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTestStore } from '@/store/testStore';
import { getSavedTests, type SavedTest } from '@/lib/testHistory';
import { getPlannedTests, addPlannedTest, deletePlannedTest, type PlannedTest } from '@/lib/plannedTestStore';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { TestSection, DisplayPrefs } from '@/types/test';
import { DEFAULT_DISPLAY_PREFS } from '@/types/test';

import { collection, query, orderBy, onSnapshot, deleteDoc, doc, setDoc, where, getDocs, getDocFromServer } from 'firebase/firestore';
import { db, loginWithGoogle, logout } from '@/firebase';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { Lock, BarChart3, AlertCircle, Download, Play, Trash2, Edit, History } from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
  }
}

type Tab = 'quick' | 'plan' | 'server' | 'upcoming' | 'history';

interface SectionInput { name: string; startQ: string; endQ: string; type: 'mcq' | 'numerical' }

const AUTOSAVE_KEY = 'omr_autosave';

const SetupPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setConfig, startTest, setResult } = useTestStore();
  const [tab, setTab] = useState<Tab>('server');

  // Submissions state
  const [isSubmissionsOpen, setIsSubmissionsOpen] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [viewingTest, setViewingTest] = useState<any | null>(null);

  // Confirmation Dialog state
  const [confirmConfig, setConfirmConfig] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const showConfirm = (title: string, description: string, onConfirm: () => void) => {
    setConfirmConfig({ open: true, title, description, onConfirm });
  };

  // Quick start state
  const [totalQuestions, setTotalQuestions] = useState('');
  const [startFrom, setStartFrom] = useState('1');
  const [timeInMinutes, setTimeInMinutes] = useState('');
  const [qSections, setQSections] = useState<SectionInput[]>([]);
  const [qDisplayPrefs, setQDisplayPrefs] = useState<DisplayPrefs>({ ...DEFAULT_DISPLAY_PREFS });
  const [wallClockStart, setWallClockStart] = useState('');

  // Plan state
  const [planName, setPlanName] = useState('');
  const [planQuestions, setPlanQuestions] = useState('');
  const [planStart, setPlanStart] = useState('1');
  const [planTime, setPlanTime] = useState('');
  const [planDate, setPlanDate] = useState<Date | undefined>(undefined);
  const [planSections, setPlanSections] = useState<SectionInput[]>([]);
  const [planDisplayPrefs, setPlanDisplayPrefs] = useState<DisplayPrefs>({ ...DEFAULT_DISPLAY_PREFS });
  const [planWallClockStart, setPlanWallClockStart] = useState('');

  // Data
  const [planned, setPlanned] = useState<PlannedTest[]>([]);
  const [savedTests, setSavedTests] = useState<SavedTest[]>([]);
  const [serverTests, setServerTests] = useState<any[]>([]);
  const [localTests, setLocalTests] = useState<any[]>([]);
  const [serverLoading, setServerLoading] = useState(true);
  const [downloadedTests, setDownloadedTests] = useState<string[]>([]);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Autosave recovery
  const [autosave, setAutosave] = useState<any>(null);

  const handleFirestoreError = (error: any, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: user?.uid,
        email: user?.email,
        emailVerified: user?.emailVerified,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    
    if (errInfo.error.includes('insufficient permissions')) {
      toast.error("Permission denied. Admin access required.");
    } else if (errInfo.error.includes('quota exceeded')) {
      toast.error("Firestore quota exceeded.");
    } else {
      toast.error(`Error: ${errInfo.error}`);
    }
    
    throw new Error(JSON.stringify(errInfo));
  };

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error: any) {
        if (error.message?.includes('the client is offline')) {
          console.error("Firestore connection error: the client is offline");
          toast.error("Database is offline. Please check your connection.");
        }
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    setPlanned(getPlannedTests());
    setSavedTests(getSavedTests());
    
    // Load downloaded tests list
    try {
      const raw = localStorage.getItem('downloaded_server_tests');
      const saved = raw ? JSON.parse(raw) : [];
      if (Array.isArray(saved)) {
        setLocalTests(saved);
        setDownloadedTests(saved.map((t: any) => t.id).filter(Boolean));
      }
    } catch (e) {
      console.error("Error loading downloaded tests:", e);
      localStorage.removeItem('downloaded_server_tests');
    }

    // Check for autosave
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (raw) setAutosave(JSON.parse(raw));
    } catch (e) {
      console.error("Error loading autosave:", e);
    }

    // Fetch server tests
    const q = query(collection(db, 'tests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setServerTests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setServerLoading(false);
    }, (error) => {
      console.error("Firestore snapshot error:", error);
      setServerLoading(false);
      // Log more details if possible
      if (error.code === 'permission-denied') {
        toast.error("Permission denied when fetching tests. Please try again later.");
      }
    });

    return () => unsubscribe();
  }, []);

  const upcomingTests = planned.filter(t => !t.completed).sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayTests = upcomingTests.filter(t => t.scheduledDate === todayStr);

  const buildSections = (inputs: SectionInput[]): TestSection[] => {
    const valid = inputs.filter(s => s.name.trim() && parseInt(s.startQ) && parseInt(s.endQ));
    if (valid.length === 0) return [];
    return valid.map(s => ({ 
      id: Math.random().toString(36).substring(2, 9),
      name: s.name.trim(), 
      startQ: parseInt(s.startQ), 
      endQ: parseInt(s.endQ),
      type: s.type || 'mcq'
    }));
  };

  const handleQuickStart = () => {
    const total = parseInt(totalQuestions);
    const start = parseInt(startFrom) || 1;
    const time = parseInt(timeInMinutes);
    if (!total || total < 1 || !time || time < 1) return;

    const sections = buildSections(qSections);
    // Validate sections are within range
    const invalidSection = sections.find(s => s.startQ < start || s.endQ > start + total - 1 || s.startQ > s.endQ);
    if (invalidSection) {
      toast.error(`Section "${invalidSection.name}" is out of range (Q${start}–Q${start + total - 1})`);
      return;
    }

    localStorage.removeItem(AUTOSAVE_KEY);
    setConfig({
      totalQuestions: total, startFrom: start, timeInMinutes: time,
      sections,
      displayPrefs: qDisplayPrefs,
      wallClockStartTime: wallClockStart || undefined,
    });
    startTest();
    navigate('/test');
  };

  const handleViewSubmissions = async (test: any) => {
    setViewingTest(test);
    setSubmissionsLoading(true);
    setIsSubmissionsOpen(true);
    const path = 'submissions';
    try {
      const isRealAdmin = user?.email === "manishayadav0512198500@gmail.com" || user?.email === "dav08kum@gmail.com";
      const isAdmin = user?.uid === 'admin_davendra' || isRealAdmin;
      
      let q;
      if (isAdmin) {
        q = query(
          collection(db, path),
          where('testId', '==', test.id),
          orderBy('completedAt', 'desc')
        );
      } else {
        q = query(
          collection(db, path),
          where('testId', '==', test.id),
          where('testOwnerId', '==', user?.uid)
        );
      }
      
      const snapshot = await getDocs(q);
      let subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort in memory if not admin
      if (!isAdmin) {
        subs.sort((a: any, b: any) => {
          const timeA = a.completedAt?.toMillis?.() || 0;
          const timeB = b.completedAt?.toMillis?.() || 0;
          return timeB - timeA;
        });
      }
      
      setSubmissions(subs);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const handleViewSubmissionAnalysis = (sub: any) => {
    navigate(`/review/submission/${sub.id}`);
  };

  const handleStartServerTest = (test: any) => {
    localStorage.removeItem(AUTOSAVE_KEY);
    setConfig({
      totalQuestions: test.numQuestions,
      startFrom: test.startFrom || 1,
      timeInMinutes: test.timeInMinutes,
      sections: test.sections || [],
      displayPrefs: { ...DEFAULT_DISPLAY_PREFS },
      isServerTest: true,
      testId: test.id,
      testOwnerId: test.createdBy,
      title: test.title,
      description: test.description,
      questionImages: test.questions?.reduce((acc: any, q: any) => {
        if (q.imageUrl) acc[q.id] = q.imageUrl;
        return acc;
      }, {}),
      correctAnswers: test.questions?.reduce((acc: any, q: any) => {
        if (q.correctAnswer) acc[q.id] = q.correctAnswer;
        return acc;
      }, {}),
      questionTypes: test.questions?.reduce((acc: any, q: any) => {
        if (q.type) acc[q.id] = q.type;
        return acc;
      }, {})
    });
    startTest();
    navigate('/test');
  };

  const handleResumeAutosave = () => {
    if (!autosave) return;
    const store = useTestStore.getState();
    store.setConfig(autosave.config);
    // Restore responses and startTime
    useTestStore.setState({
      responses: autosave.responses,
      startTime: autosave.startTime || Date.now(),
    });
    // Don't call startTest() since startTime is already set
    navigate('/test');
  };

  const handleDismissAutosave = () => {
    localStorage.removeItem(AUTOSAVE_KEY);
    setAutosave(null);
  };

  const handlePlanTest = () => {
    const total = parseInt(planQuestions);
    const start = parseInt(planStart) || 1;
    const time = parseInt(planTime);
    if (!total || !time || !planDate || !planName.trim()) return;

    const sections = buildSections(planSections);
    // Validate sections are within range
    const invalidSection = sections.find(s => s.startQ < start || s.endQ > start + total - 1 || s.startQ > s.endQ);
    if (invalidSection) {
      toast.error(`Section "${invalidSection.name}" is out of range (Q${start}–Q${start + total - 1})`);
      return;
    }

    addPlannedTest({
      name: planName.trim(), totalQuestions: total, startFrom: start, timeInMinutes: time,
      scheduledDate: format(planDate, 'yyyy-MM-dd'),
      sections,
    });
    setPlanned(getPlannedTests());
    setPlanName(''); setPlanQuestions(''); setPlanStart('1'); setPlanTime(''); setPlanDate(undefined);
    setPlanSections([]);
    setTab('upcoming');
  };

  const handleStartPlanned = (test: PlannedTest) => {
    localStorage.removeItem(AUTOSAVE_KEY);
    setConfig({
      totalQuestions: test.totalQuestions, startFrom: test.startFrom, timeInMinutes: test.timeInMinutes,
      sections: test.sections || [], displayPrefs: { ...DEFAULT_DISPLAY_PREFS },
    });
    startTest();
    sessionStorage.setItem('planned_test_id', test.id);
    navigate('/test');
  };

  const handleDownload = (test: any) => {
    try {
      if (!test || !test.id) {
        toast.error("Invalid test data");
        return;
      }

      console.log("Downloading test:", test.id);
      const raw = localStorage.getItem('downloaded_server_tests');
      const saved = raw ? JSON.parse(raw) : [];
      
      if (!Array.isArray(saved)) {
        localStorage.setItem('downloaded_server_tests', JSON.stringify([test]));
        setLocalTests([test]);
        setDownloadedTests([test.id]);
        toast.success("Test downloaded for offline use!");
        return;
      }

      if (!saved.find((t: any) => t.id === test.id)) {
        const newSaved = [...saved, test];
        localStorage.setItem('downloaded_server_tests', JSON.stringify(newSaved));
        setLocalTests(newSaved);
        setDownloadedTests(prev => [...prev, test.id]);
        toast.success("Test downloaded for offline use!");
      } else {
        toast.info("Test is already downloaded.");
      }
    } catch (error) {
      console.error("Download error:", error);
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        toast.error("Storage is full. Please remove some downloaded tests.");
      } else {
        toast.error("Failed to download test. Local storage error.");
      }
    }
  };

  const handleDeleteServerTest = async (id: string) => {
    showConfirm(
      "Delete from Server?",
      "Are you sure you want to delete this test from the server? This action cannot be undone.",
      async () => {
        const path = 'tests';
        try {
          await deleteDoc(doc(db, path, id));
          toast.success("Test deleted from server");
          // Also remove from downloaded if present
          const saved = JSON.parse(localStorage.getItem('downloaded_server_tests') || '[]');
          const filtered = saved.filter((t: any) => t.id !== id);
          localStorage.setItem('downloaded_server_tests', JSON.stringify(filtered));
          setLocalTests(filtered);
          setDownloadedTests(filtered.map((t: any) => t.id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
        }
      }
    );
  };

  const handleEditServerTest = (id: string) => {
    navigate(`/omr/edit/${id}`);
  };

  const handleDeleteDownloaded = (id: string) => {
    showConfirm(
      "Remove from Cache?",
      "Remove this test from offline cache?",
      () => {
        const saved = JSON.parse(localStorage.getItem('downloaded_server_tests') || '[]');
        const filtered = saved.filter((t: any) => t.id !== id);
        localStorage.setItem('downloaded_server_tests', JSON.stringify(filtered));
        setLocalTests(filtered);
        setDownloadedTests(filtered.map((t: any) => t.id));
        toast.success("Removed from offline cache");
      }
    );
  };

  const handleDeletePlanned = (id: string) => {
    showConfirm(
      "Delete Planned Test?",
      "Delete this planned test?",
      () => {
        deletePlannedTest(id);
        setPlanned(getPlannedTests());
      }
    );
  };

  const handleLogin = async () => {
    if (password === "Davendra@07") {
      setIsLoggingIn(true);
      try {
        // Just set local storage, AuthProvider will detect it
        localStorage.setItem('admin_passcode', password);
        // Force a page reload to refresh AuthProvider state
        window.location.reload();
      } catch (error) {
        console.error("Login error:", error);
        toast.error("Login failed");
      } finally {
        setIsLoggingIn(false);
      }
    } else {
      toast.error("Incorrect Admin Password");
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await loginWithGoogle();
      toast.success("Logged in successfully!");
      setIsLoginOpen(false);
    } catch (error) {
      toast.error("Failed to login with Google");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      localStorage.removeItem('admin_passcode');
      toast.success("Logged out successfully");
      window.location.reload();
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'server', label: 'Server Tests', icon: '🌐' },
    { key: 'quick', label: 'Quick Start', icon: '⚡' },
    { key: 'plan', label: 'Plan Test', icon: '📅' },
    { key: 'upcoming', label: `Upcoming${upcomingTests.length ? ` (${upcomingTests.length})` : ''}`, icon: '📋' },
    { key: 'history', label: `Past Tests${savedTests.length ? ` (${savedTests.length})` : ''}`, icon: '📊' },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      {/* Global Dialogs */}
      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmConfig.open}
        onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, open }))}
        title={confirmConfig.title}
        description={confirmConfig.description}
        onConfirm={confirmConfig.onConfirm}
      />

      {/* Login Dialog */}
      <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Login
            </DialogTitle>
            <DialogDescription>
              Login to create and share tests.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button 
              variant="outline" 
              onClick={handleGoogleLogin} 
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-2"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
              Login with Google
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or Admin Login
                </span>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Admin Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLoginOpen(false)}>Cancel</Button>
            <Button onClick={handleLogin} disabled={isLoggingIn}>
              {isLoggingIn ? "Logging in..." : "Login as Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submissions Dialog */}
      <Dialog open={isSubmissionsOpen} onOpenChange={setIsSubmissionsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Test Submissions
            </DialogTitle>
            <DialogDescription>
              View and analyze submissions for this test.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4">
            {submissionsLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mb-4" />
                <p className="text-sm text-muted-foreground">Fetching submissions...</p>
              </div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-12 bg-muted/20 rounded-lg border border-dashed border-border">
                <p className="text-sm text-muted-foreground">No submissions found for this test.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {submissions.map((sub) => (
                  <div key={sub.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold truncate">
                          User: {sub.userId === 'admin_davendra' ? 'Admin' : sub.userId.slice(0, 8) + '...'}
                        </span>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {sub.completedAt ? format(sub.completedAt.toDate(), 'dd MMM HH:mm') : 'Unknown date'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-bold text-primary">Score: {sub.score}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {Object.keys(sub.answers || {}).length} Answers
                        </div>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleViewSubmissionAnalysis(sub)}
                      className="shrink-0 text-[10px] h-8"
                    >
                      View Analysis
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubmissionsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground">📝 OMR Test</h1>
          <p className="text-muted-foreground mt-1 text-sm">Configure, plan, and track your tests</p>
        </div>
        {user && !user.isAnonymous && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate('/omr/create')}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-bold font-mono hover:opacity-90 transition-opacity"
            >
              + Create Test
            </button>
            <button 
              onClick={handleLogout}
              className="px-3 py-1.5 border border-border text-muted-foreground rounded-md text-xs font-bold font-mono hover:bg-muted transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>

      {/* Autosave recovery banner */}
      {autosave && (
        <div className="bg-[hsl(var(--review))]/10 border border-[hsl(var(--review))]/30 rounded-lg p-4">
          <div className="text-sm font-bold text-[hsl(var(--review))] font-mono mb-1">💾 Unsaved Test Found</div>
          <p className="text-xs text-muted-foreground mb-3">
            {autosave.config.totalQuestions}Q test from {new Date(autosave.savedAt).toLocaleString()}
          </p>
          <div className="flex gap-2">
            <button onClick={handleResumeAutosave} className="px-3 py-1.5 bg-primary text-primary-foreground rounded font-bold text-xs hover:opacity-90">▶ Resume</button>
            <button onClick={handleDismissAutosave} className="px-3 py-1.5 border border-border rounded text-xs text-muted-foreground hover:bg-muted">Dismiss</button>
          </div>
        </div>
      )}

      {todayTests.length > 0 && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
          <div className="text-sm font-bold text-primary font-mono mb-2">🔔 Today's Tests</div>
          <div className="space-y-2">
            {todayTests.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-2">
                <span className="text-sm font-mono text-foreground truncate">{t.name}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                  <span>{t.totalQuestions}Q · {t.timeInMinutes}m</span>
                  <button onClick={() => handleStartPlanned(t)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded font-bold text-xs hover:opacity-90 transition-opacity">▶ Start</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto scrollbar-hide">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => t.key === 'history' ? navigate('/omr/history') : setTab(t.key)}
            className={cn(
              'flex-1 py-2 px-3 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap',
              tab === t.key && t.key !== 'history' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="hidden sm:inline">{t.icon} </span>{t.label}
          </button>
        ))}
      </div>

      {/* Server Tests */}
      {tab === 'server' && (
        <div className="space-y-6">
          {(!user || user.isAnonymous) && (
            <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground mb-2">Login to create and share your own tests with the community.</p>
              <button 
                onClick={() => setIsLoginOpen(true)} 
                className="text-primary font-bold text-xs hover:underline"
              >
                🔑 Login Now
              </button>
            </div>
          )}

          {/* Downloaded Section */}
          {localTests.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <span className="text-[10px] font-black font-mono uppercase tracking-widest text-success">Downloaded & Offline</span>
                <div className="h-px flex-1 bg-success/20" />
              </div>
              {localTests.map(test => {
                const isOwner = test.createdBy === user?.uid || user?.uid === 'admin_davendra';
                return (
                  <div key={`local-${test.id}`} className="bg-card border-2 border-success/20 rounded-lg p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-mono font-bold text-foreground truncate">{test.title}</div>
                          <span className="bg-success text-success-foreground text-[8px] px-1.5 py-0.5 rounded font-bold uppercase">Ready</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{test.description || 'Offline copy available.'}</p>
                        <div className="flex flex-wrap gap-2 mt-2 text-[10px] font-mono text-muted-foreground">
                          <span className="bg-muted px-2 py-0.5 rounded">{test.numQuestions}Q</span>
                          <span className="bg-muted px-2 py-0.5 rounded">⏱ {test.timeInMinutes}m</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button 
                          onClick={() => handleStartServerTest(test)} 
                          className="bg-success text-success-foreground hover:bg-success/90 h-9 px-4"
                        >
                          <Play className="w-4 h-4 mr-1" /> Start
                        </Button>
                        <div className="flex justify-end gap-1">
                          {isOwner && (
                            <>
                              <button onClick={() => handleViewSubmissions(test)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors" title="View Submissions">
                                <BarChart3 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleEditServerTest(test.id)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors" title="Edit">
                                <Edit className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button onClick={() => handleDeleteDownloaded(test.id)} className="p-1.5 text-muted-foreground hover:text-warning transition-colors" title="Remove from Cache">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Server Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] font-black font-mono uppercase tracking-widest text-muted-foreground">Available on Server</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            {serverLoading ? (
              <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-lg">
                <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-xs">Connecting to server...</p>
              </div>
            ) : serverTests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground bg-muted/20 border border-dashed border-border rounded-lg">
                <p className="text-xs italic">No tests found on server.</p>
              </div>
            ) : (
              serverTests.map(test => {
                const isDownloaded = downloadedTests.includes(test.id);
                const isOwner = test.createdBy === user?.uid || user?.uid === 'admin_davendra';
                return (
                  <div key={test.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-mono font-bold text-foreground truncate">{test.title}</div>
                          {isDownloaded && (
                            <span className="bg-success/20 text-success text-[8px] px-1.5 py-0.5 rounded font-bold uppercase">Cached</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{test.description || 'No description provided.'}</p>
                        <div className="flex flex-wrap gap-2 mt-2 text-[10px] font-mono text-muted-foreground">
                          <span className="bg-muted px-2 py-0.5 rounded">{test.numQuestions}Q</span>
                          <span className="bg-muted px-2 py-0.5 rounded">⏱ {test.timeInMinutes}m</span>
                          <span className="bg-muted px-2 py-0.5 rounded">👤 {isOwner ? 'You' : 'Community'}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <div className="flex gap-2">
                          <Button 
                            variant="outline"
                            onClick={() => handleDownload(test)} 
                            className="h-9 px-3"
                            title="Download for offline use"
                            disabled={downloadedTests.includes(test.id)}
                          >
                            <Download className={cn("w-4 h-4", downloadedTests.includes(test.id) && "text-success")} />
                          </Button>
                          <Button 
                            onClick={() => handleStartServerTest(test)} 
                            className="h-9 px-4"
                          >
                            <Play className="w-4 h-4 mr-1" /> Start
                          </Button>
                        </div>
                        <div className="flex justify-end gap-1">
                          {isOwner && (
                            <>
                              <button onClick={() => handleViewSubmissions(test)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors" title="View Submissions">
                                <BarChart3 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleEditServerTest(test.id)} className="p-1.5 text-muted-foreground hover:text-primary transition-colors" title="Edit">
                                <Edit className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteServerTest(test.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors" title="Delete from Server">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Quick Start */}
      {tab === 'quick' && (
        <div className="space-y-5 bg-card border border-border rounded-lg p-6">
          <div className="text-sm font-bold font-mono text-foreground">⚡ Quick Start</div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Number of Questions</label>
            <input type="number" min={1} placeholder="e.g. 90" value={totalQuestions} onChange={(e) => setTotalQuestions(e.target.value)}
              className="w-full h-12 px-4 text-lg font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Starting Question Number</label>
            <input type="number" min={1} placeholder="e.g. 1" value={startFrom} onChange={(e) => setStartFrom(e.target.value)}
              className="w-full h-12 px-4 text-lg font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Time (minutes)</label>
            <input type="number" min={1} placeholder="e.g. 180" value={timeInMinutes} onChange={(e) => setTimeInMinutes(e.target.value)}
              className="w-full h-12 px-4 text-lg font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          {/* Wall clock start */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">🕐 Wall Clock Start Time (optional)</label>
            <input type="time" value={wallClockStart} onChange={(e) => setWallClockStart(e.target.value)}
              className="w-full h-12 px-4 text-lg font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            <p className="text-xs text-muted-foreground mt-1">Set if you want the wall clock to start from a specific time (e.g. 14:00 for NEET)</p>
          </div>

          <SectionBuilder sections={qSections} onChange={setQSections} />
          <DisplayPrefsEditor prefs={qDisplayPrefs} onChange={setQDisplayPrefs} />

          <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
            <strong>Scoring:</strong> +4 for correct, −1 for wrong, 0 for unanswered
          </div>
          <button onClick={handleQuickStart} disabled={!totalQuestions || !timeInMinutes}
            className="w-full h-12 bg-primary text-primary-foreground font-bold text-lg rounded hover:opacity-90 disabled:opacity-40 transition-opacity">
            ▶ Start Test
          </button>
        </div>
      )}

      {/* Plan Test */}
      {tab === 'plan' && (
        <div className="space-y-5 bg-card border border-border rounded-lg p-6">
          <div className="text-sm font-bold font-mono text-foreground">📅 Plan a Test</div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Test Name</label>
            <input type="text" placeholder="e.g. Physics Mock Test 3" value={planName} onChange={(e) => setPlanName(e.target.value)}
              className="w-full h-12 px-4 text-lg font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Questions</label>
              <input type="number" min={1} placeholder="e.g. 90" value={planQuestions} onChange={(e) => setPlanQuestions(e.target.value)}
                className="w-full h-12 px-4 text-lg font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Start From</label>
              <input type="number" min={1} placeholder="1" value={planStart} onChange={(e) => setPlanStart(e.target.value)}
                className="w-full h-12 px-4 text-lg font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Time (minutes)</label>
            <input type="number" min={1} placeholder="e.g. 180" value={planTime} onChange={(e) => setPlanTime(e.target.value)}
              className="w-full h-12 px-4 text-lg font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Scheduled Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn("w-full h-12 px-4 text-left text-lg font-mono border border-border rounded bg-background flex items-center gap-2", planDate ? 'text-foreground' : 'text-muted-foreground')}>
                  📅 {planDate ? format(planDate, 'dd MMM yyyy') : 'Pick a date'}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={planDate} onSelect={setPlanDate} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>

          {/* Wall clock start */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">🕐 Wall Clock Start Time (optional)</label>
            <input type="time" value={planWallClockStart} onChange={(e) => setPlanWallClockStart(e.target.value)}
              className="w-full h-12 px-4 text-lg font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <SectionBuilder sections={planSections} onChange={setPlanSections} />
          <DisplayPrefsEditor prefs={planDisplayPrefs} onChange={setPlanDisplayPrefs} />

          <button onClick={handlePlanTest} disabled={!planName.trim() || !planQuestions || !planTime || !planDate}
            className="w-full h-12 bg-primary text-primary-foreground font-bold text-lg rounded hover:opacity-90 disabled:opacity-40 transition-opacity">
            📅 Schedule Test
          </button>
        </div>
      )}

      {/* Upcoming Tests */}
      {tab === 'upcoming' && (
        <div className="space-y-3">
          {upcomingTests.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-lg">
              <div className="text-4xl mb-3">📅</div>
              <p className="text-sm">No planned tests. Use "Plan Test" to schedule one.</p>
            </div>
          ) : (
            upcomingTests.map(test => {
              const isToday = test.scheduledDate === todayStr;
              const isPast = test.scheduledDate < todayStr;
              return (
                <div key={test.id} className={cn("bg-card border rounded-lg p-4 transition-colors", isToday ? 'border-primary/50 bg-primary/5' : isPast ? 'border-destructive/30 bg-destructive/5' : 'border-border')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono font-bold text-foreground truncate">{test.name}</div>
                      <div className="flex flex-wrap gap-2 mt-1.5 text-xs font-mono text-muted-foreground">
                        <span className={cn("px-2 py-0.5 rounded", isToday ? 'bg-primary/20 text-primary font-bold' : isPast ? 'bg-destructive/20 text-destructive' : 'bg-muted')}>
                          {isToday ? '🔴 Today' : isPast ? '⚠ Overdue' : format(new Date(test.scheduledDate), 'dd MMM')}
                        </span>
                        <span>{test.totalQuestions}Q</span>
                        <span>Q{test.startFrom}–{test.startFrom + test.totalQuestions - 1}</span>
                        <span>⏱ {test.timeInMinutes}m</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handleStartPlanned(test)} className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-bold hover:opacity-90 transition-opacity">▶ Start</button>
                      <button onClick={() => handleDeletePlanned(test.id)} className="p-1.5 text-muted-foreground hover:text-destructive text-sm" title="Delete">🗑</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// Section Builder Component
function SectionBuilder({ sections, onChange }: { sections: SectionInput[]; onChange: (s: SectionInput[]) => void }) {
  const addSection = () => onChange([...sections, { name: '', startQ: '', endQ: '', type: 'mcq' }]);
  const removeSection = (i: number) => onChange(sections.filter((_, idx) => idx !== i));
  const updateSection = (i: number, field: keyof SectionInput, val: string) => {
    const copy = [...sections];
    copy[i] = { ...copy[i], [field]: val } as SectionInput;
    onChange(copy);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">📂 Sections (optional)</label>
        <button onClick={addSection} className="px-2 py-1 text-xs font-bold font-mono bg-muted text-foreground rounded hover:bg-muted/80 transition-colors">+ Add Section</button>
      </div>
      {sections.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No sections — the entire paper is one block. Add sections to divide by subjects.</p>
      )}
      {sections.map((s, i) => (
        <div key={i} className="flex flex-col gap-2 p-3 bg-muted/30 rounded-lg border border-border/50">
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <input type="text" placeholder="e.g. Physics" value={s.name} onChange={(e) => updateSection(i, 'name', e.target.value)}
                className="w-full h-10 px-3 text-sm font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <button onClick={() => removeSection(i)} className="p-2 text-destructive hover:bg-destructive/10 rounded text-sm">✕</button>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex-1 flex items-center gap-1">
              <input type="number" placeholder="From" value={s.startQ} onChange={(e) => updateSection(i, 'startQ', e.target.value)}
                className="w-full h-10 px-2 text-sm font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
              <span className="text-muted-foreground text-sm">–</span>
              <input type="number" placeholder="To" value={s.endQ} onChange={(e) => updateSection(i, 'endQ', e.target.value)}
                className="w-full h-10 px-2 text-sm font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex-1">
              <select 
                value={s.type} 
                onChange={(e) => updateSection(i, 'type', e.target.value)}
                className="w-full h-10 px-2 text-sm font-mono border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="mcq">MCQ</option>
                <option value="numerical">Numerical</option>
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Display Preferences Component
function DisplayPrefsEditor({ prefs, onChange }: { prefs: DisplayPrefs; onChange: (p: DisplayPrefs) => void }) {
  const toggle = (key: keyof DisplayPrefs) => onChange({ ...prefs, [key]: !prefs[key] });
  const items: { key: keyof DisplayPrefs; label: string; icon: string }[] = [
    { key: 'showCountdown', label: 'Time Remaining (countdown)', icon: '⏱' },
    { key: 'showWallClock', label: 'Wall Clock (actual time)', icon: '🕐' },
    { key: 'showQuestionsLeft', label: 'Questions Left count', icon: '○' },
    { key: 'showAnswered', label: 'Answered count', icon: '✓' },
    { key: 'showMarked', label: 'Marked count', icon: '⚑' },
    { key: 'showQuestionRange', label: 'Question range (Q1–90)', icon: '📋' },
  ];

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">🎛 Display Controls</label>
      <p className="text-xs text-muted-foreground italic">Choose what to show in the test header</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map(item => (
          <label key={item.key} className="flex items-center gap-2 text-sm text-foreground cursor-pointer p-2 rounded hover:bg-muted transition-colors">
            <input type="checkbox" checked={prefs[item.key]} onChange={() => toggle(item.key)} className="rounded border-border" />
            <span className="text-base">{item.icon}</span>
            <span className="text-xs">{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default SetupPage;
