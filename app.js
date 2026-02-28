// MyShift App - Bus Driver Schedule Manager
class MyShiftApp {
    constructor() {
        this.db = null;
        this.currentWeek = 1; // Default to middle week (current week)
        this.currentShift = null;
        this.editingShift = null;
        
        // Initialize dynamic weeks
        this.initializeWeeks();
        
        this.days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        
        this.init();
    }
    
    // Initialize dynamic weeks based on current date
    initializeWeeks() {
        const today = new Date();
        const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysSinceSunday = currentDay; // Days since last Sunday (0 if today is Sunday)
        
        // Find the start of current week (Sunday)
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(today.getDate() - daysSinceSunday);
        currentWeekStart.setHours(0, 0, 0, 0); // Set to midnight
        
        // Generate 3 weeks: current, next, and week after next
        this.weeks = [];
        for (let i = 0; i < 3; i++) {
            const weekStart = new Date(currentWeekStart);
            weekStart.setDate(currentWeekStart.getDate() + (i * 7));
            
            this.weeks.push({
                start: weekStart,
                label: this.formatWeekLabel(weekStart)
            });
        }
        
        // Clean up old shift data
        this.cleanupOldShifts();
    }
    
    // Format week label (e.g., "1 Mar 26")
    formatWeekLabel(date) {
        const day = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const year = date.getFullYear().toString().slice(-2);
        return `${day} ${month} ${year}`;
    }
    
    // Clean up old shift data (past weeks)
    async cleanupOldShifts() {
        if (!this.db) return;
        
        try {
            const oldestWeekStart = this.weeks[0].start;
            
            // Get all shifts
            const transaction = this.db.transaction(['shifts'], 'readwrite');
            const store = transaction.objectStore('shifts');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const shifts = request.result;
                const shiftsToDelete = [];
                
                // Find shifts from past weeks
                shifts.forEach(shift => {
                    const shiftWeek = this.weeks[shift.week];
                    if (shiftWeek && shiftWeek.start < oldestWeekStart) {
                        shiftsToDelete.push(shift.id);
                    }
                });
                
                // Delete old shifts and their photos
                shiftsToDelete.forEach(async (shiftId) => {
                    // Delete shift
                    await this.deleteShiftFromDB(shiftId);
                    
                    // Delete associated photos
                    const photos = await this.getShiftPhotos(shiftId);
                    for (const photo of photos) {
                        await this.deletePhotoFromDB(photo.id);
                    }
                });
                
                if (shiftsToDelete.length > 0) {
                    console.log(`Cleaned up ${shiftsToDelete.length} old shifts`);
                }
            };
        } catch (error) {
            console.error('Error cleaning up old shifts:', error);
        }
    }
    
    // Check if week needs to be updated (call this periodically)
    checkWeekUpdate() {
        const today = new Date();
        const currentWeekStart = this.weeks[1].start; // Middle week should be current
        const daysSinceWeekStart = Math.floor((today - currentWeekStart) / (1000 * 60 * 60 * 24));
        
        // If we're more than 7 days past the current week start, update weeks
        if (daysSinceWeekStart >= 7) {
            this.initializeWeeks();
            this.renderWeekView();
            console.log('Weeks updated for new period');
        }
    }
    
    async init() {
        await this.initDB();
        this.setupEventListeners();
        this.renderWeekView();
        
        // Check for week updates every hour
        setInterval(() => this.checkWeekUpdate(), 60 * 60 * 1000);
        
        // Also check on app focus/visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkWeekUpdate();
            }
        });
    }
    
    // Initialize IndexedDB
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('MyShiftDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create shifts store
                if (!db.objectStoreNames.contains('shifts')) {
                    const shiftsStore = db.createObjectStore('shifts', { keyPath: 'id', autoIncrement: true });
                    shiftsStore.createIndex('week', 'week', { unique: false });
                    shiftsStore.createIndex('day', 'day', { unique: false });
                }
                
                // Create photos store
                if (!db.objectStoreNames.contains('photos')) {
                    const photosStore = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
                    photosStore.createIndex('shiftId', 'shiftId', { unique: false });
                }
            };
        });
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Week selector
        document.querySelectorAll('.week-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectWeek(parseInt(e.target.dataset.week));
            });
        });
        
        // Add shift button
        document.getElementById('addShiftBtn').addEventListener('click', () => {
            this.openAddShiftModal();
        });
        
        // Modal close buttons
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal('shiftModal');
        });
        
        document.getElementById('closeAddModal').addEventListener('click', () => {
            this.closeModal('addShiftModal');
        });
        
        document.getElementById('cancelAddShift').addEventListener('click', () => {
            this.closeModal('addShiftModal');
        });
        
        // Day Off checkbox
        document.getElementById('isDayOff').addEventListener('change', (e) => {
            const shiftDetailsFields = document.getElementById('shiftDetailsFields');
            const inputs = shiftDetailsFields.querySelectorAll('input, select');
            
            if (e.target.checked) {
                // Hide shift details when Day Off is checked
                shiftDetailsFields.style.opacity = '0.5';
                inputs.forEach(input => {
                    if (input.id !== 'shiftDay') {
                        input.required = false;
                        input.disabled = true;
                    }
                });
            } else {
                // Show shift details when Day Off is unchecked
                shiftDetailsFields.style.opacity = '1';
                inputs.forEach(input => {
                    if (input.id !== 'shiftDay') {
                        input.required = true;
                        input.disabled = false;
                    }
                });
            }
        });
        
        // Copy days functionality - handle button toggles
        document.querySelectorAll('.copy-day-btn').forEach(button => {
            // Handle click events
            button.addEventListener('click', (e) => {
                e.preventDefault();
                button.classList.toggle('selected');
                this.updateCopyDaysState();
            });
            
            // Handle touch events for mobile
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                button.classList.toggle('selected');
                this.updateCopyDaysState();
            });
        });
        
        // Shift form
        document.getElementById('shiftForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveShift();
        });
        
        // Photo upload
        document.getElementById('uploadBtn').addEventListener('click', () => {
            // Remove capture attribute to open gallery/file picker
            const photoInput = document.getElementById('photoInput');
            photoInput.removeAttribute('capture');
            photoInput.click();
        });
        
        document.getElementById('cameraBtn').addEventListener('click', () => {
            // Add capture attribute to open camera
            const photoInput = document.getElementById('photoInput');
            photoInput.setAttribute('capture', 'environment');
            photoInput.click();
        });
        
        document.getElementById('photoInput').addEventListener('change', (e) => {
            this.handlePhotoUpload(e.target.files);
        });
        
        // Delete shift
        document.getElementById('deleteShiftBtn').addEventListener('click', () => {
            this.deleteShift();
        });
        
        // Edit shift
        document.getElementById('editShiftBtn').addEventListener('click', () => {
            this.openEditShiftModal();
        });
        
        // Photo fullscreen close
        document.getElementById('closePhotoFullscreen').addEventListener('click', () => {
            this.closeModal('photoFullscreenModal');
        });
        
        // Close modals on background click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }
    
    // Week selection
    selectWeek(weekIndex) {
        this.currentWeek = weekIndex;
        
        // Update button states
        document.querySelectorAll('.week-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-week="${weekIndex}"]`).classList.add('active');
        
        // Re-render week view
        this.renderWeekView();
    }
    
    // Format hours display
    formatHours(hours) {
        if (typeof hours === 'object' && hours.hours !== undefined) {
            // Handle new format: {hours: 7, minutes: 22}
            const h = hours.hours;
            const m = hours.minutes;
            if (m === 0) {
                return `${h}h`;
            }
            return `${h}h ${m}m`;
        } else if (typeof hours === 'string' && hours.includes('.')) {
            // Handle legacy decimal format
            const [wholeHours, decimalHours] = hours.split('.');
            const minutes = Math.round((parseFloat('0.' + decimalHours) * 60));
            return `${wholeHours}h ${minutes}m`;
        } else if (typeof hours === 'number') {
            // Handle legacy number format
            const wholeHours = Math.floor(hours);
            const decimalHours = hours - wholeHours;
            const minutes = Math.round(decimalHours * 60);
            if (minutes === 0) {
                return `${wholeHours}h`;
            } else if (minutes === 60) {
                return `${wholeHours + 1}h`;
            }
            return `${wholeHours}h ${minutes}m`;
        }
        return `${hours}h`;
    }
    
    // Format time for display
    formatTime(time24) {
        const [hours, minutes] = time24.split(':');
        const hour = parseInt(hours);
        const minute = parseInt(minutes);
        
        if (hour === 0) {
            return `12:${minute.toString().padStart(2, '0')} AM`;
        } else if (hour < 12) {
            return `${hour}:${minute.toString().padStart(2, '0')} AM`;
        } else if (hour === 12) {
            return `12:${minute.toString().padStart(2, '0')} PM`;
        } else {
            return `${hour - 12}:${minute.toString().padStart(2, '0')} PM`;
        }
    }
    
    // Render week view
    async renderWeekView() {
        const weekView = document.getElementById('weekView');
        const weekSelector = document.querySelector('.week-selector');
        
        // Update week selector buttons
        this.updateWeekSelector();
        
        const weekStart = this.weeks[this.currentWeek].start;
        
        let html = '';
        
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(weekStart);
            currentDate.setDate(weekStart.getDate() + i);
            
            const dayName = this.days[i];
            const dayDate = currentDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            });
            
            const shifts = await this.getShiftsForDay(this.currentWeek, dayName);
            
            html += `
                <div class="day-card ${shifts.length > 0 && shifts.some(shift => shift.isDayOff) ? 'day-off-card' : ''}" data-day="${dayName}">
                    <div class="day-header">
                        <span class="day-name">${dayName.charAt(0).toUpperCase() + dayName.slice(1)}</span>
                        <span class="day-date">${dayDate}</span>
                    </div>
                    <div class="shifts-container">
                        ${shifts.length > 0 ? shifts.map(shift => {
                            if (shift.isDayOff) {
                                return `
                                    <div class="day-off-item" data-shift-id="${shift.id}">
                                        <div class="day-off-badge">OFF</div>
                                    </div>
                                `;
                            } else {
                                return `
                                    <div class="shift-item" data-shift-id="${shift.id}">
                                        <div class="shift-id">${shift.shiftId}</div>
                                        <div class="shift-details">
                                            <span class="shift-time">🕐 ${this.formatTime(shift.signOn)} - ${this.formatTime(shift.finish)}</span>
                                            <span class="shift-hours">${this.formatHours(shift.totalHours)}</span>
                                        </div>
                                    </div>
                                `;
                            }
                        }).join('') : '<div class="no-shifts">No shifts scheduled</div>'}
                    </div>
                </div>
            `;
        }
        
        weekView.innerHTML = html;
        
        // Add click listeners to shift items and day off items
        document.querySelectorAll('.shift-item, .day-off-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const shiftId = parseInt(item.dataset.shiftId);
                this.openShiftDetails(shiftId);
            });
        });
        
        // Add click listeners to day cards for adding shifts
        document.querySelectorAll('.day-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('no-shifts') || e.target.classList.contains('day-card')) {
                    const dayName = card.dataset.day;
                    this.openAddShiftModal(dayName);
                }
            });
        });
    }
    
    // Update week selector buttons
    updateWeekSelector() {
        const weekSelector = document.querySelector('.week-selector');
        
        let html = '';
        this.weeks.forEach((week, index) => {
            const isActive = index === this.currentWeek;
            const isCurrentWeek = this.isCurrentWeek(week.start);
            const isPastWeek = week.start < new Date();
            
            html += `
                <button class="week-btn ${isActive ? 'active' : ''} ${isPastWeek ? 'past-week' : ''}" 
                        data-week="${index}" 
                        onclick="app.selectWeek(${index})">
                    ${week.label}
                    ${isCurrentWeek ? ' (Current)' : ''}
                </button>
            `;
        });
        
        weekSelector.innerHTML = html;
    }
    
    // Update copy days state based on selected day
    updateCopyDaysState() {
        const selectedDay = document.getElementById('shiftDay').value;
        const copyButtons = document.querySelectorAll('.copy-day-btn');
        
        copyButtons.forEach(button => {
            const day = button.dataset.day;
            
            // Uncheck the selected day (prevent copying to same day)
            if (day === selectedDay) {
                button.classList.remove('selected');
            }
        });
    }
    isCurrentWeek(weekStart) {
        const today = new Date();
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        return today >= weekStart && today <= weekEnd;
    }
    
    // Get shifts for a specific day
    async getShiftsForDay(week, day) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['shifts'], 'readonly');
            const store = transaction.objectStore('shifts');
            const index = store.index('week');
            const request = index.getAll(week);
            
            request.onsuccess = () => {
                const shifts = request.result.filter(shift => shift.day === day);
                resolve(shifts);
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    // Open shift details modal
    async openShiftDetails(shiftId) {
        const shift = await this.getShift(shiftId);
        if (!shift) return;
        
        this.currentShift = shift;
        
        // Populate modal
        document.getElementById('modalShiftId').textContent = shift.shiftId;
        document.getElementById('modalSignOn').textContent = this.formatTime(shift.signOn);
        document.getElementById('modalFinish').textContent = this.formatTime(shift.finish);
        document.getElementById('modalTotalHours').textContent = this.formatHours(shift.totalHours);
        
        // Load photos
        await this.loadShiftPhotos(shiftId);
        
        // Show modal
        this.openModal('shiftModal');
    }
    
    // Get single shift
    async getShift(shiftId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['shifts'], 'readonly');
            const store = transaction.objectStore('shifts');
            const request = store.get(shiftId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Load shift photos
    async loadShiftPhotos(shiftId) {
        const photos = await this.getShiftPhotos(shiftId);
        const gallery = document.getElementById('photoGallery');
        
        if (photos.length === 0) {
            gallery.innerHTML = '<p style="color: #64748b; text-align: center;">No photos uploaded</p>';
            return;
        }
        
        gallery.innerHTML = photos.map(photo => `
            <div class="photo-item" onclick="app.openPhotoFullscreen('${photo.data}')">
                <img src="${photo.data}" alt="Shift photo">
                <button class="photo-delete" onclick="event.stopPropagation(); app.deletePhoto(${photo.id})">×</button>
            </div>
        `).join('');
    }
    
    // Get photos for a shift
    async getShiftPhotos(shiftId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['photos'], 'readonly');
            const store = transaction.objectStore('photos');
            const index = store.index('shiftId');
            const request = index.getAll(shiftId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
        // Open add shift modal
    openAddShiftModal(day = null) {
        this.editingShift = null;
        document.getElementById('addModalTitle').textContent = 'Add New Shift';
        document.getElementById('shiftForm').reset();
        
        // Reset Day Off checkbox and trigger change event
        document.getElementById('isDayOff').checked = false;
        const event = new Event('change');
        document.getElementById('isDayOff').dispatchEvent(event);
        
        if (day) {
            document.getElementById('shiftDay').value = day;
            // Update copy days state
            this.updateCopyDaysState();
        }
        
        this.openModal('addShiftModal');
    }
    
    // Open edit shift modal
    async openEditShiftModal() {
        if (!this.currentShift) return;
        
        this.editingShift = this.currentShift;
        document.getElementById('addModalTitle').textContent = 'Edit Shift';
        
        // Populate form
        document.getElementById('shiftDay').value = this.currentShift.day;
        document.getElementById('isDayOff').checked = this.currentShift.isDayOff || false;
        
        // Handle Day Off checkbox change
        const event = new Event('change');
        document.getElementById('isDayOff').dispatchEvent(event);
        
        if (!this.currentShift.isDayOff) {
            // Populate regular shift fields
            document.getElementById('shiftId').value = this.currentShift.shiftId;
            document.getElementById('signOnTime').value = this.currentShift.signOn;
            document.getElementById('finishTime').value = this.currentShift.finish;
            
            // Handle total hours - support both old and new formats
            if (typeof this.currentShift.totalHours === 'object' && this.currentShift.totalHours.hours !== undefined) {
                // New format
                document.getElementById('totalHoursHours').value = this.currentShift.totalHours.hours;
                document.getElementById('totalHoursMinutes').value = this.currentShift.totalHours.minutes;
            } else {
                // Legacy format - convert to hours/minutes
                const totalHours = parseFloat(this.currentShift.totalHours);
                const hours = Math.floor(totalHours);
                const minutes = Math.round((totalHours - hours) * 60);
                document.getElementById('totalHoursHours').value = hours;
                document.getElementById('totalHoursMinutes').value = minutes;
            }
        }
        
        // Close details modal and open edit modal
        this.closeModal('shiftModal');
        this.openModal('addShiftModal');
    }
    
    // Save shift
    async saveShift() {
        const isDayOff = document.getElementById('isDayOff').checked;
        const selectedDay = document.getElementById('shiftDay').value;
        const copyButtons = document.querySelectorAll('.copy-day-btn.selected');
        const copyDays = Array.from(copyButtons).map(btn => btn.dataset.day);
        
        let formData;
        
        if (isDayOff) {
            // Save Day Off
            formData = {
                week: this.currentWeek,
                day: selectedDay,
                isDayOff: true,
                shiftId: 'DAY OFF',
                signOn: '00:00',
                finish: '00:00',
                totalHours: { hours: 0, minutes: 0 }
            };
        } else {
            // Save regular shift
            const hours = parseInt(document.getElementById('totalHoursHours').value);
            const minutes = parseInt(document.getElementById('totalHoursMinutes').value);
            
            formData = {
                week: this.currentWeek,
                day: selectedDay,
                isDayOff: false,
                shiftId: document.getElementById('shiftId').value,
                signOn: document.getElementById('signOnTime').value,
                finish: document.getElementById('finishTime').value,
                totalHours: { hours, minutes }
            };
        }
        
        try {
            // Save to primary day AND all selected copy days
            const daysToSave = [selectedDay, ...copyDays];
            
            for (const day of daysToSave) {
                const dayFormData = { ...formData, day };
                
                if (this.editingShift) {
                    // Update existing shift
                    await this.updateShift(this.editingShift.id, dayFormData);
                } else {
                    // Add new shift/day off
                    await this.addShift(dayFormData);
                }
            }
            
            this.closeModal('addShiftModal');
            this.renderWeekView();
        } catch (error) {
            console.error('Error saving shift:', error);
            alert('Error saving shift. Please try again.');
        }
    }
    
    // Add new shift
    async addShift(shiftData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['shifts'], 'readwrite');
            const store = transaction.objectStore('shifts');
            const request = store.add(shiftData);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Update existing shift
    async updateShift(shiftId, shiftData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['shifts'], 'readwrite');
            const store = transaction.objectStore('shifts');
            const request = store.put({ ...shiftData, id: shiftId });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Delete shift
    async deleteShift() {
        if (!this.currentShift) return;
        
        if (!confirm(`Are you sure you want to delete shift ${this.currentShift.shiftId}?`)) {
            return;
        }
        
        try {
            // Delete shift
            await this.deleteShiftFromDB(this.currentShift.id);
            
            // Delete associated photos
            const photos = await this.getShiftPhotos(this.currentShift.id);
            for (const photo of photos) {
                await this.deletePhotoFromDB(photo.id);
            }
            
            this.closeModal('shiftModal');
            this.renderWeekView();
        } catch (error) {
            console.error('Error deleting shift:', error);
            alert('Error deleting shift. Please try again.');
        }
    }
    
    // Delete shift from database
    async deleteShiftFromDB(shiftId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['shifts'], 'readwrite');
            const store = transaction.objectStore('shifts');
            const request = store.delete(shiftId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Handle photo upload
    async handlePhotoUpload(files) {
        if (!this.currentShift) return;
        
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        await this.savePhoto(this.currentShift.id, e.target.result, file.name);
                        await this.loadShiftPhotos(this.currentShift.id);
                    } catch (error) {
                        console.error('Error saving photo:', error);
                    }
                };
                reader.readAsDataURL(file);
            }
        }
        
        // Clear file input
        document.getElementById('photoInput').value = '';
    }
    
    // Save photo to database
    async savePhoto(shiftId, data, filename) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['photos'], 'readwrite');
            const store = transaction.objectStore('photos');
            const request = store.add({
                shiftId: shiftId,
                data: data,
                filename: filename,
                uploadedAt: new Date().toISOString()
            });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Delete photo
    async deletePhoto(photoId) {
        try {
            await this.deletePhotoFromDB(photoId);
            if (this.currentShift) {
                await this.loadShiftPhotos(this.currentShift.id);
            }
        } catch (error) {
            console.error('Error deleting photo:', error);
        }
    }
    
    // Open photo fullscreen
    openPhotoFullscreen(photoData) {
        document.getElementById('fullscreenPhoto').src = photoData;
        this.openModal('photoFullscreenModal');
        
        // Initialize pinch zoom for touch devices
        this.initPhotoZoom();
    }
    
    // Initialize photo zoom functionality
    initPhotoZoom() {
        const photo = document.getElementById('fullscreenPhoto');
        let scale = 1;
        let initialDistance = 0;
        
        // Touch events for pinch zoom
        photo.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                initialDistance = this.getDistance(e.touches[0], e.touches[1]);
                e.preventDefault();
            }
        });
        
        photo.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
                const scaleChange = currentDistance / initialDistance;
                scale = Math.min(Math.max(1, scale * scaleChange), 5); // Min 1x, max 5x zoom
                photo.style.transform = `scale(${scale})`;
                initialDistance = currentDistance;
                e.preventDefault();
            }
        });
        
        photo.addEventListener('touchend', () => {
            // Reset scale on touch end for next pinch
            if (scale <= 1.1) {
                photo.style.transform = 'scale(1)';
                scale = 1;
            }
        });
        
        // Double tap to reset zoom
        let lastTap = 0;
        photo.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 500 && tapLength > 0) {
                photo.style.transform = 'scale(1)';
                scale = 1;
                e.preventDefault();
            }
            lastTap = currentTime;
        });
        
        // Mouse wheel zoom for desktop
        photo.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            scale = Math.min(Math.max(1, scale * delta), 5);
            photo.style.transform = `scale(${scale})`;
        });
        
        // Click to reset zoom
        photo.addEventListener('click', (e) => {
            if (e.detail === 2) { // Double click
                photo.style.transform = 'scale(1)';
                scale = 1;
                e.preventDefault();
            }
        });
    }
    
    // Calculate distance between two touch points
    getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // Delete photo from database
    async deletePhotoFromDB(photoId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['photos'], 'readwrite');
            const store = transaction.objectStore('photos');
            const request = store.delete(photoId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Modal helpers
    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        document.body.style.overflow = '';
        
        if (modalId === 'shiftModal') {
            this.currentShift = null;
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MyShiftApp();
});

// PWA Installation
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Show install button or banner
    const installBanner = document.createElement('div');
    installBanner.className = 'install-banner';
    installBanner.innerHTML = `
        <p>Install MyShift for quick access!</p>
        <button id="installBtn">Install</button>
        <button id="dismissBtn">Not now</button>
    `;
    
    document.body.appendChild(installBanner);
    
    document.getElementById('installBtn').addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
            installBanner.remove();
        }
    });
    
    document.getElementById('dismissBtn').addEventListener('click', () => {
        installBanner.remove();
    });
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
