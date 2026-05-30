'use strict';

/* IDU Liga — inter-group subject tournaments (Phase 1)
 * Bracket visualization (World-Cup style) + league table + dekanat create.
 */

var _ligaList = [];
var _ligaActiveId = null;
var _ligaDetail = null;
var _ligaSocket = null;
var _ligaMatch = null;       // { id, aName, bName, myTeam, status }
var _ligaQTimer = null;

var LIGA_SUBJECTS = [
  { code: 'algo', name: 'Algoritmlar', icon: '🧮' },
  { code: 'ai',   name: "Sun'iy intellekt", icon: '🤖' },
  { code: 'math', name: 'Matematika', icon: '📐' },
  { code: 'db',   name: "Ma'lumotlar bazasi", icon: '🗄️' },
  { code: 'web',  name: 'Web dasturlash', icon: '🌐' },
];

function _ligaInjectStyles() {
  if (document.getElementById('ligaStyles')) return;
  var css = ''
    + '.liga-wrap{padding:4px 2px 40px}'
    + '.liga-tcard{background:var(--card,#fff);border:1px solid var(--border,#e5e7eb);border-radius:16px;padding:18px 20px;margin-bottom:14px;cursor:pointer;transition:transform .15s,box-shadow .15s;display:flex;align-items:center;gap:16px}'
    + '.liga-tcard:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(37,99,235,.12)}'
    + '.liga-temoji{font-size:34px;flex-shrink:0}'
    + '.liga-tmeta{flex:1;min-width:0}'
    + '.liga-ttitle{font-weight:800;font-size:16px;color:var(--text,#0f172a);margin-bottom:3px}'
    + '.liga-tsub{font-size:13px;color:var(--text3,#64748b)}'
    + '.liga-badge{font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.4px}'
    + '.liga-b-draft{background:#fef3c7;color:#92400e}'
    + '.liga-b-active{background:#dcfce7;color:#166534}'
    + '.liga-b-completed{background:#e0e7ff;color:#3730a3}'
    + '.liga-section{margin:26px 0 14px;font-weight:800;font-size:15px;color:var(--text,#0f172a);display:flex;align-items:center;gap:8px}'
    + '.liga-table{width:100%;border-collapse:collapse;background:var(--card,#fff);border:1px solid var(--border,#e5e7eb);border-radius:14px;overflow:hidden}'
    + '.liga-table th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text3,#64748b);padding:11px 14px;background:rgba(37,99,235,.05)}'
    + '.liga-table td{padding:11px 14px;border-top:1px solid var(--border,#eef2f7);font-size:14px;color:var(--text,#0f172a)}'
    + '.liga-rank{display:inline-flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:8px;font-weight:800;font-size:13px;background:rgba(37,99,235,.1);color:#2563eb}'
    + '.liga-rank.top1{background:#fde68a;color:#92400e}.liga-rank.top2{background:#e2e8f0;color:#475569}.liga-rank.top3{background:#fed7aa;color:#9a3412}'
    + '.liga-rating{font-weight:800;color:#2563eb}'
    + '.bracket{display:flex;gap:34px;overflow-x:auto;padding:14px 4px 24px}'
    + '.bracket-col{display:flex;flex-direction:column;justify-content:space-around;min-width:210px;gap:18px}'
    + '.bracket-rname{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--text3,#64748b);text-align:center;margin-bottom:4px}'
    + '.bm{background:var(--card,#fff);border:1px solid var(--border,#e5e7eb);border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.04)}'
    + '.bm-live{border-color:#ef4444;box-shadow:0 0 0 2px rgba(239,68,68,.18)}'
    + '.bm-row{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;font-size:13px;gap:8px}'
    + '.bm-row+.bm-row{border-top:1px solid var(--border,#eef2f7)}'
    + '.bm-team{font-weight:700;color:var(--text,#0f172a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.bm-win .bm-team{color:#166534}'
    + '.bm-win{background:rgba(16,185,129,.08)}'
    + '.bm-score{font-weight:800;color:var(--text2,#475569);font-variant-numeric:tabular-nums}'
    + '.bm-tbd{color:var(--text3,#94a3b8);font-style:italic;font-weight:600}'
    + '.bm-foot{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;text-align:center;padding:4px;color:#64748b;background:rgba(0,0,0,.02)}'
    + '.bm-foot.live{color:#ef4444}.bm-foot.ready{color:#2563eb}'
    + '.liga-empty{text-align:center;padding:50px 20px;color:var(--text3,#64748b)}'
    + '.liga-back{display:inline-flex;align-items:center;gap:6px;font-weight:700;color:#2563eb;cursor:pointer;margin-bottom:8px;font-size:14px}'
    + '.liga-pill{display:inline-block;font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;background:rgba(37,99,235,.1);color:#2563eb;margin-right:6px}'
    + '.liga-cg{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;max-height:240px;overflow:auto;padding:4px;border:1px solid var(--border,#e5e7eb);border-radius:12px}'
    + '.liga-gchk{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;cursor:pointer;font-size:13px;background:rgba(0,0,0,.02)}'
    + '.liga-gchk input{width:16px;height:16px}'
    + '.liga-gchk.on{background:rgba(37,99,235,.12);font-weight:700}'
    + '.mr-bg{position:fixed;inset:0;z-index:9999;background:linear-gradient(160deg,#0b1220,#111c33);display:flex;flex-direction:column;color:#e8eefc}'
    + '.mr-top{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.08)}'
    + '.mr-x{background:rgba(255,255,255,.1);border:none;color:#fff;width:36px;height:36px;border-radius:10px;font-size:16px;cursor:pointer}'
    + '.mr-score{display:flex;align-items:center;justify-content:center;gap:18px;padding:18px}'
    + '.mr-team{flex:1;max-width:240px;text-align:center}'
    + '.mr-tname{font-weight:800;font-size:16px;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.mr-tscore{font-size:42px;font-weight:900;font-variant-numeric:tabular-nums;line-height:1}'
    + '.mr-tsub{font-size:11px;color:#8aa0c6;margin-top:4px}'
    + '.mr-vs{font-weight:900;color:#64748b;font-size:18px}'
    + '.mr-mine{box-shadow:0 0 0 2px #2563eb inset;border-radius:14px;padding:10px 6px}'
    + '.mr-body{flex:1;overflow:auto;padding:10px 18px 28px;display:flex;flex-direction:column;align-items:center;justify-content:center}'
    + '.mr-q{max-width:680px;width:100%;text-align:center}'
    + '.mr-qmeta{font-size:12px;color:#8aa0c6;font-weight:700;letter-spacing:.5px;margin-bottom:10px}'
    + '.mr-qtext{font-size:21px;font-weight:800;line-height:1.4;margin-bottom:22px}'
    + '.mr-opts{display:grid;grid-template-columns:1fr 1fr;gap:12px}'
    + '.mr-opt{background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.12);color:#e8eefc;padding:16px 18px;border-radius:14px;font-size:15px;font-weight:600;cursor:pointer;text-align:left;transition:.15s;display:flex;gap:10px;align-items:center}'
    + '.mr-opt:hover{background:rgba(37,99,235,.22);border-color:#2563eb}'
    + '.mr-opt .k{display:inline-flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:7px;background:rgba(255,255,255,.12);font-weight:800;flex-shrink:0}'
    + '.mr-opt.picked{background:rgba(37,99,235,.35);border-color:#3b82f6}'
    + '.mr-opt.correct{background:rgba(16,185,129,.3);border-color:#10b981}'
    + '.mr-opt.wrong{background:rgba(239,68,68,.28);border-color:#ef4444}'
    + '.mr-opt[disabled]{cursor:default;opacity:.92}'
    + '.mr-ring{width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;margin:0 auto 14px;border:4px solid #2563eb;color:#fff}'
    + '.mr-start{background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;border:none;padding:16px 34px;border-radius:14px;font-size:17px;font-weight:800;cursor:pointer;box-shadow:0 10px 30px rgba(37,99,235,.4)}'
    + '.mr-wait{color:#8aa0c6;font-size:15px;margin-top:14px}'
    + '.mr-winner{font-size:30px;font-weight:900;margin-bottom:8px}'
    + '@media(max-width:640px){.bracket-col{min-width:172px}.mr-opts{grid-template-columns:1fr}.mr-tscore{font-size:32px}}';
  var s = document.createElement('style');
  s.id = 'ligaStyles'; s.textContent = css;
  document.head.appendChild(s);
}

function _ligaIsStaff() {
  var r = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.role : '';
  return r === 'dekanat' || r === 'admin';
}

async function renderLiga() {
  _ligaInjectStyles();
  var host = document.getElementById('ligaBody');
  if (!host) return;
  _ligaActiveId = null;
  host.innerHTML = '<div class="liga-empty">⏳ Yuklanmoqda...</div>';
  try {
    _ligaList = await api('GET', '/competitions');
    if (!Array.isArray(_ligaList)) _ligaList = [];
  } catch (e) { _ligaList = []; }

  if (!_ligaList.length) {
    host.innerHTML =
      '<div class="liga-empty"><div style="font-size:54px;margin-bottom:10px">🏆</div>' +
      '<div style="font-size:17px;font-weight:800;color:var(--text,#0f172a);margin-bottom:6px">Hali turnir yo\'q</div>' +
      '<div style="font-size:14px">Fanlar bo\'yicha guruhlararo chempionat shu yerda ko\'rinadi.' +
      (_ligaIsStaff() ? ' Yangi turnir yaratish uchun yuqoridagi tugmadan foydalaning.' : '') + '</div></div>';
    return;
  }

  host.innerHTML = _ligaList.map(function (t) {
    var subj = LIGA_SUBJECTS.find(function (s) { return s.code === t.subject; });
    var stCls = 'liga-b-' + t.status;
    var stTxt = t.status === 'active' ? 'Jonli' : t.status === 'completed' ? 'Tugagan' : 'Tayyorlanmoqda';
    var champ = t.champion_group ? ' · 🥇 ' + t.champion_group : '';
    return '<div class="liga-tcard" onclick="openLigaDetail(' + t.id + ')">' +
      '<div class="liga-temoji">' + (subj ? subj.icon : '🏆') + '</div>' +
      '<div class="liga-tmeta">' +
        '<div class="liga-ttitle">' + _esc(t.title) + '</div>' +
        '<div class="liga-tsub">' + (subj ? subj.name : t.subject) + ' · ' + _esc(t.semester) +
          ' · ' + (t.team_count || 0) + ' jamoa' + champ + '</div>' +
      '</div>' +
      '<span class="liga-badge ' + stCls + '">' + stTxt + '</span>' +
    '</div>';
  }).join('');
}

function _esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function _roundName(round, total) {
  var fromEnd = total - round; // 0 = final
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Yarim final';
  if (fromEnd === 2) return 'Chorak final';
  return '1/' + Math.pow(2, fromEnd + 1);
}

async function openLigaDetail(id) {
  _ligaInjectStyles();
  var host = document.getElementById('ligaBody');
  if (!host) return;
  _ligaActiveId = id;
  host.innerHTML = '<div class="liga-empty">⏳ Yuklanmoqda...</div>';
  var data;
  try { data = await api('GET', '/competitions/' + id); }
  catch (e) { host.innerHTML = '<div class="liga-empty">❌ Yuklab bo\'lmadi</div>'; return; }

  _ligaDetail = data;
  var t = data.tournament, teams = data.teams || [], matches = data.matches || [];
  var subj = LIGA_SUBJECTS.find(function (s) { return s.code === t.subject; });

  // group matches by round
  var byRound = {};
  matches.forEach(function (m) { (byRound[m.round] = byRound[m.round] || []).push(m); });
  var rounds = Object.keys(byRound).map(Number).sort(function (a, b) { return a - b; });

  var bracketHtml = '<div class="bracket">' + rounds.map(function (r) {
    var col = byRound[r].sort(function (a, b) { return a.slot - b.slot; }).map(function (m) {
      return _matchCard(m);
    }).join('');
    return '<div class="bracket-col"><div class="bracket-rname">' + _roundName(r, t.total_rounds) + '</div>' + col + '</div>';
  }).join('') + '</div>';

  var tableHtml = '<table class="liga-table"><thead><tr>' +
    '<th>#</th><th>Jamoa</th><th>Reyting</th><th>O\'yin</th><th>G\'/M</th></tr></thead><tbody>' +
    teams.map(function (tm, i) {
      var rc = 'liga-rank' + (i === 0 ? ' top1' : i === 1 ? ' top2' : i === 2 ? ' top3' : '');
      return '<tr><td><span class="' + rc + '">' + (i + 1) + '</span></td>' +
        '<td><b>' + _esc(tm.group_name) + '</b>' + (tm.eliminated ? ' <span style="color:#ef4444;font-size:11px">✕ chiqdi</span>' : '') + '</td>' +
        '<td class="liga-rating">' + tm.rating + '</td>' +
        '<td>' + tm.played + '</td>' +
        '<td>' + tm.wins + ' / ' + tm.losses + '</td></tr>';
    }).join('') + '</tbody></table>';

  var staffCtrl = '';
  if (_ligaIsStaff()) {
    if (t.status === 'draft')
      staffCtrl = '<button class="btn btn-primary" onclick="ligaSetStatus(' + id + ',\'active\')">▶️ Turnirni boshlash</button>';
    else if (t.status === 'active')
      staffCtrl = '<button class="btn btn-secondary" onclick="ligaSetStatus(' + id + ',\'completed\')">🏁 Yakunlash</button>';
  }

  host.innerHTML =
    '<div class="liga-back" onclick="renderLiga()">← Barcha turnirlar</div>' +
    '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px">' +
      '<div><div style="font-size:22px;font-weight:900;color:var(--text,#0f172a)">' + (subj ? subj.icon : '🏆') + ' ' + _esc(t.title) + '</div>' +
      '<div style="margin-top:6px"><span class="liga-pill">' + (subj ? subj.name : t.subject) + '</span>' +
      '<span class="liga-pill">' + _esc(t.semester) + '</span>' +
      '<span class="liga-pill">' + teams.length + ' jamoa</span></div></div>' +
      '<div>' + staffCtrl + '</div>' +
    '</div>' +
    '<div class="liga-section">🗺️ Turnir to\'ri (bracket)</div>' + bracketHtml +
    '<div class="liga-section">📊 Liga jadvali — jamoa reytingi</div>' + tableHtml;
}

function _matchCard(m) {
  var live = m.status === 'live';
  var aWin = m.winner_team_id && m.winner_team_id === m.team_a_id;
  var bWin = m.winner_team_id && m.winner_team_id === m.team_b_id;
  function row(name, score, win, has) {
    return '<div class="bm-row' + (win ? ' bm-win' : '') + '">' +
      '<span class="' + (has ? 'bm-team' : 'bm-tbd') + '">' + (has ? _esc(name) : 'Kutilmoqda') + '</span>' +
      '<span class="bm-score">' + (m.status === 'finished' || live ? _fmtScore(score) : '') + '</span></div>';
  }
  var foot = '';
  var clickable = (m.status === 'ready' || m.status === 'live') && m.team_a_id && m.team_b_id;
  if (m.status === 'live') foot = '<div class="bm-foot live">🔴 JONLI — kirish</div>';
  else if (m.status === 'ready') foot = '<div class="bm-foot ready">▶ Jangga kirish</div>';
  else if (m.status === 'finished') foot = '<div class="bm-foot">Tugadi</div>';
  var onclick = clickable ? ' onclick="openMatchRoom(' + m.id + ')" style="cursor:pointer"' : '';
  return '<div class="bm' + (live ? ' bm-live' : '') + '"' + onclick + '>' +
    row(m.team_a_name, m.team_a_score, aWin, !!m.team_a_id) +
    row(m.team_b_name, m.team_b_score, bWin, !!m.team_b_id) +
    foot + '</div>';
}

function _fmtScore(v) {
  var n = parseFloat(v);
  if (isNaN(n)) return '0';
  return (Math.round(n * 10) / 10).toString();
}

async function ligaSetStatus(id, status) {
  try {
    await api('POST', '/competitions/' + id + '/status', { status: status });
    showToast('✅', 'Liga', status === 'active' ? 'Turnir boshlandi' : 'Turnir yakunlandi');
    openLigaDetail(id);
  } catch (e) { showToast('❌', 'Xato', (e && e.message) || 'Bajarilmadi'); }
}

// ── Dekanat: create tournament ───────────────────────────────────────────────
async function openLigaCreate() {
  if (!_ligaIsStaff()) return;
  _ligaInjectStyles();
  var groups = [];
  try { groups = await api('GET', '/competitions/groups'); } catch (e) {}
  if (!Array.isArray(groups)) groups = [];

  var subjOpts = LIGA_SUBJECTS.map(function (s) {
    return '<option value="' + s.code + '">' + s.icon + ' ' + s.name + '</option>';
  }).join('');

  var groupChecks = groups.length ? groups.map(function (g) {
    return '<label class="liga-gchk" onclick="this.classList.toggle(\'on\',this.querySelector(\'input\').checked)">' +
      '<input type="checkbox" value="' + _esc(g.group_name) + '"> ' + _esc(g.group_name) +
      ' <span style="color:#94a3b8;font-size:11px">(' + (g.size || 0) + ')</span></label>';
  }).join('') : '<div style="color:#94a3b8;padding:10px">Guruhlar topilmadi</div>';

  var now = new Date();
  var sem = now.getFullYear() + '-' + (now.getFullYear() + 1) + '-' + (now.getMonth() < 6 ? '2' : '1');

  var html =
    '<div class="cal-modal-box" style="max-width:520px">' +
      '<div class="cal-modal-head"><div class="cal-modal-title">🏆 Yangi turnir</div>' +
      '<button onclick="_ligaCloseModal()" class="cal-x">✕</button></div>' +
      '<div class="cal-form">' +
        '<label class="cal-fl">Nomi</label>' +
        '<input id="ligaTitle" class="form-input" placeholder="Masalan: Bahor chempionati" value="Fanlar chempionati">' +
        '<label class="cal-fl">Fan</label>' +
        '<select id="ligaSubject" class="form-input">' + subjOpts + '</select>' +
        '<label class="cal-fl">Semestr</label>' +
        '<input id="ligaSemester" class="form-input" value="' + sem + '">' +
        '<div style="display:flex;gap:10px">' +
          '<div style="flex:1"><label class="cal-fl">Savollar / o\'yin</label>' +
          '<input id="ligaQpm" class="form-input" type="number" value="10" min="3" max="30"></div>' +
          '<div style="flex:1"><label class="cal-fl">Soniya / savol</label>' +
          '<input id="ligaSpq" class="form-input" type="number" value="20" min="5" max="60"></div>' +
        '</div>' +
        '<label class="cal-fl">Ishtirokchi guruhlar (kamida 2 ta)</label>' +
        '<div class="liga-cg" id="ligaGroups">' + groupChecks + '</div>' +
        '<button class="btn btn-primary" style="margin-top:14px;width:100%" onclick="submitLigaCreate()">Turnir yaratish</button>' +
      '</div>' +
    '</div>';

  var modal = document.createElement('div');
  modal.id = 'ligaModal';
  modal.className = 'cal-modal-bg';
  modal.onclick = function (e) { if (e.target === modal) _ligaCloseModal(); };
  modal.innerHTML = html;
  document.body.appendChild(modal);
}

function _ligaCloseModal() { var m = document.getElementById('ligaModal'); if (m) m.remove(); }

async function submitLigaCreate() {
  var title = (document.getElementById('ligaTitle').value || '').trim();
  var subject = document.getElementById('ligaSubject').value;
  var semester = (document.getElementById('ligaSemester').value || '').trim();
  var qpm = parseInt(document.getElementById('ligaQpm').value, 10) || 10;
  var spq = parseInt(document.getElementById('ligaSpq').value, 10) || 20;
  var groups = Array.prototype.slice.call(
    document.querySelectorAll('#ligaGroups input:checked')
  ).map(function (i) { return i.value; });

  if (!title) return showToast('⚠️', 'Xato', 'Nom kiriting');
  if (groups.length < 2) return showToast('⚠️', 'Xato', 'Kamida 2 ta guruh tanlang');

  try {
    var r = await api('POST', '/competitions', {
      title: title, subject: subject, semester: semester,
      groups: groups, questions_per_match: qpm, seconds_per_question: spq,
    });
    showToast('✅', 'Liga', 'Turnir yaratildi (' + r.bracket_size + ' jamoali bracket)');
    _ligaCloseModal();
    if (r && r.id) openLigaDetail(r.id); else renderLiga();
  } catch (e) {
    showToast('❌', 'Xato', (e && e.message) || 'Yaratilmadi');
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  LIVE BATTLE — match room
// ════════════════════════════════════════════════════════════════════════════
function openMatchRoom(matchId) {
  _ligaInjectStyles();
  var d = _ligaDetail; if (!d) return;
  var m = (d.matches || []).find(function (x) { return x.id === matchId; });
  if (!m) return;
  var teams = d.teams || [];
  var ta = teams.find(function (t) { return t.id === m.team_a_id; });
  var tb = teams.find(function (t) { return t.id === m.team_b_id; });
  var uid = window.CURRENT_USER ? window.CURRENT_USER.id : null;
  var role = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.role : '';
  var isStaff = role === 'dekanat' || role === 'admin';
  var isCaptain = (ta && ta.captain_user_id === uid) || (tb && tb.captain_user_id === uid);

  _ligaMatch = {
    id: matchId, aId: m.team_a_id, bId: m.team_b_id,
    aName: m.team_a_name || 'A', bName: m.team_b_name || 'B',
    canStart: isStaff || isCaptain, status: m.status, myTeam: null,
    curQIndex: -1, picked: null,
  };

  var existing = document.getElementById('ligaMatchRoom');
  if (existing) existing.remove();
  var el = document.createElement('div');
  el.id = 'ligaMatchRoom';
  el.className = 'mr-bg';
  el.innerHTML =
    '<div class="mr-top"><div style="font-weight:800;font-size:15px">⚔️ Liga jangi</div>' +
      '<button class="mr-x" onclick="closeMatchRoom()">✕</button></div>' +
    '<div class="mr-score">' +
      '<div class="mr-team" id="mrTeamA"><div class="mr-tname">' + _esc(_ligaMatch.aName) + '</div>' +
        '<div class="mr-tscore" id="mrScoreA">0</div><div class="mr-tsub" id="mrSubA">0 ishtirokchi</div></div>' +
      '<div class="mr-vs">VS</div>' +
      '<div class="mr-team" id="mrTeamB"><div class="mr-tname">' + _esc(_ligaMatch.bName) + '</div>' +
        '<div class="mr-tscore" id="mrScoreB">0</div><div class="mr-tsub" id="mrSubB">0 ishtirokchi</div></div>' +
    '</div>' +
    '<div class="mr-body" id="mrBody"><div class="mr-wait">⏳ Ulanmoqda...</div></div>';
  document.body.appendChild(el);

  _ligaConnectAndJoin(matchId);
}

function _ligaConnectAndJoin(matchId) {
  if (typeof io === 'undefined') { _setBody('<div class="mr-wait">❌ Realtime mavjud emas</div>'); return; }
  var token = window._apiToken || localStorage.getItem('idu_jwt') || '';
  var apiOrigin = (window.API_BASE || '').replace(/\/api.*$/, '').replace(/^http/, 'ws') ||
    ((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host);
  if (_ligaSocket) { try { _ligaSocket.disconnect(); } catch (e) {} _ligaSocket = null; }
  _ligaSocket = io(apiOrigin, { auth: { token: token }, transports: ['websocket', 'polling'], reconnection: true });

  _ligaSocket.on('connect', function () {
    _ligaSocket.emit('comp:join', { matchId: matchId }, function (res) { _onJoinAck(res); });
  });
  _ligaSocket.on('comp:start', function () { _setBody('<div class="mr-wait">🚀 Jang boshlandi...</div>'); });
  _ligaSocket.on('comp:question', function (p) { _renderMrQuestion(p); });
  _ligaSocket.on('comp:reveal', function (p) { _onReveal(p); });
  _ligaSocket.on('comp:score', function (s) { _setScores(s); });
  _ligaSocket.on('comp:end', function (p) { _renderMrEnd(p); });
  _ligaSocket.on('disconnect', function () {});
}

function _onJoinAck(res) {
  if (!res || res.error) { _setBody('<div class="mr-wait">❌ ' + ((res && res.error) || ' Xato') + '</div>'); return; }
  if (res.myTeam) _ligaMatch.myTeam = res.myTeam;
  if (res.scores) _setScores(res.scores);
  if (res.live) {
    if (res.current) _renderMrQuestion(res.current);
    else _setBody('<div class="mr-wait">⏳ Keyingi savol kutilmoqda...</div>');
  } else {
    _renderMrLobby();
  }
}

function _renderMrLobby() {
  var canStart = _ligaMatch.canStart;
  _setBody(
    '<div style="text-align:center">' +
      '<div style="font-size:54px;margin-bottom:10px">⚔️</div>' +
      '<div style="font-size:20px;font-weight:800;margin-bottom:6px">' + _esc(_ligaMatch.aName) + ' vs ' + _esc(_ligaMatch.bName) + '</div>' +
      (canStart
        ? '<button class="mr-start" onclick="ligaStartMatch()">▶ Jangni boshlash</button>' +
          '<div class="mr-wait">Boshlaganda ikkala guruh bir vaqtda javob beradi</div>'
        : '<div class="mr-wait">Kapitan yoki dekanat jangni boshlashini kuting...</div>') +
    '</div>'
  );
}

function ligaStartMatch() {
  if (!_ligaSocket || !_ligaMatch) return;
  _setBody('<div class="mr-wait">🚀 Boshlanmoqda...</div>');
  _ligaSocket.emit('comp:start', { matchId: _ligaMatch.id }, function (res) {
    if (res && res.error) {
      var msg = res.error === 'not_enough_questions' ? 'Bu fan uchun yetarli savol yo\'q'
        : res.error === 'not_captain' ? 'Faqat kapitan/dekanat boshlay oladi'
        : res.error === 'already_live' ? 'Jang allaqachon boshlangan' : res.error;
      showToast('⚠️', 'Liga', msg);
      _renderMrLobby();
    }
  });
}

function _renderMrQuestion(p) {
  if (!p || !p.question) return;
  _ligaMatch.curQIndex = p.qIndex;
  _ligaMatch.picked = null;
  var q = p.question;
  var canAnswer = !!_ligaMatch.myTeam;
  var letters = ['A', 'B', 'C', 'D'];
  var opts = [q.a, q.b, q.c, q.d];
  var optHtml = opts.map(function (o, i) {
    if (o == null || o === '') return '';
    var L = letters[i];
    var attr = canAnswer ? ' onclick="ligaAnswer(\'' + L + '\')"' : ' disabled';
    return '<button class="mr-opt" id="mrOpt' + L + '"' + attr + '><span class="k">' + L + '</span><span>' + _esc(o) + '</span></button>';
  }).join('');
  _setBody(
    '<div class="mr-q">' +
      '<div class="mr-ring" id="mrRing">' + '–' + '</div>' +
      '<div class="mr-qmeta">SAVOL ' + (p.qIndex + 1) + ' / ' + p.total + (canAnswer ? '' : ' · tomoshabin') + '</div>' +
      '<div class="mr-qtext">' + _esc(q.text) + '</div>' +
      '<div class="mr-opts">' + optHtml + '</div>' +
    '</div>'
  );
  _startQRing(p.endsAt);
}

function _startQRing(endsAt) {
  if (_ligaQTimer) clearInterval(_ligaQTimer);
  function tick() {
    var ring = document.getElementById('mrRing');
    if (!ring) { clearInterval(_ligaQTimer); return; }
    var left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    ring.textContent = left;
    ring.style.borderColor = left <= 5 ? '#ef4444' : '#2563eb';
    if (left <= 0) { clearInterval(_ligaQTimer); _lockOpts(); }
  }
  tick();
  _ligaQTimer = setInterval(tick, 250);
}

function ligaAnswer(choice) {
  if (!_ligaSocket || !_ligaMatch || _ligaMatch.picked) return;
  _ligaMatch.picked = choice;
  var btn = document.getElementById('mrOpt' + choice);
  if (btn) btn.classList.add('picked');
  _lockOpts();
  _ligaSocket.emit('comp:answer', { matchId: _ligaMatch.id, qIndex: _ligaMatch.curQIndex, choice: choice }, function () {});
}

function _lockOpts() {
  ['A', 'B', 'C', 'D'].forEach(function (L) {
    var b = document.getElementById('mrOpt' + L);
    if (b) b.setAttribute('disabled', 'disabled');
  });
}

function _onReveal(p) {
  if (_ligaQTimer) clearInterval(_ligaQTimer);
  if (p.scores) _setScores(p.scores);
  var correct = p.correct_option;
  if (correct) {
    var cb = document.getElementById('mrOpt' + correct);
    if (cb) cb.classList.add('correct');
    if (_ligaMatch.picked && _ligaMatch.picked !== correct) {
      var wb = document.getElementById('mrOpt' + _ligaMatch.picked);
      if (wb) wb.classList.add('wrong');
    }
  }
  var ring = document.getElementById('mrRing');
  if (ring) ring.textContent = '✓';
}

function _setScores(s) {
  if (!s) return;
  var a = s.teamA || {}, b = s.teamB || {};
  var sa = document.getElementById('mrScoreA'), sb = document.getElementById('mrScoreB');
  if (sa) sa.textContent = _fmtScore(a.score || 0);
  if (sb) sb.textContent = _fmtScore(b.score || 0);
  var ua = document.getElementById('mrSubA'), ub = document.getElementById('mrSubB');
  if (ua) ua.textContent = (a.participants || 0) + ' ishtirokchi · ' + (a.correct || 0) + ' to\'g\'ri';
  if (ub) ub.textContent = (b.participants || 0) + ' ishtirokchi · ' + (b.correct || 0) + ' to\'g\'ri';
  // highlight my team
  if (_ligaMatch && _ligaMatch.myTeam) {
    var ea = document.getElementById('mrTeamA'), eb = document.getElementById('mrTeamB');
    if (ea) ea.classList.toggle('mr-mine', _ligaMatch.myTeam === _ligaMatch.aId);
    if (eb) eb.classList.toggle('mr-mine', _ligaMatch.myTeam === _ligaMatch.bId);
  }
}

function _renderMrEnd(p) {
  if (_ligaQTimer) clearInterval(_ligaQTimer);
  if (p.scores) _setScores(p.scores);
  var winName = p.winner_team_id === _ligaMatch.aId ? _ligaMatch.aName
    : p.winner_team_id === _ligaMatch.bId ? _ligaMatch.bName : '—';
  var iWon = _ligaMatch.myTeam && _ligaMatch.myTeam === p.winner_team_id;
  _setBody(
    '<div style="text-align:center">' +
      '<div style="font-size:60px;margin-bottom:6px">' + (iWon ? '🎉' : '🏁') + '</div>' +
      '<div class="mr-winner">🥇 ' + _esc(winName) + '</div>' +
      '<div class="mr-wait">' + _fmtScore(p.team_a_score) + ' : ' + _fmtScore(p.team_b_score) + '</div>' +
      (iWon ? '<div style="color:#34d399;font-weight:800;margin-top:8px">Tabriklaymiz! +50 XP</div>' : '') +
      '<button class="mr-start" style="margin-top:20px" onclick="closeMatchRoom()">Yopish</button>' +
    '</div>'
  );
}

function _setBody(html) { var b = document.getElementById('mrBody'); if (b) b.innerHTML = html; }

function closeMatchRoom() {
  if (_ligaQTimer) { clearInterval(_ligaQTimer); _ligaQTimer = null; }
  if (_ligaSocket) { try { _ligaSocket.disconnect(); } catch (e) {} _ligaSocket = null; }
  var el = document.getElementById('ligaMatchRoom');
  if (el) el.remove();
  if (_ligaActiveId) openLigaDetail(_ligaActiveId);
}
