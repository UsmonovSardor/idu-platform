'use strict';
/* ══════════════════════════════════════════════════════════════
   Forum / Q&A — Stack Overflow style
   List, ask, answer, upvote, accept
══════════════════════════════════════════════════════════════ */

var _forumSort = 'recent';
var _forumDebounce = null;

function setForumSort(sort, btn) {
  _forumSort = sort;
  document.querySelectorAll('#page-forum .filter-chip').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  loadForum();
}

function loadForumDebounced() {
  clearTimeout(_forumDebounce);
  _forumDebounce = setTimeout(loadForum, 320);
}

async function loadForum() {
  var el = document.getElementById('forumList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3)">Yuklanmoqda...</div>';

  var search = (document.getElementById('forumSearch') || {}).value || '';
  var qs = '?sort=' + encodeURIComponent(_forumSort) + (search ? '&search=' + encodeURIComponent(search) : '');

  try {
    var data = await api('GET', '/forum/questions' + qs);
    var qs = data.questions || [];
    if (!qs.length) {
      el.innerHTML = '<div style="text-align:center;padding:48px 16px;color:var(--text3)">' +
        '<div style="font-size:48px;margin-bottom:12px">💭</div>' +
        '<div style="font-size:15px;font-weight:600;color:var(--text2);margin-bottom:6px">Hozircha savollar yo\'q</div>' +
        '<div style="font-size:13px">Birinchi bo\'lib savol bering!</div>' +
      '</div>';
      return;
    }
    el.innerHTML = qs.map(_renderForumItem).join('');
  } catch (e) {
    el.innerHTML = '<div style="color:var(--red);text-align:center;padding:24px">Xato: ' + (e.message || 'yuklanmadi') + '</div>';
  }
}

function _renderForumItem(q) {
  var dt = new Date(q.created_at);
  var diff = Math.floor((Date.now() - dt.getTime()) / 60000);
  var timeAgo = diff < 1 ? 'hozir' : diff < 60 ? diff + ' daq oldin' : diff < 1440 ? Math.floor(diff/60) + ' soat' : Math.floor(diff/1440) + ' kun';
  var initials = (q.author_name || '?').split(' ').map(function(p){return p[0];}).join('').slice(0,2).toUpperCase();
  var roleColors = { student:'#2563eb', teacher:'#16a34a', dekanat:'#7c3aed', admin:'#dc2626' };
  var roleColor = roleColors[q.author_role] || '#64748b';

  return '<div class="forum-item" onclick="openForumDetail(' + q.id + ')">' +
    '<div class="forum-stats">' +
      '<div class="forum-stat-box"><div class="forum-stat-num">' + q.upvotes + '</div><div class="forum-stat-key">ovoz</div></div>' +
      '<div class="forum-stat-box ' + (q.is_solved ? 'forum-solved' : '') + '"><div class="forum-stat-num">' + q.answer_count + '</div><div class="forum-stat-key">javob</div></div>' +
      '<div class="forum-stat-box"><div class="forum-stat-num">' + q.views + '</div><div class="forum-stat-key">ko\'rildi</div></div>' +
    '</div>' +
    '<div class="forum-body">' +
      '<div class="forum-title">' + (q.is_solved ? '<span class="forum-badge-solved">✓ Yechildi</span> ' : '') + _esc(q.title) + '</div>' +
      '<div class="forum-snippet">' + _esc((q.body || '').substring(0, 180)) + (q.body && q.body.length > 180 ? '…' : '') + '</div>' +
      '<div class="forum-meta">' +
        '<span class="forum-cat">' + _esc(q.category || 'umumiy') + '</span>' +
        '<span class="forum-author"><span class="forum-author-avatar" style="background:' + roleColor + '">' + initials + '</span>' +
          _esc(q.author_name || 'Talaba') + ' · ' + timeAgo + '</span>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function _esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function openAskModal() {
  var bg = document.getElementById('askModalBg');
  if (bg) bg.style.display = 'flex';
  setTimeout(function(){ var t = document.getElementById('askTitle'); if (t) t.focus(); }, 50);
}
function closeAskModal() {
  var bg = document.getElementById('askModalBg');
  if (bg) bg.style.display = 'none';
  var t = document.getElementById('askTitle'); if (t) t.value = '';
  var b = document.getElementById('askBody');  if (b) b.value = '';
}

async function submitQuestion() {
  var title    = document.getElementById('askTitle').value.trim();
  var body     = document.getElementById('askBody').value.trim();
  var category = document.getElementById('askCategory').value;
  if (title.length < 5 || body.length < 10) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', 'Sarlavha ≥5, tafsilot ≥10 belgi bo\'lishi kerak');
    return;
  }
  try {
    await api('POST', '/forum/questions', { title, body, category });
    if (typeof showToast === 'function') showToast('✅', 'Yuborildi', 'Savol e\'lon qilindi');
    closeAskModal();
    loadForum();
  } catch (e) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', e.message || 'Yuborilmadi');
  }
}

async function openForumDetail(qid) {
  var bg = document.getElementById('forumDetailBg');
  var content = document.getElementById('forumDetailContent');
  if (!bg || !content) return;
  bg.style.display = 'flex';
  content.innerHTML = '<div style="text-align:center;padding:32px">Yuklanmoqda...</div>';
  try {
    var data = await api('GET', '/forum/questions/' + qid);
    _renderForumDetail(data, qid);
  } catch (e) {
    content.innerHTML = '<div style="color:var(--red);padding:24px">' + (e.message || 'Xato') + '</div>';
  }
}

function closeForumDetail() {
  var bg = document.getElementById('forumDetailBg');
  if (bg) bg.style.display = 'none';
}

function _renderForumDetail(data, qid) {
  var q = data.question;
  var answers = data.answers || [];
  var me = window.CURRENT_USER || JSON.parse(localStorage.getItem('idu_user') || '{}');
  var isAsker = me.id === q.user_id;

  var content = document.getElementById('forumDetailContent');
  if (!content) return;
  content.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">' +
      '<div style="font-size:20px;font-weight:800;color:var(--text);line-height:1.3;flex:1">' +
        (q.is_solved ? '<span class="forum-badge-solved">✓</span> ' : '') + _esc(q.title) +
      '</div>' +
      '<button onclick="closeForumDetail()" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--text3);margin-left:14px">×</button>' +
    '</div>' +
    '<div style="display:flex;gap:10px;font-size:12px;color:var(--text3);margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)">' +
      '<span><strong style="color:var(--text2)">' + _esc(q.author_name) + '</strong></span>' +
      '<span>·</span><span>' + new Date(q.created_at).toLocaleDateString('uz-UZ') + '</span>' +
      '<span>·</span><span>👁 ' + q.views + '</span>' +
      '<span>·</span><span>👍 ' + q.upvotes + '</span>' +
    '</div>' +
    '<div style="font-size:14px;line-height:1.7;color:var(--text);white-space:pre-wrap;margin-bottom:18px">' + _esc(q.body) + '</div>' +

    '<div style="font-weight:700;font-size:14px;color:var(--text2);margin-bottom:10px">' +
      answers.length + ' ta javob</div>' +

    answers.map(function(a) {
      var ans = '<div class="forum-answer' + (a.is_accepted ? ' forum-answer-accepted' : '') + '">' +
        '<div class="forum-vote-col">' +
          '<button class="forum-vote-btn ' + (a.user_voted ? 'voted' : '') + '" onclick="voteForum(\'answer\',' + a.id + ',this,' + qid + ')">▲</button>' +
          '<div class="forum-vote-num">' + a.upvotes + '</div>' +
          (a.is_accepted ? '<div style="color:#16a34a;font-size:20px;margin-top:6px">✓</div>' : '') +
        '</div>' +
        '<div style="flex:1">' +
          '<div style="font-size:14px;line-height:1.65;color:var(--text);white-space:pre-wrap;margin-bottom:10px">' + _esc(a.body) + '</div>' +
          '<div style="font-size:11px;color:var(--text3);display:flex;gap:10px;align-items:center">' +
            '<span>' + _esc(a.author_name) + ' · ' + new Date(a.created_at).toLocaleDateString('uz-UZ') + '</span>' +
            (isAsker && !a.is_accepted ? '<button class="btn btn-secondary btn-sm" onclick="acceptForumAnswer(' + a.id + ',' + qid + ')">Qabul qilish</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
      return ans;
    }).join('') +

    '<div style="margin-top:18px;padding-top:18px;border-top:1px solid var(--border)">' +
      '<textarea id="forumAnsBody" rows="4" placeholder="Javobingizni yozing..." maxlength="5000" style="width:100%;padding:10px 14px;border:1.5px solid var(--border2);border-radius:9px;font-family:inherit;font-size:14px;resize:vertical;box-sizing:border-box"></textarea>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:10px">' +
        '<button class="btn btn-primary" onclick="postForumAnswer(' + qid + ')">Javob berish</button>' +
      '</div>' +
    '</div>';
}

async function postForumAnswer(qid) {
  var body = document.getElementById('forumAnsBody').value.trim();
  if (body.length < 5) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', 'Javob ≥5 belgi bo\'lishi kerak');
    return;
  }
  try {
    await api('POST', '/forum/questions/' + qid + '/answers', { body });
    if (typeof showToast === 'function') showToast('✅', 'Yuborildi', 'Javobingiz qo\'shildi');
    openForumDetail(qid);
  } catch (e) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', e.message || 'Yuborilmadi');
  }
}

async function voteForum(type, id, btn, qid) {
  try {
    var res = await api('POST', '/forum/vote', { targetType: type, targetId: id });
    openForumDetail(qid);
  } catch (e) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', e.message || 'Ovoz berilmadi');
  }
}

async function acceptForumAnswer(answerId, qid) {
  try {
    await api('POST', '/forum/accept/' + answerId, {});
    if (typeof showToast === 'function') showToast('✅', 'Qabul qilindi', 'Javob to\'g\'ri deb belgilandi');
    openForumDetail(qid);
    loadForum();
  } catch (e) {
    if (typeof showToast === 'function') showToast('⚠️', 'Xato', e.message || 'Qabul qilinmadi');
  }
}

console.log('✅ Forum module loaded');
