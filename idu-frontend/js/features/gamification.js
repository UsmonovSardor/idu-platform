'use strict';
// IDU — Gamification module (XP, badges, leaderboard)

var XP_LEVEL_NAMES = ['Yangi boshlovchi','Izlanuvchi','Talaba','Faol talaba','Ilg\'or','Ekspert','Ustoz','Chempion','Legend','Grand Master'];

function getLevelName(level) { return XP_LEVEL_NAMES[Math.min(level-1, XP_LEVEL_NAMES.length-1)] || 'Grand Master'; }
function getLevelColor(level) {
  var colors = ['#94A3B8','#22C55E','#3B82F6','#8B5CF6','#F59E0B','#EF4444','#EC4899','#F97316','#0EA5E9','#FFD700'];
  return colors[Math.min(level-1, colors.length-1)];
}

// ── Render student XP widget (inside student dashboard) ───────────────────────
async function renderXPWidget() {
  var el = document.getElementById('xpWidget');
  if (!el) return;
  try {
    var data = await api('GET', '/gamification/me');
    var pct = data.nextThreshold > data.prevThreshold
      ? Math.round(100*(data.xp - data.prevThreshold)/(data.nextThreshold - data.prevThreshold))
      : 100;
    var color = getLevelColor(data.level);

    el.innerHTML = '<div style="background:linear-gradient(135deg,' + color + '22,' + color + '11);border:1.5px solid ' + color + '44;border-radius:16px;padding:16px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
      + '<div>'
      + '<div style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:1px">Level ' + data.level + '</div>'
      + '<div style="font-size:18px;font-weight:900;color:' + color + '">' + getLevelName(data.level) + '</div>'
      + '</div>'
      + '<div style="text-align:right">'
      + '<div style="font-size:24px;font-weight:900;color:' + color + '">' + data.xp.toLocaleString() + '</div>'
      + '<div style="font-size:10px;color:#94A3B8">XP</div>'
      + '</div>'
      + '</div>'
      + '<div style="height:8px;background:#E2E8F0;border-radius:4px;overflow:hidden;margin-bottom:6px">'
      + '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:4px;transition:width 1s ease"></div>'
      + '</div>'
      + '<div style="display:flex;justify-content:space-between;font-size:10px;color:#94A3B8">'
      + '<span>' + data.prevThreshold + ' XP</span>'
      + '<span>' + pct + '% — Keyingi: ' + data.nextThreshold + ' XP</span>'
      + '</div>'
      + (data.badges && data.badges.length ? renderBadgeStrip(data.badges) : '')
      + '</div>';
  } catch(e) {
    el.innerHTML = '<div style="color:#94A3B8;font-size:12px;padding:8px">XP yuklanmadi</div>';
  }
}

function renderBadgeStrip(badges) {
  return '<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:6px">'
    + badges.map(function(b) {
      return '<div title="' + (b.name||b.badge_code) + ': ' + (b.desc||'') + '" style="background:' + (b.color||'#94A3B8') + '22;border:1px solid ' + (b.color||'#94A3B8') + '55;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;color:' + (b.color||'#64748B') + ';cursor:default">'
        + (b.icon||'🏅') + ' ' + (b.name||b.badge_code) + '</div>';
    }).join('') + '</div>';
}

// ── Leaderboard page — 21st.dev "Top Authors" style ──────────────────────────
async function renderLeaderboard() {
  var el = document.getElementById('leaderboardList');
  if (!el) return;
  el.innerHTML = '<div style="padding:20px 0;text-align:center;color:var(--text3);font-size:13px">⏳ Yuklanmoqda...</div>';

  var group = (document.getElementById('lbGroupFilter')||{}).value || '';
  var q = group ? '?group=' + encodeURIComponent(group) : '';

  try {
    var rows = await api('GET', '/gamification/leaderboard' + q);
    if (!rows.length) {
      el.innerHTML = '<div style="padding:32px 0;text-align:center;color:var(--text3);font-size:13px">Hali ma\'lumot yo\'q</div>';
      return;
    }
    var myId = window.CURRENT_USER ? window.CURRENT_USER.id : null;
    // Header inspired by 21st.dev
    var now = new Date();
    var months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
    var monthLabel = months[now.getMonth()] + ' ' + now.getFullYear();
    var html = '<div class="lb-page-header">'
      + '<div class="lb-page-title">Top Talabalar</div>'
      + '<div class="lb-page-sub">' + monthLabel + ' · Eng faol o\'quvchilar XP reytingi</div>'
      + '</div>';
    html += rows.map(function(r, i) {
      var isMe = r.id === myId;
      var rankClass = i===0?' lb-r1':i===1?' lb-r2':i===2?' lb-r3':'';
      var rankHtml = i===0?'🥇':i===1?'🥈':i===2?'🥉':String(r.rank||i+1);
      var color = getLevelColor(r.level);
      var ini = (r.full_name||'?').split(' ').filter(Boolean).map(function(p){return p[0];}).join('').slice(0,2).toUpperCase();
      var avHtml = r.avatar_url
        ? '<div class="lb-av"><img src="' + r.avatar_url + '" onerror="this.parentNode.innerHTML=\'' + ini + '\'"></div>'
        : '<div class="lb-av" style="background:' + color + 'cc">' + ini + '</div>';
      var badgesHtml = '';
      if (r.badges && r.badges.length) {
        badgesHtml = '<div class="lb-badges">'
          + r.badges.slice(0,3).map(function(b){
            return '<span class="lb-badge-chip" style="background:' + (b.color||'#94A3B8') + '18;border-color:' + (b.color||'#94A3B8') + '44;color:' + (b.color||'#64748B') + '">'
              + (b.icon||'🏅') + ' ' + (b.name||b.badge_code) + '</span>';
          }).join('')
          + '</div>';
      }
      return '<div class="lb-row' + (isMe?' lb-row-me':'') + '">'
        + '<div class="lb-rank' + rankClass + '">' + rankHtml + '</div>'
        + avHtml
        + '<div class="lb-body">'
          + '<div class="lb-name">' + (r.full_name||'—') + (isMe?' <span style="font-size:10px;color:var(--primary);font-weight:700">· Siz</span>':'') + '</div>'
          + '<div class="lb-meta">' + (r.group_name||'') + (r.group_name&&r.level?' · ':'') + (r.level?'Level '+r.level+' '+getLevelName(r.level):'') + '</div>'
          + badgesHtml
        + '</div>'
        + '<div class="lb-stats">'
          + '<div class="lb-stat">'
            + '<div class="lb-stat-val">' + (r.xp||0).toLocaleString() + '</div>'
            + '<div class="lb-stat-key">XP</div>'
          + '</div>'
          + '<div class="lb-stat">'
            + '<div class="lb-stat-val">' + (r.badge_count||0) + '</div>'
            + '<div class="lb-stat-key">Badge</div>'
          + '</div>'
        + '</div>'
        + '</div>';
    }).join('');
    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = '<div style="color:var(--red);padding:14px;font-size:13px">Xato: ' + e.message + '</div>';
  }
}

// ── Rector: trigger recalculate ───────────────────────────────────────────────
async function recalcAllXP() {
  var btn = document.getElementById('recalcXpBtn');
  if (btn) { btn.disabled=true; btn.textContent='Hisoblanmoqda...'; }
  try {
    var r = await api('POST', '/gamification/recalculate', {});
    showToast('✅','XP',r.message||'Hisoblandi');
    renderLeaderboard();
  } catch(e) {
    showToast('❌','Xato',e.message);
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='🔄 XP qayta hisoblash'; }
  }
}
