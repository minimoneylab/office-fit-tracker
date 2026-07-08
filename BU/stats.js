function mondayOfThisWeek() {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split('T')[0];
}

async function init() {
    if (!requireConfig()) return;

    const weekStart = mondayOfThisWeek();
    const today = new Date().toISOString().split('T')[0];

    const { data: users } = await db.from('users').select('id, name');
    const { data: activities } = await db.from('activity_types').select('*').eq('active', true).order('name');
    const { data: logs } = await db
        .from('logs')
        .select('value, user_id, activity_type_id')
        .gte('log_date', weekStart)
        .lte('log_date', today);

    if (!users || !activities) return;

    const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

    renderTeamTotals(activities, logs || []);
    renderLeaderboards(activities, logs || [], userMap);
}

function renderTeamTotals(activities, logs) {
    const wrap = document.getElementById('team-totals');
    wrap.innerHTML = '';
    activities.forEach(a => {
        const rows = logs.filter(l => l.activity_type_id === a.id);
        const total = rows.reduce((sum, r) => sum + Number(r.value), 0);
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
        const ranked = Object.entries(byUser).sort((x, y) => y[1] - x[1]).slice(0, 5);

        const card = document.createElement('div');
        card.className = 'card';
        let rowsHtml = ranked.length
            ? ranked.map(([uid, val], i) => `
                <div class="leader-row">
                    <div class="leader-rank">${i + 1}</div>
                    <div class="leader-name">${userMap[uid] || 'Unknown'}</div>
                    <div class="leader-val">${val} ${a.unit}</div>
                </div>`).join('')
            : '<div class="empty-state">No entries yet this week.</div>';
        card.innerHTML = `<div class="section-label">${a.name} leaderboard</div>${rowsHtml}`;
        wrap.appendChild(card);
    });
}

init();
