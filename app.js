// MyShift App - Simple Bus Driver Schedule Manager
class MyShiftApp {
    constructor() {
        this.db = null;
        this.currentWeek = 1; // Default to middle week (current week)
        this.currentShift = null;
        this.editingShift = null;
        
        // Initialize dynamic weeks
        this.initializeWeeks();
        
        this.days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    }
    
    // Initialize dynamic weeks based on current date
    initializeWeeks() {
        const today = new Date();
        const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysSinceSunday = currentDay; // Days since last Sunday (0 if today is Sunday)
        
        // Find start of current week (Sunday)
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
    }
    
    // Format week label (e.g., "1 Mar 26")
    formatWeekLabel(date) {
        const day = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const year = date.getFullYear().toString().slice(-2);
        return `${day} ${month} ${year}`;
    }
    
    async init() {
        try {
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
        } catch (error) {
            console.error('App initialization failed:', error);
            // Show error message to user
            document.body.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; font-family: system-ui;">
                    <h1 style="color: #ef4444;">App Failed to Load</h1>
                    <p style="color: #64748b;">Please refresh the page or check your browser settings.</p>
                    <button onclick="location.reload()" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-top: 20px;">Refresh</button>
                </div>
            `;
        }
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
        
        // Copy days functionality
        document.querySelectorAll('.copy-day-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                button.classList.toggle('selected');
                this.updateCopyDaysState();
            });
        });
        
        // Photo upload
        document.getElementById('uploadBtn').addEventListener('click', () => {
            const photoInput = document.getElementById('photoInput');
            photoInput.removeAttribute('capture');
            photoInput.click();
        });
        
        document.getElementById('cameraBtn').addEventListener('click', () => {
            const photoInput = document.getElementById('photoInput');
            photoInput.setAttribute('capture', 'environment');
            photoInput.click();
        });
        
        document.getElementById('photoInput').addEventListener('change', (e) => {
            this.handlePhotoUpload(e.target.files);
        });
        
        // Form submission
        document.getElementById('shiftForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveShift();
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
    
    // Update copy days state
    updateCopyDaysState() {
        const selectedButtons = document.querySelectorAll('.copy-day-btn.selected');
        const selectedDays = Array.from(selectedButtons).map(btn => btn.dataset.day);
        console.log('Selected days for copy:', selectedDays);
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
    
    // Check if week needs to be updated
    checkWeekUpdate() {
        const today = new Date();
        const currentWeekStart = this.weeks[1].start; // Middle week should be current
        const daysSinceWeekStart = Math.floor((today - currentWeekStart) / (1000 * 60 * 60 * 24));
        
        // If we're more than 7 days past the current week start, update weeks
        if (daysSinceWeekStart >= 7) {
            this.initializeWeeks();
            this.renderWeekView();
        }
    }
    
    // Format hours display
    formatHours(hours) {
        if (typeof hours === 'object' && hours.hours !== undefined) {
            const h = hours.hours;
            const m = hours.minutes;
            if (m === 0) {
                return `${h}h`;
            }
            return `${h}h ${m}m`;
        } else if (typeof hours === 'number') {
            const wholeHours = Math.floor(hours);
            const decimalHours = hours - wholeHours;
            const minutes = Math.round(decimalHours * 60);
            if (minutes === 0) {
                return `${wholeHours}h`;
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
        
        // Get all shifts for the week to detect duplicates
        const allWeekShifts = [];
        for (let i = 0; i < 7; i++) {
            const dayName = this.days[i];
            const shifts = await this.getShiftsForDay(this.currentWeek, dayName);
            allWeekShifts.push(...shifts);
        }
        
        // Find duplicate shift IDs and identify original vs duplicates
        const shiftIdMap = new Map(); // shiftId -> {original: shiftId, duplicates: [shiftIds]}
        allWeekShifts.forEach(shift => {
            if (!shiftIdMap.has(shift.shiftId)) {
                shiftIdMap.set(shift.shiftId, {
                    original: shift.id,
                    duplicates: []
                });
            } else {
                shiftIdMap.get(shift.shiftId).duplicates.push(shift.id);
            }
        });
        
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
            const photos = shifts.length > 0 ? await this.getShiftPhotos(shifts[0].id) : [];
            
            // Determine day card class based on day name
            let dayCardClass = 'day-card';
            if (dayName === 'sunday') dayCardClass += ' sunday-card';
            if (dayName === 'saturday') dayCardClass += ' saturday-card';
            
            html += `
                <div class="${dayCardClass}" data-day="${dayName}">
                    <div class="day-header">
                        <span class="day-name">${dayName.charAt(0).toUpperCase() + dayName.slice(1)}</span>
                        <span class="day-date">${dayDate}</span>
                    </div>
                    <div class="shifts-container">
                        ${shifts.length > 0 ? shifts.map(shift => {
                            const shiftInfo = shiftIdMap.get(shift.shiftId);
                            const isOriginal = shiftInfo && shiftInfo.original === shift.id;
                            const isDuplicate = shiftInfo && shiftInfo.duplicates.includes(shift.id);
                            
                            if (shift.isDayOff) {
                                return `
                                    <div class="day-off-item ${!isOriginal ? 'duplicate-shift' : ''}" data-shift-id="${shift.id}">
                                        <div class="day-off-badge">
                                            ${isOriginal ? 'OFF' : '✅'}
                                        </div>
                                    </div>
                                `;
                            } else {
                                return `
                                    <div class="shift-item ${!isOriginal ? 'duplicate-shift' : ''}" data-shift-id="${shift.id}">
                                        <div class="shift-id-large">
                                            ${isOriginal ? shift.shiftId : '✅'}
                                        </div>
                                        ${photos.length > 0 && isOriginal ? `
                                            <div class="shift-photo-thumbnail" onclick="app.openPhotoFullscreen('${photos[0].data}')">
                                                <img src="${photos[0].data}" alt="Shift photo">
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            }
                        }).join('') : '<div class="no-shifts">Tap to add shift</div>'}
                    </div>
                </div>
            `;
        }
        
        weekView.innerHTML = html;
        
        // Add click listeners - only for original shifts
        document.querySelectorAll('.shift-item:not(.duplicate-shift), .day-off-item:not(.duplicate-shift)').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const shiftId = parseInt(item.dataset.shiftId);
                this.openShiftDetails(shiftId);
            });
        });
        
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
    
    // Check if date is in current week
    isCurrentWeek(date) {
        const today = new Date();
        const currentWeekStart = this.weeks[1].start; // Middle week should be current
        const daysSinceWeekStart = Math.floor((today - currentWeekStart) / (1000 * 60 * 60 * 24));
        return daysSinceWeekStart >= 0 && daysSinceWeekStart < 7;
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
        
        // Populate modal with shift data
        document.getElementById('modalShiftId').textContent = shift.shiftId;
        
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
        
        console.log(`Loaded ${photos.length} photos for shift ${shiftId}`);
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
        
        // Reset copy days selection
        document.querySelectorAll('.copy-day-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        if (day) {
            document.getElementById('shiftDay').value = day;
        }
        
        this.openModal('addShiftModal');
    }
    
    // Save shift
    async saveShift() {
        const isDayOff = document.getElementById('isDayOff').checked;
        const selectedDay = document.getElementById('shiftDay').value;
        const shiftId = document.getElementById('shiftId').value;
        
        // Get selected copy days
        const selectedButtons = document.querySelectorAll('.copy-day-btn.selected');
        const selectedDays = Array.from(selectedButtons).map(btn => btn.dataset.day);
        
        // Create shift data
        let shiftData;
        
        if (isDayOff) {
            shiftData = {
                week: this.currentWeek,
                day: selectedDay,
                isDayOff: true,
                shiftId: 'DAY OFF'
            };
        } else {
            shiftData = {
                week: this.currentWeek,
                day: selectedDay,
                isDayOff: false,
                shiftId: shiftId
            };
        }
        
        try {
            // Save to selected days
            for (const day of selectedDays) {
                const dayShiftData = { ...shiftData, day };
                
                // Check if shift already exists for this day
                const existingShifts = await this.getShiftsForDay(this.currentWeek, day);
                if (existingShifts.length > 0) {
                    // Update existing shift
                    await this.updateShift(existingShifts[0].id, dayShiftData);
                } else {
                    // Add new shift
                    await this.addShift(dayShiftData);
                }
            }
            
            // If no copy days selected, just save to the original day
            if (selectedDays.length === 0) {
                const existingShifts = await this.getShiftsForDay(this.currentWeek, selectedDay);
                if (existingShifts.length > 0) {
                    // Update existing shift
                    await this.updateShift(existingShifts[0].id, shiftData);
                } else {
                    // Add new shift
                    await this.addShift(shiftData);
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
            console.log('Deleting shift:', this.currentShift.id);
            
            // Delete shift
            await this.deleteShiftFromDB(this.currentShift.id);
            
            // Delete associated photos
            const photos = await this.getShiftPhotos(this.currentShift.id);
            for (const photo of photos) {
                await this.deletePhotoFromDB(photo.id);
            }
            
            console.log('Shift deleted successfully');
            
            // Close modal and refresh
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
        // Get the current shift ID from the form
        const shiftId = document.getElementById('shiftId').value;
        const selectedDay = document.getElementById('shiftDay').value;
        
        // Find or create shift for this day
        let currentShift = null;
        const existingShifts = await this.getShiftsForDay(this.currentWeek, selectedDay);
        
        if (existingShifts.length > 0) {
            currentShift = existingShifts[0];
        } else {
            // Create a temporary shift for photo upload
            const tempShiftData = {
                week: this.currentWeek,
                day: selectedDay,
                isDayOff: false,
                shiftId: shiftId || 'TEMP_SHIFT'
            };
            const newShiftId = await this.addShift(tempShiftData);
            currentShift = { ...tempShiftData, id: newShiftId };
        }
        
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        await this.savePhoto(currentShift.id, e.target.result, file.name);
                        console.log('Photo saved successfully for shift:', currentShift.id);
                        
                        // If we're in a shift details modal, refresh the photos
                        if (this.currentShift && this.currentShift.id === currentShift.id) {
                            await this.loadShiftPhotos(currentShift.id);
                        }
                        
                        // Refresh the week view to show thumbnail
                        this.renderWeekView();
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
        if (!confirm('Are you sure you want to delete this photo?')) {
            return;
        }
        
        try {
            console.log('Deleting photo:', photoId);
            await this.deletePhotoFromDB(photoId);
            
            // Refresh photos if we're in a shift details modal
            if (this.currentShift) {
                await this.loadShiftPhotos(this.currentShift.id);
                // Also refresh week view to update thumbnails
                this.renderWeekView();
            }
            
            console.log('Photo deleted successfully');
        } catch (error) {
            console.error('Error deleting photo:', error);
            alert('Error deleting photo. Please try again.');
        }
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
    
    // Open photo fullscreen
    openPhotoFullscreen(photoData) {
        document.getElementById('fullscreenPhoto').src = photoData;
        this.openModal('photoFullscreenModal');
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
document.addEventListener('DOMContentLoaded', async () => {
    try {
        window.app = new MyShiftApp();
        await window.app.init();
        console.log('MyShift App initialized successfully');
    } catch (error) {
        console.error('Failed to initialize MyShift App:', error);
    }
});
