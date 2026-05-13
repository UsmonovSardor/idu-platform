'use strict';
// IDU - features/reports.js — Real API

async function renderFullReport() {
  try {
    renderGroupAvgChart();
    renderSubjectAvgTable();
  } catch(e) {}
}

async function renderGroupAvgChart() {
  const el = document.getElementById('groupAvgChart');
  if (!el) return;
  try {
    const data = await api('GET', '/exams/history');
    if (!Array.isArray(data) || !data.length) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">Ma\'lumot yo\'q</div>';
      return;
    }
    // Group by subject
    const bySubject = {};
    data.forEach(r => {
      if (!bySubject[r.subject]) bySubject[r.subject] = [];
      bySubject[r.subject].push(parseFloat(r.score) || 0);
    });
    const subjects = Object.keys(bySubject);
    const avgs = subjects.map(s => (bySubject[s].reduce((a,b)=>a+b,0)/bySubject[s].length).toFixed(1));
    const maxV = Math.max(...avgs.map(Number)) + 5;
    const colors = ['#1B4FD8','#7C3AED','#16A34A','#EA580C','#0D9488'];
    el.innerHTML = '<div style="display:flex;align-items:flex-end;gap:10px;height:120px;padding:0 8px;margin-bottom:8px">' +
      subjects.map((s, i) => {
        const h = Math.round((avgs[i] / maxV) * 95);
        const c = colors[i % colors.length];
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
          <span style="font-size:11px;font-weight:800;color:${c}">${avgs[i]}%</span>
          <div style="width:100%;background:${c};border-radius:6px 6px 0 0;height:${h}px;opacity:0.88"></div>
          <div style="font-size:9px;color:#94A3B8;text-align:center">${s}</div>
        </div>`;
      }).join('') + '</div>';
  } catch(e) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">—</div>';
  }
}

async function renderSubjectAvgTable() {
  const el = document.getElementById('subjectAvgTable');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">⏳</div>';
  try {
    const data = await api('GET', '/exams/history');
    if (!Array.isArray(data) || !data.length) {
      el.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">Ma\'lumot yo\'q</div>';
      return;
    }
    const bySubject = {};
    data.forEach(r => {
      if (!bySubject[r.subject]) bySubject[r.subject] = { scores: [], alo: 0, fail: 0 };
      const s = parseFloat(r.score) || 0;
      bySubject[r.subject].scores.push(s);
      if (r.letter_grade === 'A') bySubject[r.subject].alo++;
      if (r.letter_grade === 'F') bySubject[r.subject].fail++;
    });
    const rows = Object.entries(bySubject).map(([sub, d]) => ({
      sub,
      avg: (d.scores.reduce((a,b)=>a+b,0)/d.scores.length).toFixed(1),
      alo: d.alo, fail: d.fail
    })).sort((a,b) => b.avg - a.avg);
    el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr>
        <th style="text-align:left;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;color:#94A3B8;font-size:11px">#</th>
        <th style="text-align:left;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;color:#94A3B8;font-size:11px">Fan</th>
        <th style="text-align:center;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;color:#94A3B8;font-size:11px">O'rt. ball</th>
        <th style="text-align:center;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;color:#94A3B8;font-size:11px">A'lochilar</th>
        <th style="text-align:center;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;color:#94A3B8;font-size:11px">Qoniqarsiz</th>
      </tr></thead>
      <tbody>${rows.map((r,i) => {
        const tc = r.avg >= 80 ? '#166534' : r.avg >= 65 ? '#1E40AF' : '#991B1B';
        const tb = r.avg >= 80 ? '#DCFCE7' : r.avg >= 65 ? '#DBEAFE' : '#FEE2E2';
        return `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #F8FAFC;color:#94A3B8">${i+1}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #F8FAFC;font-weight:600">${r.sub}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #F8FAFC;text-align:center">
            <span style="background:${tb};color:${tc};padding:3px 11px;border-radius:7px;font-weight:800">${r.avg}%</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #F8FAFC;text-align:center;color:#16A34A;font-weight:700">${r.alo}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #F8FAFC;text-align:center;color:${r.fail>0?'#DC2626':'#94A3B8'};font-weight:700">${r.fail}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  } catch(e) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:#ef4444">Xato: ${e.message}</div>`;
  }
}

function renderGroupDetailReport() { renderFullReport(); }
function renderTeacherPerformance() {}
function renderRiskStudents() { if (typeof renderAtRiskFromApi === 'function') renderAtRiskFromApi(); }
function renderSemesterCompare() {}
function switchRTab(name, btn) {
  document.querySelectorAll('.rtab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.report-panel').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const panel = document.getElementById('rpanel-' + name);
  if (panel) panel.classList.add('active');
  if (name === 'overview') renderFullReport();
  else if (name === 'risk') renderRiskStudents();
}
