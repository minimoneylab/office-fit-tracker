let chart = null;
let currentTargetId = null;

function mondayOfThisWeek() {
    const d = new Date();
    const day = d.getDay(); // 0 Sun ... 6 Sat
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function weekdayDates() {
    const monday = mondayOfThisWeek();
    const dates = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
}

async function init() {
    if (!requireConfig()) return;

    const { data: users } = await db.from('users').select('*').order('name');
    const userSelect = document.getElementById('user-select');
    userSelect.innerHTML = (users || []).map(u => `<option value="${u.id}">${u.name}</option>`).join('');

    const { data: activities } = await db.from('activity_types').select('*').eq('active', true).order('name');
    const activitySelect = document.getElementById('activity-select');
    activitySelect.innerHTML = (activities || []).map(a => `<option value="${a.id}" data-unit="${a.unit}" data-name="${a.name}">${a.name}</option>`).join('');

    userSelect.onchange = render;
    activitySelect.onchange = render;

    if (users && users.length && activities && activities.length) render();
}

async function render() {
    const userId = document.getElementById('user-select').value;
    const activityOpt = document.getElementById('activity-select').selectedOptions[0];
    if (!userId || !activityOpt) return;
    const activityTypeId = activityOpt.value;
    const unit = activityOpt.dataset.unit;
    const name = activityOpt.dataset.name;

    document.getElementById('chart-title').textContent = `${name} — actual vs target (${unit})`;

    const dates = weekdayDates();

    const { data: logs } = await db
        .from('logs')
        .select('value, log_date')
        .eq('user_id', userId)
        .eq('activity_type_id', activityTypeId)
        .gte('log_date', dates[0])
        .lte('log_date', dates[4]);

    const dailyTotals = dates.map(d => (logs || [])
        .filter(l => l.log_date === d)
        .reduce((sum, l) => sum + Number(l.value), 0));

    const { data: targetRow } = await db
        .from('weekly_targets')
        .select('*')
        .eq('user_id', userId)
        .eq('activity_type_id', activityTypeId)
        .maybeSingle();

    currentTargetId = targetRow ? targetRow.id : null;
    document.getElementById('target-input').value = targetRow ? targetRow.target_value : '';
    document.getElementById('target-input').dataset.userId = userId;
    document.getElementById('target-input').dataset.activityId = activityTypeId;

    const target = targetRow ? Number(targetRow.target_value) : 0;
    const perDayTarget = target / 5;
    const cumulativeActual = [];
    dailyTotals.reduce((acc, v, i) => { cumulativeActual[i] = acc + v; return acc + v; }, 0);
    const cumulativeTarget = dates.map((_, i) => perDayTarget * (i + 1));

    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

    if (chart) chart.destroy();
    const ctx = document.getElementById('weekly-chart').getContext('2d');
    chart = new Chart(ctx, {
        data: {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: `Actual per day (${unit})`,
                    data: dailyTotals,
                    backgroundColor: '#2C6E7F',
                    borderRadius: 6,
                    order: 2
                },
                {
                    type: 'line',
                    label: 'Cumulative actual',
                    data: cumulativeActual,
                    borderColor: '#4A8B6F',
                    backgroundColor: '#4A8B6F',
                    tension: 0.3,
                    order: 1
                },
                {
                    type: 'line',
                    label: 'Cumulative target',
                    data: cumulativeTarget,
                    borderColor: '#C97B4A',
                    borderDash: [6, 4],
                    backgroundColor: '#C97B4A',
                    tension: 0,
                    order: 0
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter' } } } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#E8E8E8' } },
                x: { grid: { display: false } }
            }
        }
    });
}

async function saveTarget() {
    const input = document.getElementById('target-input');
    const value = parseFloat(input.value);
    if (!value || value <= 0) return;
    const userId = input.dataset.userId;
    const activityId = input.dataset.activityId;

    if (currentTargetId) {
        await db.from('weekly_targets').update({ target_value: value }).eq('id', currentTargetId);
    } else {
        await db.from('weekly_targets').insert({ user_id: userId, activity_type_id: activityId, target_value: value });
    }
    render();
}

init();
