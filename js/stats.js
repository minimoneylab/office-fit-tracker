function localDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function mondayOfThisWeek() {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return localDateStr(d);
}

function dateRange(startStr, endStr) {
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    const dates = [];
    let d = new Date(start);
    while (d <= end) {
        dates.push(localDateStr(d));
        d.setDate(d.getDate() + 1);
    }
    return dates;
}

async function init() {
    if (!requireConfig()) return;

    const weekStart = mondayOfThisWeek();
    const today = localDateStr(new Date());
    const weekDates = dateRange(weekStart, today);

    const { data: users } = await db.from('users').select('id, name, photo_url');
    const { data: activities } = await db.from('activity_types').select('*').eq('active', true).order('name');
    const { data: logs } = await db
        .from('logs')
        .select('value, user_id, activity_type_id, log_date')
        .gte('log_date', weekStart)
        .lte('log_date', today);
    const { data: dailyTargets } = await db.from('daily_targets').select('user_id, activity_type_id, target_value');

    if (!users || !activities) return;

    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    renderAchievementBoard(dailyTargets || [], logs || [], weekDates, userMap);
    renderTeamTotals(activities, logs || []);
    renderLeaderboards(activities, logs || [], userMap);
}

function renderAchievementBoard(dailyTargets, logs, weekDates, userMap) {
    const wrap = document.getElementById('achievement-board');

    // targets per user: { userId: { activityTypeId: targetValue } }
    const targetsByUser = {};
    dailyTargets.forEach(t => {
        if (!targetsByUser[t.user_id]) targetsByUser[t.user_id] = {};
        targetsByUser[t.user_id][t.activity_type_id] = Number(t.target_value);
    });

    // actual per user per day per activity
    const actualByUser = {};
    logs.forEach(l => {
        if (!actualByUser[l.user_id]) actualByUser[l.user_id] = {};
        if (!actualByUser[l.user_id][l.log_date]) actualByUser[l.user_id][l.log_date] = {};
        actualByUser[l.user_id][l.log_date][l.activity_type_id] =
            (actualByUser[l.user_id][l.log_date][l.activity_type_id] || 0) + Number(l.value);
    });

    const scores = Object.entries(targetsByUser).map(([uid, targets]) => {
        const activityIds = Object.keys(targets);
        if (activityIds.length === 0) return null;

        const dailyScores = weekDates.map(date => {
            const dayActuals = (actualByUser[uid] && actualByUser[uid][date]) || {};
            const ratios = activityIds.map(actId => {
                const target = targets[actId];
                const actual = dayActuals[actId] || 0;
                return target > 0 ? Math.min(100, (actual / target) * 100) : 0;
            });
            return ratios.reduce((s, r) => s + r, 0) / ratios.length;
        });

        const weeklyAvg = dailyScores.reduce((s, d) => s + d, 0) / dailyScores.length;
        return { uid, avg: weeklyAvg };
    }).filter(Boolean).sort((a, b) => b.avg - a.avg).slice(0, 10);

    if (!scores.length) {
        wrap.innerHTML = '<div class="empty-state">No one has set daily targets yet — set some on the Daily page to appear here.</div>';
        return;
    }

    wrap.innerHTML = scores.map((s, i) => {
        const user = userMap[s.uid];
        const name = user ? user.name : 'Unknown';
        const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
        const avatar = user && user.photo_url ? `<img src="${user.photo_url}" alt="${name}">` : initials;
        const pct = Math.round(s.avg);
        const badge = pct >= 100 ? ' 🎉' : '';
        return `
            <div class="leader-row">
                <div class="leader-rank">${i + 1}</div>
                <div class="leader-avatar">${avatar}</div>
                <div class="leader-name">${name}${badge}</div>
                <div class="leader-val">${pct}%</div>
            </div>
        `;
    }).join('');
}

function renderTeamTotals(activities, logs) {
    const wrap = document.getElementById('team-totals');
    wrap.innerHTML = '';
    activities.forEach(a => {
        const rows = logs.filter(l => l.activity_type_id === a.id);
        const total = round2(rows.reduce((sum, r) => sum + Number(r.value), 0));
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="section-label">${a.icon || ''} ${a.name} — team total this week</div>
            <div style="font-size:2rem; font-weight:300;">${total} <span style="font-size:1rem; color:var(--text-light);">${a.unit}</span></div>
        `;
        wrap.appendChild(card);
    });
}

function renderLeaderboards(activities, logs, userMap) {
    const wrap = document.getElementById('leaderboards');
    wrap.innerHTML = '';
    activities.forEach(a => {
        const rows = logs.filter(l => l.activity_type_id === a.id);
        const byUser = {};
        rows.forEach(r => {
            byUser[r.user_id] = (byUser[r.user_id] || 0) + Number(r.value);
        });
        const ranked = Object.entries(byUser).sort((x, y) => y[1] - x[1]).slice(0, 10);

        const card = document.createElement('div');
        card.className = 'card';
        let rowsHtml = ranked.length
            ? ranked.map(([uid, val], i) => {
                const user = userMap[uid];
                const name = user ? user.name : 'Unknown';
                const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                const avatar = user && user.photo_url
                    ? `<img src="${user.photo_url}" alt="${name}">`
                    : initials;
                return `
                <div class="leader-row">
                    <div class="leader-rank">${i + 1}</div>
                    <div class="leader-avatar">${avatar}</div>
                    <div class="leader-name">${name}</div>
                    <div class="leader-val">${round2(val)} ${a.unit}</div>
                </div>`;
            }).join('')
            : '<div class="empty-state">No entries yet this week.</div>';
        card.innerHTML = `<div class="section-label">${a.name} leaderboard</div>${rowsHtml}`;
        wrap.appendChild(card);
    });
}

init();
