// ===== DATABASE =====
let db;
const DB_NAME = 'MyShiftDB_v3';
const DB_VERSION = 1;

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

        request.onsuccess = (e) => {
            db = e.target.result;
            cleanOldData();
            resolve();
        };

        request.onerror = () => reject(request.error);
    });
}


// ===== 자동 삭제: 3주 지난 데이터 정리 =====
async function cleanOldData() {
    try {
        // 오늘부터 3주 전 날짜 계산
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const threeWeeksAgo = new Date(today);
        threeWeeksAgo.setDate(today.getDate() - 21);
        const cutoffKey = threeWeeksAgo.toISOString().split('T')[0];

        // 모든 shift 가져오기
        const tx = db.transaction(['shifts', 'photos'], 'readwrite');
        const shiftStore = tx.objectStore('shifts');
        const photoStore = tx.objectStore('photos');

        const allShifts = await new Promise((resolve) => {
            const req = shiftStore.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });

        // 3주 지난 shift 삭제
        for (const shift of allShifts) {
            if (shift.week < cutoffKey) {
                // 관련 사진도 삭제
                const photoIndex = photoStore.index('shiftId');
                const photos = await new Promise((resolve) => {
                    const req = photoIndex.getAll(shift.id);
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => resolve([]);
                });
                for (const photo of photos) {
                    photoStore.delete(photo.id);
                }
                shiftStore.delete(shift.id);
            }
        }
    } catch(e) {
        // 조용히 실패 (앱 동작에 영향 없음)
    }
}

// ===== WEEK CALCULATION =====
let currentWeekIndex = 1; // 0=prev, 1=current, 2=next, 3=week after
let weeks = [];

function getWeeks() {
    const today = new Date();
    const day = today.getDay(); // 0=Sunday
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
    return `${weekStart.getDate()} ${months[weekStart.getMonth()]}`;
}

function formatDayHeader(date) {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[date.getMonth()]} ${date.getDate()} (${days[date.getDay()]})`;
}

// ===== RENDER MAIN SCREEN =====
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
        btn.onclick = () => {
            currentWeekIndex = i;
            renderWeekSelector();
            renderWeekView();
        };
        container.appendChild(btn);
    });
}

async function renderWeekView() {
    const container = document.getElementById('weekView');
    container.innerHTML = '';

    const weekStart = weeks[currentWeekIndex];
    const weekKey = getWeekKey(weekStart);

    for (let d = 0; d < 7; d++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + d);
        const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const dayName = dayNames[d];

        // Get shift for this day
        const shift = await getShift(weekKey, dayName);

        const card = document.createElement('div');
        let cardClass = 'day-card';
        if (d === 0) cardClass += ' sunday';
        if (d === 6) cardClass += ' saturday';
        if (shift && shift.isDayOff) cardClass += ' day-off';
        card.className = cardClass;

        const header = document.createElement('div');
        header.className = 'day-header';
        header.innerHTML = `<span class="day-name">${formatDayHeader(date)}</span>`;
        card.appendChild(header);

        if (shift) {
            if (shift.isDayOff) {
                const offDiv = document.createElement('div');
                offDiv.className = 'day-off-badge';
                offDiv.textContent = '🚫 Day Off';
                card.appendChild(offDiv);
                card.onclick = () => openDetailModal(shift);
            } else {
                const shiftCard = document.createElement('div');
                shiftCard.className = 'shift-card';

                const idSpan = document.createElement('span');
                idSpan.className = 'shift-id-display';
                idSpan.textContent = shift.shiftId;
                shiftCard.appendChild(idSpan);

                // Get first photo for thumbnail
                const photos = await getPhotos(shift.id);
                if (photos.length > 0) {
                    const img = document.createElement('img');
                    img.className = 'shift-thumbnail';
                    img.src = photos[0].data;
                    img.alt = "Shift photo";
                    img.style.pointerEvents = "none";
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

// ===== INDEXEDDB OPERATIONS =====
function getShift(weekKey, day) {
    return new Promise((resolve) => {
        const tx = db.transaction('shifts', 'readonly');
        const store = tx.objectStore('shifts');
        const index = store.index('weekDay');
        const request = index.getAll([weekKey, day]);
        request.onsuccess = () => {
            const results = request.result;
            resolve(results.length > 0 ? results[0] : null);
        };
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
        const request = store.add({ shiftId, data, createdAt: new Date().toISOString() });
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

function deletePhotosByShiftId(shiftId) {
    return new Promise(async (resolve) => {
        const photos = await getPhotos(shiftId);
        for (const photo of photos) {
            await deletePhotoFromDB(photo.id);
        }
        resolve();
    });
}

// ===== ADD MODAL =====
let pendingPhotos = []; // { data: base64 } before shift saved
let editingShift = null;

function openAddModal(dayName) {
    editingShift = null;
    pendingPhotos = [];
    document.getElementById('modalTitle').textContent = 'Add/Edit Shift';
    document.getElementById('shiftIdInput').value = '';
    document.getElementById('shiftIdInput').disabled = false;
    document.getElementById('dayOffCheck').checked = false;
    document.getElementById('daySelect').disabled = false;
    document.getElementById('copyDaysSection').style.display = 'block';
    document.getElementById('dayOffDaysSection').style.display = 'none';
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
        btn.className = 'copy-day-btn';
        btn.textContent = d;
        btn.dataset.day = fullDays[i];

        if (fullDays[i] === selectedDay) {
            btn.classList.add('hidden');
        }

        btn.onclick = () => {
            btn.classList.toggle('selected');
        };

        container.appendChild(btn);
    });
}

function toggleDayOff() {
    const isDayOff = document.getElementById('dayOffCheck').checked;
    document.getElementById('shiftIdInput').disabled = isDayOff;
    document.getElementById('copyDaysSection').style.display = isDayOff ? 'none' : 'block';
    document.getElementById('dayOffDaysSection').style.display = isDayOff ? 'block' : 'none';
    if (isDayOff) updateDayOffDays();
}

function updateDayOffDays() {
    const selectedDay = document.getElementById('daySelect').value;
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const fullDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const container = document.getElementById('dayOffDaysButtons');
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

function handlePhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        pendingPhotos.push({ data: e.target.result });
        renderPhotoPreview();
    };
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
        removeBtn.onclick = () => {
            pendingPhotos.splice(index, 1);
            renderPhotoPreview();
        };
        item.appendChild(removeBtn);
        list.appendChild(item);
    });

    area.appendChild(list);
}

async function saveShift() {
    const daySelect = document.getElementById('daySelect');
    const shiftIdInput = document.getElementById('shiftIdInput');
    const dayOffCheck = document.getElementById('dayOffCheck');

    const selectedDay = daySelect.value;
    const shiftIdValue = shiftIdInput.value.trim();
    const isDayOff = dayOffCheck.checked;

    // Validate
    if (!isDayOff && shiftIdValue === '') {
        alert('Please enter a Shift ID!');
        return;
    }

    const weekKey = getWeekKey(weeks[currentWeekIndex]);

    // Get copy days or day off days
    let allDays;
    if (isDayOff) {
        const dayOffButtons = document.querySelectorAll('#dayOffDaysButtons .copy-day-btn.selected');
        const dayOffDays = Array.from(dayOffButtons).map(b => b.dataset.day);
        allDays = [selectedDay, ...dayOffDays];
    } else {
        const copyButtons = document.querySelectorAll('.copy-day-btn.selected');
        const copyDays = Array.from(copyButtons).map(b => b.dataset.day);
        allDays = [selectedDay, ...copyDays];
    }

    for (const day of allDays) {
        // Check if shift exists for this day
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
            // Delete old photos if editing
            if (editingShift && editingShift.id === existing.id) {
                // Keep existing photos, just add new ones
            }
        } else {
            savedId = await saveShiftToDB(shiftData);
        }

        // Save photos (only for primary day, not copies)
        if (day === selectedDay) {
            for (const photo of pendingPhotos) {
                await savePhotoToDB(savedId, photo.data);
            }
        }
    }

    closeAddModal();
    await renderWeekView();
}

// ===== DETAIL MODAL =====
let currentDetailShift = null;

async function openDetailModal(shift) {
    currentDetailShift = shift;
    const content = document.getElementById('detailContent');

    const photos = await getPhotos(shift.id);

    let html = '';
    if (shift.isDayOff) {
        html += `<div class="detail-shift-id">🚫 Day Off</div>`;
    } else {
        html += `<div class="detail-shift-id">${shift.shiftId}</div>`;
    }
    html += `<div class="detail-day-info">${shift.day} · ${shift.week}</div>`;

    if (photos.length > 0) {
        html += `<div class="detail-photos">`;
        photos.forEach(photo => {
            html += `
                <div class="detail-photo-item">
                    <img src="${photo.data}" onclick="openFullscreen('${photo.data}')" alt="Shift photo">
                    <button class="detail-photo-delete" onclick="deletePhoto(${photo.id})">✕</button>
                </div>`;
        });
        html += `</div>`;
    } else {
        html += `<div class="no-photos-text">No photos uploaded</div>`;
    }

    content.innerHTML = html;
    document.getElementById('detailModal').classList.add('active');
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('active');
    currentDetailShift = null;
}

async function deleteShift() {
    if (!currentDetailShift) return;
    if (!confirm(`Delete shift ${currentDetailShift.shiftId || 'Day Off'}?`)) return;

    await deletePhotosByShiftId(currentDetailShift.id);
    await deleteShiftFromDB(currentDetailShift.id);
    closeDetailModal();
    await renderWeekView();
}

async function deletePhoto(photoId) {
    if (!confirm('Delete this photo?')) return;
    await deletePhotoFromDB(photoId);
    if (currentDetailShift) {
        await openDetailModal(currentDetailShift);
    }
    await renderWeekView();
}

function editShift() {
    if (!currentDetailShift) return;
    closeDetailModal();

    editingShift = currentDetailShift;
    pendingPhotos = [];

    // 제목을 Add/Edit Shift로 변경
    document.getElementById('modalTitle').textContent = 'Add/Edit Shift';

    // 기존 데이터 채우기
    document.getElementById('shiftIdInput').value = currentDetailShift.shiftId || '';
    document.getElementById('shiftIdInput').disabled = false;
    document.getElementById('dayOffCheck').checked = currentDetailShift.isDayOff || false;
    document.getElementById('daySelect').value = currentDetailShift.day;
    document.getElementById('daySelect').disabled = true; // 요일은 변경 못하게
    document.getElementById('photoPreviewArea').innerHTML = '';
    document.getElementById('copyDaysSection').style.display = 'none'; // 수정시 copy 숨김
    document.getElementById('dayOffDaysSection').style.display = 'none';

    if (currentDetailShift.isDayOff) {
        document.getElementById('shiftIdInput').disabled = true;
    }

    updateCopyDays();
    document.getElementById('addModal').classList.add('active');
}

// ===== FULLSCREEN PHOTO =====
function openFullscreen(src) {
    document.getElementById('fullscreenImg').src = src;
    document.getElementById('fullscreenPhoto').classList.add('active');
}

function closeFullscreen() {
    document.getElementById('fullscreenPhoto').classList.remove('active');
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
    await initDB();
    await renderApp();
});

// Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
}
