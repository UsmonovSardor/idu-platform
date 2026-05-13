'use strict';
// IDU - features/grades.js — Real API

function getGrade(total) {
  if (total >= 86) return { letter: "A (a'lo)", cls: 'gc-a' };
  if (total >= 71) return { letter: 'B (yaxshi)', cls: 'gc-b' };
  if (total >= 56) return { letter: 'C (qoniq.)', cls: 'gc-c' };
  if (total >= 41) return { letter: 'D (qoniq.)', cls: 'gc-d' };
  return { letter: 'F (qoniq.)', cls: 'gc-f' };
}

async function renderGrades() {
  const el = document.getElementById('gradesBody');
  if (!el) return;
  el.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#94a3b8">⏳ Yuklanmoqda...</td></tr>';
  try {
    if (!currentUser) return;
    const grades = await api('GET', '/students/' + currentUser.id + '/grades');
    if (!Array.isArray(grades) || !grades.length) {
      el.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:#94a3b8">📚 Baholar hali kiritilmagan</td></tr>';
      // Dashboard stat cardlarini ham yangilash
      const avgEl = document.getElementById('avgScore');
      if (avgEl) avgEl.textContent = '0';
      return;
    }
    let sum = 0, alo = 0, good = 0, fail = 0;
    const q = (document.getElementById('gradesSearch')?.value || '').toLowerCase();
    const data = grades.filter(g => !q || (g.course_name||'').toLowerCase().includes(q));
    el.innerHTML = data.map((g, idx) => {
      const total = parseFloat(g.total) || (parseFloat(g.jn)||0) + (parseFloat(g.on_score)||0) + (parseFloat(g.yn)||0) + (parseFloat(g.mi)||0);
      sum += total;
      const { letter, cls } = getGrade(total);
      if (total >= 86) alo++; else if (total >= 71) good++; else if (total < 56) fail++;
      const jn = parseFloat(g.jn) || 0, on = parseFloat(g.on_score) || 0, yn = parseFloat(g.yn) || 0, mi = parseFloat(g.mi) || 0;
      const jb = jn >= 25 ? '#D1FAE5' : jn >= 18 ? '#FEF9C3' : '#FEE2E2';
      const ob = on >= 17 ? '#D1FAE5' : on >= 12 ? '#FEF9C3' : '#FEE2E2';
      const yb = yn >= 25 ? '#D1FAE5' : yn >= 18 ? '#FEF9C3' : '#FEE2E2';
      const mb = mi >= 17 ? '#D1FAE5' : mi >= 12 ? '#FEF9C3' : '#FEE2E2';
      return `<tr>
        <td>${idx + 1}</td>
        <td style="font-weight:600">${g.course_name || g.course_code || '—'}</td>
        <td style="color:#64748b;font-size:12px">${g.semester || '—'}-semestr · ${g.academic_year || ''}</td>
        <td><span style="background:${jb};padding:2px 9px;border-radius:5px;font-weight:700">${jn}</span><span style="color:#9CA3AF;font-size:10px"> /30</span></td>
        <td><span style="background:${ob};padding:2px 9px;border-radius:5px;font-weight:700">${on}</span><span style="color:#9CA3AF;font-size:10px"> /20</span></td>
        <td><span style="background:${yb};padding:2px 9px;border-radius:5px;font-weight:700">${yn}</span><span style="color:#9CA3AF;font-size:10px"> /30</span></td>
        <td><span style="background:${mb};padding:2px 9px;border-radius:5px;font-weight:700">${mi}</span><span style="color:#9CA3AF;font-size:10px"> /20</span></td>
        <td><strong>${total}</strong></td>
        <td><span class="grade-chip ${cls}">${letter}</span></td>
      </tr>`;
    }).join('');
    // Stat cards yangilash
    const avg = data.length ? (sum / data.length).toFixed(1) : '0';
    const avgEl = document.getElementById('avgScore'); if (avgEl) avgEl.textContent = avg;
    const excEl = document.getElementById('excellentCount'); if (excEl) excEl.textContent = alo;
    const failEl = document.getElementById('failCount'); if (failEl) failEl.textContent = fail;
  } catch (e) {
    el.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:#ef4444">Xato: ${e.message}</td></tr>`;
  }
}

async function renderDashboardGrades() {
  const el = document.getElementById('recentGradesBody');
  if (!el || !currentUser) return;
  try {
    const grades = await api('GET', '/students/' + currentUser.id + '/grades');
    if (!Array.isArray(grades) || !grades.length) {
      el.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8">Baholar hali yo\'q</td></tr>';
      return;
    }
    el.innerHTML = grades.slice(0, 5).map(g => {
      const total = parseFloat(g.total) || 0;
      const { letter, cls } = getGrade(total);
      return `<tr>
        <td><strong>${g.course_name || '—'}</strong></td>
        <td>${g.jn || 0}</td><td>${g.on_score || 0}</td>
        <td>${g.yn || 0}</td><td>${g.mi || 0}</td>
        <td><strong>${total}</strong></td>
        <td><span class="grade-chip ${cls}">${letter}</span></td>
      </tr>`;
    }).join('');
  } catch (e) {
    el.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8">—</td></tr>';
  }
}

function filterGradesSt(f, btn) {
  document.querySelectorAll('#page-grades .xl-filter-chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderGrades();
}
