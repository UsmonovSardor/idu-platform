'use strict';
// IDU — Gamification module (XP, badges, leaderboard)

var LEVEL_NAMES = ['Yangi boshlovchi','Izlanuvchi','Talaba','Faol talaba','Ilg\'or','Ekspert','Ustoz','Chempion','Legend','Grand Master'];

function getLevelName(level) { return LEVEL_NAMES[Math.min(level-1, LEVEL_NAMES.length-1)] || 'Grand Master'; }
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

// ── Leaderboard page ──────────────────────────────────────────────────────────
async function renderLeaderboard() {
  var el = document.getElementById('leaderboardList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:20px">Yuklanmoqda...</div>';

  var group = (document.getElementById('lbGroupFilter')||{}).value || '';
  var q = group ? '?group=' + encodeURIComponent(group) : '';

  try {
    var rows = await api('GET', '/gamification/leaderboard' + q);
    if (!rows.length) {
      el.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:20px">Hali ma\'lumot yo\'q</div>';
      return;
    }
    var myId = window.CURRENT_USER ? window.CURRENT_USER.id : null;
    el.innerHTML = rows.map(function(r, i) {
      var isMe = r.id === myId;
      var medalIcon = i===0?'🥇':i===1?'🥈':i===2?'🥉':r.rank+'';
      var color = getLevelColor(r.level);
      return '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;margin-bottom:8px;background:' + (isMe?'#EFF6FF':'#F8FAFC') + ';border:' + (isMe?'2px solid #1B4FD8':'1.5px solid #E2E8F0') + '">'
        + '<div style="font-size:' + (i<3?'22px':'14px') + ';width:32px;text-align:center;font-weight:900;color:' + (i<3?'inherit':'#94A3B8') + '">' + medalIcon + '</div>'
        + '<div style="flex:1">'
        + '<div style="font-weight:700;font-size:13px' + (isMe?';color:#1B4FD8':'')+'">' + r.full_name + (isMe?' (Siz)':'') + '</div>'
        + '<div style="font-size:11px;color:#94A3B8">' + (r.group_name||'') + ' · Level ' + r.level + ' ' + getLevelName(r.level) + '</div>'
        + '</div>'
        + '<div style="text-align:right">'
        + '<div style="font-size:16px;font-weight:900;color:' + color + '">' + (r.xp||0).toLocaleString() + '</div>'
        + '<div style="font-size:10px;color:#94A3B8">' + r.badge_count + ' badge</div>'
        + '</div>'
        + '</div>';
    }).join('');
  } catch(e) {
    el.innerHTML = '<div style="color:#DC2626;padding:12px">Xato: ' + e.message + '</div>';
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
