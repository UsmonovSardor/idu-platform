'use strict';
// IDU - features/reports.js

function exportStudentGrades(){
  let csv="Fan nomi,O'qituvchi,JN/30,ON/20,YN/30,MI/20,Jami/100,Baho\n";
  GRADES_DATA.forEach(g=>{
    const t=g.jn+g.on+g.yn+g.mi;
    csv+='"'+g.sub+'","'+g.teacher+'",'+g.jn+','+g.on+','+g.yn+','+g.mi+','+t+',"'+getGrade(t).letter+'"\n';
  });
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='baholar.csv';a.click();
  showToast('📥','Excel','Yuklab olindi');
}

function exportGrades(){
  var students=STUDENTS_DATA.filter(function(s){return s.group===_curGrp;});
  var csv='Fan,Guruh,Talaba,JN/30,ON/20,YN/30,MI/20,Jami/100,Baho\n';
  students.forEach(function(s){
    var jn=parseInt(document.getElementById('jn-'+s.id)?.value)||0;
    var on=parseInt(document.getElementById('on-'+s.id)?.value)||0;
    var yn=parseInt(document.getElementById('yn-'+s.id)?.value)||0;
    var mi=parseInt(document.getElementById('mi-'+s.id)?.value)||0;
    var t=jn+on+yn+mi;
    csv+='"'+_curSub+'","'+_curGrp+'","'+s.name+'",'+jn+','+on+','+yn+','+mi+','+t+',"'+getGrade(t).letter+'"\n';
  });
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=_curSub.replace(/ /g,'_')+'_'+_curGrp+'.csv';a.click();
  showToast('📥','Excel','Yuklab olindi');
}

function exportDekanatGrades(){
  var grp=document.getElementById('dekGradeGroup')?.value||'AI-2301';
  var students=STUDENTS_DATA.filter(function(s){return s.group===grp;});
  var csv='Talaba,Guruh,Fan,JN/30,ON/20,YN/30,MI/20,Jami/100,Baho\n';
  students.forEach(function(s){
    GRADES_DATA.forEach(function(g){
      var key=s.id+'_'+g.sub;var sv=SAVED_GRADES[key];
      var jn=sv?sv.jn:g.jn,on=sv?sv.on:g.on,yn=sv?sv.yn:g.yn,mi=sv?sv.mi:g.mi;
      var t=jn+on+yn+mi;
      csv+='"'+s.name+'","'+grp+'","'+g.sub+'",'+jn+','+on+','+yn+','+mi+','+t+',"'+getGrade(t).letter+'"\n';
    });
  });
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=grp+'_baholar.csv';a.click();
  showToast('📥','Excel','Yuklab olindi');
}

function exportAttendance(){
  showToast('📤','Export','Davomat hisoboti Excel formatida yuklanmoqda...');
}

async function renderFullReport(){
  // Skeleton
  var u = function(id, val){ var el=document.getElementById(id); if(el) el.textContent=val; };
  u('rpt-total-students','…'); u('rpt-avg-score','…');
  u('rpt-total-exams','…'); u('rpt-pass-rate','…'); u('rpt-fail-count','…');

  var attempts = [];
  var students  = [];
  try {
    var res = await Promise.all([
      api('GET', '/exams/history'),
      api('GET', '/students?limit=200')
    ]);
    attempts = Array.isArray(res[0]) ? res[0] : [];
    students  = Array.isArray(res[1]) ? res[1] : (Array.isArray(res[1] && res[1].students) ? res[1].students : []);
  } catch(e) {}

  // ── KPI ──────────────────────────────────────────────────────
  var completed = attempts.filter(function(a){ return a.status === 'completed'; });
  var totalStudents = students.length;
  var avgScore  = completed.length
    ? Math.round(completed.reduce(function(s,a){ return s + (a.score||0); }, 0) / completed.length * 10) / 10
    : 0;
  var passCount = completed.filter(function(a){ return a.letter_grade && a.letter_grade !== 'F'; }).length;
  var failCount = completed.filter(function(a){ return a.letter_grade === 'F'; }).length;
  var passRate  = completed.length ? Math.round(passCount / completed.length * 100) : 0;

  u('rpt-total-students', totalStudents || 0);
  u('rpt-avg-score',  avgScore || 0);
  u('rpt-total-exams', completed.length);
  u('rpt-pass-rate',  passRate + '%');
  u('rpt-fail-count', failCount);

  var scoreEl = document.getElementById('rpt-avg-score');
  if (scoreEl) scoreEl.style.color = avgScore >= 71 ? '#16A34A' : avgScore >= 56 ? '#D97706' : '#DC2626';
  var failTrend = document.getElementById('rpt-fail-trend');
  if (failTrend) { failTrend.textContent = failCount > 0 ? '↓ Nazorat kerak' : '✅ Yaxshi'; failTrend.style.color = failCount > 0 ? '#DC2626' : '#16A34A'; }

  // ── Grade distribution ────────────────────────────────────────
  var gradeEl = document.getElementById('gradeDistribution');
  if (gradeEl) {
    var alo  = completed.filter(function(a){ return (a.score||0) >= 86; }).length;
    var yax  = completed.filter(function(a){ var s=a.score||0; return s>=71 && s<86; }).length;
    var qon  = completed.filter(function(a){ var s=a.score||0; return s>=56 && s<71; }).length;
    var fail2= completed.filter(function(a){ return (a.score||0) < 56; }).length;
    var tot  = completed.length || 1;
    var bars = [
      { label:"A'lo (86–100)",  cnt: alo,  pct: Math.round(alo/tot*100),  color:'#16A34A' },
      { label:'Yaxshi (71–85)', cnt: yax,  pct: Math.round(yax/tot*100),  color:'#1B4FD8' },
      { label:'Qoniqarli (56–70)', cnt: qon, pct: Math.round(qon/tot*100), color:'#D97706' },
      { label:'Qoniqarsiz (<56)',  cnt: fail2, pct: Math.round(fail2/tot*100), color:'#DC2626' }
    ];
    gradeEl.innerHTML = bars.map(function(b){
      return '<div style="margin-bottom:12px">'
        +'<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;margin-bottom:4px">'
          +'<span style="color:#0F172A">'+b.label+'</span>'
          +'<span style="color:'+b.color+'">'+b.cnt+' ta &nbsp;'+b.pct+'%</span>'
        +'</div>'
        +'<div style="background:#F1F5F9;border-radius:6px;height:10px;overflow:hidden">'
          +'<div style="width:'+b.pct+'%;background:'+b.color+';height:100%;border-radius:6px;transition:width 0.5s"></div>'
        +'</div>'
      +'</div>';
    }).join('');
  }

  // ── Group avg bar chart ───────────────────────────────────────
  var chartEl = document.getElementById('groupAvgChart');
  if (chartEl) {
    if (!completed.length) {
      chartEl.innerHTML = '<div style="padding:30px;text-align:center;color:#94A3B8;font-size:13px">Hali imtihon natijalari yo\'q</div>';
    } else {
      var groupMap = {};
      completed.forEach(function(a){
        var g = a.group_name || a.group || 'Noma\'lum';
        if (!groupMap[g]) groupMap[g] = [];
        groupMap[g].push(a.score || 0);
      });
      var colors = ['#1B4FD8','#7C3AED','#16A34A','#EA580C','#0891B2','#DB2777'];
      var groups = Object.keys(groupMap);
      var gdata = groups.map(function(g, i){
        var scores = groupMap[g];
        var avg = scores.length ? Math.round(scores.reduce(function(s,v){ return s+v; },0)/scores.length) : 0;
        return { g: g, avg: avg, cnt: scores.length, c: colors[i % colors.length] };
      });
      var maxV = Math.max.apply(null, gdata.map(function(d){ return d.avg; })) + 10 || 100;
      chartEl.innerHTML = '<div style="display:flex;align-items:flex-end;gap:10px;height:120px;padding:0 8px;margin-bottom:8px">'
        + gdata.map(function(d){
          var h = Math.max(4, Math.round((d.avg / maxV) * 95));
          return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">'
            +'<span style="font-size:11px;font-weight:800;color:'+d.c+'">'+d.avg+'</span>'
            +'<div style="width:100%;background:'+d.c+';border-radius:6px 6px 0 0;height:'+h+'px;opacity:0.88"></div>'
            +'<div style="font-size:9px;color:#94A3B8;text-align:center;line-height:1.3">'+d.g+'<br><span style="color:#CBD5E1">'+d.cnt+' ta</span></div>'
          +'</div>';
        }).join('')
      +'</div>';
    }
  }

  // ── Subject avg table ─────────────────────────────────────────
  var subEl = document.getElementById('subjectAvgTable');
  if (subEl) {
    var subNames = { algo:'Algoritmlar', ai:"Sun'iy Intellekt", math:'Matematika', db:"Ma'lumotlar Bazasi", web:'Web Dasturlash' };
    var subMap = {};
    completed.forEach(function(a){
      var s = a.subject || 'unknown';
      if (!subMap[s]) subMap[s] = [];
      subMap[s].push(a.score || 0);
    });
    var subRows = Object.keys(subMap).map(function(sub){
      var scores = subMap[sub];
      var avg  = parseFloat((scores.reduce(function(s,v){ return s+v; },0)/scores.length).toFixed(1));
      var alo  = scores.filter(function(s){ return s>=86; }).length;
      var fail = scores.filter(function(s){ return s<56; }).length;
      var tc   = avg>=80?'#166534':avg>=65?'#1E40AF':'#991B1B';
      var tb   = avg>=80?'#DCFCE7':avg>=65?'#DBEAFE':'#FEE2E2';
      return { sub: subNames[sub]||sub, avg: avg, alo: alo, fail: fail, tc: tc, tb: tb, total: scores.length };
    });
    subRows.sort(function(a,b){ return b.avg - a.avg; });
    if (!subRows.length) {
      subEl.innerHTML = '<div style="padding:24px;text-align:center;color:#94A3B8;font-size:13px">Hali imtihon natijalari yo\'q</div>';
    } else {
      subEl.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px">'
        +'<thead><tr>'
          +'<th style="text-align:left;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8">#</th>'
          +'<th style="text-align:left;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8">FAN NOMI</th>'
          +'<th style="text-align:center;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8">O\'RT. BALL</th>'
          +'<th style="text-align:center;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8">A\'LOCHILAR</th>'
          +'<th style="text-align:center;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8">QONIQARSIZ</th>'
          +'<th style="padding:8px 12px;border-bottom:1.5px solid #E2E8F0"></th>'
        +'</tr></thead><tbody>'
        + subRows.map(function(r, i){
          return '<tr style="border-bottom:1px solid #F1F5F9">'
            +'<td style="padding:10px 12px;color:#94A3B8;font-weight:700">'+(i+1)+'</td>'
            +'<td style="padding:10px 12px;font-weight:700;color:#0F172A">'+r.sub+'</td>'
            +'<td style="padding:10px 12px;text-align:center"><span style="background:'+r.tb+';color:'+r.tc+';padding:3px 10px;border-radius:20px;font-weight:800;font-size:12px">'+r.avg+'</span></td>'
            +'<td style="padding:10px 12px;text-align:center;font-weight:700;color:#16A34A">'+r.alo+'</td>'
            +'<td style="padding:10px 12px;text-align:center;font-weight:700;color:#DC2626">'+r.fail+'</td>'
            +'<td style="padding:10px 12px"><div style="background:#F1F5F9;border-radius:4px;height:6px;width:100px;overflow:hidden"><div style="width:'+Math.round(r.avg)+'%;background:'+r.tc+';height:100%;border-radius:4px"></div></div></td>'
          +'</tr>';
        }).join('')
        +'</tbody></table>';
    }
  }
}

function renderGroupDetailReport(){
  var el=document.getElementById('groupDetailReport');if(!el)return;
  var groups=['AI-2301','CS-2301','IT-2301','DB-2301'];
  var colors=['#1B4FD8','#7C3AED','#16A34A','#EA580C'];
  var html='<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">';
  groups.forEach(function(grp,gi){
    var ss=STUDENTS_DATA.filter(function(s){return s.group===grp;});
    if(!ss.length){ ss=[{id:99,name:'Demo',gpa:3.2,avg:75,att:92}]; }
    var avgs=ss.map(function(s){
      return GRADES_DATA.reduce(function(acc,g){
        var key=s.id+'_'+g.sub;var sv=SAVED_GRADES[key];
        return acc+(sv?sv.jn:g.jn)+(sv?sv.on:g.on)+(sv?sv.yn:g.yn)+(sv?sv.mi:g.mi);
      },0)/Math.max(GRADES_DATA.length,1);
    });
    var avg=avgs.length?(avgs.reduce(function(a,b){return a+b;},0)/avgs.length).toFixed(1):75;
    var alo=ss.filter(function(s){return s.avg>=86;}).length;
    var fail=ss.filter(function(s){return s.avg<56;}).length;
    var attAvg=(ss.reduce(function(a,s){return a+s.att;},0)/ss.length).toFixed(1);
    var gpaAvg=(ss.reduce(function(a,s){return a+(parseFloat(s.gpa)||3);},0)/ss.length).toFixed(2);
    var c=colors[gi];
    html+='<div class="card" style="border-top:3px solid '+c+'">'
      +'<div class="card-header">'
        +'<div class="card-title" style="color:'+c+'">'+grp+'</div>'
        +'<div class="card-badge" style="background:'+c+'22;color:'+c+'">'+ss.length+' talaba</div>'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px">'
        +'<div style="text-align:center;padding:10px 4px;background:#F8FAFC;border-radius:8px">'
          +'<div style="font-size:18px;font-weight:900;color:'+c+';font-family:\'DM Mono\',monospace">'+avg+'</div>'
          +'<div style="font-size:9px;color:#94A3B8;font-weight:600;margin-top:2px">ORT. BALL</div>'
        +'</div>'
        +'<div style="text-align:center;padding:10px 4px;background:#F8FAFC;border-radius:8px">'
          +'<div style="font-size:18px;font-weight:900;color:#16A34A;font-family:\'DM Mono\',monospace">'+alo+'</div>'
          +'<div style="font-size:9px;color:#94A3B8;font-weight:600;margin-top:2px">A\'LOCHILAR</div>'
        +'</div>'
        +'<div style="text-align:center;padding:10px 4px;background:#F8FAFC;border-radius:8px">'
          +'<div style="font-size:18px;font-weight:900;color:#D97706;font-family:\'DM Mono\',monospace">'+attAvg+'%</div>'
          +'<div style="font-size:9px;color:#94A3B8;font-weight:600;margin-top:2px">DAVOMAT</div>'
        +'</div>'
        +'<div style="text-align:center;padding:10px 4px;background:#F8FAFC;border-radius:8px">'
          +'<div style="font-size:18px;font-weight:900;color:#7C3AED;font-family:\'DM Mono\',monospace">'+gpaAvg+'</div>'
          +'<div style="font-size:9px;color:#94A3B8;font-weight:600;margin-top:2px">GPA</div>'
        +'</div>'
      +'</div>'
      +(fail>0?'<div style="background:#FFF5F5;border:1px solid #FCA5A5;border-radius:8px;padding:8px 12px;font-size:12.5px;color:#DC2626;display:flex;align-items:center;gap:6px">⚠️ '+fail+' talaba qoniqarsiz baho olgan — nazorat tavsiya etiladi</div>':'<div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:8px 12px;font-size:12.5px;color:#16A34A;display:flex;align-items:center;gap:6px">✅ Guruh barqaror ko\'rsatkichda</div>')
    +'</div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

function exportReportCSV(){
  var groups=['AI-2301','CS-2301','IT-2301','DB-2301'];
  var csv='Guruh,Talabalar soni,Ort. ball,A\'lo (86+),Yaxshi (71-85),Qoniqarsiz (<56),GPA\n';
  groups.forEach(function(grp){
    var ss=STUDENTS_DATA.filter(function(s){return s.group===grp;});
    if(!ss.length) return;
    var avgs=ss.map(function(s){
      return GRADES_DATA.reduce(function(acc,g){
        var key=s.id+'_'+g.sub;var sv=SAVED_GRADES[key];
        return acc+(sv?sv.jn:g.jn)+(sv?sv.on:g.on)+(sv?sv.yn:g.yn)+(sv?sv.mi:g.mi);
      },0)/Math.max(GRADES_DATA.length,1);
    });
    var avg=(avgs.reduce(function(a,b){return a+b;},0)/avgs.length).toFixed(1);
    var alo=avgs.filter(function(a){return a>=86;}).length;
    var yax=avgs.filter(function(a){return a>=71&&a<86;}).length;
    var fail=avgs.filter(function(a){return a<56;}).length;
    var gpaAvg=(ss.reduce(function(a,s){return a+(parseFloat(s.gpa)||3);},0)/ss.length).toFixed(2);
    csv+='"'+grp+'",'+ss.length+','+avg+','+alo+','+yax+','+fail+','+gpaAvg+'\n';
  });
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='IDU_hisobot_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  showToast('📊','CSV export','Hisobot fayli yuklab olindi');
}

function printReport(){
  window.print();
  showToast('🖨️','Chop etish','Chop etish oynasi ochildi');
}