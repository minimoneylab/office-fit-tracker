async function init() {
    if (!requireConfig()) return;
    await loadUserList();
    await loadActivityList();
}

async function loadUserList() {
    const { data } = await db.from('users').select('*').order('name');
    const list = document.getElementById('user-list');
    list.innerHTML = (data || []).map(u => `
        <li>
            <span>${u.name}</span>
            <button class="btn-secondary" style="padding:4px 12px; font-size:0.8125rem;" onclick="removeUser('${u.id}')">Remove</button>
        </li>
    `).join('') || '<li>No teammates yet.</li>';
}

async function addUser() {
    const name = document.getElementById('new-user-name').value.trim();
    const photo = document.getElementById('new-user-photo').value.trim();
    if (!name) return;
    await db.from('users').insert({ name, photo_url: photo || null });
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-photo').value = '';
    loadUserList();
}

async function removeUser(id) {
    if (!confirm('Remove this teammate? Their logged activity will also be deleted.')) return;
    await db.from('users').delete().eq('id', id);
    loadUserList();
}

async function loadActivityList() {
    const { data } = await db.from('activity_types').select('*').eq('active', true).order('name');
    const list = document.getElementById('activity-list');
    list.innerHTML = (data || []).map(a => `
        <li>
            <span>${a.icon || ''} ${a.name} <span class="pill">${a.unit}</span></span>
            <button class="btn-secondary" style="padding:4px 12px; font-size:0.8125rem;" onclick="removeActivity('${a.id}')">Remove</button>
        </li>
    `).join('') || '<li>No activities yet.</li>';
}

async function addActivity() {
    const name = document.getElementById('new-activity-name').value.trim();
    const unit = document.getElementById('new-activity-unit').value.trim();
    const icon = document.getElementById('new-activity-icon').value.trim();
    if (!name || !unit) return;
    await db.from('activity_types').insert({ name, unit, icon: icon || '💪' });
    document.getElementById('new-activity-name').value = '';
    document.getElementById('new-activity-unit').value = '';
    document.getElementById('new-activity-icon').value = '';
    loadActivityList();
}

async function removeActivity(id) {
    if (!confirm('Remove this activity type? Historical logs stay, but it will disappear from Daily logging.')) return;
    await db.from('activity_types').update({ active: false }).eq('id', id);
    loadActivityList();
}

init();
