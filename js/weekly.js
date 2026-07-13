let selectedUserId = null;
let usersCache = [];
let activityTypes = [];
let dailyTargets = {};
let currentPeriod = 'week';
let chartInstances = {};

if (window.ChartDataLabels) Chart.register(ChartDataLabels);

function localDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function todayStr() { return localDateStr(new Date()); }

function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
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

function mondayOfThisWeek() {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return localDateStr(d);
}

function sundayOfThisWeek() {
    const monday = new Date(mondayOfThisWeek() + 'T00:00:00');
    monday.setDate(monday.getDate() + 6);
    return localDateStr(monday);
}

function firstOfThisMonth() {
    const d = new Date();
    return localDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
}

function lastOfThisMonth() {
    const d = new Date();
    return localDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function formatLabel(dateStr, period) {
    const d = new Date(dateStr + 'T00:00:00');
    if (period === 'week') return d.toLocaleDateString('en-US', { weekday: 'short' });
    if (period === 'month') return String(d.getDate());
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isWeekday(dateStr) {
    const day = new Date(dateStr + 'T00:00:00').getDay();
    return day !== 0 && day !== 6;
}

function filterWeekdays(dates) {
    return dates.filter(isWeekday);
}

function buildTargetTimeline(historyRows) {
    return [...historyRows].sort((a, b) => {
        if (a.effective_date !== b.effective_date) return a.effective_date < b.effective_date ? -1 : 1;
        return new Date(a.created_at) - new Date(b.created_at);
    });
}

function targetForDate(sortedHistory, dateStr) {
    let result = null;
    for (const row of sortedHistory) {
        if (row.effective_date <= dateStr) result = Number(row.target_value);
        else break;
    }
    return result;
}

async function init() {
    if (!requireConfig()) return;
    await loadUsers();

    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPeriod = btn.dataset.period;
            if (selectedUserId) renderAllCharts();
        };
    });
}

async function loadUsers() {
    const { data } = await db.from('users').select('*').order('name');
    usersCache = data || [];
    const grid = document.getElementById('user-grid');
    grid.innerHTML = '';
    usersCache.forEach(user => {
        const card = document.createElement('div');
        card.className = 'user-card';
        const initials = user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
        card.innerHTML = `
            <div class="user-avatar">${user.photo_url ? `<img src="${user.photo_url}" alt="${user.name}">` : initials}</div>
            <div class="user-card-name">${user.name}</div>
        `;
        card.onclick = () => selectUser(user.id, card);
        grid.appendChild(card);
    });
}

async function selectUser(userId, cardEl) {
    selectedUserId = userId;
    document.querySelectorAll('.user-card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');
    document.getElementById('stats-panel').style.display = 'block';
    document.getElementById('no-user-hint').style.display = 'none';

    const user = usersCache.find(u => u.id === userId);
    const initials = user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    document.getElementById('profile-avatar').innerHTML = user.photo_url
        ? `<img src="${user.photo_url}" alt="${user.name}">` : initials;
    document.getElementById('profile-name').textContent = user.name;
    document.getElementById('profile-bio').textContent = user.bio ? `"${user.bio}"` : '';

    const { data: activities } = await db.from('activity_types').select('*').eq('active', true).order('name');
    activityTypes = activities || [];

    const { data: targets } = await db.from('daily_targets').select('*').eq('user_id', userId);
    dailyTargets = {};
    (targets || []).forEach(t => { dailyTargets[t.activity_type_id] = Number(t.target_value); });

    buildChartCards();
    renderAllCharts();
    renderScrawlSummary();
}

async function renderScrawlSummary() {
    const wrap = document.getElementById('scrawl-summary');
    if (!wrap) return;

    const { data: allLogs } = await db
        .from('logs')
        .select('value, activity_type_id, log_date')
        .eq('user_id', selectedUserId);

    const logs = allLogs || [];

    if (logs.length === 0) {
        wrap.innerHTML = `<div class="scrawl-since">No activity logged yet — nothing to summarize!</div>`;
        return;
    }

    const sinceDate = logs.reduce((min, l) => (l.log_date < min ? l.log_date : min), logs[0].log_date);
    const sinceLabel = new Date(sinceDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const weekStart = mondayOfThisWeek();
    const today = todayStr();

    const totalsWeek = {};
    const totalsAllTime = {};
    logs.forEach(l => {
        totalsAllTime[l.activity_type_id] = (totalsAllTime[l.activity_type_id] || 0) + Number(l.value);
        if (l.log_date >= weekStart && l.log_date <= today) {
            totalsWeek[l.activity_type_id] = (totalsWeek[l.activity_type_id] || 0) + Number(l.value);
        }
    });

    const activityLines = activityTypes.map(a => {
        const week = round2(totalsWeek[a.id] || 0);
        const all = round2(totalsAllTime[a.id] || 0);
        return `<div class="scrawl-line">${a.icon || ''} ${a.name}: <span class="scrawl-num">${week}</span> ${a.unit} (week to date) / <span class="scrawl-num">${all}</span> ${a.unit} (since day one)</div>`;
    }).join('');

    const achievement = computeWeeklyAchievement(logs);
    const achievementLine = achievement !== null
        ? `<div class="scrawl-achievement">🏆 Weekly Achievement Ratio: ${Math.round(achievement)}%</div>`
        : '';

    wrap.innerHTML = `
        <div class="scrawl-since">Since ${sinceLabel}</div>
        ${activityLines}
        ${achievementLine}
    `;
}

function computeWeeklyAchievement(logs) {
    const activityIds = Object.keys(dailyTargets);
    if (activityIds.length === 0) return null;

    const dates = dateRange(mondayOfThisWeek(), todayStr());
    const byDate = {};
    logs.forEach(l => {
        if (!byDate[l.log_date]) byDate[l.log_date] = {};
        byDate[l.log_date][l.activity_type_id] = (byDate[l.log_date][l.activity_type_id] || 0) + Number(l.value);
    });

    const dailyScores = dates.map(d => {
        const dayActuals = byDate[d] || {};
        const ratios = activityIds.map(actId => {
            const target = dailyTargets[actId];
            const actual = dayActuals[actId] || 0;
            return target > 0 ? Math.min(100, (actual / target) * 100) : 0;
        });
        return ratios.reduce((s, r) => s + r, 0) / ratios.length;
    });

    return dailyScores.reduce((s, d) => s + d, 0) / dailyScores.length;
}

function buildChartCards() {
    const wrap = document.getElementById('activity-charts');
    wrap.innerHTML = '';
    activityTypes.forEach(a => {
        const card = document.createElement('div');
        card.className = 'card chart-card';
        card.innerHTML = `
            <div class="chart-card-header">
                <div class="chart-card-title">${a.icon || ''} ${a.name}</div>
                <div class="chart-card-meta" id="meta-${a.id}"></div>
            </div>
            <div class="chart-canvas-wrap">
                <canvas id="chart-${a.id}" height="90"></canvas>
            </div>
            ${!dailyTargets[a.id] ? `<div class="no-target-note">No daily target set for ${a.name} — set one on the Daily page to see % achieved.</div>` : ''}
        `;
        wrap.appendChild(card);
    });
}

async function renderAllCharts() {
    for (const a of activityTypes) {
        await renderActivityChart(a);
    }
}

async function renderActivityChart(activity) {
    let dates;
    if (currentPeriod === 'week') {
        dates = filterWeekdays(dateRange(mondayOfThisWeek(), sundayOfThisWeek()));
    } else if (currentPeriod === 'month') {
        dates = filterWeekdays(dateRange(firstOfThisMonth(), lastOfThisMonth()));
    } else {
        const { data: earliest } = await db
            .from('logs')
            .select('log_date')
            .eq('user_id', selectedUserId)
            .eq('activity_type_id', activity.id)
            .order('log_date', { ascending: true })
            .limit(1);
        if (!earliest || earliest.length === 0) {
            dates = filterWeekdays(dateRange(todayStr(), todayStr()));
            if (dates.length === 0) dates = [todayStr()];
        } else {
            dates = filterWeekdays(dateRange(earliest[0].log_date, todayStr()));
        }
    }

    const rangeStart = dates[0];
    const rangeEnd = dates[dates.length - 1];

    const { data: logs } = await db
        .from('logs')
        .select('value, log_date')
        .eq('user_id', selectedUserId)
        .eq('activity_type_id', activity.id)
        .gte('log_date', rangeStart)
        .lte('log_date', rangeEnd);

    const { data: historyRows } = await db
        .from('daily_target_history')
        .select('target_value, effective_date, created_at')
        .eq('user_id', selectedUserId)
        .eq('activity_type_id', activity.id);

    const sortedHistory = buildTargetTimeline(historyRows || []);
    const dayTargets = dates.map(d => targetForDate(sortedHistory, d));
    const hasAnyTarget = dayTargets.some(t => t !== null);

    const totalsByDate = {};
    (logs || []).forEach(l => {
        totalsByDate[l.log_date] = (totalsByDate[l.log_date] || 0) + Number(l.value);
    });

    const today = todayStr();

    const values = dates.map(d => round2(totalsByDate[d] || 0));
    const labels = dates.map(d => formatLabel(d, currentPeriod));
    const pctLabels = dates.map((d, i) => {
        if (dayTargets[i] === null) return '';
        if (d > today) return '';
        return `${Math.round((values[i] / dayTargets[i]) * 100)}%`;
    });

    const grandTotal = round2(values.reduce((s, v) => s + v, 0));
    const currentTarget = dailyTargets[activity.id] || null;
    const metaEl = document.getElementById(`meta-${activity.id}`);
    if (metaEl) {
        metaEl.textContent = `Total: ${grandTotal} ${activity.unit}${currentTarget ? ` · Current target: ${currentTarget} ${activity.unit}/day` : ''}`;
    }

    const canvas = document.getElementById(`chart-${activity.id}`);
    if (!canvas) return;

    if (chartInstances[activity.id]) {
        chartInstances[activity.id].destroy();
    }

    const datasets = [{
        label: `${activity.name} (${activity.unit})`,
        data: values,
        backgroundColor: values.map((v, i) => {
            if (dayTargets[i] === null) return '#2C6E7F';
            return v >= dayTargets[i] ? '#4A8B6F' : '#2C6E7F';
        }),
        borderRadius: 6,
        pctData: pctLabels
    }];

    if (hasAnyTarget) {
        datasets.push({
            type: 'line',
            label: 'Daily target (at the time)',
            data: dayTargets,
            spanGaps: false,
            stepped: true,
            borderColor: '#C97B4A',
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: '#C97B4A',
            pointBorderColor: '#C97B4A'
        });
    }

    chartInstances[activity.id] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            plugins: {
                legend: { display: hasAnyTarget, position: 'bottom', labels: { font: { family: 'Inter' } } },
                datalabels: {
                    display: (ctx) => ctx.datasetIndex === 0 && ctx.dataset.pctData && ctx.dataset.pctData[ctx.dataIndex],
                    formatter: (value, ctx) => ctx.dataset.pctData[ctx.dataIndex],
                    anchor: 'end',
                    align: 'top',
                    color: '#6B6B6B',
                    font: { family: 'Inter', size: 10, weight: '600' }
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#E8E8E8' } },
                x: { grid: { display: false } }
            }
        }
    });
}

init();
