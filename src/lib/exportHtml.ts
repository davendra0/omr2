import type { TestResult, AnswerKey, Option } from '@/types/test';
import type { QuestionAnnotation } from '@/lib/mistakeStore';
import { MISTAKE_TYPES } from '@/lib/mistakeStore';

interface ExportData {
  testName: string;
  result: TestResult;
  answerKey: AnswerKey | null;
  includeAnnotations?: boolean;
  annotations?: QuestionAnnotation[];
}

export function exportTestAsHtml({ testName, result, answerKey, includeAnnotations, annotations = [] }: ExportData) {
  const { responses, startTime, endTime, config } = result;
  const totalTimeSec = Math.round((endTime - startTime) / 1000);
  const answered = responses.filter(r => r.selected !== null).length;
  const unanswered = responses.length - answered;
  const reviewed = responses.filter(r => r.markedForReview).length;

  // Scoring
  let correct = 0, incorrect = 0, score = 0, skipped = 0;
  const analysisRows: string[] = [];
  const questionData: { qNo: number; selected: Option; correctAns: Option; marks: number; isCorrect: boolean; isWrong: boolean; isSkipped: boolean; timeGap: number | null }[] = [];

  // Time gaps
  const answeredSorted = responses.filter(r => r.answeredAt !== null).sort((a, b) => a.answeredAt! - b.answeredAt!);
  const timeGaps: Record<number, number> = {};
  let prev = startTime;
  answeredSorted.forEach(r => {
    timeGaps[r.questionNo] = Math.round((r.answeredAt! - prev) / 1000);
    prev = r.answeredAt!;
  });

  responses.forEach(r => {
    const correctAns = answerKey ? (answerKey[r.questionNo] ?? null) : null;
    const isCorrect = r.selected !== null && r.selected === correctAns;
    const isWrong = r.selected !== null && correctAns !== null && r.selected !== correctAns;
    const isSkip = r.selected === null;
    const marks = isCorrect ? 4 : isWrong ? -1 : 0;
    if (isCorrect) { correct++; score += 4; }
    else if (isWrong) { incorrect++; score -= 1; }
    else { skipped++; }
    questionData.push({ qNo: r.questionNo, selected: r.selected, correctAns, marks, isCorrect, isWrong, isSkipped: isSkip, timeGap: timeGaps[r.questionNo] ?? null });
  });

  const maxScore = responses.length * 4;
  const accuracy = (correct + incorrect) > 0 ? Math.round((correct / (correct + incorrect)) * 100) : 0;
  const attemptRate = responses.length > 0 ? Math.round(((responses.length - skipped) / responses.length) * 100) : 0;

  const answeredTimes = questionData.filter(q => q.timeGap !== null).map(q => q.timeGap!);
  const avgTime = answeredTimes.length > 0 ? Math.round(answeredTimes.reduce((a, b) => a + b, 0) / answeredTimes.length) : 0;
  const fastestQ = answeredTimes.length > 0 ? Math.min(...answeredTimes) : 0;
  const slowestQ = answeredTimes.length > 0 ? Math.max(...answeredTimes) : 0;
  const correctTimes = questionData.filter(q => q.isCorrect && q.timeGap !== null).map(q => q.timeGap!);
  const wrongTimes = questionData.filter(q => q.isWrong && q.timeGap !== null).map(q => q.timeGap!);
  const avgCorrectTime = correctTimes.length > 0 ? Math.round(correctTimes.reduce((a, b) => a + b, 0) / correctTimes.length) : 0;
  const avgWrongTime = wrongTimes.length > 0 ? Math.round(wrongTimes.reduce((a, b) => a + b, 0) / wrongTimes.length) : 0;

  // Streaks
  let bestStreak = 0, worstStreak = 0, curGood = 0, curBad = 0;
  questionData.forEach(q => {
    if (q.isCorrect) { curGood++; bestStreak = Math.max(bestStreak, curGood); curBad = 0; }
    else if (q.isWrong) { curBad++; worstStreak = Math.max(worstStreak, curBad); curGood = 0; }
    else { curGood = 0; curBad = 0; }
  });

  // Cumulative score for chart
  const cumulativeScores: number[] = [];
  let running = 0;
  questionData.forEach(q => { running += q.marks; cumulativeScores.push(running); });

  // Cumulative accuracy
  const cumulativeAcc: number[] = [];
  let cC = 0, tC = 0;
  questionData.forEach(q => { tC++; if (q.isCorrect) cC++; cumulativeAcc.push(Math.round((cC / tC) * 100)); });

  // Time per question chart data
  const timeBarData = questionData.filter(q => q.timeGap !== null);

  // Section-wise (quarters)
  const segSize = Math.ceil(questionData.length / 4);
  const sections = Array.from({ length: 4 }, (_, i) => {
    const slice = questionData.slice(i * segSize, (i + 1) * segSize);
    if (slice.length === 0) return null;
    const sc = slice.filter(a => a.isCorrect).length;
    const sw = slice.filter(a => a.isWrong).length;
    const ss = slice.filter(a => a.isSkipped).length;
    const sScore = slice.reduce((s, a) => s + a.marks, 0);
    return { name: `Q${slice[0].qNo}–${slice[slice.length - 1].qNo}`, correct: sc, wrong: sw, skipped: ss, score: sScore, max: slice.length * 4 };
  }).filter(Boolean);

  // Option distribution
  const optDist = { A: 0, B: 0, C: 0, D: 0 };
  const keyDist = { A: 0, B: 0, C: 0, D: 0 };
  questionData.forEach(q => {
    if (q.selected && q.selected in optDist) optDist[q.selected as keyof typeof optDist]++;
    if (q.correctAns && q.correctAns in keyDist) keyDist[q.correctAns as keyof typeof keyDist]++;
  });

  // Worst time wasters
  const timeWasters = questionData.filter(q => q.isWrong && q.timeGap !== null).sort((a, b) => b.timeGap! - a.timeGap!).slice(0, 5);

  const fmt = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  const fmtTotal = (s: number) => { const m = Math.floor(s / 60); const sec = s % 60; return `${m}m ${sec}s`; };

  const getBubbleClass = (selected: Option, opt: string, correctAns: Option) => {
    if (!answerKey) return selected === opt ? 'bubble-filled' : '';
    if (opt === correctAns && opt === selected) return 'bubble-correct';
    if (opt === selected && opt !== correctAns) return 'bubble-wrong';
    if (opt === correctAns) return 'bubble-correct-key';
    return 'bubble-dim';
  };

  // Build OMR rows HTML
  const omrRowsHtml = responses.map((r, idx) => {
    const qd = questionData.find(q => q.qNo === r.questionNo)!;
    const bubbles = ['A', 'B', 'C', 'D'].map(opt => {
      const cls = getBubbleClass(r.selected, opt, qd.correctAns);
      return `<div class="bubble ${cls}">${opt}</div>`;
    }).join('');
    const marksHtml = answerKey ? (r.selected ? (qd.isCorrect ? '<span class="mark-pos">+4</span>' : '<span class="mark-neg">−1</span>') : '<span class="mark-zero">0</span>') : '';
    return `<div class="omr-row ${idx % 2 !== 0 ? 'omr-row-alt' : ''}">
      <span class="q-no">Q.${r.questionNo}</span>
      <div class="bubbles">${bubbles}</div>
      ${marksHtml}
    </div>`;
  }).join('\n');

  // Question table HTML
  const tableRowsHtml = questionData.map((q, idx) => {
    const statusCls = q.isSkipped ? 'status-skip' : q.isCorrect ? 'status-correct' : 'status-wrong';
    const statusTxt = q.isSkipped ? 'SKIP' : q.isCorrect ? '✓' : '✗';
    const marksCls = q.marks > 0 ? 'mark-pos' : q.marks < 0 ? 'mark-neg' : 'mark-zero';
    const marksTxt = q.marks > 0 ? `+${q.marks}` : `${q.marks}`;
    return `<tr class="${idx % 2 !== 0 ? 'row-alt' : ''} ${q.isCorrect ? 'row-correct' : q.isWrong ? 'row-wrong' : ''}">
      <td class="td-qno">${q.qNo}</td>
      <td class="td-opt">${q.selected ?? '—'}</td>
      <td class="td-key">${q.correctAns ?? '—'}</td>
      <td class="${statusCls}">${statusTxt}</td>
      <td class="${marksCls} td-right">${marksTxt}</td>
      <td class="td-time">${q.timeGap != null ? fmt(q.timeGap) : '—'}</td>
    </tr>`;
  }).join('\n');

  // Section bars HTML
  const sectionHtml = sections.map((s: any) => {
    const total = s.correct + s.wrong + s.skipped;
    const cPct = total > 0 ? (s.correct / total) * 100 : 0;
    const wPct = total > 0 ? (s.wrong / total) * 100 : 0;
    const pct = s.max > 0 ? Math.round((s.score / s.max) * 100) : 0;
    return `<div class="section-item">
      <div class="section-header"><span>${s.name}</span><span class="section-score">${s.score}/${s.max} (${pct}%)</span></div>
      <div class="section-bar"><div class="bar-correct" style="width:${cPct}%"></div><div class="bar-wrong" style="width:${wPct}%"></div></div>
      <div class="section-legend">✓ ${s.correct} &nbsp; ✗ ${s.wrong} &nbsp; — ${s.skipped}</div>
    </div>`;
  }).join('\n');

  // Time wasters HTML
  const wastersHtml = timeWasters.map(q => 
    `<div class="waster-row"><span class="waster-q">Q.${q.qNo}</span><span>You: <b class="mark-neg">${q.selected}</b> → Key: <b class="mark-pos">${q.correctAns}</b></span><span class="mark-neg waster-time">${fmt(q.timeGap!)}</span></div>`
  ).join('\n');

  // Option dist HTML
  const optDistHtml = ['A', 'B', 'C', 'D'].map(o => 
    `<div class="opt-card"><div class="opt-letter">${o}</div><div class="opt-yours">${optDist[o as keyof typeof optDist]}</div><div class="opt-label">Yours</div><hr class="opt-hr"/><div class="opt-key">${keyDist[o as keyof typeof keyDist]}</div><div class="opt-label">Key</div></div>`
  ).join('');

  // Detailed Analysis HTML
  const detailedAnalysisHtml = responses.map(r => {
    const qd = questionData.find(q => q.qNo === r.questionNo)!;
    const ann = annotations.find(a => a.questionNo === r.questionNo);
    const mType = ann ? MISTAKE_TYPES[ann.mistakeType] : null;

    return `
    <div class="detailed-card ${qd.isCorrect ? 'border-success' : qd.isWrong ? 'border-danger' : 'border-muted'}">
      <div class="detailed-header">
        <span class="detailed-qno">Question ${r.questionNo}</span>
        <div class="detailed-status">
          ${qd.isCorrect ? '<span class="badge badge-success">✓ Correct</span>' : 
            qd.isWrong ? '<span class="badge badge-danger">✗ Wrong</span>' : 
            '<span class="badge badge-muted">Skipped</span>'}
          <span class="badge badge-info">${qd.timeGap ? fmt(qd.timeGap) : '—'}</span>
        </div>
      </div>

      <div class="detailed-body">
        <div class="detailed-answers">
          <div class="ans-box">
            <span class="ans-label">Your Answer</span>
            <span class="ans-val ${qd.isCorrect ? 'color-success' : qd.isWrong ? 'color-danger' : ''}">${qd.selected || '—'}</span>
          </div>
          <div class="ans-box border-success-light">
            <span class="ans-label color-success">Correct Answer</span>
            <span class="ans-val color-success">${qd.correctAns || '—'}</span>
          </div>
        </div>

        ${ann?.imageData ? `
        <div class="detailed-image">
          <img src="${ann.imageData}" alt="Question ${r.questionNo}" />
        </div>` : ''}

        ${ann ? `
        <div class="detailed-annotation">
          <div class="ann-type">
            <span class="ann-icon">${mType?.icon || '📝'}</span>
            <span class="ann-label">${mType?.label || 'Annotation'}</span>
          </div>
          ${ann.notes ? `<div class="ann-notes">${ann.notes}</div>` : ''}
          ${ann.tags && ann.tags.length > 0 ? `
          <div class="ann-tags">
            ${ann.tags.map(t => `<span class="tag">#${t}</span>`).join('')}
          </div>` : ''}
        </div>` : ''}
      </div>
    </div>`;
  }).join('\n');

  const exportDate = new Date().toLocaleString();
  const testDate = new Date(startTime).toLocaleString();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${testName} - Test Report</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f6f8;color:#1a1c2e;line-height:1.5}
.container{max-width:900px;margin:0 auto;padding:16px}
h1{font-size:1.5rem;font-weight:700;font-family:'Courier New',monospace}
h2{font-size:1.1rem;font-weight:700;font-family:'Courier New',monospace;color:#666;margin-bottom:12px}
.header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #e0e2e8}
.meta{font-size:12px;color:#888;font-family:'Courier New',monospace}
.tabs{display:flex;gap:4px;margin-bottom:20px;flex-wrap:wrap}
.tab{padding:8px 16px;border:2px solid #e0e2e8;border-radius:6px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;font-family:'Courier New',monospace;transition:all .15s}
.tab:hover{border-color:#2a9d8f;color:#2a9d8f}
.tab.active{background:#2a9d8f;color:#fff;border-color:#2a9d8f}
.panel{display:none}.panel.active{display:block}
.card{background:#fff;border:1px solid #e0e2e8;border-radius:8px;padding:16px;margin-bottom:16px}
.card-accent{border:2px solid rgba(42,157,143,.3)}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.stat{text-align:center;padding:12px;background:#fff;border:1px solid #e0e2e8;border-radius:8px}
.stat-val{font-size:1.5rem;font-weight:700;font-family:'Courier New',monospace}
.stat-label{font-size:10px;color:#888;margin-top:4px}
.stat-big{font-size:2rem}
.color-primary{color:#2a9d8f}
.color-success{color:#22c55e}
.color-danger{color:#ef4444}
.color-muted{color:#999}
.color-warn{color:#f59e0b}
/* OMR */
.omr-row{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid #f0f1f4}
.omr-row-alt{background:#fafbfc}
.q-no{font-family:'Courier New',monospace;font-size:14px;font-weight:700;color:#888;width:56px;text-align:right;flex-shrink:0}
.bubbles{display:flex;gap:8px}
.bubble{width:36px;height:36px;border-radius:50%;border:2px solid #d0d2d8;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;font-family:'Courier New',monospace;color:#999;cursor:default;transition:all .15s}
.bubble-filled{background:#2a9d8f;color:#fff;border-color:#2a9d8f}
.bubble-correct{background:#22c55e;color:#fff;border-color:#22c55e}
.bubble-wrong{background:#ef4444;color:#fff;border-color:#ef4444}
.bubble-correct-key{background:rgba(34,197,94,.15);color:#22c55e;border-color:#22c55e}
.bubble-dim{border-color:#e8e9ec;color:#ccc}
.mark-pos{color:#22c55e;font-family:'Courier New',monospace;font-size:12px;font-weight:700}
.mark-neg{color:#ef4444;font-family:'Courier New',monospace;font-size:12px;font-weight:700}
.mark-zero{color:#999;font-family:'Courier New',monospace;font-size:12px}
/* Table */
table{width:100%;border-collapse:collapse;font-size:13px}
th{padding:8px;text-align:left;font-family:'Courier New',monospace;font-size:11px;color:#888;background:#fafbfc;border-bottom:1px solid #e0e2e8}
td{padding:8px;border-bottom:1px solid #f0f1f4}
.td-qno{font-family:'Courier New',monospace;font-weight:700;color:#888;text-align:right;width:50px}
.td-opt{font-family:'Courier New',monospace;font-weight:700}
.td-key{font-family:'Courier New',monospace;font-weight:700;color:#2a9d8f}
.td-right{text-align:right}
.td-time{text-align:right;font-family:'Courier New',monospace;font-size:12px;color:#888}
.status-correct{color:#22c55e;font-weight:700;font-family:'Courier New',monospace}
.status-wrong{color:#ef4444;font-weight:700;font-family:'Courier New',monospace}
.status-skip{color:#999;font-family:'Courier New',monospace;font-size:11px}
.row-alt{background:#fafbfc}
.row-correct{background:rgba(34,197,94,.03)}
.row-wrong{background:rgba(239,68,68,.03)}
/* Charts */
.chart-container{position:relative;height:220px;margin:8px 0}
.chart-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:640px){.chart-grid{grid-template-columns:1fr}}
/* Sections */
.section-item{margin-bottom:12px}
.section-header{display:flex;justify-content:space-between;font-size:12px;font-family:'Courier New',monospace;margin-bottom:4px}
.section-score{font-weight:700}
.section-bar{height:20px;background:#f0f1f4;border-radius:10px;overflow:hidden;display:flex}
.bar-correct{background:#22c55e;height:100%}
.bar-wrong{background:#ef4444;height:100%}
.section-legend{font-size:10px;color:#888;margin-top:4px;display:flex;gap:12px}
/* Wasters */
.waster-row{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(239,68,68,.04);border-radius:6px;margin-bottom:6px;font-size:13px}
.waster-q{font-family:'Courier New',monospace;font-weight:700}
.waster-time{font-size:14px}
/* Option dist */
.opt-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.opt-card{text-align:center;border:1px solid #e0e2e8;border-radius:8px;padding:12px}
.opt-letter{font-family:'Courier New',monospace;font-size:1.2rem;font-weight:700}
.opt-yours{color:#2a9d8f;font-family:'Courier New',monospace;font-weight:700;margin-top:8px}
.opt-key{color:#22c55e;font-family:'Courier New',monospace;font-weight:700}
.opt-label{font-size:10px;color:#888}
.opt-hr{border:none;border-top:1px solid #e0e2e8;margin:6px 0}
/* Detailed Analysis */
.detailed-card{background:#fff;border:1px solid #e0e2e8;border-radius:12px;margin-bottom:24px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05)}
.detailed-header{padding:12px 16px;background:#f8f9fa;border-bottom:1px solid #e0e2e8;display:flex;justify-content:space-between;align-items:center}
.detailed-qno{font-weight:700;font-family:'Courier New',monospace;font-size:16px}
.detailed-status{display:flex;gap:8px}
.badge{padding:4px 8px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
.badge-success{background:rgba(34,197,94,.1);color:#22c55e}
.badge-danger{background:rgba(239,68,68,.1);color:#ef4444}
.badge-muted{background:rgba(153,153,153,.1);color:#999}
.badge-info{background:rgba(42,157,143,.1);color:#2a9d8f}
.detailed-body{padding:16px}
.detailed-answers{display:flex;gap:12px;margin-bottom:16px}
.ans-box{flex:1;padding:12px;border-radius:8px;border:1px solid #e0e2e8;display:flex;flex-direction:column;align-items:center}
.ans-label{font-size:9px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:4px}
.ans-val{font-size:18px;font-weight:700;font-family:'Courier New',monospace}
.border-success-light{border-color:rgba(34,197,94,.3);background:rgba(34,197,94,.02)}
.border-success{border-left:4px solid #22c55e}
.border-danger{border-left:4px solid #ef4444}
.border-muted{border-left:4px solid #999}
.detailed-image{margin-bottom:16px;border:1px solid #e0e2e8;border-radius:8px;overflow:hidden;text-align:center;background:#fcfcfc}
.detailed-image img{max-width:100%;max-height:400px;object-contain:contain}
.detailed-annotation{padding:12px;background:#fdfdfd;border:1px solid #eee;border-radius:8px}
.ann-type{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.ann-icon{font-size:20px}
.ann-label{font-weight:700;font-size:13px}
.ann-notes{font-size:13px;font-style:italic;color:#444;margin-bottom:8px;padding-left:12px;border-left:2px solid #ddd}
.ann-tags{display:flex;flex-wrap:wrap;gap:6px}
.tag{font-size:10px;font-weight:700;color:#2a9d8f;background:rgba(42,157,143,.1);padding:2px 8px;border-radius:10px}
/* Print */
@media print{.tabs{display:none}.panel{display:block!important}body{background:#fff}}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div>
      <h1>${testName}</h1>
      <div class="meta">Q${config.startFrom}–${config.startFrom + config.totalQuestions - 1} · ${config.totalQuestions} Questions · ${config.timeInMinutes} min</div>
      <div class="meta">Test: ${testDate} · Exported: ${exportDate}</div>
    </div>
  </div>

  <div class="tabs">
    <div class="tab active" onclick="showTab('response')">Response Sheet</div>
    ${answerKey ? '<div class="tab" onclick="showTab(\'analysis\')">Analysis</div>' : ''}
    ${answerKey ? '<div class="tab" onclick="showTab(\'charts\')">Charts</div>' : ''}
    ${includeAnnotations ? '<div class="tab" onclick="showTab(\'detailed\')">Question Paper & Review</div>' : ''}
    <div class="tab" onclick="showTab('table')">Question Table</div>
  </div>

  <!-- RESPONSE SHEET -->
  <div id="panel-response" class="panel active">
    <div class="stats-grid" style="margin-bottom:16px">
      <div class="stat"><div class="stat-val color-primary">${answered}</div><div class="stat-label">✓ Answered</div></div>
      <div class="stat"><div class="stat-val color-muted">${unanswered}</div><div class="stat-label">— Unanswered</div></div>
      <div class="stat"><div class="stat-val color-warn">${reviewed}</div><div class="stat-label">⚑ Reviewed</div></div>
      <div class="stat"><div class="stat-val">${fmtTotal(totalTimeSec)}</div><div class="stat-label">⏱ Time</div></div>
    </div>
    ${answerKey ? `<div class="card card-accent">
      <div class="stats-grid">
        <div class="stat"><div class="stat-val stat-big color-primary">${score}</div><div class="stat-label">Score / ${maxScore}</div></div>
        <div class="stat"><div class="stat-val color-success">+${correct * 4}</div><div class="stat-label">${correct} Correct</div></div>
        <div class="stat"><div class="stat-val color-danger">−${incorrect}</div><div class="stat-label">${incorrect} Wrong</div></div>
        <div class="stat"><div class="stat-val">${accuracy}%</div><div class="stat-label">Accuracy</div></div>
      </div>
    </div>` : ''}
    <div class="card">
      <h2>RESPONSE SHEET</h2>
      ${omrRowsHtml}
    </div>
  </div>

  ${answerKey ? `
  <!-- ANALYSIS -->
  <div id="panel-analysis" class="panel">
    <div class="card card-accent">
      <div class="stats-grid">
        <div class="stat"><div class="stat-val stat-big color-primary">${score}</div><div class="stat-label">Score / ${maxScore}</div></div>
        <div class="stat"><div class="stat-val color-success">+${correct * 4}</div><div class="stat-label">${correct} Correct</div></div>
        <div class="stat"><div class="stat-val color-danger">−${incorrect}</div><div class="stat-label">${incorrect} Wrong</div></div>
        <div class="stat"><div class="stat-val">${accuracy}%</div><div class="stat-label">Accuracy</div></div>
        <div class="stat"><div class="stat-val color-warn">${attemptRate}%</div><div class="stat-label">Attempt Rate</div></div>
      </div>
    </div>
    <div class="stats-grid" style="margin-bottom:16px">
      <div class="stat"><div class="stat-val">${fmt(avgTime)}</div><div class="stat-label">Avg Time/Q</div></div>
      <div class="stat"><div class="stat-val">${fmt(fastestQ)}</div><div class="stat-label">Fastest</div></div>
      <div class="stat"><div class="stat-val">${fmt(slowestQ)}</div><div class="stat-label">Slowest</div></div>
      <div class="stat"><div class="stat-val">${skipped * 4}</div><div class="stat-label">Marks Missed (Skips)</div></div>
    </div>
    <div class="stats-grid" style="margin-bottom:16px">
      <div class="stat" style="border-color:rgba(34,197,94,.3)"><div class="stat-val color-success">${fmt(avgCorrectTime)}</div><div class="stat-label">Avg Time on Correct</div></div>
      <div class="stat" style="border-color:rgba(239,68,68,.3)"><div class="stat-val color-danger">${fmt(avgWrongTime)}</div><div class="stat-label">Avg Time on Wrong</div></div>
      <div class="stat"><div class="stat-val">${bestStreak} ✓ / ${worstStreak} ✗</div><div class="stat-label">Best / Worst Streak</div></div>
    </div>
    <div class="card">
      <h2>Section-wise Performance</h2>
      ${sectionHtml}
    </div>
    <div class="card">
      <h2>Option Distribution: Yours vs Key</h2>
      <div class="opt-grid">${optDistHtml}</div>
    </div>
    ${timeWasters.length > 0 ? `<div class="card" style="border-color:rgba(239,68,68,.3)">
      <h2 style="color:#ef4444">⚠ Most Time Wasted on Wrong Answers</h2>
      ${wastersHtml}
    </div>` : ''}
  </div>

  <!-- CHARTS -->
  <div id="panel-charts" class="panel">
    <div class="chart-grid">
      <div class="card">
        <h2>Score Breakdown</h2>
        <div class="chart-container"><canvas id="pieChart"></canvas></div>
      </div>
      <div class="card">
        <h2>Score Progression</h2>
        <div class="chart-container"><canvas id="scoreChart"></canvas></div>
      </div>
      <div class="card">
        <h2>Accuracy Trend</h2>
        <div class="chart-container"><canvas id="accChart"></canvas></div>
      </div>
      <div class="card">
        <h2>Time Per Question</h2>
        <div class="chart-container"><canvas id="timeChart"></canvas></div>
      </div>
    </div>
  </div>
  ` : ''}

  <!-- TABLE -->
  <div id="panel-table" class="panel">
    <div class="card">
      <h2>QUESTION-WISE BREAKDOWN</h2>
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th style="text-align:right;width:50px">Q.No</th><th>Yours</th>${answerKey ? '<th>Key</th><th>Status</th><th style="text-align:right">Marks</th>' : ''}<th style="text-align:right">Time</th></tr></thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>
      </div>
    </div>
  </div>

  ${includeAnnotations ? `
  <!-- QUESTION PAPER & REVIEW -->
  <div id="panel-detailed" class="panel">
    <h2 style="margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px;">Question Paper & Detailed Review</h2>
    ${detailedAnalysisHtml}
  </div>
  ` : ''}
</div>

<script>
function showTab(name){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('panel-'+name).classList.add('active');
  event.target.classList.add('active');
  if(name==='charts'&&!window._chartsInit){window._chartsInit=true;initCharts();}
}
${answerKey ? `
function initCharts(){
  const labels=${JSON.stringify(questionData.map(q=>'Q'+q.qNo))};
  const cumScores=${JSON.stringify(cumulativeScores)};
  const cumAcc=${JSON.stringify(cumulativeAcc)};
  const timeLabels=${JSON.stringify(timeBarData.map(q=>'Q'+q.qNo))};
  const timeVals=${JSON.stringify(timeBarData.map(q=>q.timeGap))};
  const timeColors=${JSON.stringify(timeBarData.map(q=>q.isCorrect?'#22c55e':q.isWrong?'#ef4444':'#999'))};
  
  new Chart(document.getElementById('pieChart'),{type:'doughnut',data:{labels:['Correct (+4)','Incorrect (−1)','Skipped (0)'],datasets:[{data:[${correct},${incorrect},${skipped}],backgroundColor:['#22c55e','#ef4444','#b0b3c0'],borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{size:11}}}}}});
  
  new Chart(document.getElementById('scoreChart'),{type:'line',data:{labels:labels,datasets:[{label:'Score',data:cumScores,borderColor:'#2a9d8f',backgroundColor:'rgba(42,157,143,0.1)',fill:true,tension:0.3,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{maxTicksLimit:10,font:{size:8}}},y:{beginAtZero:false}},plugins:{legend:{display:false}}}});
  
  new Chart(document.getElementById('accChart'),{type:'line',data:{labels:labels,datasets:[{label:'Accuracy %',data:cumAcc,borderColor:'#2a9d8f',tension:0.3,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{maxTicksLimit:10,font:{size:8}}},y:{min:0,max:100}},plugins:{legend:{display:false}}}});
  
  new Chart(document.getElementById('timeChart'),{type:'bar',data:{labels:timeLabels,datasets:[{label:'Time (s)',data:timeVals,backgroundColor:timeColors,borderRadius:2}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{ticks:{maxTicksLimit:15,font:{size:7}}},y:{beginAtZero:true}},plugins:{legend:{display:false}}}});
}
` : ''}
</script>
</body>
</html>`;

  // Download
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${testName.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
