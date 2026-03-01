let db;
const DB_NAME = 'MyShiftDB';
const DB_VERSION = 2;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains('shifts')) {
                const store = database.createObjectStore('shifts', { keyPath: 'id', autoIncrement: true });
                store.createIndex('weekDay', ['week', 'day'], { unique: false });
            }
            if (!database.objectStoreNames.contains('photos')) {
                const store = database.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
                store.createIndex('shiftId', 'shiftId', { unique: false });
            }
        };
        request.onsuccess = (e) => { db = e.target.result; resolve(); };
        request.onerror = () => reject(request.error);
    });
}

let currentWeekIndex = 1;
let weeks = [];

function getWeeks() {
    const today = new Date();
    const day = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - day);
    sunday.setHours(0, 0, 0, 0);
    weeks = [];
    for (let w = 0; w < 3; w++) {
        const weekStart = new Date(sunday);
        weekStart.setDate(sunday.getDate() + (w * 7));
        weeks.push(weekStart);
    }
}

function getWeekKey(weekStart) {
    return weekStart.toISOString().split('T')[0];
}

function formatWeekBtn(weekStart) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return weekStart.getDate() + ' ' + months[weekStart.getMonth()];
}

function formatDayHeader(date) {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[date.getMonth()] + ' ' + date.getDate() + ' (' + days[date.getDay()] + ')';
}

async function renderApp() {
    getWeeks();
    renderWeekSelector();
    await renderWeekView();
}

function renderWeekSelector() {
    const container = document.getElementById('weekSelector');
    container.innerHTML = '';
    weeks.forEach((week, i) => {
        const btn = document.createElement('button');
        btn.className = 'week-btn' + (i === currentWeekIndex ? ' active' : '');
        btn.textContent = formatWeekBtn(week);
        btn.onclick = () => { currentWeekIndex = i; renderWeekSelector(); renderWeekView(); };
        container.appendChild(btn);
    });
}

async function renderWeekView() {
    const container = document.getElementById('weekView');
    container.innerHTML = '';
    const weekStart = weeks[currentWeekIndex];
    const weekKey = getWeekKey(weekStart);
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    for (let d = 0; d < 7; d++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + d);
        const dayName = dayNames[d];
        const shift = await getShift(weekKey, dayName);

        const card = document.createElement('div');
        let cardClass = 'day-card';
        if (d === 0) cardClass += ' sunday';
        if (d === 6) cardClass += ' saturday';
        card.className = cardClass;

        const header = document.createElement('div');
        header.className = 'day-header';
        header.innerHTML = '<span class="day-name">' + formatDayHeader(date) + '</span>';
        card.appendChild(header);

        if (shift) {
            if (shift.isDayOff) {
                const offDiv = document.createElement('div');
                offDiv.className = 'day-off-badge';
                offDiv.textContent = '🚫 Day Off';
                offDiv.onclick = () => openDetailModal(shift);
                card.appendChild(offDiv);
            } else {
                const shiftCard = document.createElement('div');
                shiftCard.className = 'shift-card';
                const idSpan = document.createElement('span');
                idSpan.className = 'shift-id-display';
                idSpan.textContent = shift.shiftId;
                shiftCard.appendChild(idSpan);
                const photos = await getPhotos(shift.id);
                if (photos.length > 0) {
                    const img = document.createElement('img');
                    img.className = 'shift-thumbnail';
                    img.src = photos[0].data;
                    shiftCard.appendChild(img);
                }
                shiftCard.onclick = () => openDetailModal(shift);
                card.appendChild(shiftCard);
            }
        } else {
            const tapDiv = document.createElement('div');
            tapDiv.className = 'tap-to-add';
            tapDiv.textContent = 'Tap to add shift';
            tapDiv.onclick = () => openAddModal(dayName);
            card.appendChild(tapDiv);
        }
        container.appendChild(card);
    }
}

function getShift(weekKey, day) {
    return new Promise((resolve) => {
        const tx = db.transaction('shifts', 'readonly');
        const store = tx.objectStore('shifts');
        const index = store.index('weekDay');
        const request = index.getAll([weekKey, day]);
        request.onsuccess = () => resolve(request.result.length > 0 ? request.result[0] : null);
        request.onerror = () => resolve(null);
    });
}

function saveShiftToDB(shiftData) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('shifts', 'readwrite');
        const store = tx.objectStore('shifts');
        const request = store.add(shiftData);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function updateShiftInDB(shiftData) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('shifts', 'readwrite');
        const store = tx.objectStore('shifts');
        const request = store.put(shiftData);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function deleteShiftFromDB(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('shifts', 'readwrite');
        const store = tx.objectStore('shifts');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function savePhotoToDB(shiftId, data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('photos', 'readwrite');
        const store = tx.objectStore('photos');
        const request = store.add({ shiftId: shiftId, data: data, createdAt: new Date().toISOString() });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getPhotos(shiftId) {
    return new Promise((resolve) => {
        const tx = db.transaction('photos', 'readonly');
        const store = tx.objectStore('photos');
        const index = store.index('shiftId');
        const request = index.getAll(shiftId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

function deletePhotoFromDB(id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction('photos', 'readwrite');
        const store = tx.objectStore('photos');
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function deletePhotosByShiftId(shiftId) {
    const photos = await getPhotos(shiftId);
    for (const photo of photos) { await deletePhotoFromDB(photo.id); }
}

let pendingPhotos = [];
let editingShift = null;

function openAddModal(dayName) {
    editingShift = null;
    pendingPhotos = [];
    document.getElementById('modalTitle').textContent = 'Add Shift';
    document.getElementById('shiftIdInput').value = '';
    document.getElementById('dayOffCheck').checked = false;
    document.getElementById('shiftIdInput').disabled = false;
    document.getElementById('copyDaysSection').style.display = 'block';
    document.getElementById('photoPreviewArea').innerHTML = '';
    if (dayName) document.getElementById('daySelect').value = dayName;
    updateCopyDays();
    document.getElementById('addModal').classList.add('active');
}

function closeAddModal() {
    document.getElementById('addModal').classList.remove('active');
    editingShift = null;
    pendingPhotos = [];
}

function updateCopyDays() {
    const selectedDay = document.getElementById('daySelect').value;
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const fullDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const container = document.getElementById('copyDaysButtons');
    container.innerHTML = '';
    days.forEach((d, i) => {
        const btn = document.createElement('button');
        btn.className = 'copy-day-btn' + (fullDays[i] === selectedDay ? ' hidden' : '');
        btn.textContent = d;
        btn.dataset.day = fullDays[i];
        btn.onclick = () => btn.classList.toggle('selected');
        container.appendChild(btn);
    });
}

function toggleDayOff() {
    const isDayOff = document.getElementById('dayOffCheck').checked;
    document.getElementById('shiftIdInput').disabled = isDayOff;
    document.getElementById('copyDaysSection').style.display = isDayOff ? 'none' : 'block';
}

function handlePhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => { pendingPhotos.push({ data: e.target.result }); renderPhotoPreview(); };
    reader.readAsDataURL(file);
    event.target.value = '';
}

function renderPhotoPreview() {
    const area = document.getElementById('photoPreviewArea');
    area.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'photo-preview-list';
    pendingPhotos.forEach((photo, index) => {
        const item = document.createElement('div');
        item.className = 'photo-preview-item';
        const img = document.createElement('img');
        img.src = photo.data;
        item.appendChild(img);
        const removeBtn = document.createElement('button');
        removeBtn.className = 'photo-remove-btn';
        removeBtn.textContent = '✕';
        removeBtn.onclick = () => { pendingPhotos.splice(index, 1); renderPhotoPreview(); };
        item.appendChild(removeBtn);
        list.appendChild(item);
    });
    area.appendChild(list);
}

async function saveShift() {
    const selectedDay = document.getElementById('daySelect').value;
    const shiftIdValue = document.getElementById('shiftIdInput').value.trim();
    const isDayOff = document.getElementById('dayOffCheck').checked;

    if (!isDayOff && shiftIdValue === '') {
        alert('Please enter a Shift ID!');
        return;
    }

    const weekKey = getWeekKey(weeks[currentWeekIndex]);
    const copyButtons = document.querySelectorAll('.copy-day-btn.selected');
    const copyDays = Array.from(copyButtons).map(b => b.dataset.day);
    const allDays = [selectedDay, ...copyDays];

    for (const day of allDays) {
        const existing = await getShift(weekKey, day);
        const shiftData = {
            week: weekKey,
            day: day,
            shiftId: isDayOff ? '' : shiftIdValue,
            isDayOff: isDayOff,
            createdAt: new Date().toISOString()
        };

        let savedId;
        if (existing) {
            shiftData.id = existing.id;
            await updateShiftInDB(shiftData);
            savedId = existing.id;
        } else {
            savedId = await saveShiftToDB(shiftData);
        }

        if (day === selectedDay) {
            for (const photo of pendingPhotos) {
                await savePhotoToDB(savedId, photo.data);
            }
        }
    }

    closeAddModal();
    await renderWeekView();
}

let currentDetailShift = null;

async function openDetailModal(shift) {
    currentDetailShift = shift;
    const photos = await getPhotos(shift.id);
    let html = '';
    if (shift.isDayOff) {
        html += '<div class="detail-shift-id">🚫 Day Off</div>';
    } else {
        html += '<div class="detail-shift-id">' + shift.shiftId + '</div>';
    }
    html += '<div class="detail-day-info">' + shift.day + ' &middot; ' + shift.week + '</div>';
    if (photos.length > 0) {
        html += '<div class="detail-photos">';
        photos.forEach(photo => {
            html += '<div class="detail-photo-item">';
            html += '<img src="' + photo.data + '" onclick="openFullscreen(\'' + photo.id + '\')" alt="photo">';
            html += '<button class="detail-photo-delete" onclick="deletePhoto(' + photo.id + ')">✕</button>';
            html += '</div>';
        });
        html += '</div>';
    } else {
        html += '<div class="no-photos-text">No photos uploaded</div>';
    }
    document.getElementById('detailContent').innerHTML = html;
    document.getElementById('detailModal').classList.add('active');
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('active');
    currentDetailShift = null;
}

async function deleteShift() {
    if (!currentDetailShift) return;
    if (!confirm('Delete this shift?')) return;
    await deletePhotosByShiftId(currentDetailShift.id);
    await deleteShiftFromDB(currentDetailShift.id);
    closeDetailModal();
    await renderWeekView();
}

async function deletePhoto(photoId) {
    if (!confirm('Delete this photo?')) return;
    await deletePhotoFromDB(photoId);
    if (currentDetailShift) await openDetailModal(currentDetailShift);
    await renderWeekView();
}

function editShift() {
    if (!currentDetailShift) return;
    closeDetailModal();
    editingShift = currentDetailShift;
    pendingPhotos = [];
    document.getElementById('modalTitle').textContent = 'Edit Shift';
    document.getElementById('shiftIdInput').value = currentDetailShift.shiftId || '';
    document.getElementById('dayOffCheck').checked = currentDetailShift.isDayOff || false;
    document.getElementById('shiftIdInput').disabled = currentDetailShift.isDayOff || false;
    document.getElementById('daySelect').value = currentDetailShift.day;
    document.getElementById('photoPreviewArea').innerHTML = '';
    document.getElementById('copyDaysSection').style.display = 'block';
    updateCopyDays();
    document.getElementById('addModal').classList.add('active');
}

let allPhotosCache = {};

async function openFullscreen(photoId) {
    const tx = db.transaction('photos', 'readonly');
    const store = tx.objectStore('photos');
    const request = store.get(photoId);
    request.onsuccess = () => {
        if (request.result) {
            document.getElementById('fullscreenImg').src = request.result.data;
            document.getElementById('fullscreenPhoto').classList.add('active');
        }
    };
}

function closeFullscreen() {
    document.getElementById('fullscreenPhoto').classList.remove('active');
}

document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    await renderApp();
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
