// ── CONSTANTES ──
const DATA_KEY = 'pointage_data';
const SETTINGS_KEY = 'pointage_settings';

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const JOURS_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MOIS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
const MOIS_FULL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// ── DONNÉES ──
let data = {};
let settings = {
  heureArrivee: '08:00',
  heureDepart: '17:00',
  weeklyHours: 35
};

function loadData() {
  const d = localStorage.getItem(DATA_KEY);
  if (d) data = JSON.parse(d);
  const s = localStorage.getItem(SETTINGS_KEY);
  if (s) settings = { ...settings, ...JSON.parse(s) };
}

function saveData() {
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

function savePersistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ── HELPERS ──
function todayKey() {
  return new Date().toISOString().split('T')[0];
}

function formatTime(t) {
  return t || '--:--';
}

function calcDuration(arrivee, depart) {
  if (!arrivee || !depart) return null;
  const [ah, am] = arrivee.split(':').map(Number);
  const [dh, dm] = depart.split(':').map(Number);
  const total = (dh * 60 + dm) - (ah * 60 + am);
  if (total <= 0) return null;
  return { h: Math.floor(total / 60), m: total % 60, total };
}

function fmtDur(dur) {
  if (!dur) return '--h--';
  return `${dur.h}h${String(dur.m).padStart(2, '0')}`;
}

function fmtMinutes(totalMin) {
  if (!totalMin) return '0h00';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function getWeekDates() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function getWeekNumber(d) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ── NAVIGATION ──
function showPage(pageId, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + pageId).classList.add('active');
  btn.classList.add('active');

  if (pageId === 'historique') renderHistory();
  if (pageId === 'stats') renderStats();
  if (pageId === 'settings') renderSettingsPage();
}

// ── POINTAGE ──
function pointer(type) {
  const now = new Date();
  const key = todayKey();
  const heure = now.toTimeString().slice(0, 5);

  if (!data[key]) data[key] = {};

  if (type === 'arrivee') {
    if (data[key].arrivee) {
      if (!confirm(`Tu as déjà pointé ton arrivée à ${data[key].arrivee}. Remplacer ?`)) return;
    }
    data[key].arrivee = heure;
    showToast(`✅ Arrivée pointée à ${heure}`);
  } else {
    if (!data[key].arrivee) {
      showToast('⚠️ Pointe d\'abord ton arrivée !');
      return;
    }
    if (data[key].depart) {
      if (!confirm(`Tu as déjà pointé ton départ à ${data[key].depart}. Remplacer ?`)) return;
    }
    data[key].depart = heure;
    showToast(`✅ Départ pointé à ${heure}`);
  }

  saveData();
  if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
  updateAccueil();
}

// ── MISE À JOUR ACCUEIL ──
function updateAccueil() {
  const key = todayKey();
  const today = data[key] || {};
  const now = new Date();

  // Date
  const jour = JOURS_FULL[now.getDay()];
  const mois = MOIS_FULL[now.getMonth()];
  document.getElementById('date-today').textContent =
    `${jour} ${now.getDate()} ${mois} ${now.getFullYear()}`;

  // Statut
  const card = document.getElementById('status-card');
  const icon = document.getElementById('status-icon');
  const text = document.getElementById('status-text');
  const timeEl = document.getElementById('status-time');

  if (today.depart) {
    card.className = 'status-card done';
    icon.textContent = '✅';
    text.textContent = 'Journée terminée !';
    const dur = calcDuration(today.arrivee, today.depart);
    timeEl.textContent = dur ? `${fmtDur(dur)} travaillées` : '';
  } else if (today.arrivee) {
    card.className = 'status-card working';
    icon.textContent = '💼';
    text.textContent = 'En cours de travail';
    const [ah, am] = today.arrivee.split(':').map(Number);
    const elapsedMin = (now.getHours() * 60 + now.getMinutes()) - (ah * 60 + am);
    timeEl.textContent = elapsedMin >= 0 ? `Depuis ${fmtMinutes(elapsedMin)}` : '';
  } else {
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    card.className = 'status-card';
    if (isWeekend) {
      icon.textContent = '😎';
      text.textContent = 'Bon week-end !';
      timeEl.textContent = 'Pas de travail aujourd\'hui';
    } else {
      icon.textContent = '⏰';
      text.textContent = 'Non pointé';
      timeEl.textContent = '';
    }
  }

  // Boutons
  document.getElementById('btn-arrive').disabled = !!today.arrivee;
  document.getElementById('btn-depart').disabled = !today.arrivee || !!today.depart;

  // Résumé du jour
  document.getElementById('today-arrive').textContent = formatTime(today.arrivee);
  document.getElementById('today-depart').textContent = formatTime(today.depart);
  const dur = calcDuration(today.arrivee, today.depart);
  document.getElementById('today-total').textContent = fmtDur(dur);

  // Semaine
  updateWeek();
}

function updateWeek() {
  const weekDates = getWeekDates();
  const now = new Date();
  const todayStr = todayKey();
  let totalMin = 0;

  const daysHtml = weekDates.map(date => {
    const entry = data[date] || {};
    const dur = calcDuration(entry.arrivee, entry.depart);
    if (dur) totalMin += dur.total;
    const d = new Date(date + 'T12:00:00');
    const isToday = date === todayStr;
    let dotClass = 'week-day-dot';
    if (dur) dotClass += ' done';
    else if (entry.arrivee) dotClass += ' partial';
    if (isToday) dotClass += ' today';
    const label = dur ? `${dur.h}h` : (entry.arrivee ? '…' : '');
    return `
      <div class="week-day">
        <div class="week-day-name">${JOURS[d.getDay()]}</div>
        <div class="${dotClass}">${label}</div>
      </div>`;
  }).join('');

  document.getElementById('week-days').innerHTML = daysHtml;
  document.getElementById('week-hours').textContent = fmtMinutes(totalMin);

  const target = settings.weeklyHours * 60;
  document.getElementById('week-target-label').textContent = fmtMinutes(target);
  const pct = Math.min(100, (totalMin / target) * 100);
  const bar = document.getElementById('week-bar');
  bar.style.width = pct + '%';
  bar.style.background = pct >= 100 ? 'var(--success)' : 'var(--primary)';
}

// ── HISTORIQUE ──
function renderHistory() {
  const list = document.getElementById('history-list');
  const entries = Object.entries(data).sort((a, b) => b[0].localeCompare(a[0]));

  if (!entries.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <p>Aucun pointage enregistré</p>
      </div>`;
    return;
  }

  list.innerHTML = entries.map(([date, entry]) => {
    const d = new Date(date + 'T12:00:00');
    const dur = calcDuration(entry.arrivee, entry.depart);
    return `
      <div class="history-item">
        <div class="history-date-col">
          <span class="history-day-name">${JOURS[d.getDay()]}</span>
          <span class="history-day-num">${d.getDate()}</span>
          <span class="history-month">${MOIS[d.getMonth()]}</span>
        </div>
        <div class="history-times">
          <span class="time-chip arrivee">${formatTime(entry.arrivee)}</span>
          <span class="time-arrow">→</span>
          <span class="time-chip depart">${formatTime(entry.depart)}</span>
        </div>
        <div class="history-dur ${dur ? '' : 'incomplete'}">
          ${dur ? fmtDur(dur) : (entry.arrivee ? 'en cours' : '?')}
        </div>
      </div>`;
  }).join('');
}

// ── STATS ──
function renderStats() {
  const content = document.getElementById('stats-content');
  const completed = Object.entries(data).filter(([, e]) => e.arrivee && e.depart);

  if (!completed.length) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <p>Pas encore assez de données</p>
      </div>`;
    return;
  }

  const durations = completed.map(([, e]) => calcDuration(e.arrivee, e.depart).total);
  const totalMin = durations.reduce((a, b) => a + b, 0);
  const avgMin = Math.round(totalMin / durations.length);
  const maxMin = Math.max(...durations);
  const minMin = Math.min(...durations);

  // Semaines
  const byWeek = {};
  completed.forEach(([date, entry]) => {
    const d = new Date(date + 'T12:00:00');
    const wk = `S${getWeekNumber(d)}`;
    if (!byWeek[wk]) byWeek[wk] = 0;
    byWeek[wk] += calcDuration(entry.arrivee, entry.depart).total;
  });
  const weekEntries = Object.entries(byWeek).slice(-5);
  const maxWeek = Math.max(...weekEntries.map(([, v]) => v), settings.weeklyHours * 60);

  const barsHtml = weekEntries.map(([week, min]) => {
    const pct = (min / maxWeek) * 100;
    const color = min >= settings.weeklyHours * 60 ? 'var(--success)' : 'var(--primary)';
    return `
      <div class="bar-col">
        <div class="bar-val">${fmtMinutes(min)}</div>
        <div class="bar-fill" style="height:${pct}%;background:${color}"></div>
        <div class="bar-week-label">${week}</div>
      </div>`;
  }).join('');

  content.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${completed.length}</div>
        <div class="stat-label">Jours pointés</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${fmtMinutes(avgMin)}</div>
        <div class="stat-label">Moyenne / jour</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${fmtMinutes(totalMin)}</div>
        <div class="stat-label">Total cumulé</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${fmtMinutes(maxMin)}</div>
        <div class="stat-label">Plus longue journée</div>
      </div>
    </div>
    <div class="chart-card">
      <div class="chart-title">Heures par semaine</div>
      <div class="bar-chart">${barsHtml}</div>
    </div>`;
}

// ── PARAMÈTRES ──
function renderSettingsPage() {
  document.getElementById('set-heure-arrivee').value = settings.heureArrivee;
  document.getElementById('set-heure-depart').value = settings.heureDepart;
  document.getElementById('set-weekly-hours').value = settings.weeklyHours;
  document.getElementById('shortcut-matin').textContent = settings.heureArrivee;
  document.getElementById('shortcut-soir').textContent = settings.heureDepart;
}

function saveSettings() {
  settings.heureArrivee = document.getElementById('set-heure-arrivee').value;
  settings.heureDepart = document.getElementById('set-heure-depart').value;
  settings.weeklyHours = parseInt(document.getElementById('set-weekly-hours').value) || 35;
  savePersistSettings();
  document.getElementById('shortcut-matin').textContent = settings.heureArrivee;
  document.getElementById('shortcut-soir').textContent = settings.heureDepart;
  showToast('✅ Paramètres enregistrés !');
  updateAccueil();
}

// ── EXPORT CSV ──
function exportCSV() {
  let csv = 'Date,Jour,Arrivée,Départ,Durée\n';
  Object.entries(data).sort().forEach(([date, entry]) => {
    const d = new Date(date + 'T12:00:00');
    const jour = JOURS_FULL[d.getDay()];
    const dur = calcDuration(entry.arrivee, entry.depart);
    csv += `${date},${jour},${entry.arrivee || ''},${entry.depart || ''},${dur ? fmtDur(dur) : ''}\n`;
  });
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pointage_${todayKey()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── EFFACER ──
function clearAllData() {
  if (confirm('Effacer tous les pointages ? Cette action est irréversible.')) {
    data = {};
    saveData();
    updateAccueil();
    showToast('🗑 Données effacées');
  }
}

// ── TIMER LIVE ──
setInterval(() => {
  const key = todayKey();
  if (data[key]?.arrivee && !data[key]?.depart) updateAccueil();
}, 30000);

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  // Créer le toast
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast';
  document.body.appendChild(toast);

  loadData();
  updateAccueil();

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }
});
