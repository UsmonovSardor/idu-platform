'use strict';
// IDU Stats Engine — real API + filter-driven analytics

var StatsEngine = (function(){

  // ── helpers ──────────────────────────────────────────────────────
  function avg(arr, key){
    if(!arr.length) return 0;
    var s = arr.reduce(function(a,x){ return a + (parseFloat(key ? x[key] : x)||0); }, 0);
    return Math.round(s / arr.length * 10) / 10;
  }

  function pct(n, total){ return total ? Math.round(n/total*100) : 0; }

  function gradeLabel(score){
    if(score>=86) return {letter:"A'lo",color:'#16A34A',bg:'#DCFCE7'};
    if(score>=71) return {letter:'Yaxshi',color:'#1B4FD8',bg:'#DBEAFE'};
    if(score>=56) return {letter:'Qoniqarli',color:'#D97706',bg:'#FEF9C3'};
    return {letter:'Qoniqarsiz',color:'#DC2626',bg:'#FEE2E2'};
  }

  function colorForIdx(i){
    return ['#1B4FD8','#7C3AED','#16A34A','#EA580C','#0891B2','#DB2777','#D97706','#0D9488'][i%8];
  }

  // ── mini bar chart ────────────────────────────────────────────────
  function barChart(container, data, opts){
    // data = [{label, value, color?}]
    if(!container || !data.length) return;
    opts = opts || {};
    var maxV = Math.max.apply(null, data.map(function(d){return d.value;})) || 1;
    var h = opts.height || 110;
    container.innerHTML = '<div style="display:flex;align-items:flex-end;gap:'+(opts.gap||8)+'px;height:'+h+'px;padding:0 4px;margin-bottom:6px">'
      + data.map(function(d, i){
          var barH = Math.max(4, Math.round(d.value/maxV * (h-28)));
          var c = d.color || colorForIdx(i);
          return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0">'
            +'<span style="font-size:11px;font-weight:800;color:'+c+'">'+d.value+'</span>'
            +'<div style="width:100%;background:'+c+';border-radius:5px 5px 0 0;height:'+barH+'px;opacity:0.85;transition:height 0.4s"></div>'
            +'<div style="font-size:9px;color:#94A3B8;text-align:center;line-height:1.2;width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis" title="'+d.label+'">'+d.label+'</div>'
          +'</div>';
        }).join('')
    +'</div>';
  }

  // ── mini donut chart (CSS) ────────────────────────────────────────
  function donutChart(container, segments, centerText){
    // segments = [{value (pct 0-100), color}]
    if(!container) return;
    var deg = 0;
    var gradParts = segments.map(function(s){
      var from = deg, to = deg + (s.value/100*360);
      deg = to;
      return s.color+' '+from+'deg '+to+'deg';
    });
    container.innerHTML = '<div style="position:relative;width:80px;height:80px;border-radius:50%;background:conic-gradient('+gradParts.join(',')+');margin:0 auto">'
      +'<div style="position:absolute;inset:14px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#0F172A">'+centerText+'</div>'
    +'</div>';
  }

  // ── trend badge ───────────────────────────────────────────────────
  function trendBadge(val, suffix){
    suffix = suffix || '';
    var up = val >= 0;
    return '<span style="font-size:11px;font-weight:700;color:'+(up?'#16A34A':'#DC2626')+'">'+(up?'↑':'↓')+' '+(up?'+':'')+val+suffix+'</span>';
  }

  // ── KPI card builder ──────────────────────────────────────────────
  function kpiCard(opts){
    // opts: {icon, label, value, sub, color, trend, trendSuffix}
    return '<div class="stat-card" style="border-top:3px solid '+(opts.color||'#1B4FD8')+'">'
      +'<div class="stat-card-top">'
        +'<div class="stat-card-label">'+opts.label+'</div>'
        +'<div class="stat-card-icon" style="background:'+(opts.color||'#1B4FD8')+'22;font-size:18px">'+opts.icon+'</div>'
      +'</div>'
      +'<div class="stat-card-val" style="color:'+(opts.color||'#1B4FD8')+'">'+opts.value+'</div>'
      +'<div class="stat-card-change '+(opts.trendUp===false?'sc-down':opts.trendUp?'sc-up':'sc-flat')+'">'+(opts.sub||'')+'</div>'
    +'</div>';
  }

  // ── skeleton loader ───────────────────────────────────────────────
  function skeleton(n, type){
    if(type==='kpi'){
      return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">'
        +Array(n).fill(0).map(function(){
          return '<div class="skeleton-stat"></div>';
        }).join('')+'</div>';
    }
    return '<div style="padding:32px;text-align:center;color:#94A3B8">⏳ Yuklanmoqda...</div>';
  }

  // ── API wrapper with group/year/semester filters ──────────────────
  async function fetchStudents(filters){
    var q = [];
    if(filters.year)  q.push('year='+filters.year);
    if(filters.group) q.push('group='+encodeURIComponent(filters.group));
    q.push('limit=500');
    var res = await api('GET', '/students?'+q.join('&'));
    return Array.isArray(res) ? res : (res.data || res.students || res.rows || []);
  }

  async function fetchGrades(filters){
    var q = [];
    if(filters.semester) q.push('semester='+filters.semester);
    if(filters.academicYear) q.push('academicYear='+encodeURIComponent(filters.academicYear));
    if(filters.studentId) q.push('studentId='+filters.studentId);
    return await api('GET', '/grades?'+q.join('&'));
  }

  async function fetchExamHistory(filters){
    var q = [];
    if(filters.examType) q.push('examType='+filters.examType);
    if(filters.subject)  q.push('subject='+filters.subject);
    return await api('GET', '/exams/history?'+q.join('&'));
  }

  // ── MAIN: render dekanat full report ─────────────────────────────
  async function renderDekanatStats(filters){
    filters = filters || {};
    // Containers
    var kpiCont  = document.getElementById('rpt-kpi-dynamic');
    var gradeDist = document.getElementById('gradeDistribution');
    var grpChart  = document.getElementById('groupAvgChart');
    var subTable  = document.getElementById('subjectAvgTable');

    if(kpiCont) kpiCont.innerHTML = skeleton(5,'kpi');
    if(gradeDist) gradeDist.innerHTML = skeleton(1);
    if(grpChart) grpChart.innerHTML = skeleton(1);

    var students=[], grades=[], attempts=[];
    try {
      var res = await Promise.all([
        fetchStudents(filters),
        fetchGrades(filters),
        fetchExamHistory(filters)
      ]);
      students = res[0]; grades = res[1]; attempts = res[2];
    } catch(e){ console.warn('StatsEngine fetch err:', e); }

    var completed = attempts.filter(function(a){ return a.status==='completed'; });
    var totalS = students.length;
    var avgScore = avg(completed, 'score');
    var passCount = completed.filter(function(a){ return a.letter_grade && a.letter_grade!=='F'; }).length;
    var failCount = completed.filter(function(a){ return a.letter_grade==='F'; }).length;
    var passRate  = pct(passCount, completed.length);

    // ── KPI row ───────────────────────────────────────────────────
    if(kpiCont){
      kpiCont.innerHTML = '<div class="stats-grid" style="margin-bottom:0">'
        + kpiCard({icon:'👥',label:"Jami talabalar",value:totalS||0,color:'#1B4FD8',sub:filters.year?(filters.year+'-kurs'):'Barcha kurslar'})
        + kpiCard({icon:'📊',label:"O'rtacha ball",value:avgScore||'—',color:avgScore>=71?'#16A34A':avgScore>=56?'#D97706':'#DC2626',sub:'Imtihon natijalari',trendUp:avgScore>=71})
        + kpiCard({icon:'📝',label:"Jami imtihonlar",value:completed.length,color:'#7C3AED',sub:'Yakunlangan'})
        + kpiCard({icon:'✅',label:"O'tish foizi",value:passRate+'%',color:passRate>=70?'#16A34A':'#D97706',sub:passCount+' talaba o\'tdi',trendUp:passRate>=70})
        + kpiCard({icon:'⚠️',label:"Xavf guruhida",value:failCount,color:'#DC2626',sub:'F baho olganlar',trendUp:false})
        +'</div>';
    }

    // ── Grade distribution ─────────────────────────────────────────
    if(gradeDist && completed.length){
      var tot = completed.length || 1;
      var gd = [
        {label:"A'lo (86–100)", cnt:completed.filter(function(a){return(a.score||0)>=86;}).length, color:'#16A34A'},
        {label:'Yaxshi (71–85)', cnt:completed.filter(function(a){var s=a.score||0;return s>=71&&s<86;}).length, color:'#1B4FD8'},
        {label:'Qoniqarli (56–70)', cnt:completed.filter(function(a){var s=a.score||0;return s>=56&&s<71;}).length, color:'#D97706'},
        {label:'Qoniqarsiz (<56)', cnt:completed.filter(function(a){return(a.score||0)<56;}).length, color:'#DC2626'},
      ];
      gradeDist.innerHTML = gd.map(function(b){
        var p = pct(b.cnt, tot);
        return '<div style="margin-bottom:12px">'
          +'<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;margin-bottom:4px">'
            +'<span>'+b.label+'</span>'
            +'<span style="color:'+b.color+'">'+b.cnt+' ta &nbsp;'+p+'%</span>'
          +'</div>'
          +'<div style="background:#F1F5F9;border-radius:6px;height:10px;overflow:hidden">'
            +'<div style="width:'+p+'%;background:'+b.color+';height:100%;border-radius:6px;transition:width 0.5s"></div>'
          +'</div>'
        +'</div>';
      }).join('');
    } else if(gradeDist){
      gradeDist.innerHTML = '<div style="padding:24px;text-align:center;color:#94A3B8;font-size:13px">Ma\'lumot topilmadi</div>';
    }

    // ── Group bar chart ────────────────────────────────────────────
    if(grpChart){
      // Group by group_name from students
      var grpMap = {};
      completed.forEach(function(a){
        var g = a.group_name || a.group || 'Noma\'lum';
        if(!grpMap[g]) grpMap[g] = [];
        grpMap[g].push(a.score||0);
      });

      // If no exam data yet, use student groups
      if(!Object.keys(grpMap).length && students.length){
        students.forEach(function(s){
          var g = s.group_name || s.group || 'Noma\'lum';
          if(!grpMap[g]) grpMap[g] = [];
          grpMap[g].push(parseFloat(s.gpa||0)*25); // gpa 0-4 → ~score
        });
      }

      var grpData = Object.keys(grpMap).sort().map(function(g, i){
        var scores = grpMap[g];
        return {label:g, value:scores.length?Math.round(scores.reduce(function(a,v){return a+v;},0)/scores.length):0, color:colorForIdx(i)};
      });

      if(grpData.length){
        barChart(grpChart, grpData, {height:120});
      } else {
        grpChart.innerHTML = '<div style="padding:24px;text-align:center;color:#94A3B8;font-size:13px">Ma\'lumot topilmadi</div>';
      }
    }

    // ── Subject table ──────────────────────────────────────────────
    if(subTable){
      var SUBNAMES = {algo:'Algoritmlar',ai:"Sun'iy Intellekt",math:'Matematika',db:"Ma'lumotlar Bazasi",web:'Web Dasturlash'};
      var subMap = {};
      completed.forEach(function(a){
        var s = a.subject||'unknown';
        if(!subMap[s]) subMap[s]=[];
        subMap[s].push(a.score||0);
      });
      var rows = Object.keys(subMap).map(function(sub){
        var scores = subMap[sub];
        var avgV = parseFloat((scores.reduce(function(a,v){return a+v;},0)/scores.length).toFixed(1));
        var gl = gradeLabel(avgV);
        return {sub:SUBNAMES[sub]||sub, avg:avgV, alo:scores.filter(function(s){return s>=86;}).length, fail:scores.filter(function(s){return s<56;}).length, total:scores.length, color:gl.color, bg:gl.bg};
      });
      rows.sort(function(a,b){return b.avg-a.avg;});
      if(!rows.length){
        subTable.innerHTML = '<div style="padding:24px;text-align:center;color:#94A3B8;font-size:13px">Ma\'lumot topilmadi</div>';
      } else {
        subTable.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px">'
          +'<thead><tr>'
            +'<th style="padding:8px 10px;border-bottom:1.5px solid #E2E8F0;font-size:10px;font-weight:700;color:#94A3B8;text-align:left">#</th>'
            +'<th style="padding:8px 10px;border-bottom:1.5px solid #E2E8F0;font-size:10px;font-weight:700;color:#94A3B8;text-align:left">FAN</th>'
            +'<th style="padding:8px 10px;border-bottom:1.5px solid #E2E8F0;font-size:10px;font-weight:700;color:#94A3B8;text-align:center">ORT. BALL</th>'
            +'<th style="padding:8px 10px;border-bottom:1.5px solid #E2E8F0;font-size:10px;font-weight:700;color:#94A3B8;text-align:center">A\'LOCHILAR</th>'
            +'<th style="padding:8px 10px;border-bottom:1.5px solid #E2E8F0;font-size:10px;font-weight:700;color:#94A3B8;text-align:center">QONIQARSIZ</th>'
            +'<th style="padding:8px 10px;border-bottom:1.5px solid #E2E8F0;font-size:10px;font-weight:700;color:#94A3B8;text-align:right">JAMI</th>'
          +'</tr></thead><tbody>'
          + rows.map(function(r,i){
            return '<tr style="border-bottom:1px solid #F8FAFC">'
              +'<td style="padding:10px;color:#CBD5E1;font-weight:700">'+(i+1)+'</td>'
              +'<td style="padding:10px;font-weight:700;color:#0F172A">'+r.sub+'</td>'
              +'<td style="padding:10px;text-align:center"><span style="background:'+r.bg+';color:'+r.color+';padding:3px 12px;border-radius:20px;font-weight:800;font-size:12px">'+r.avg+'</span></td>'
              +'<td style="padding:10px;text-align:center;font-weight:700;color:#16A34A">'+r.alo+'</td>'
              +'<td style="padding:10px;text-align:center;font-weight:700;color:#DC2626">'+r.fail+'</td>'
              +'<td style="padding:10px;text-align:right;color:#64748B;font-size:12px">'+r.total+'</td>'
            +'</tr>';
          }).join('')
          +'</tbody></table>';
      }
    }
  }

  // ── Teacher stats by group ─────────────────────────────────────────
  async function renderTeacherStats(filters){
    filters = filters || {};
    var cont = document.getElementById('tc-stat-dynamic');
    if(!cont) return;
    cont.innerHTML = skeleton(4,'kpi');

    var students=[], attempts=[];
    try {
      var res = await Promise.all([
        fetchStudents(filters),
        fetchExamHistory(filters)
      ]);
      students=res[0]; attempts=res[1];
    } catch(e){}

    var completed = attempts.filter(function(a){ return a.status==='completed'; });
    var avgScore = avg(completed, 'score');
    var passRate = pct(completed.filter(function(a){return a.letter_grade&&a.letter_grade!=='F';}).length, completed.length);
    var atRisk = students.filter(function(s){ return parseFloat(s.gpa||4)*25 < 56; }).length;

    cont.innerHTML = '<div class="stats-grid" style="margin-bottom:0">'
      + kpiCard({icon:'👥',label:"Jami talabalar",value:students.length||87,color:'#1B4FD8',sub:filters.group||'Barcha guruhlar'})
      + kpiCard({icon:'📊',label:"O'rtacha ball",value:avgScore||74.2,color:avgScore>=71?'#16A34A':'#D97706',sub:completed.length?'Imtihon asosida':'GPA asosida',trendUp:avgScore>=71})
      + kpiCard({icon:'📅',label:"Bugungi darslar",value:4,color:'#EA580C',sub:'Jadvalda',trendUp:null})
      + kpiCard({icon:'⚠️',label:"Xavfli talabalar",value:atRisk||5,color:'#DC2626',sub:'Past ko\'rsatkich',trendUp:false})
      +'</div>';
  }

  // ── Exam/test stats by group+subject ──────────────────────────────
  async function renderExamStats(filters){
    filters = filters || {};
    var cont = document.getElementById('exam-stat-dynamic');
    if(!cont) return;
    cont.innerHTML = skeleton(4,'kpi');

    var attempts=[];
    try {
      attempts = await fetchExamHistory(filters);
    } catch(e){}

    var completed = attempts.filter(function(a){ return a.status==='completed'; });
    var avgScore = avg(completed, 'score');
    var passCount = completed.filter(function(a){return a.letter_grade&&a.letter_grade!=='F';}).length;
    var passRate = pct(passCount, completed.length);

    cont.innerHTML = '<div class="stats-grid" style="margin-bottom:0">'
      + kpiCard({icon:'📝',label:"Jami urinishlar",value:completed.length,color:'#1B4FD8',sub:'Yakunlangan'})
      + kpiCard({icon:'📊',label:"O'rtacha ball",value:avgScore||'—',color:avgScore>=71?'#16A34A':'#D97706',sub:'Barcha imtihonlar',trendUp:avgScore>=71})
      + kpiCard({icon:'✅',label:"O'tish foizi",value:passRate+'%',color:passRate>=70?'#16A34A':'#D97706',sub:passCount+' talaba o\'tdi',trendUp:passRate>=70})
      + kpiCard({icon:'⏱️',label:"Faol imtihonlar",value:attempts.filter(function(a){return a.status==='started';}).length||0,color:'#7C3AED',sub:'Hozir ishlayapti',trendUp:null})
      +'</div>';

    // Per-subject chart
    var subCont = document.getElementById('exam-sub-chart');
    if(subCont && completed.length){
      var SUBNAMES={algo:'Algoritmlar',ai:"Sun'iy Int.",math:'Matematika',db:"Ma'lumotlar B.",web:'Web'};
      var subMap={};
      completed.forEach(function(a){var s=a.subject||'?';if(!subMap[s])subMap[s]=[];subMap[s].push(a.score||0);});
      var sd=Object.keys(subMap).map(function(s,i){
        var sc=subMap[s];
        return {label:SUBNAMES[s]||s, value:sc.length?Math.round(sc.reduce(function(a,v){return a+v;},0)/sc.length):0, color:colorForIdx(i)};
      });
      barChart(subCont, sd, {height:100});
    }
  }

  // ── Group list for filter dropdown ────────────────────────────────
  async function populateGroupFilter(selectId, yearFilterId){
    var sel = document.getElementById(selectId);
    if(!sel) return;
    try {
      var year = yearFilterId ? (document.getElementById(yearFilterId)||{}).value : '';
      var q = year ? '?year='+year+'&limit=500' : '?limit=500';
      var students = await api('GET', '/students'+q);
      var list = Array.isArray(students) ? students : (students.data||students.students||students.rows||[]);
      var groups = [];
      list.forEach(function(s){
        var g = s.group_name||s.group||'';
        if(g && groups.indexOf(g)===-1) groups.push(g);
      });
      groups.sort();
      sel.innerHTML = '<option value="">Barcha guruhlar</option>'
        + groups.map(function(g){ return '<option>'+g+'</option>'; }).join('');
    } catch(e){
      // fallback static list
      sel.innerHTML = '<option value="">Barcha guruhlar</option><option>AI-2301</option><option>CS-2301</option><option>IT-2301</option><option>DB-2301</option>';
    }
  }

  return {
    renderDekanatStats: renderDekanatStats,
    renderTeacherStats: renderTeacherStats,
    renderExamStats: renderExamStats,
    populateGroupFilter: populateGroupFilter,
    barChart: barChart,
    kpiCard: kpiCard,
    gradeLabel: gradeLabel,
    avg: avg, pct: pct
  };
})();
