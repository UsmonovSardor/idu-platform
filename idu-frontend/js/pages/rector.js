'use strict';
// IDU — Rector Analytics Dashboard

async function renderRectorDashboard() {
  renderRectorKPI();
  renderRectorGradeDist();
  renderRectorGroupStats();
  renderRectorSubjectStats();
  renderRectorTopStudents();
  renderRectorRiskStudents();
  renderRectorAttByGroup();
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
async function renderRectorKPI() {
  var el = document.getElementById('rectorKpiRow');
  if (!el) return;
  el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">'
    + [1,2,3,4,5,6].map(function(i){ return '<div class="skeleton-stat" style="animation-delay:' + (i*0.07) + 's"><div class="skeleton-line" style="width:60%;height:11px;margin-bottom:12px"></div><div class="skeleton-line" style="width:40%;height:28px;margin-bottom:8px"></div><div class="skeleton-line" style="width:80%;height:9px"></div></div>'; }).join('') + '</div>';
  try {
    var d = await api('GET', '/rector/kpi');
    el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">'
      + kpiCard({ icon:'👥', label:"Jami talabalar",   val:d.totalStudents,  color:'#1B4FD8', change:'Faol o\'quvchilar' })
      + kpiCard({ icon:'👨‍🏫', label:"O'qituvchilar",   val:d.totalTeachers,  color:'#7C3AED', change:'Faol kadrlar' })
      + kpiCard({ icon:'📊', label:'O\'rtacha ball',    val:d.avgScore+'',    color:'#16A34A', change:'100 ballik tizim' })
      + kpiCard({ icon:'📅', label:'Davomat %',         val:(d.attendancePct||0)+'%', color:'#0891B2', change:'QR orqali' })
      + kpiCard({ icon:'📝', label:'Baholangan ish',    val:d.gradedSubmissions, color:'#D97706', change:'Topshiriqlar' })
      + kpiCard({ icon:'🎯', label:'Faol imtihon',      val:d.activeExams,    color:'#DC2626', change:'Hozir' })
      + '</div>';
  } catch(e) {
    el.innerHTML = '<div style="color:#DC2626;padding:12px">KPI yuklanmadi: ' + e.message + '</div>';
  }
}

function kpiCard(o) {
  return '<div class="stat-card" style="border-top:3px solid '+o.color+'">'
    + '<div class="stat-card-top"><div class="stat-card-label">'+o.label+'</div>'
    + '<div class="stat-card-icon" style="background:'+o.color+'22;font-size:18px">'+o.icon+'</div></div>'
    + '<div class="stat-card-val stat-card-val" style="color:'+o.color+'">'+o.val+'</div>'
    + '<div class="stat-card-change">'+o.change+'</div>'
    + '<div class="stat-card-bar" style="background:'+o.color+'33;height:3px;border-radius:2px;margin-top:8px"></div>'
    + '</div>';
}

// ── Grade distribution bar chart ──────────────────────────────────────────────
async function renderRectorGradeDist() {
  var el = document.getElementById('rectorGradeDist');
  if (!el) return;
  try {
    var d = await api('GET', '/rector/grade-distribution');
    var total = parseInt(d.total,10) || 1;
    var bars = [
      { label:"A'lo (86+)",  val:d.a_count, color:'#16A34A' },
      { label:'Yaxshi (71+)', val:d.b_count, color:'#0891B2' },
      { label:"Qoniqarli (56+)", val:d.c_count, color:'#D97706' },
      { label:'Yetarli (41+)', val:d.d_count, color:'#EA580C' },
      { label:'Qoniqarsiz',   val:d.f_count, color:'#DC2626' },
    ];
    el.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px">'
      + bars.map(function(b) {
        var pct = Math.round(100*(parseInt(b.val,10)||0)/total);
        return '<div>'
          + '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">'
          + '<span style="font-weight:600;color:#374151">' + b.label + '</span>'
          + '<span style="color:#64748B">' + (b.val||0) + ' ta · ' + pct + '%</span></div>'
          + '<div style="height:10px;background:#F1F5F9;border-radius:6px;overflow:hidden">'
          + '<div style="height:100%;width:' + pct + '%;background:' + b.color + ';border-radius:6px;transition:width 1s ease"></div>'
          + '</div></div>';
      }).join('') + '</div>';
  } catch(e) {
    el.innerHTML = '<div style="color:#94A3B8;font-size:12px">Yuklanmadi</div>';
  }
}

// ── Group stats table ─────────────────────────────────────────────────────────
async function renderRectorGroupStats() {
  var el = document.getElementById('rectorGroupTable');
  if (!el) return;
  try {
    var rows = await api('GET', '/rector/group-stats');
    if (!rows.length) { el.innerHTML='<tr><td colspan="6" style="text-align:center;color:#94A3B8;padding:16px">Guruh ma\'lumoti yo\'q</td></tr>'; return; }
    el.innerHTML = rows.map(function(r,i) {
      var avg = parseFloat(r.avg_score)||0;
      var barColor = avg>=86?'#16A34A':avg>=71?'#0891B2':avg>=56?'#D97706':'#DC2626';
      return '<tr style="background:' + (i%2?'#F8FAFC':'#fff') + '">'
        + '<td style="padding:10px 12px;font-weight:700;color:#1B4FD8">' + r.group_name + '</td>'
        + '<td style="padding:10px 12px;text-align:center">' + r.student_count + '</td>'
        + '<td style="padding:10px 12px">'
        + '<div style="display:flex;align-items:center;gap:6px">'
        + '<div style="flex:1;height:6px;background:#F1F5F9;border-radius:3px"><div style="height:100%;width:' + Math.min(avg,100) + '%;background:'+barColor+';border-radius:3px"></div></div>'
        + '<span style="font-weight:700;color:'+barColor+';font-size:12px">' + avg.toFixed(1) + '</span>'
        + '</div></td>'
        + '<td style="padding:10px 12px;text-align:center">' + (parseFloat(r.avg_gpa)||0).toFixed(2) + '</td>'
        + '<td style="padding:10px 12px;text-align:center"><span style="background:#DCFCE7;color:#16A34A;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">' + (r.excellent||0) + '</span></td>'
        + '<td style="padding:10px 12px;text-align:center"><span style="background:#FEE2E2;color:#DC2626;font-size:11px;padding:2px 8px;border-radius:12px;font-weight:700">' + (r.failing||0) + '</span></td>'
        + '</tr>';
    }).join('');
  } catch(e) {
    el.innerHTML = '<tr><td colspan="6" style="color:#DC2626;padding:12px">' + e.message + '</td></tr>';
  }
}

// ── Subject stats ─────────────────────────────────────────────────────────────
async function renderRectorSubjectStats() {
  var el = document.getElementById('rectorSubjectTable');
  if (!el) return;
  try {
    var rows = await api('GET', '/rector/subject-stats');
    if (!rows.length) { el.innerHTML='<tr><td colspan="5" style="text-align:center;color:#94A3B8;padding:16px">Ma\'lumot yo\'q</td></tr>'; return; }
    el.innerHTML = rows.map(function(r,i) {
      var avg = parseFloat(r.avg_score)||0;
      var pct = r.attempts ? Math.round(100*r.passed/r.attempts) : 0;
      return '<tr style="background:' + (i%2?'#F8FAFC':'#fff') + '">'
        + '<td style="padding:10px 12px;font-weight:700">' + r.subject + '</td>'
        + '<td style="padding:10px 12px;text-align:center">' + r.attempts + '</td>'
        + '<td style="padding:10px 12px;text-align:center;font-weight:700;color:' + (avg>=71?'#16A34A':avg>=56?'#D97706':'#DC2626') + '">' + avg.toFixed(1) + '</td>'
        + '<td style="padding:10px 12px;text-align:center">' + r.max_score + ' / ' + r.min_score + '</td>'
        + '<td style="padding:10px 12px;text-align:center"><div style="display:flex;align-items:center;gap:4px"><div style="height:6px;background:#E2E8F0;border-radius:3px;flex:1"><div style="height:100%;width:'+pct+'%;background:#16A34A;border-radius:3px"></div></div><span style="font-size:11px;color:#64748B">'+pct+'%</span></div></td>'
        + '</tr>';
    }).join('');
  } catch(e) {
    el.innerHTML = '<tr><td colspan="5" style="color:#DC2626;padding:12px">' + e.message + '</td></tr>';
  }
}

// ── Top students ──────────────────────────────────────────────────────────────
async function renderRectorTopStudents() {
  var el = document.getElementById('rectorTopStudents');
  if (!el) return;
  try {
    var rows = await api('GET', '/rector/top-students');
    el.innerHTML = '<div style="display:flex;flex-direction:column;gap:6px">'
      + rows.map(function(r, i) {
        var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1);
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px;background:' + (i<3?'#FFFBEB':'#F8FAFC') + ';border-radius:10px;border:1px solid ' + (i<3?'#FDE68A':'#E2E8F0') + '">'
          + '<div style="font-size:' + (i<3?'18px':'12px') + ';width:28px;text-align:center;font-weight:700;color:#94A3B8">' + medal + '</div>'
          + '<div style="flex:1">'
          + '<div style="font-weight:700;font-size:12px">' + r.full_name + '</div>'
          + '<div style="font-size:10px;color:#94A3B8">' + (r.group_name||'') + '</div>'
          + '</div>'
          + '<div style="text-align:right">'
          + '<div style="font-size:13px;font-weight:900;color:#16A34A">' + (r.avg_score||0) + '</div>'
          + '<div style="font-size:10px;color:#94A3B8">' + r.badges + ' 🏅</div>'
          + '</div></div>';
      }).join('') + '</div>';
  } catch(e) {
    el.innerHTML = '<div style="color:#94A3B8;font-size:12px">Yuklanmadi</div>';
  }
}

// ── Risk students ─────────────────────────────────────────────────────────────
async function renderRectorRiskStudents() {
  var el = document.getElementById('rectorRiskTable');
  if (!el) return;
  try {
    var rows = await api('GET', '/rector/risk-students');
    if (!rows.length) {
      el.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#16A34A;padding:16px">✅ Xavf guruhida talabalar yo\'q</td></tr>';
      return;
    }
    el.innerHTML = rows.map(function(r,i) {
      return '<tr style="background:' + (i%2?'#FFF5F5':'#fff') + '">'
        + '<td style="padding:10px 12px;font-weight:600">' + r.full_name + '</td>'
        + '<td style="padding:10px 12px">' + (r.group_name||'—') + '</td>'
        + '<td style="padding:10px 12px">' + r.email + '</td>'
        + '<td style="padding:10px 12px;text-align:center"><span style="background:#FEE2E2;color:#DC2626;font-weight:700;padding:3px 10px;border-radius:20px;font-size:11px">' + (r.avg_score||'?') + '</span></td>'
        + '</tr>';
    }).join('');
  } catch(e) {
    el.innerHTML = '<tr><td colspan="4" style="color:#DC2626;padding:12px">' + e.message + '</td></tr>';
  }
}

// ── Attendance by group ───────────────────────────────────────────────────────
async function renderRectorAttByGroup() {
  var el = document.getElementById('rectorAttChart');
  if (!el) return;
  try {
    var rows = await api('GET', '/rector/attendance-by-group');
    if (!rows.length) { el.innerHTML='<div style="color:#94A3B8;font-size:12px;padding:8px">Davomat ma\'lumoti yo\'q</div>'; return; }
    el.innerHTML = '<div style="display:flex;flex-direction:column;gap:6px">'
      + rows.map(function(r) {
        var pct = parseFloat(r.pct)||0;
        var c = pct>=80?'#16A34A':pct>=60?'#D97706':'#DC2626';
        return '<div>'
          + '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px">'
          + '<span style="font-weight:600">' + r.group_name + '</span>'
          + '<span style="color:' + c + ';font-weight:700">' + pct + '%</span></div>'
          + '<div style="height:8px;background:#F1F5F9;border-radius:4px;overflow:hidden">'
          + '<div style="height:100%;width:' + Math.min(pct,100) + '%;background:' + c + ';border-radius:4px;transition:width 1s ease"></div>'
          + '</div></div>';
      }).join('') + '</div>';
  } catch(e) {
    el.innerHTML = '<div style="color:#94A3B8;font-size:12px">Yuklanmadi</div>';
  }
}
