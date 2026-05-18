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
  var filters = {
    year: (document.getElementById('rptYearFilter')||{}).value || '',
    group: (document.getElementById('rptGroupFilter')||{}).value || '',
    semester: (document.getElementById('rptSemSelect')||{}).value || '2',
    academicYear: '2025-2026'
  };
  if(typeof StatsEngine !== 'undefined'){
    await StatsEngine.renderDekanatStats(filters);
  }
}

async function renderGroupDetailReport(){
  var el=document.getElementById('groupDetailReport');if(!el)return;
  var year = (document.getElementById('rptYearFilter')||{}).value||'';
  el.innerHTML = '<div style="padding:32px;text-align:center;color:#94A3B8">⏳ Yuklanmoqda...</div>';

  var students=[];
  try {
    var q = year ? '?year='+year+'&limit=500' : '?limit=500';
    var res = await api('GET', '/students'+q);
    students = Array.isArray(res) ? res : (res.data||res.students||res.rows||[]);
  } catch(e){ students=[]; }

  // group by group_name
  var grpMap={};
  students.forEach(function(s){
    var g=s.group_name||s.group||'Noma\'lum';
    if(!grpMap[g]) grpMap[g]=[];
    grpMap[g].push(s);
  });

  var groups = Object.keys(grpMap).sort();
  if(!groups.length){
    el.innerHTML='<div style="padding:32px;text-align:center;color:#94A3B8">Guruh ma\'lumoti topilmadi</div>';
    return;
  }

  var colors=['#1B4FD8','#7C3AED','#16A34A','#EA580C','#0891B2','#DB2777','#D97706','#0D9488'];
  var html='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">';
  groups.forEach(function(grp, gi){
    var ss=grpMap[grp];
    var gpaVals=ss.map(function(s){return parseFloat(s.gpa||0);}).filter(Boolean);
    var avgGpa=gpaVals.length?(gpaVals.reduce(function(a,v){return a+v;},0)/gpaVals.length).toFixed(2):3.00;
    var avgScore=Math.round(parseFloat(avgGpa)*25); // gpa 0-4 → 0-100 approx
    var alo=ss.filter(function(s){return parseFloat(s.gpa||0)>=3.5;}).length;
    var fail=ss.filter(function(s){return parseFloat(s.gpa||0)<2.0;}).length;
    var c=colors[gi%colors.length];
    html+='<div class="card" style="border-top:3px solid '+c+';padding:16px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
        +'<div style="font-size:16px;font-weight:800;color:'+c+'">'+grp+'</div>'
        +'<div style="background:'+c+'22;color:'+c+';padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700">'+ss.length+' talaba</div>'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">'
        +'<div style="background:#F8FAFC;border-radius:8px;padding:10px;text-align:center">'
          +'<div style="font-size:20px;font-weight:900;color:'+c+'">'+avgScore+'</div>'
          +'<div style="font-size:9px;color:#94A3B8;font-weight:600;margin-top:2px">ORT. BALL</div>'
        +'</div>'
        +'<div style="background:#F8FAFC;border-radius:8px;padding:10px;text-align:center">'
          +'<div style="font-size:20px;font-weight:900;color:#7C3AED">'+avgGpa+'</div>'
          +'<div style="font-size:9px;color:#94A3B8;font-weight:600;margin-top:2px">GPA</div>'
        +'</div>'
        +'<div style="background:#F8FAFC;border-radius:8px;padding:10px;text-align:center">'
          +'<div style="font-size:20px;font-weight:900;color:#16A34A">'+alo+'</div>'
          +'<div style="font-size:9px;color:#94A3B8;font-weight:600;margin-top:2px">A\'LOCHILAR</div>'
        +'</div>'
        +'<div style="background:#F8FAFC;border-radius:8px;padding:10px;text-align:center">'
          +'<div style="font-size:20px;font-weight:900;color:#DC2626">'+fail+'</div>'
          +'<div style="font-size:9px;color:#94A3B8;font-weight:600;margin-top:2px">XAVF GURUHI</div>'
        +'</div>'
      +'</div>'
      +(fail>0
        ?'<div style="background:#FFF5F5;border:1px solid #FCA5A5;border-radius:8px;padding:8px 12px;font-size:12px;color:#DC2626">⚠️ '+fail+' talaba — nazorat tavsiya etiladi</div>'
        :'<div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:8px 12px;font-size:12px;color:#16A34A">✅ Guruh barqaror ko\'rsatkichda</div>')
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