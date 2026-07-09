async function init() {
    if (!requireConfig()) return;
    await loadUserList();
    await loadActivityList();
}

let usersCache = [];

async function loadUserList() {
    const { data } = await db.from('users').select('*').order('name');
    usersCache = data || [];
    renderUserList();
}

function renderUserList() {
    const list = document.getElementById('user-list');
    list.innerHTML = usersCache.map(u => `
        <li id="user-row-${u.id}" style="flex-direction:column; align-items:stretch;">
            <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                <span>${u.name}</span>
                <span class="user-row-actions">
                    <button class="btn-secondary" style="padding:4px 12px; font-size:0.8125rem;" onclick="toggleEditUser('${u.id}')">Edit</button>
                    <button class="btn-secondary" style="padding:4px 12px; font-size:0.8125rem;" onclick="removeUser('${u.id}')">Remove</button>
                </span>
            </div>
            <div id="edit-form-${u.id}" style="display:none;"></div>
        </li>
    `).join('') || '<li>No teammates yet.</li>';
}

function toggleEditUser(userId) {
    const container = document.getElementById(`edit-form-${userId}`);
    const isOpen = container.style.display !== 'none';
    document.querySelectorAll('[id^="edit-form-"]').forEach(el => el.style.display = 'none');
    if (isOpen) return;

    const user = usersCache.find(u => u.id === userId);
    container.innerHTML = `
        <div class="user-edit-form">
            <div class="form-row">
                <label>Name</label>
                <input type="text" id="edit-name-${userId}" value="${(user.name || '').replace(/"/g, '&quot;')}">
            </div>
            <div class="form-row">
                <label>Bio</label>
                <textarea id="edit-bio-${userId}" rows="2">${user.bio || ''}</textarea>
            </div>
            <div class="form-row">
                <label style="font-size:0.8125rem; color:var(--text-mid);">Replace photo (optional)</label>
                <input type="file" id="edit-photo-${userId}" accept="image/*">
            </div>
            <div class="user-edit-actions">
                <button class="btn-primary" style="padding:6px 14px; font-size:0.8125rem;" onclick="saveUserEdit('${userId}')">Save</button>
                <button class="btn-secondary" style="padding:6px 14px; font-size:0.8125rem;" onclick="toggleEditUser('${userId}')">Cancel</button>
            </div>
            <div id="edit-status-${userId}" style="font-size:0.8125rem; margin-top:8px;"></div>
        </div>
    `;
    container.style.display = 'block';
}

async function saveUserEdit(userId) {
    const name = document.getElementById(`edit-name-${userId}`).value.trim();
    const bio = document.getElementById(`edit-bio-${userId}`).value.trim();
    const fileInput = document.getElementById(`edit-photo-${userId}`);
    const file = fileInput.files[0];
    const status = document.getElementById(`edit-status-${userId}`);

    if (!name) {
        status.textContent = 'Name cannot be empty.';
        status.style.color = '#C0554A';
        return;
    }

    const updates = { name, bio: bio || null };

    if (file) {
        status.textContent = 'Uploading photo...';
        const ext = file.name.split('.').pop();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await db.storage.from('avatars').upload(path, file);
        if (uploadError) {
            status.textContent = 'Photo upload failed: ' + uploadError.message;
            status.style.color = '#C0554A';
            return;
        }
        const { data: urlData } = db.storage.from('avatars').getPublicUrl(path);
        updates.photo_url = urlData.publicUrl;
    }

    const { error } = await db.from('users').update(updates).eq('id', userId);
    if (error) {
        status.textContent = 'Could not save: ' + error.message;
        status.style.color = '#C0554A';
        return;
    }
    loadUserList();
}

async function addUser() {
    const name = document.getElementById('new-user-name').value.trim();
    const bio = document.getElementById('new-user-bio').value.trim();
    const fileInput = document.getElementById('new-user-photo-file');
    const file = fileInput.files[0];
    const status = document.getElementById('upload-status');

    if (!name) {
        status.textContent = 'Please enter a name first.';
        status.style.color = '#C0554A';
        return;
    }

    let photoUrl = null;

    if (file) {
        status.textContent = 'Uploading photo...';
        status.style.color = '';
        const ext = file.name.split('.').pop();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await db.storage.from('avatars').upload(path, file);
        if (uploadError) {
            status.textContent = 'Photo upload failed: ' + uploadError.message;
            status.style.color = '#C0554A';
            return;
        }
        const { data: urlData } = db.storage.from('avatars').getPublicUrl(path);
        photoUrl = urlData.publicUrl;
    }

    const { error: insertError } = await db.from('users').insert({ name, photo_url: photoUrl, bio: bio || null });

    if (insertError) {
        status.textContent = 'Could not add teammate: ' + insertError.message;
        status.style.color = '#C0554A';
        return;
    }

    status.textContent = `Added ${name}.`;
    status.style.color = '#4A8B6F';
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-bio').value = '';
    fileInput.value = '';
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
