import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '@/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc, updateDoc, getDocFromServer } from 'firebase/firestore';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Image as ImageIcon, Check, Upload, Grid, List, ChevronLeft, ChevronRight, AlertCircle, Hash, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TestSection, QuestionType, QuestionData } from '@/types/test';
import { PdfQuestionExtractor } from '@/components/PdfQuestionExtractor';
import { FileText } from 'lucide-react';

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

// Using QuestionData from types/test.ts instead of local redefinition
// interface QuestionData {
//   id: number;
//   imageUrl: string;
//   correctAnswer: string;
// }

const compressImage = (base64Str: string, maxWidth = 500, maxHeight = 500, quality = 0.5): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
  });
};

const CreateTestPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { testId } = useParams();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!testId);
  const [viewMode, setViewMode] = useState<'editor' | 'grid' | 'preview'>('editor');
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [numQuestions, setNumQuestions] = useState(50);
  const [timeInMinutes, setTimeInMinutes] = useState(180);
  const [startFrom, setStartFrom] = useState(1);
  const [sections, setSections] = useState<TestSection[]>([]);
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [activeQuestion, setActiveQuestion] = useState(1);
  const [showPdfExtractor, setShowPdfExtractor] = useState(false);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setActiveQuestion(prev => {
      if (prev < startFrom) return startFrom;
      if (prev >= startFrom + numQuestions) return Math.max(startFrom, startFrom + numQuestions - 1);
      return prev;
    });
  }, [startFrom, numQuestions]);

  useEffect(() => {
    const fetchTest = async () => {
      if (!testId) return;
      try {
        const docRef = doc(db, 'tests', testId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Security check: Only creator can edit
          const isAdmin = user?.uid === 'admin_davendra';
          if (user && data.createdBy !== user.uid && !isAdmin) {
            toast.error("You don't have permission to edit this test");
            navigate('/omr');
            return;
          }
          
          setTitle(data.title || '');
          setDescription(data.description || '');
          setNumQuestions(data.numQuestions || 50);
          setTimeInMinutes(data.timeInMinutes || 180);
          setStartFrom(data.startFrom || 1);
          setSections(data.sections || []);
          setQuestions((data.questions || []).map((q: any) => ({
            ...q,
            type: q.type || 'mcq'
          })));
          if (data.startFrom) setActiveQuestion(data.startFrom);
        } else {
          toast.error("Test not found");
          navigate('/omr');
        }
      } catch (error) {
        console.error("Error fetching test:", error);
        toast.error("Failed to load test data");
      } finally {
        setFetching(false);
      }
    };

    if (user) {
      fetchTest();
    }
  }, [testId, user, navigate]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, qId: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const compressed = await compressImage(base64String);
      
      setQuestions(prev => {
        const existing = prev.find(q => q.id === qId);
        if (existing) {
          return prev.map(q => q.id === qId ? { ...q, imageUrl: compressed } : q);
        }
        return [...prev, { id: qId, imageUrl: compressed, correctAnswer: '', type: 'mcq' }];
      });
    };
    reader.readAsDataURL(file);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setLoading(true);
    toast.info(`Processing ${files.length} images...`);

    // Sort files by name to try and match Q1, Q2, etc.
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    const newQuestions = [...questions];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const match = file.name.match(/(\d+)/);
      const qId = match ? parseInt(match[1]) : startFrom + i;
      
      if (qId >= startFrom + numQuestions && !match) break;

      const reader = new FileReader();
      const compressed = await new Promise<string>((resolve) => {
        reader.onloadend = async () => {
          const res = await compressImage(reader.result as string);
          resolve(res);
        };
        reader.readAsDataURL(file);
      });

      const idx = newQuestions.findIndex(q => q.id === qId);
      if (idx >= 0) {
        newQuestions[idx] = { ...newQuestions[idx], imageUrl: compressed };
      } else {
        newQuestions.push({ id: qId, imageUrl: compressed, correctAnswer: '', type: 'mcq' });
      }
    }

    setQuestions(newQuestions);
    setLoading(false);
    toast.success("Bulk upload complete!");
  };

  const setCorrectAnswer = (qId: number, ans: string) => {
    setQuestions(prev => {
      const existing = prev.find(q => q.id === qId);
      if (existing) {
        return prev.map(q => q.id === qId ? { ...q, correctAnswer: ans } : q);
      }
      return [...prev, { id: qId, imageUrl: '', correctAnswer: ans, type: 'mcq' }];
    });
  };

  const setQuestionType = (qId: number, type: QuestionType) => {
    setQuestions(prev => {
      const existing = prev.find(q => q.id === qId);
      if (existing) {
        return prev.map(q => q.id === qId ? { ...q, type } : q);
      }
      return [...prev, { id: qId, imageUrl: '', correctAnswer: '', type }];
    });
  };

  const addSection = () => {
    const lastEnd = sections.length > 0 ? sections[sections.length - 1].endQ : startFrom - 1;
    const nextStart = lastEnd + 1;
    const nextEnd = Math.min(nextStart + 9, startFrom + numQuestions - 1);
    
    if (nextStart > startFrom + numQuestions - 1) {
      toast.error("All questions are already assigned to sections");
      return;
    }

    const newSection: TestSection = {
      id: crypto.randomUUID(),
      name: `Section ${sections.length + 1}`,
      startQ: nextStart,
      endQ: nextEnd,
      type: 'mcq'
    };
    setSections([...sections, newSection]);
  };

  const updateSection = (id: string, updates: Partial<TestSection>) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
  };

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
      toast.error("Permission denied. Make sure you are logged in as admin.");
    } else if (errInfo.error.includes('quota exceeded')) {
      toast.error("Firestore quota exceeded. Please try again tomorrow.");
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
          toast.error("Database is offline. Please check your internet connection.");
        }
      }
    };
    testConnection();
  }, []);

  const handleSave = async () => {
    if (!user) {
      toast.error("You must be logged in to create a test");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setLoading(true);
    try {
      // Calculate total size of questions to warn if it exceeds 1MB
      const questionsJson = JSON.stringify(questions);
      const sizeInBytes = new Blob([questionsJson]).size;
      const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
      
      console.log(`Saving test: ${title}, Size: ${sizeInBytes} bytes (${sizeInMB} MB)`);

      if (sizeInBytes > 1000000) {
        toast.error(`Test data is too large (${sizeInMB} MB). Firestore limit is 1MB. Please reduce image quality or number of questions.`);
        setLoading(false);
        return;
      }

      const testData = {
        title: title.trim(),
        description: description.trim(),
        numQuestions: Number(numQuestions) || 0,
        timeInMinutes: Number(timeInMinutes) || 0,
        startFrom: Number(startFrom) || 1,
        sections: sections,
        questions: [...questions].sort((a, b) => a.id - b.id),
        updatedAt: serverTimestamp(),
        passcode: "Davendra@07", // Include passcode for rule validation
      };

      const path = 'tests';
      if (testId) {
        try {
          await updateDoc(doc(db, path, testId), testData);
          toast.success("Test updated successfully!");
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `${path}/${testId}`);
        }
      } else {
        try {
          await addDoc(collection(db, path), {
            ...testData,
            createdAt: serverTimestamp(),
            createdBy: user.uid,
            authorName: user.displayName || user.email?.split('@')[0] || 'Anonymous'
          });
          toast.success("Test created successfully!");
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, path);
        }
      }
      navigate('/omr');
    } catch (error) {
      console.error("Error saving test:", error);
      // Error already handled by handleFirestoreError if it was a firestore error
    } finally {
      setLoading(false);
    }
  };

  const handlePdfCapture = async (imageData: string) => {
    const compressed = await compressImage(imageData);
    
    setQuestions(prev => {
      const existing = prev.find(q => q.id === activeQuestion);
      if (existing) {
        return prev.map(q => q.id === activeQuestion ? { ...q, imageUrl: compressed } : q);
      }
      return [...prev, { id: activeQuestion, imageUrl: compressed, correctAnswer: '', type: 'mcq' }];
    });

    // Move to next question automatically
    if (activeQuestion < startFrom + numQuestions - 1) {
      setActiveQuestion(prev => prev + 1);
    } else {
      toast.success("All questions captured!");
      setShowPdfExtractor(false);
    }
  };

  const currentQData = questions.find(q => q.id === activeQuestion);

  const renderPreview = () => {
    return (
      <div className="space-y-8">
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-bold font-mono">{title || 'Untitled Test'}</h2>
            <p className="text-sm text-muted-foreground">{description || 'No description provided.'}</p>
          </div>
          <div className="flex gap-4 text-xs font-mono text-muted-foreground">
            <span className="bg-muted px-2 py-1 rounded">{numQuestions} Questions</span>
            <span className="bg-muted px-2 py-1 rounded">Start From: {startFrom}</span>
            <span className="bg-muted px-2 py-1 rounded">{timeInMinutes} Minutes</span>
          </div>
        </div>

        {sections.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map(s => (
              <div key={s.id} className="bg-muted/30 border border-border rounded-lg p-3 space-y-1">
                <div className="text-xs font-bold font-mono uppercase text-primary">{s.name}</div>
                <div className="text-[10px] text-muted-foreground">Q{s.startQ} to Q{s.endQ} · {s.type.toUpperCase()}</div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-6">
          {Array.from({ length: numQuestions }).map((_, i) => {
            const qId = startFrom + i;
            const qData = questions.find(q => q.id === qId);
            const section = sections.find(s => qId >= s.startQ && qId <= s.endQ);
            const qType = qData?.type || section?.type || 'mcq';

            return (
              <Card key={qId} className="overflow-hidden border-2 border-primary/5">
                <CardHeader className="bg-muted/30 py-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-mono font-bold">Question {qId}</CardTitle>
                    {section && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">{section.name}</span>}
                  </div>
                  {qData?.correctAnswer && (
                    <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded-full font-bold uppercase">Answer: {qData.correctAnswer}</span>
                  )}
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  {qData?.imageUrl ? (
                    <img src={qData.imageUrl} alt={`Q${qId}`} className="max-h-[500px] object-contain rounded-lg mx-auto" />
                  ) : (
                    <div className="h-40 bg-muted/20 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground text-sm italic">
                      No image provided for this question
                    </div>
                  )}
                  
                  {qType === 'mcq' ? (
                    <div className="grid grid-cols-4 gap-4 max-w-md mx-auto">
                      {['A', 'B', 'C', 'D'].map(ans => (
                        <div 
                          key={ans} 
                          className={cn(
                            "h-12 rounded-lg border flex items-center justify-center font-black font-mono",
                            qData?.correctAnswer === ans ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground opacity-50"
                          )}
                        >
                          {ans}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="max-w-md mx-auto">
                      <div className="h-12 rounded-lg border border-primary bg-primary/5 flex items-center justify-center font-black font-mono text-primary">
                        {qData?.correctAnswer || 'Numerical Answer'}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground font-mono text-sm">Loading test data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight flex items-center gap-2">
            <span className="text-primary">🛠</span> {testId ? 'Edit' : 'Create'} Server Test
          </h1>
          <p className="text-muted-foreground text-sm">{testId ? 'Modify your existing test' : 'Design a test that everyone can take'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/omr')}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading} className="font-bold">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            {testId ? 'Update Test' : 'Save Test'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Settings */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Test Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. NEET Mock 2026" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief details..." className="min-h-[80px] text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Questions</Label>
                  <Input type="number" value={numQuestions} onChange={e => setNumQuestions(parseInt(e.target.value) || 0)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Start From</Label>
                  <Input type="number" value={startFrom} onChange={e => setStartFrom(parseInt(e.target.value) || 1)} className="h-9" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Time (min)</Label>
                  <Input type="number" value={timeInMinutes} onChange={e => setTimeInMinutes(parseInt(e.target.value) || 0)} className="h-9" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Sections</CardTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addSection}>
                <Plus className="w-3 h-3" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {sections.map(s => (
                <div key={s.id} className="p-3 border border-border rounded-lg space-y-3 relative group">
                  <button 
                    onClick={() => removeSection(s.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <Input 
                    value={s.name} 
                    onChange={e => updateSection(s.id, { name: e.target.value })} 
                    placeholder="Section Name"
                    className="h-7 text-xs font-bold"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Start Q</Label>
                      <Input 
                        type="number" 
                        value={s.startQ} 
                        onChange={e => updateSection(s.id, { startQ: parseInt(e.target.value) || 0 })}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">End Q</Label>
                      <Input 
                        type="number" 
                        value={s.endQ} 
                        onChange={e => updateSection(s.id, { endQ: parseInt(e.target.value) || 0 })}
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      variant={s.type === 'mcq' ? 'default' : 'outline'} 
                      size="sm" 
                      className="h-6 text-[10px] flex-1"
                      onClick={() => updateSection(s.id, { type: 'mcq' })}
                    >
                      MCQ
                    </Button>
                    <Button 
                      variant={s.type === 'numerical' ? 'default' : 'outline'} 
                      size="sm" 
                      className="h-6 text-[10px] flex-1"
                      onClick={() => updateSection(s.id, { type: 'numerical' })}
                    >
                      Numerical
                    </Button>
                  </div>
                </div>
              ))}
              {sections.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic text-center py-2">No sections added yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Bulk Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                ref={bulkInputRef}
                onChange={handleBulkUpload}
              />
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 h-9 text-xs"
                onClick={() => bulkInputRef.current?.click()}
                disabled={loading}
              >
                <Upload className="w-3.5 h-3.5" />
                Bulk Upload Images
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 h-9 text-xs bg-primary/5 border-primary/20 hover:bg-primary/10"
                onClick={() => {
                  // Find first question without an image
                  const firstEmpty = Array.from({ length: numQuestions }).map((_, i) => startFrom + i).find(qId => !questions.find(q => q.id === qId)?.imageUrl);
                  if (firstEmpty) {
                    setActiveQuestion(firstEmpty);
                  }
                  setShowPdfExtractor(true);
                }}
                disabled={loading}
              >
                <FileText className="w-3.5 h-3.5 text-primary" />
                Extract from PDF
              </Button>
              <p className="text-[10px] text-muted-foreground italic">
                Tip: Sort images as Q1.jpg, Q2.jpg... for auto-assignment.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right: Question Editor */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between bg-muted/50 p-1 rounded-lg border border-border">
            <div className="flex gap-1">
              <Button 
                variant={viewMode === 'editor' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="text-xs gap-2"
                onClick={() => setViewMode('editor')}
              >
                <List className="w-3.5 h-3.5" /> Editor
              </Button>
              <Button 
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="text-xs gap-2"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-3.5 h-3.5" /> Grid View
              </Button>
              <Button 
                variant={viewMode === 'preview' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="text-xs gap-2"
                onClick={() => setViewMode('preview')}
              >
                <ImageIcon className="w-3.5 h-3.5" /> Preview
              </Button>
            </div>
          {viewMode !== 'preview' && viewMode === 'editor' && (
              <div className="flex items-center gap-2 px-2">
                <span className="text-xs font-mono font-bold">Q{activeQuestion} / {startFrom + numQuestions - 1}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveQuestion(Math.max(startFrom, activeQuestion - 1))} disabled={activeQuestion === startFrom}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveQuestion(Math.min(startFrom + numQuestions - 1, activeQuestion + 1))} disabled={activeQuestion === startFrom + numQuestions - 1}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {viewMode === 'editor' ? (
            <Card className="border-2 border-primary/10">
              <CardContent className="p-6 space-y-8">
                {/* Image Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-primary" />
                      Question Image
                    </Label>
                    {currentQData?.imageUrl && (
                      <Button variant="ghost" size="sm" className="h-7 text-destructive hover:text-destructive text-[10px]" onClick={() => setQuestions(prev => prev.map(q => q.id === activeQuestion ? { ...q, imageUrl: '' } : q))}>
                        <Trash2 className="w-3 h-3 mr-1" /> Remove
                      </Button>
                    )}
                  </div>
                  
                  <div className="group border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center min-h-[300px] bg-muted/20 relative transition-all hover:bg-muted/30 hover:border-primary/30">
                    {currentQData?.imageUrl ? (
                      <img src={currentQData.imageUrl} alt={`Q${activeQuestion}`} className="max-h-[400px] object-contain rounded-lg shadow-sm" />
                    ) : (
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                          <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">No image for this question</p>
                          <p className="text-xs text-muted-foreground mt-1">Upload a screenshot or photo of the question</p>
                        </div>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          id={`img-upload-${activeQuestion}`} 
                          onChange={(e) => handleImageUpload(e, activeQuestion)} 
                        />
                        <Label htmlFor={`img-upload-${activeQuestion}`} className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:opacity-90 transition-opacity">
                          <Plus className="w-4 h-4" />
                          Select Image
                        </Label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Answer Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold flex items-center gap-2">
                      <Check className="w-4 h-4 text-success" />
                      Correct Answer
                    </Label>
                    <div className="flex gap-1 bg-muted p-0.5 rounded-md">
                      <Button 
                        variant={currentQData?.type === 'mcq' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        className="h-6 text-[10px] gap-1"
                        onClick={() => setQuestionType(activeQuestion, 'mcq')}
                      >
                        <Type className="w-3 h-3" /> MCQ
                      </Button>
                      <Button 
                        variant={currentQData?.type === 'numerical' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        className="h-6 text-[10px] gap-1"
                        onClick={() => setQuestionType(activeQuestion, 'numerical')}
                      >
                        <Hash className="w-3 h-3" /> Numerical
                      </Button>
                    </div>
                  </div>

                  {currentQData?.type === 'numerical' ? (
                    <div className="max-w-md mx-auto">
                      <Input 
                        type="text" 
                        placeholder="Enter numerical answer..." 
                        value={currentQData?.correctAnswer || ''} 
                        onChange={e => setCorrectAnswer(activeQuestion, e.target.value)}
                        className="h-16 text-center text-2xl font-black font-mono border-2 border-primary/50 focus:ring-primary"
                      />
                      <p className="text-[10px] text-muted-foreground text-center mt-2">Enter the exact numerical value (e.g. 42, 3.14)</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-3">
                      {['A', 'B', 'C', 'D'].map(ans => (
                        <Button
                          key={ans}
                          variant={currentQData?.correctAnswer === ans ? 'default' : 'outline'}
                          className={cn(
                            "h-16 text-xl font-black font-mono transition-all",
                            currentQData?.correctAnswer === ans ? "scale-105 shadow-md" : "hover:border-primary/50"
                          )}
                          onClick={() => setCorrectAnswer(activeQuestion, ans)}
                        >
                          {ans}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: numQuestions }).map((_, i) => {
                const qId = startFrom + i;
                const qData = questions.find(q => q.id === qId);
                return (
                  <Card 
                    key={qId} 
                    className={cn(
                      "cursor-pointer hover:border-primary/50 transition-all group overflow-hidden",
                      activeQuestion === qId && "border-primary ring-2 ring-primary/20"
                    )}
                    onClick={() => { setActiveQuestion(qId); setViewMode('editor'); }}
                  >
                    <div className="aspect-video bg-muted/30 flex items-center justify-center border-b border-border relative">
                      {qData?.imageUrl ? (
                        <img src={qData.imageUrl} alt={`Q${qId}`} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-muted-foreground/20" />
                      )}
                      <div className="absolute top-1 left-1 bg-background/80 backdrop-blur px-1.5 py-0.5 rounded text-[10px] font-bold font-mono">
                        Q{qId}
                      </div>
                      {qData?.type === 'numerical' && (
                        <div className="absolute top-1 right-1 bg-primary text-primary-foreground px-1 rounded text-[8px] font-bold">NUM</div>
                      )}
                    </div>
                    <CardContent className="p-2 flex items-center justify-between">
                      <div className="flex gap-1">
                        {qData?.imageUrl && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        {qData?.correctAnswer && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                      </div>
                      <span className="text-xs font-bold font-mono truncate max-w-[60px]">{qData?.correctAnswer || '-'}</span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            renderPreview()
          )}
        </div>
      </div>

      {/* Question Grid Panel (Sticky Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur border-t border-border p-2 z-40 lg:hidden">
        <div className="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {Array.from({ length: numQuestions }).map((_, i) => {
            const qId = startFrom + i;
            const qData = questions.find(q => q.id === qId);
            return (
              <button
                key={qId}
                onClick={() => setActiveQuestion(qId)}
                className={cn(
                  "min-w-[40px] h-10 rounded border flex flex-col items-center justify-center transition-all shrink-0",
                  activeQuestion === qId ? "border-primary bg-primary/10" : "border-border bg-card",
                  qData?.imageUrl && qData?.correctAnswer ? "border-success/50" : ""
                )}
              >
                <span className="text-[10px] font-bold">{qId}</span>
                <div className="flex gap-0.5 mt-0.5">
                  {qData?.imageUrl && <div className="w-1 h-1 rounded-full bg-blue-500" />}
                  {qData?.correctAnswer && <div className="w-1 h-1 rounded-full bg-green-500" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {showPdfExtractor && (
        <PdfQuestionExtractor 
          currentQuestion={activeQuestion}
          startFrom={startFrom}
          numQuestions={numQuestions}
          questions={questions}
          onQuestionSelect={setActiveQuestion}
          onCapture={handlePdfCapture}
          onClose={() => setShowPdfExtractor(false)}
        />
      )}
    </div>
  );
};

export default CreateTestPage;
