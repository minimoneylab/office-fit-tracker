let selectedUserId = null;
let activityTypes = [];
let dailyTargets = {};
let usersCache = [];

function localDateStr(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

const todayStr = () => localDateStr();

document.getElementById('today-label').textContent =
    new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

async function init() {
    if (!requireConfig()) return;
    await loadUsers();
    await loadActivityTypes();
}

async function loadUsers() {
    const { data, error } = await db.from('users').select('*').order('name');
    usersCache = (data && !error) ? data : [];
    const grid = document.getElementById('user-grid');
    grid.innerHTML = '';
    usersCache.forEach(user => {
        const card = document.createElement('div');
        card.className = 'user-card';
        card.dataset.userId = user.id;
        const initials = user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
        card.innerHTML = `
            <div class="user-avatar">${user.photo_url ? `<img src="${user.photo_url}" alt="${user.name}">` : initials}</div>
            <div class="user-card-name">${user.name}</div>
        `;
        card.onclick = () => selectUser(user.id, card);
        grid.appendChild(card);
    });
}

async function loadActivityTypes() {
    const { data, error } = await db.from('activity_types').select('*').eq('active', true).order('name');
    activityTypes = (data && !error) ? data : [];
}

async function selectUser(userId, cardEl) {
    selectedUserId = userId;
    document.querySelectorAll('.user-card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');
    document.getElementById('log-panel').style.display = 'block';
    document.getElementById('no-user-hint').style.display = 'none';

    const user = usersCache.find(u => u.id === userId);
    const initials = user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    document.getElementById('profile-avatar').innerHTML = user.photo_url
        ? `<img src="${user.photo_url}" alt="${user.name}">` : initials;
    document.getElementById('profile-name').textContent = user.name;
    document.getElementById('profile-bio').textContent = user.bio ? `"${user.bio}"` : '';

    renderActivityRows();
    await loadDailyTargets();
    renderDailyTargetRows();
    refreshSummary();
}

function renderActivityRows() {
    const wrap = document.getElementById('activity-rows');
    wrap.innerHTML = '';
    activityTypes.forEach(a => {
        const row = document.createElement('div');
        row.className = 'activity-row';
        row.innerHTML = `
            <div class="activity-icon">${a.icon || '💪'}</div>
            <div class="activity-label">${a.name}</div>
            <input type="number" class="activity-input" min="0" step="any" placeholder="0" id="input-${a.id}">
            <div class="activity-unit">${a.unit}</div>
            <button class="log-btn" onclick="logActivity('${a.id}')">Log</button>
            <span class="check-flash" id="check-${a.id}">✓</span>
        `;
        wrap.appendChild(row);
    });
}

async function logActivity(activityTypeId) {
    const input = document.getElementById(`input-${activityTypeId}`);
    const value = parseFloat(input.value);
    if (!value || value <= 0) { input.focus(); return; }

    const { error } = await db.from('logs').insert({
        user_id: selectedUserId,
        activity_type_id: activityTypeId,
        value: value,
        log_date: todayStr()
    });

    if (!error) {
        input.value = '';
        const check = document.getElementById(`check-${activityTypeId}`);
        check.classList.add('show');
        setTimeout(() => check.classList.remove('show'), 1200);
        refreshSummary();
    } else {
        alert('Could not log activity: ' + error.message);
    }
}

async function loadDailyTargets() {
    dailyTargets = {};
    const { data } = await db.from('daily_targets').select('*').eq('user_id', selectedUserId);
    (data || []).forEach(t => { dailyTargets[t.activity_type_id] = t; });
}

function renderDailyTargetRows() {
    const wrap = document.getElementById('daily-target-rows');
    wrap.innerHTML = '';
    activityTypes.forEach(a => {
        const existing = dailyTargets[a.id];
        const row = document.createElement('div');
        row.className = 'target-row';
        row.innerHTML = `
            <label>${a.icon || ''} ${a.name}</label>
            <input type="number" min="0" step="any" id="daily-target-${a.id}" value="${existing ? existing.target_value : ''}" placeholder="e.g. 50">
            <span class="unit">${a.unit}</span>
            <button class="btn-secondary" onclick="saveDailyTarget('${a.id}')">Save</button>
        `;
        wrap.appendChild(row);
    });
}

async function saveDailyTarget(activityTypeId) {
    const input = document.getElementById(`daily-target-${activityTypeId}`);
    const value = parseFloat(input.value);
    if (!value || value <= 0) return;

    const existing = dailyTargets[activityTypeId];
    if (existing) {
        await db.from('daily_targets').update({ target_value: value }).eq('id', existing.id);
    } else {
        await db.from('daily_targets').insert({ user_id: selectedUserId, activity_type_id: activityTypeId, target_value: value });
    }
    await loadDailyTargets();
    refreshSummary();
}

async function refreshSummary() {
    const { data, error } = await db
        .from('logs')
        .select('id, value, activity_type_id, created_at, activity_types(name, unit, icon)')
        .eq('user_id', selectedUserId)
        .eq('log_date', todayStr())
        .order('created_at', { ascending: false });

    renderSummaryList(data, error);
    renderEntriesList(data, error);
}

function renderSummaryList(data, error) {
    const list = document.getElementById('summary-list');
    list.innerHTML = '';

    if (error || !data || data.length === 0) {
        list.innerHTML = '<li>No activity logged yet today.</li>';
        return;
    }

    const grouped = {};
    data.forEach(row => {
        const name = row.activity_types?.name || 'Unknown';
        const unit = row.activity_types?.unit || '';
        if (!grouped[name]) grouped[name] = { unit, values: [], activityTypeId: row.activity_type_id };
        grouped[name].values.push(row.value);
    });

    Object.entries(grouped).forEach(([name, info]) => {
        const total = info.values.reduce((a, b) => a + b, 0);
        const target = dailyTargets[info.activityTypeId];
        const li = document.createElement('li');

        let text = '';
        if (info.unit === 'litres' || info.unit === 'ml') {
            text = `Drank <span class="num">${total}</span> ${info.unit} of ${name.toLowerCase()}`;
        } else {
            const avg = (total / info.values.length).toFixed(1);
            text = `<span class="num">${info.values.length}</span> sets of ${name} in average <span class="num">${avg}</span> ${info.unit} each (total ${total} ${info.unit})`;
        }

        let progressHtml = '';
        if (target) {
            const pct = Math.round((total / target.target_value) * 100);
            const over = pct >= 100;
            progressHtml = `
                <div class="progress-track"><div class="progress-fill ${over ? 'over' : ''}" style="width:${Math.min(pct, 100)}%;"></div></div>
                <div class="progress-pct">${pct}% of daily target (${target.target_value} ${info.unit})</div>
            `;
        }

        li.innerHTML = `${text}${progressHtml}`;
        list.appendChild(li);
    });
}

function renderEntriesList(data, error) {
    const list = document.getElementById('entries-list');
    list.innerHTML = '';

    if (error || !data || data.length === 0) {
        list.innerHTML = '<li>Nothing logged yet — entries you add today will show up here.</li>';
        return;
    }

    data.forEach(row => {
        const name = row.activity_types?.name || 'Unknown';
        const unit = row.activity_types?.unit || '';
        const icon = row.activity_types?.icon || '';
        const li = document.createElement('li');
        li.id = `entry-${row.id}`;
        li.innerHTML = `
            <span class="entry-left">
                <span>${icon} ${name}</span>
                <span id="entry-value-${row.id}">${row.value} ${unit}</span>
            </span>
            <span class="entry-actions">
                <button title="Edit" onclick="startEditEntry('${row.id}', ${row.value}, '${unit}')">✎</button>
                <button title="Delete" class="delete-btn" onclick="deleteEntry('${row.id}')">✕</button>
            </span>
        `;
        list.appendChild(li);
    });
}

function startEditEntry(logId, currentValue, unit) {
    const valueSpan = document.getElementById(`entry-value-${logId}`);
    valueSpan.innerHTML = `
        <input type="number" min="0" step="any" class="entry-edit-input" id="edit-input-${logId}" value="${currentValue}">
        <button title="Save" onclick="saveEditEntry('${logId}')" style="background:none;border:none;cursor:pointer;color:var(--accent);">✓</button>
    `;
    document.getElementById(`edit-input-${logId}`).focus();
}

async function saveEditEntry(logId) {
    const input = document.getElementById(`edit-input-${logId}`);
    const newValue = parseFloat(input.value);
    if (!newValue || newValue <= 0) return;
    const { error } = await db.from('logs').update({ value: newValue }).eq('id', logId);
    if (error) { alert('Could not update entry: ' + error.message); return; }
    refreshSummary();
}

async function deleteEntry(logId) {
    if (!confirm('Remove this entry?')) return;
    const { error } = await db.from('logs').delete().eq('id', logId);
    if (error) { alert('Could not delete entry: ' + error.message); return; }
    refreshSummary();
}

init();
