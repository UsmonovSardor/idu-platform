'use strict';
// IDU Platform — features/reports.js

function fillInvestor(l,p,c){
  document.getElementById('iLogin').value=l;
  document.getElementById('iPass').value=p;
  document.getElementById('iCompany').value=c;
}

function loginInvestor(){
  const l=document.getElementById('iLogin').value.trim();
  const p=document.getElementById('iPass').value.trim();
  const override = getEffectivePass('investor', l);
  const u=USERS.investor.find(x=>x.login===l&&(override?override===p:x.pass===p));
  if(!u){document.getElementById('investorError').classList.add('show');return;}
  document.getElementById('investorError').classList.remove('show');
  u.company = document.getElementById('iCompany').value || u.company;
  launchApp('investor', u);
}

function exportStudentGrades(){
  let csv="Fan nomi,O'qituvchi,JN/30,ON/20,YN/30,MI/20,Jami/100,Baho\n";
  GRADES_DATA.forEach(g=>{
    const t=g.jn+g.on+g.yn+g.mi;
    csv+='"'+g.sub+'","'+g.teacher+'",'+g.jn+','+g.on+','+g.yn+','+g.mi+','+t+',"'+getGrade(t).letter+'"\n';
  });
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='baholar.csv';a.click();
  showToast('ð¥','Excel','Yuklab olindi');
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
  showToast('ð¥','Excel','Yuklab olindi');
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
  showToast('ð¥','Excel','Yuklab olindi');
}

function exportAttendance(){
  showToast('ð¤','Export','Davomat hisoboti Excel formatida yuklanmoqda...');
}

function renderFullReport(){
  renderGradeDistribution();
  renderGroupAvgChart();
  renderSubjectAvgTable();
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
      +(fail>0?'<div style="background:#FFF5F5;border:1px solid #FCA5A5;border-radius:8px;padding:8px 12px;font-size:12.5px;color:#DC2626;display:flex;align-items:center;gap:6px">â ï¸ '+fail+' talaba qoniqarsiz baho olgan â nazorat tavsiya etiladi</div>':'<div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:8px 12px;font-size:12.5px;color:#16A34A;display:flex;align-items:center;gap:6px">â Guruh barqaror ko\'rsatkichda</div>')
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
  showToast('ð','CSV export','Hisobot fayli yuklab olindi');
}

function printReport(){
  window.print();
  showToast('ð¨ï¸','Chop etish','Chop etish oynasi ochildi');
}

function renderInvestorDashboard(){
  const el=document.getElementById('topIdeasList');if(!el)return;
  const top=[...IDEAS].sort((a,b)=>b.investorRating-a.investorRating).slice(0,3);
  el.innerHTML=top.map(idea=>`
    <div style="display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid #F8FAFC">
      <div style="font-size:24px">ð</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">${idea.title}</div>
        <div style="font-size:12px;color:var(--text2)">Jamoa: ${idea.team.slice(0,2).join(', ')}</div>
      </div>
      <div style="display:flex;gap:2px">${[1,2,3,4,5].map(n=>`<span style="color:${n<=idea.investorRating?'#F59E0B':'#E2E8F0'};font-size:16px">â</span>`).join('')}</div>
    </div>`).join('');
  const cn=document.getElementById('investorCompanyName');
  if(cn&&currentUser?.company)cn.textContent=currentUser.company;
}