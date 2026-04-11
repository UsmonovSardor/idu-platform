'use strict';
// IDU Platform — features/games.js

function showForgotPassword(role) {
  _fpRole = role; _fpUser = null; _fpOtp = null;
  document.getElementById('fpPhone').value = '';
  document.getElementById('fpOtpInput').value = '';
  document.getElementById('fpNewPass').value = '';
  document.getElementById('fpNewPass2').value = '';
  document.getElementById('fpError').style.display = 'none';
  document.getElementById('fpOtpError').style.display = 'none';
  document.getElementById('fpPassError').style.display = 'none';
  showFpStep1();
  document.getElementById('forgotModal').style.display = 'flex';
  document.getElementById('loginModalBg').classList.remove('open');
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

function expressInterest(id){
  const idea=IDEAS.find(i=>i.id===id);if(!idea)return;
  showToast('ð¼','Qiziqish bildirdi!',`${currentUser.company} â "${idea.title}" g'oyasiga qiziqish bildirdi`);
  const ic=document.getElementById('investorInterestedCount');if(ic)ic.textContent=parseInt(ic.textContent||'0')+1;
}

function addXP(amount, reason){
  playerXP += amount;
  const newLevel = Math.floor(playerXP / XP_PER_LEVEL) + 1;
  if(newLevel > playerLevel){
    playerLevel = newLevel;
    showToast('â¡','Daraja oshdi!',`Siz ${playerLevel}-darajaga ko'tarildingiz! ð`);
  }
  updateXPDisplays();
  if(reason) showToast('â¨','XP qo\'shildi',`+${amount} XP â ${reason}`);
}

function updateXPDisplays(){
  const xpInLevel = playerXP % XP_PER_LEVEL;
  const pct = (xpInLevel / XP_PER_LEVEL) * 100;
  const ln = LEVEL_NAMES[Math.min(playerLevel-1, LEVEL_NAMES.length-1)];
  // Sidebar
  const sl=document.getElementById('sidebarLevel');if(sl)sl.textContent=playerLevel;
  const sln=document.getElementById('sidebarLevelName');if(sln)sln.textContent=ln;
  const sxp=document.getElementById('sidebarXPBar');if(sxp)sxp.style.width=pct+'%';
  const sxpt=document.getElementById('sidebarXP');if(sxpt)sxpt.textContent=playerXP+' XP';
  const sc=document.getElementById('sidebarCoins');if(sc)sc.textContent='ðª '+playerCoins;
  // Game hub
  const gcd=document.getElementById('gameCoinsDisplay');if(gcd)gcd.textContent='ðª '+playerCoins;
  const gld=document.getElementById('gameLevelDisplay');if(gld)gld.textContent='â¡ Daraja '+playerLevel;
  // Gamification page
  const tcd=document.getElementById('totalCoinsDisplay');if(tcd)tcd.textContent='ðª '+playerCoins+' IDU Coin';
  const tld=document.getElementById('totalLevelDisplay');if(tld)tld.textContent='â¡ Daraja '+playerLevel;
  const blb=document.getElementById('bigLevelBadge');if(blb)blb.textContent=playerLevel;
  const xbf=document.getElementById('xpBarFill');if(xbf)xbf.style.width=pct+'%';
  const cxp=document.getElementById('currentXP');if(cxp)cxp.textContent=playerXP+' XP';
  const mxp=document.getElementById('maxXP');if(mxp)mxp.textContent=(Math.ceil(playerXP/XP_PER_LEVEL)*XP_PER_LEVEL)+' XP';
  const xtn=document.getElementById('xpToNext');if(xtn)xtn.textContent=XP_PER_LEVEL-xpInLevel;
  const txps=document.getElementById('totalXPStat');if(txps)txps.textContent=playerXP;
  const tcs=document.getElementById('totalCoinsStat');if(tcs)tcs.textContent=playerCoins;
  const gps=document.getElementById('gamesPlayedStat');if(gps)gps.textContent=gamesPlayed;
}

function forceSubmitGame(){
  if(gameActive) finishGame(true);
}

function startGame(type){
  currentGame = type;
  gameScore = 0; gameStreak = 0; gameQNum = 0;
  anticheatActive = true; warnCount = 0;
  const cfg = GAME_CONFIGS[type];
  document.getElementById('gameArena').style.display = 'block';
  document.getElementById('gameArena').scrollIntoView({behavior:'smooth'});
  document.getElementById('gameTitle').textContent = cfg.title;
  updateGameHeader(cfg.time);
  startGameTimer(cfg.time);
  gamesPlayed++;
  if(type==='math') renderMathQ();
  else if(type==='prog') renderProgQ();
  else if(type==='english') renderEnglishGame();
  else if(type==='physics') renderPhysicsGame();
  else if(type==='algo') renderAlgoGame();
  else if(type==='logic') renderLogicQ();
}

function exitGame(){
  clearInterval(gameTimerInt);
  anticheatActive = false;
  document.getElementById('gameArena').style.display = 'none';
  gameActive = false;
}

function startGameTimer(seconds){
  let t = seconds;
  clearInterval(gameTimerInt);
  gameActive = true;
  gameTimerInt = setInterval(()=>{
    t--;
    const el = document.getElementById('gameTimer');
    if(el){
      el.textContent = t;
      if(t<=10) el.classList.add('warn');
      else el.classList.remove('warn');
    }
    if(t<=0){clearInterval(gameTimerInt);finishGame(false);}
  },1000);
}

function updateGameHeader(maxT){
  const qs = document.getElementById('gameQ');
  const ss = document.getElementById('gameScore');
  const st = document.getElementById('gameStreak2');
  const cfg = GAME_CONFIGS[currentGame];
  if(qs) qs.textContent = `${gameQNum}/${cfg.questions}`;
  if(ss) ss.textContent = gameScore;
  if(st) st.textContent = gameStreak + 'ð¥';
}

function finishGame(forced){
  clearInterval(gameTimerInt);
  gameActive = false; anticheatActive = false;
  const cfg = GAME_CONFIGS[currentGame];
  const pct = Math.round(gameScore/(cfg.questions*10)*100);
  const coinsEarned = forced ? 0 : Math.round(cfg.coins * (pct/100));
  const xpEarned = forced ? 0 : Math.round(cfg.xp * (pct/100));
  if(!forced){addCoins(coinsEarned); addXP(xpEarned);}
  document.getElementById('gameContent').innerHTML = `
    <div style="text-align:center;padding:30px">
      <div style="font-size:60px;margin-bottom:16px">${pct>=80?'ð':pct>=50?'ð':'ð'}</div>
      <div style="font-size:48px;font-weight:900;font-family:'DM Mono',monospace;color:${pct>=80?'var(--green)':pct>=50?'var(--primary)':'var(--orange)'}">
        ${pct}%
      </div>
      <div style="font-size:16px;color:var(--text2);margin:8px 0 20px">
        ${gameScore} ball Â· ${gameQNum} savol to'g'ri${forced?' Â· â ï¸ Majburan tugatiladigan':''}
      </div>
      ${!forced?`<div style="display:flex;gap:16px;justify-content:center;margin-bottom:24px">
        <div style="text-align:center;padding:12px 20px;background:var(--purple-light);border-radius:var(--r2)">
          <div style="font-size:22px;font-weight:900;color:var(--purple)">+${xpEarned}</div>
          <div style="font-size:11px;color:var(--text2)">XP</div>
        </div>
        <div style="text-align:center;padding:12px 20px;background:var(--orange-light);border-radius:var(--r2)">
          <div style="font-size:22px;font-weight:900;color:var(--orange)">+${coinsEarned}</div>
          <div style="font-size:11px;color:var(--text2)">IDU Coin ðª</div>
        </div>
      </div>`:''}
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn btn-secondary" onclick="exitGame()">â Orqaga</button>
        <button class="btn btn-primary" onclick="startGame('${currentGame}')">ð Qayta o'ynash</button>
      </div>
    </div>`;
}

function renderMathQ(){
  const q = MATH_QUESTIONS[mathIdx % MATH_QUESTIONS.length];
  currentGameData = q;
  document.getElementById('gameContent').innerHTML = `
    <div class="math-question">
      <div class="math-expr">${q.expr}</div>
    </div>
    <div class="math-options">
      ${q.opts.map((o,i)=>`<div class="math-opt" onclick="checkMathOpt(this,'${o}','${q.answer}')">${o}</div>`).join('')}
    </div>
    <div class="math-feedback" id="mathFeedback"></div>`;
}

function checkMathOpt(el, chosen, correct){
  const opts = document.querySelectorAll('.math-opt');
  opts.forEach(o=>{o.classList.add('locked');if(o.textContent==correct)o.classList.add('correct');});
  const fb = document.getElementById('mathFeedback');
  if(String(chosen)===String(correct)){
    el.classList.add('correct');
    if(fb){fb.textContent='â To\'g\'ri! +10 ball';fb.style.color='var(--green)';}
    onCorrect(10);
    mathIdx++;
    setTimeout(()=>renderMathQ(),800);
  } else {
    el.classList.add('wrong');
    if(fb){fb.textContent='â Noto\'g\'ri! To\'g\'ri javob: '+correct;fb.style.color='var(--red)';}
    onWrong();
    setTimeout(()=>{mathIdx++;renderMathQ();},1200);
  }
}

function renderEnglishGame(){
  engMatched.clear(); engSelected = {left:null,right:null};
  engPairs = [...ENGLISH_PAIRS].sort(()=>Math.random()-0.5).slice(0,6);
  const rightShuffled = [...engPairs].sort(()=>Math.random()-0.5);
  document.getElementById('gameContent').innerHTML = `
    <div style="margin-bottom:12px;font-size:13px;color:var(--text2)">ð Inglizcha va O'zbekcha so'zlarni moslashtiring:</div>
    <div class="word-grid">
      <div class="word-col">
        ${engPairs.map((p,i)=>`<div class="word-card" id="wl${i}" onclick="selectWordCard('left',${i},'${p[0]}')">${p[0]}</div>`).join('')}
      </div>
      <div class="word-col">
        ${rightShuffled.map((p,i)=>`<div class="word-card" id="wr${i}" onclick="selectWordCard('right',${i},'${p[1]}','${p[0]}')" data-pair="${p[0]}">${p[1]}</div>`).join('')}
      </div>
    </div>
    <div id="engFeedback" style="text-align:center;font-size:14px;font-weight:700;min-height:28px;margin-top:12px"></div>`;
}

function selectWordCard(side, idx, val, pairKey){
  if(engSelected[side]!==null) return;
  const el = document.getElementById((side==='left'?'wl':'wr')+idx);
  if(el.classList.contains('matched'))return;
  el.classList.add('selected');
  engSelected[side] = {idx, val, pairKey, el};
  if(engSelected.left && engSelected.right){
    const lval = engSelected.left.val;
    const rkey = engSelected.right.pairKey;
    const match = engPairs.find(p=>p[0]===lval && p[0]===rkey);
    if(match){
      engSelected.left.el.classList.remove('selected');
      engSelected.right.el.classList.remove('selected');
      engSelected.left.el.classList.add('matched');
      engSelected.right.el.classList.add('matched');
      engMatched.add(lval);
      document.getElementById('engFeedback').textContent='â To\'g\'ri juftlik!';
      document.getElementById('engFeedback').style.color='var(--green)';
      onCorrect(10);
      if(engMatched.size>=engPairs.length){
        setTimeout(()=>finishGame(false),500);
      }
    } else {
      engSelected.left.el.classList.remove('selected');
      engSelected.right.el.classList.remove('selected');
      engSelected.left.el.classList.add('wrong-sel');
      engSelected.right.el.classList.add('wrong-sel');
      document.getElementById('engFeedback').textContent='â Noto\'g\'ri, qayta urinib ko\'ring!';
      document.getElementById('engFeedback').style.color='var(--red)';
      onWrong();
      setTimeout(()=>{
        engSelected.left.el.classList.remove('wrong-sel');
        engSelected.right.el.classList.remove('wrong-sel');
      },600);
    }
    engSelected = {left:null,right:null};
  }
}

function renderPhysicsGame(){
  physMatched.clear(); physSelected = null;
  const shuffled = [...PHYSICS_FORMULAS].sort(()=>Math.random()-0.5).slice(0,5);
  const namesShuffled = [...shuffled].sort(()=>Math.random()-0.5);
  document.getElementById('gameContent').innerHTML = `
    <div style="margin-bottom:12px;font-size:13px;color:var(--text2)">âï¸ Formulalarni ularning nomlari bilan moslashtiring:</div>
    <div class="grid-2">
      <div id="physFormulas">${shuffled.map((f,i)=>`
        <div class="formula-card" id="pf${i}" onclick="selectFormula(${i},'${f.expr}')">
          <div class="formula-expr">${f.expr}</div>
        </div>`).join('')}</div>
      <div id="physNames">${namesShuffled.map((f,i)=>`
        <div class="formula-card" id="pn${i}" onclick="matchFormula(${i},'${f.expr}','${f.name}')" data-expr="${f.expr}" style="background:linear-gradient(135deg,#EDE9FE,#F5F3FF);border-color:#C4B5FD">
          <div style="font-size:14px;font-weight:700;color:var(--purple)">${f.name}</div>
        </div>`).join('')}</div>
    </div>
    <div id="physFeedback" style="text-align:center;font-size:14px;font-weight:700;min-height:28px;margin-top:10px"></div>`;
}

function renderAlgoGame(){
  sortArr = Array.from({length:6},()=>Math.floor(Math.random()*80+10));
  sortStep = 0;
  renderSortBars();
  document.getElementById('gameContent').innerHTML = `
    <div style="margin-bottom:12px;font-size:13px;color:var(--text2)">ð Massivni kichikdan kattaga tartiblay: ikkita ustunni bosib ularni almashtiring!</div>
    <div class="sort-arena"><div class="sort-bars" id="sortBars"></div></div>
    <div class="sort-controls" style="margin-bottom:14px">
      <button class="sort-btn sb-check" onclick="checkSorted()">â Tekshir</button>
      <button class="sort-btn" style="background:var(--bg);border-color:var(--border);color:var(--text2)" onclick="renderAlgoGame()">ð Yangi</button>
    </div>
    <div id="algoFeedback" style="text-align:center;font-size:14px;font-weight:700;min-height:28px"></div>`;
  setTimeout(()=>renderSortBars(),10);
}

function renderGameHub(){
  updateXPDisplays();
  startDailyChallenge();
}

function setPomoMode(mins, label, el){
  document.querySelectorAll('.pomo-mode-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  pomoDuration = mins*60;
  pomoRemaining = pomoDuration;
  clearInterval(pomoInterval);
  pomoRunning = false;
  document.getElementById('pomoStartBtn').textContent = 'â¶ Boshlash';
  document.getElementById('pomoLabel').textContent = label.toUpperCase();
  updatePomoDisplay();
}

function togglePomo(){
  if(pomoRunning){
    clearInterval(pomoInterval);
    pomoRunning = false;
    document.getElementById('pomoStartBtn').textContent = 'â¶ Davom ettirish';
  } else {
    pomoRunning = true;
    document.getElementById('pomoStartBtn').textContent = 'â¸ Pauza';
    pomoInterval = setInterval(()=>{
      pomoRemaining--;
      updatePomoDisplay();
      if(pomoRemaining<=0){
        clearInterval(pomoInterval);
        pomoRunning=false;
        pomoTodaySessions++;
        if(pomoTodaySessions<=4){
          const pd=document.getElementById('pd'+(pomoTodaySessions-1));
          if(pd)pd.classList.add('done');
        }
        document.getElementById('pomoTodaySessions').textContent=pomoTodaySessions;
        pomoRemaining=pomoDuration;
        document.getElementById('pomoStartBtn').textContent='â¶ Boshlash';
        showToast('ð','Sessiya tugadi!',`Pomodoro #${pomoTodaySessions} yakunlandi! +20 XP`);
        addXP(20,'Pomodoro sessiyasi');
        addCoins(10);
        updateStreak();
      }
    },1000);
  }
}

function resetPomo(){
  clearInterval(pomoInterval);
  pomoRunning=false;
  pomoRemaining=pomoDuration;
  document.getElementById('pomoStartBtn').textContent='â¶ Boshlash';
  updatePomoDisplay();
}

function updatePomoDisplay(){
  const m=Math.floor(pomoRemaining/60);
  const s=pomoRemaining%60;
  const el=document.getElementById('pomoTime');
  if(el)el.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  // Update circle
  const pct=(pomoRemaining/pomoDuration)*360;
  const circle=document.getElementById('pomoCircle');
  if(circle)circle.style.background=`conic-gradient(var(--primary) ${360-pct}deg, var(--bg2) ${360-pct}deg)`;
}

function renderGamification(){
  updateXPDisplays();
  renderAchievements();
  renderLB('xp');
  renderRewardShop();
}

function renderRewardShop(){
  const el=document.getElementById('rewardShop');if(!el)return;
  el.innerHTML=REWARDS.map(r=>`
    <div class="reward-item">
      <div class="reward-emoji">${r.emoji}</div>
      <div class="reward-name">${r.name}</div>
      <div class="reward-cost">ðª ${r.cost}</div>
      <button class="btn btn-sm" style="margin-top:8px;width:100%;background:${playerCoins>=r.cost?'var(--primary)':'var(--bg2)'};color:${playerCoins>=r.cost?'white':'var(--text3)'};" onclick="buyReward('${r.name}',${r.cost})">${playerCoins>=r.cost?'Sotib olish':'Koin yetarli emas'}</button>
    </div>`).join('');
}

function buyReward(name,cost){
  if(playerCoins<cost){showToast('â','Koin yetarli emas',`Kerak: ${cost} IDU Coin`);return;}
  playerCoins-=cost;
  updateXPDisplays();
  renderRewardShop();
  showToast('ð','Sotib olindi!',`"${name}" muvaffaqiyatli sotib olindi!`);
}