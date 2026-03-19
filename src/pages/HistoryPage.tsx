import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTestStore } from '@/store/testStore';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { getSavedTests, deleteTest, renameTest, type SavedTest } from '@/lib/testHistory';
import { addPlannedTest } from '@/lib/plannedTestStore';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const HistoryPage = () => {
  const navigate = useNavigate();
  const { setResult, setAnswerKey } = useTestStore();
  const [tests, setTests] = useState<SavedTest[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [dupDate, setDupDate] = useState<Date | undefined>(undefined);
  const [confirmConfig, setConfirmConfig] = useState<{ open: boolean; id: string }>({ open: false, id: '' });

  useEffect(() => {
    setTests(getSavedTests());
  }, []);

  const filtered = searchQuery.trim()
    ? tests.filter(t => {
        const q = searchQuery.toLowerCase();
        return t.name.toLowerCase().includes(q) ||
          formatDate(t.savedAt).toLowerCase().includes(q) ||
          `${t.result.responses.length}`.includes(q);
      })
    : tests;

  const handleLoad = (test: SavedTest) => {
    setResult(test.result);
    if (test.answerKey) setAnswerKey(test.answerKey);
    navigate('/results');
  };

  const handleDelete = (id: string) => {
    setConfirmConfig({ open: true, id });
  };

  const confirmDelete = () => {
    if (confirmConfig.id) {
      deleteTest(confirmConfig.id);
      setTests(getSavedTests());
    }
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      renameTest(id, editName.trim());
      setTests(getSavedTests());
      setEditingId(null);
    }
  };

  const handleDuplicate = (test: SavedTest) => {
    if (!dupDate) return;
    addPlannedTest({
      name: test.name + ' (Retest)',
      totalQuestions: test.result.config.totalQuestions,
      startFrom: test.result.config.startFrom,
      timeInMinutes: test.result.config.timeInMinutes,
      scheduledDate: format(dupDate, 'yyyy-MM-dd'),
    });
    setDuplicatingId(null);
    setDupDate(undefined);
    navigate('/omr');
  };

  function formatDate(ts: number) {
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  const formatTime = (ms: number) => {
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <ConfirmationDialog
        open={confirmConfig.open}
        onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, open }))}
        title="Delete Test?"
        description="Are you sure you want to delete this test history? This action cannot be undone."
        onConfirm={confirmDelete}
      />
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold font-mono text-foreground">📊 Past Tests</h1>
          <p className="text-xs text-muted-foreground mt-1">{tests.length} test{tests.length !== 1 ? 's' : ''} saved</p>
        </div>
        <button
          onClick={() => navigate('/omr')}
          className="text-sm text-muted-foreground hover:text-foreground font-mono"
        >
          ← Back
        </button>
      </div>

      {/* Search */}
      {tests.length > 0 && (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">🔍</span>
          <input
            type="text"
            placeholder="Search tests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-4 text-sm font-mono border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-lg">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-sm">
            {searchQuery ? 'No tests match your search.' : 'No saved tests yet. Complete a test and save it to see it here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((test) => {
            const r = test.result;
            const answered = r.responses.filter(q => q.selected !== null).length;
            const total = r.responses.length;
            let score: number | null = null;
            if (test.answerKey) {
              score = 0;
              r.responses.forEach(q => {
                if (q.selected) {
                  if (test.answerKey![q.questionNo] === q.selected) score! += 4;
                  else if (test.answerKey![q.questionNo]) score! -= 1;
                }
              });
            }

            return (
              <div
                key={test.id}
                className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => handleLoad(test)}>
                    {editingId === test.id ? (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRename(test.id); if (e.key === 'Escape') setEditingId(null); }}
                          autoFocus
                          className="flex-1 px-2 py-1 border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <button onClick={() => handleRename(test.id)} className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-bold">✓</button>
                        <button onClick={() => setEditingId(null)} className="px-2 py-1 border border-border rounded text-xs">✗</button>
                      </div>
                    ) : (
                      <div className="font-mono font-bold text-foreground truncate">{test.name}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">{formatDate(test.savedAt)}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(test.id); setEditName(test.name); }}
                      className="text-muted-foreground hover:text-primary text-sm p-1"
                      title="Rename"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDuplicatingId(duplicatingId === test.id ? null : test.id); setDupDate(undefined); }}
                      className="text-muted-foreground hover:text-primary text-sm p-1"
                      title="Duplicate & Replan"
                    >
                      📋
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(test.id); }}
                      className="text-muted-foreground hover:text-destructive text-sm p-1"
                      title="Delete"
                    >
                      🗑
                    </button>
                  </div>
                </div>

                {/* Duplicate panel */}
                {duplicatingId === test.id && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2" onClick={(e) => e.stopPropagation()}>
                    <div className="text-xs font-bold font-mono text-foreground">📋 Replan this test</div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={cn(
                          "w-full h-9 px-3 text-left text-sm font-mono border border-border rounded bg-background flex items-center gap-2",
                          dupDate ? 'text-foreground' : 'text-muted-foreground'
                        )}>
                          📅 {dupDate ? format(dupDate, 'dd MMM yyyy') : 'Pick new date'}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dupDate}
                          onSelect={setDupDate}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDuplicate(test)}
                        disabled={!dupDate}
                        className="flex-1 h-8 bg-primary text-primary-foreground rounded text-xs font-bold hover:opacity-90 disabled:opacity-40 transition-opacity"
                      >
                        Schedule Retest
                      </button>
                      <button
                        onClick={() => { setDuplicatingId(null); setDupDate(undefined); }}
                        className="h-8 px-3 border border-border rounded text-xs hover:bg-muted transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-4 mt-2 text-xs font-mono text-muted-foreground cursor-pointer" onClick={() => handleLoad(test)}>
                  <span>{total} Q</span>
                  <span>✓ {answered}/{total}</span>
                  <span>⏱ {formatTime(r.endTime - r.startTime)}</span>
                  {score !== null && (
                    <span className="text-primary font-bold">{score}/{total * 4}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
