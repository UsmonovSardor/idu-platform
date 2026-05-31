'use strict';
// IDU — Engagement & Learning module
// Streak sync · Daily challenge · Spaced-repetition review · Bilim daraxti (mastery) · Weekly leaderboard

// ── 1. STREAK SYNC ────────────────────────────────────────────────────────────
// Pulls real streak from backend, mirrors into localStorage so the existing
// dashboard streak widget (_renderDashStreakRow) shows server-tracked values.
async function syncStreak() {
  try {
    var s = await api('GET', '/gamification/streak');
    if (s && typeof s.current !== 'undefined') {
      try {
        localStorage.setItem('idu_streak', String(s.current || 0));
        localStorage.setItem('idu_streak_record', String(s.longest || 0));
        // record today in history
        var hist = JSON.parse(localStorage.getItem('idu_streak_history') || '[]');
        var today = new Date().toISOString().slice(0, 10);
        if (hist.indexOf(today) < 0) { hist.push(today); localStorage.setItem('idu_streak_history', JSON.stringify(hist)); }
      } catch (e) {}
      if (typeof _renderDashStreakRow === 'function') _renderDashStreakRow();
    }
  } catch (e) { /* silent */ }
}

// ── 2. DAILY CHALLENGE ────────────────────────────────────────────────────────
var _dailyData = null;

async function renderDailyChallenge() {
  var el = document.getElementById('dailyChallengeCard');
  if (!el) return;
  try {
    _dailyData = await api('GET', '/gamification/daily');
    var d = _dailyData;
    var pct = d.total ? Math.round(100 * d.answered / d.total) : 0;
    var done = d.completed;
    var btn = done
      ? '<div style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);color:#34d399;border-radius:12px;padding:10px 16px;font-weight:700;text-align:center">✅ Bugun bajarildi · +' + (d.xp_earned||0) + ' XP</div>'
      : '<button onclick="openDailyChallenge()" class="btn btn-primary" style="width:100%">▶️ ' + (d.answered > 0 ? 'Davom etish' : 'Boshlash') + ' (' + d.answered + '/' + d.total + ')</button>';
    el.innerHTML =
      '<div class="dc-card">' +
        '<div class="dc-head">' +
          '<div class="dc-ico">🎯</div>' +
          '<div style="flex:1">' +
            '<div class="dc-title">Kunlik challenge</div>' +
            '<div class="dc-sub">' + d.total + ' ta savol · har kuni yangi · XP yutib oling</div>' +
          '</div>' +
          '<div class="dc-xp">+' + (d.total * 10) + ' XP</div>' +
        '</div>' +
        '<div class="dc-bar"><div class="dc-bar-fill" style="width:' + pct + '%"></div></div>' +
        btn +
      '</div>';
  } catch (e) {
    el.innerHTML = '<div class="dc-card"><div style="color:var(--text3);font-size:13px;padding:8px">Kunlik challenge yuklanmadi</div></div>';
  }
}

function _engModal(html) {
  var m = document.getElementById('engModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'engModal';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(7,21,36,0.78);backdrop-filter:blur(6px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px';
    m.onclick = function (e) { if (e.target === m) m.remove(); };
    document.body.appendChild(m);
  }
  m.innerHTML = '<div class="eng-modal-box">' + html + '</div>';
  return m;
}
function _closeEngModal() { var m = document.getElementById('engModal'); if (m) m.remove(); }

var _quizState = null; // { mode:'daily'|'review', questions:[], idx, correct }

function openDailyChallenge() {
  if (!_dailyData || !_dailyData.questions) return;
  _quizState = { mode: 'daily', questions: _dailyData.questions.slice(_dailyData.answered), idx: 0, correct: 0 };
  _renderQuizCard();
}

async function openReviewSession() {
  try {
    var r = await api('GET', '/gamification/review');
    if (!r.questions || !r.questions.length) {
      showToast('✅', 'Takrorlash', 'Bugun takrorlash uchun savol yo\'q. Zo\'r!');
      return;
    }
    _quizState = { mode: 'review', questions: r.questions, idx: 0, correct: 0 };
    _renderQuizCard();
  } catch (e) { showToast('❌', 'Xato', 'Takrorlash yuklanmadi'); }
}

function _renderQuizCard() {
  var st = _quizState;
  if (!st) return;
  if (st.idx >= st.questions.length) return _renderQuizDone();
  var q = st.questions[st.idx];
  var opts = [['A', q.option_a], ['B', q.option_b], ['C', q.option_c], ['D', q.option_d]];
  var title = st.mode === 'daily' ? '🎯 Kunlik challenge' : '🔁 Takrorlash';
  var html =
    '<div class="eq-head"><span>' + title + '</span>' +
      '<button onclick="_closeEngModal()" class="eq-x">✕</button></div>' +
    '<div class="eq-prog">Savol ' + (st.idx + 1) + ' / ' + st.questions.length + '</div>' +
    '<div class="eq-question">' + _esc(q.question_text) + '</div>' +
    '<div class="eq-opts" id="eqOpts">' +
      opts.map(function (o) {
        return '<button class="eq-opt" data-k="' + o[0] + '" onclick="_quizAnswer(\'' + o[0] + '\')">' +
          '<span class="eq-opt-k">' + o[0] + '</span><span>' + _esc(o[1]) + '</span></button>';
      }).join('') +
    '</div>' +
    '<div id="eqFeedback"></div>';
  _engModal(html);
}

function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

var _quizLock = false;
async function _quizAnswer(choice) {
  if (_quizLock) return;
  _quizLock = true;
  var st = _quizState;
  var q = st.questions[st.idx];
  var path = st.mode === 'daily' ? '/gamification/daily/answer' : '/gamification/review/answer';
  try {
    var r = await api('POST', path, { question_id: q.id, choice: choice });
    var opts = document.querySelectorAll('#eqOpts .eq-opt');
    opts.forEach(function (b) {
      b.disabled = true;
      var k = b.getAttribute('data-k');
      if (k === r.correct_option) b.classList.add('eq-correct');
      else if (k === choice && !r.correct) b.classList.add('eq-wrong');
    });
    if (r.correct) st.correct++;
    var fb = document.getElementById('eqFeedback');
    if (fb) {
      fb.innerHTML =
        '<div class="eq-fb ' + (r.correct ? 'ok' : 'bad') + '">' +
          (r.correct ? '✅ To\'g\'ri!' : '❌ Noto\'g\'ri') +
          (r.explanation ? '<div class="eq-exp">' + _esc(r.explanation) + '</div>' : '') +
        '</div>' +
        '<button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="_quizNext()">' +
          (st.idx + 1 >= st.questions.length ? 'Yakunlash' : 'Keyingisi →') + '</button>';
    }
  } catch (e) {
    showToast('❌', 'Xato', 'Javob yuborilmadi');
  } finally { _quizLock = false; }
}

function _quizNext() {
  _quizState.idx++;
  _renderQuizCard();
}

function _renderQuizDone() {
  var st = _quizState;
  var total = st.questions.length;
  var emoji = st.correct === total ? '🏆' : st.correct >= total * 0.6 ? '🎉' : '💪';
  var html =
    '<div class="eq-done">' +
      '<div class="eq-done-emoji">' + emoji + '</div>' +
      '<div class="eq-done-title">' + (st.mode === 'daily' ? 'Challenge tugadi!' : 'Takrorlash tugadi!') + '</div>' +
      '<div class="eq-done-score">' + st.correct + ' / ' + total + ' to\'g\'ri</div>' +
      '<button class="btn btn-primary" style="width:100%;margin-top:16px" onclick="_closeEngModal()">Yopish</button>' +
    '</div>';
  _engModal(html);
  // refresh widgets
  if (st.mode === 'daily') renderDailyChallenge();
  renderReviewBadge();
  renderMasteryTree();
  if (typeof renderXPWidget === 'function') renderXPWidget();
}

// ── 3. REVIEW BADGE (spaced repetition due indicator) ────────────────────────
async function renderReviewBadge() {
  var el = document.getElementById('reviewBadgeCard');
  if (!el) return;
  try {
    var r = await api('GET', '/gamification/review');
    if (!r.due) {
      el.innerHTML =
        '<div class="rv-card rv-empty">' +
          '<div class="rv-ico">🧠</div>' +
          '<div style="flex:1"><div class="dc-title">Takrorlash</div>' +
            '<div class="dc-sub">Hozircha takrorlash uchun savol yo\'q ✨</div></div>' +
        '</div>';
      return;
    }
    el.innerHTML =
      '<div class="rv-card">' +
        '<div class="rv-ico">🔁</div>' +
        '<div style="flex:1"><div class="dc-title">Takrorlash vaqti!</div>' +
          '<div class="dc-sub">' + r.due + ' ta savolni qayta ishlang — bilim mustahkamlanadi</div></div>' +
        '<button onclick="openReviewSession()" class="btn btn-primary btn-sm">Boshlash</button>' +
      '</div>';
  } catch (e) { el.innerHTML = ''; }
}

// ── 4. BILIM DARAXTI (subject mastery skill tree) ─────────────────────────────
async function renderMasteryTree() {
  var el = document.getElementById('masteryTree');
  if (!el) return;
  try {
    var tree = await api('GET', '/gamification/mastery');
    if (!tree || !tree.length) { el.innerHTML = '<div style="color:var(--text3);padding:12px;font-size:13px">Ma\'lumot yo\'q</div>'; return; }
    el.innerHTML = tree.map(function (s) {
      var m = s.mastery || 0;
      return '<div class="mt-node">' +
        '<div class="mt-ico" style="background:' + s.color + '22;border-color:' + s.color + '55">' + s.icon + '</div>' +
        '<div class="mt-body">' +
          '<div class="mt-row"><span class="mt-name">' + s.name + '</span>' +
            '<span class="mt-tier" style="color:' + s.color + '">' + s.tier + '</span></div>' +
          '<div class="mt-bar"><div class="mt-fill" style="width:' + m + '%;background:' + s.color + '"></div></div>' +
          '<div class="mt-stat">' + m + '% · ' + s.correct + '/' + s.total + ' to\'g\'ri</div>' +
        '</div></div>';
    }).join('');
  } catch (e) { el.innerHTML = ''; }
}

// ── 5. WEEKLY LEADERBOARD ─────────────────────────────────────────────────────
async function renderWeeklyLeaderboard() {
  var el = document.getElementById('weeklyLeaderboard');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:var(--text3);padding:18px">Yuklanmoqda...</div>';
  try {
    var data = await api('GET', '/gamification/leaderboard/weekly');
    var rows = data.list || [];
    if (!rows.length) { el.innerHTML = '<div style="text-align:center;color:var(--text3);padding:18px">Hali XP yig\'ilmagan</div>'; return; }
    var myId = window.CURRENT_USER ? window.CURRENT_USER.id : (data.me ? data.me.id : null);
    var header = '';
    if (data.me && data.toNext > 0) {
      header = '<div class="wl-next">⬆️ Keyingi o\'ringa <strong>' + data.toNext + ' XP</strong> qoldi</div>';
    } else if (data.me && data.me.rank === 1) {
      header = '<div class="wl-next wl-top">👑 Siz haftaning yetakchisisiz!</div>';
    }
    el.innerHTML = header + rows.map(function (r, i) {
      var isMe = r.id === myId;
      var rankNum = r.rank || (i + 1);
      var rankClass = i === 0 ? ' r1' : i === 1 ? ' r2' : i === 2 ? ' r3' : '';
      var rankHtml = i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : rankNum;
      var ini = (r.full_name || '?').split(' ').filter(Boolean).map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
      var av = r.avatar_url
        ? '<img src="' + r.avatar_url + '" class="wl-av" onerror="this.outerHTML=\'<div class=&quot;wl-av wl-av-f&quot;>' + ini + '</div>\'">'
        : '<div class="wl-av wl-av-f">' + ini + '</div>';
      return '<div class="wl-row' + (isMe ? ' wl-me' : '') + '">' +
        '<div class="wl-rank' + rankClass + '">' + rankHtml + '</div>' + av +
        '<div class="wl-info"><div class="wl-name">' + _esc(r.full_name) + (isMe ? ' <span style="font-size:10px;color:var(--primary);font-weight:700">· Siz</span>' : '') + '</div>' +
          '<div class="wl-grp">' + _esc(r.group_name || '') + '</div></div>' +
        '<div class="wl-xp">' + (r.week_xp || 0).toLocaleString() + '<span class="wl-xp-label">XP</span></div></div>';
    }).join('');
  } catch (e) { el.innerHTML = '<div style="color:#f87171;padding:12px">Xato: ' + e.message + '</div>'; }
}

// Auto-refresh hook — called from showPage for student dashboard/rating
function refreshEngagement() {
  syncStreak();
  renderDailyChallenge();
  renderReviewBadge();
}

console.log('Engagement module loaded (streak · daily · review · mastery · weekly LB)');
