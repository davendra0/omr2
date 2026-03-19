import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { getWorkspaceName, setWorkspaceName } from '@/lib/workspaceStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getShortcuts, saveShortcuts, DEFAULT_SHORTCUTS, SHORTCUT_LABELS, type ShortcutMap } from '@/lib/shortcutStore';
import { getSavedTests, type SavedTest } from '@/lib/testHistory';
import type { TestSection } from '@/types/test';

const ALL_STORAGE_KEYS = [
  'workspace_name',
  'workspace_syllabus',
  'workspace_pomodoro',
  'workspace_pomodoro_settings',
  'workspace_pomodoro_sessions',
  'workspace_notes',
  'workspace_todos',
  'workspace_mistakes',
  'workspace_countdowns',
  'workspace_planned_tests',
  'workspace_shortcuts',
  'omr_test_history',
  'omr_test_state',
  'omr_autosave',
];

function exportAllData(): string {
  const data: Record<string, any> = {};
  for (const key of ALL_STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try { data[key] = JSON.parse(raw); } catch { data[key] = raw; }
    }
  }
  return JSON.stringify({ _export: 'workspace_backup', _version: 1, _exportedAt: new Date().toISOString(), data }, null, 2);
}

function importAllData(json: string): { success: boolean; message: string } {
  try {
    const parsed = JSON.parse(json);
    if (!parsed._export || parsed._export !== 'workspace_backup' || !parsed.data) {
      return { success: false, message: 'Invalid backup file format.' };
    }
    let count = 0;
    for (const [key, value] of Object.entries(parsed.data)) {
      if (typeof key === 'string') {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        count++;
      }
    }
    return { success: true, message: `Imported ${count} data entries. Refresh the page to see changes.` };
  } catch {
    return { success: false, message: 'Could not parse the file.' };
  }
}

const SettingsPage = () => {
  const [name, setName] = useState(getWorkspaceName);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [shortcuts, setShortcutsState] = useState<ShortcutMap>(getShortcuts);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Section editor for old tests
  const [savedTests, setSavedTests] = useState<SavedTest[]>(() => getSavedTests());
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [sectionInputs, setSectionInputs] = useState<{ name: string; startQ: string; endQ: string }[]>([]);

  const handleNameSave = () => { setWorkspaceName(name); };

  const handleExport = () => {
    const json = exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importAllData(reader.result as string);
      setImportStatus({ type: result.success ? 'success' : 'error', msg: result.message });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearAll = () => {
    setConfirmOpen(true);
  };

  const confirmClearAll = () => {
    for (const key of ALL_STORAGE_KEYS) localStorage.removeItem(key);
    setImportStatus({ type: 'success', msg: 'All data cleared. Refresh the page.' });
  };

  const updateShortcut = (action: string, value: string) => {
    const updated = { ...shortcuts, [action]: value.toLowerCase() };
    setShortcutsState(updated);
    saveShortcuts(updated);
    setEditingKey(null);
  };

  const resetShortcuts = () => {
    setShortcutsState({ ...DEFAULT_SHORTCUTS });
    saveShortcuts({ ...DEFAULT_SHORTCUTS });
  };

  // Section editor for old tests
  const startEditingSections = (test: SavedTest) => {
    setEditingTestId(test.id);
    const existing = test.result.config.sections || [];
    if (existing.length > 0) {
      setSectionInputs(existing.map(s => ({ name: s.name, startQ: String(s.startQ), endQ: String(s.endQ) })));
    } else {
      setSectionInputs([]);
    }
  };

  const saveSectionsForTest = (testId: string) => {
    const validSections: TestSection[] = sectionInputs
      .filter(s => s.name.trim() && parseInt(s.startQ) && parseInt(s.endQ))
      .map(s => ({ name: s.name.trim(), startQ: parseInt(s.startQ), endQ: parseInt(s.endQ) }));

    const allTests = getSavedTests();
    const updated = allTests.map(t => {
      if (t.id !== testId) return t;
      return { ...t, result: { ...t.result, config: { ...t.result.config, sections: validSections } } };
    });
    localStorage.setItem('omr_test_history', JSON.stringify(updated));
    setSavedTests(updated);
    setEditingTestId(null);
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-16">
      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Clear All Data?"
        description="Are you sure? This will delete ALL your workspace data permanently. This action cannot be undone."
        onConfirm={confirmClearAll}
      />
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-mono">⚙️ Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your workspace preferences and data.</p>
        </div>

        {/* Workspace Name */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workspace Name</CardTitle>
            <CardDescription>Customize the name shown in the sidebar.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Workspace" />
              <Button onClick={handleNameSave}>Save</Button>
            </div>
          </CardContent>
        </Card>

        {/* Keyboard Shortcuts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">⌨️ Keyboard Shortcuts</CardTitle>
            <CardDescription>Customize navigation shortcuts. Click on a shortcut to edit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(SHORTCUT_LABELS).map(([action, label]) => (
              <div key={action} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <span className="text-sm text-foreground">{label}</span>
                {editingKey === action ? (
                  <input
                    autoFocus
                    className="w-32 h-7 px-2 border border-primary rounded bg-background text-foreground text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. ctrl+1"
                    defaultValue={shortcuts[action]}
                    onKeyDown={(e) => {
                      e.preventDefault();
                      const parts: string[] = [];
                      if (e.ctrlKey) parts.push('ctrl');
                      if (e.altKey) parts.push('alt');
                      if (e.shiftKey) parts.push('shift');
                      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) parts.push(e.key.toLowerCase());
                      if (parts.length > 0 && parts[parts.length - 1] !== 'ctrl' && parts[parts.length - 1] !== 'alt' && parts[parts.length - 1] !== 'shift') {
                        updateShortcut(action, parts.join('+'));
                      }
                    }}
                    onBlur={() => setEditingKey(null)}
                  />
                ) : (
                  <button
                    onClick={() => setEditingKey(action)}
                    className="px-2 py-1 bg-muted rounded text-xs font-mono text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
                  >
                    {shortcuts[action] || '—'}
                  </button>
                )}
              </div>
            ))}
            <button onClick={resetShortcuts} className="text-xs text-muted-foreground hover:text-foreground mt-2">
              Reset to defaults
            </button>
          </CardContent>
        </Card>

        {/* Section Editor for Old Tests */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📂 Add Sections to Past Tests</CardTitle>
            <CardDescription>Divide previously taken tests into sections for section-wise analysis.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {savedTests.length === 0 ? (
              <p className="text-xs text-muted-foreground">No saved tests.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {savedTests.map(test => (
                  <div key={test.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-mono font-bold text-foreground">{test.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Q{test.result.config.startFrom}–{test.result.config.startFrom + test.result.config.totalQuestions - 1}
                          {test.result.config.sections?.length ? ` • ${test.result.config.sections.length} sections` : ' • No sections'}
                        </div>
                      </div>
                      <button
                        onClick={() => editingTestId === test.id ? setEditingTestId(null) : startEditingSections(test)}
                        className="px-2 py-1 text-xs border border-border rounded hover:bg-muted text-muted-foreground"
                      >
                        {editingTestId === test.id ? 'Cancel' : test.result.config.sections?.length ? 'Edit' : '+ Add Sections'}
                      </button>
                    </div>

                    {editingTestId === test.id && (
                      <div className="mt-3 space-y-2 pt-3 border-t border-border">
                        {sectionInputs.map((s, i) => (
                          <div key={i} className="flex gap-2 items-center">
                            <input type="text" placeholder="Name" value={s.name} onChange={(e) => {
                              const copy = [...sectionInputs]; copy[i] = { ...copy[i], name: e.target.value }; setSectionInputs(copy);
                            }} className="flex-1 h-8 px-2 text-xs font-mono border border-border rounded bg-background text-foreground" />
                            <input type="number" placeholder="From" value={s.startQ} onChange={(e) => {
                              const copy = [...sectionInputs]; copy[i] = { ...copy[i], startQ: e.target.value }; setSectionInputs(copy);
                            }} className="w-16 h-8 px-2 text-xs font-mono border border-border rounded bg-background text-foreground" />
                            <span className="text-muted-foreground text-xs">–</span>
                            <input type="number" placeholder="To" value={s.endQ} onChange={(e) => {
                              const copy = [...sectionInputs]; copy[i] = { ...copy[i], endQ: e.target.value }; setSectionInputs(copy);
                            }} className="w-16 h-8 px-2 text-xs font-mono border border-border rounded bg-background text-foreground" />
                            <button onClick={() => setSectionInputs(sectionInputs.filter((_, idx) => idx !== i))} className="text-destructive text-xs">✕</button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <button onClick={() => setSectionInputs([...sectionInputs, { name: '', startQ: '', endQ: '' }])}
                            className="px-2 py-1 text-xs bg-muted rounded hover:bg-muted/80 text-foreground">+ Section</button>
                          <button onClick={() => saveSectionsForTest(test.id)}
                            className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded font-bold">Save</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export / Import */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Backup</CardTitle>
            <CardDescription>Export all your data as a JSON file, or import a previous backup.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleExport} variant="outline">📥 Export All Data</Button>
              <Button onClick={() => fileRef.current?.click()} variant="outline">📤 Import Data</Button>
              <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            </div>
            {importStatus && (
              <div className={`text-sm rounded-lg p-3 border ${importStatus.type === 'success' ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                {importStatus.msg}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Includes: syllabus, notes, todos, mistakes, test history, planned tests, countdowns, pomodoro, shortcuts, and settings.
            </p>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
            <CardDescription>Irreversible actions. Export your data first.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleClearAll}>🗑️ Clear All Data</Button>
          </CardContent>
        </Card>

        {/* Version Info */}
        <div className="text-center pt-4">
          <p className="text-[10px] text-muted-foreground font-mono">
            OMR Test Simulator v1.0.1
          </p>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            Build: {new Date().toISOString().slice(0, 10)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
