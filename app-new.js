class MyShiftApp {
    constructor() {
        this.db = null;
        this.currentWeek = 1; // Middle week (current)
        this.weeks = [];
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
                    const shiftStore = db.createObjectStore('shifts', { keyPath: 'id', autoIncrement: true });
                    shiftStore.createIndex('week', 'week', { unique: false });
                    shiftStore.createIndex('day', 'day', { unique: false });
                }
                
                // Create photos store
                if (!db.objectStoreNames.contains('photos')) {
                    const photoStore = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
                    photoStore.createIndex('shiftId', 'shiftId', { unique: false });
                }
            };
        });
    }
    
    // Initialize app
    async init() {
        try {
            await this.initDB();
            this.setupEventListeners();
            this.renderWeekView();
        } catch (error) {
            console.error('App initialization failed:', error);
            document.body.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; font-family: system-ui;">
                    <h1 style="color: #ef4444;">App Failed to Load</h1>
                    <p style="color: #64748b;">Please refresh the page.</p>
                    <button onclick="location.reload()" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-top: 20px;">Refresh</button>
                </div>
            `;
        }
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Add shift button
        document.getElementById('addShiftBtn').addEventListener('click', () => {
            this.openAddShiftModal();
        });
        
        // Modal close buttons
        document.getElementById('closeAddModal').addEventListener('click', () => {
            this.closeModal('addShiftModal');
        });
        
        document.getElementById('closeShiftModal').addEventListener('click', () => {
            this.closeModal('shiftModal');
        });
        
        document.getElementById('closePhotoFullscreen').addEventListener('click', () => {
            this.closeModal('photoFullscreenModal');
        });
        
        // Day off checkbox
        document.getElementById('isDayOff').addEventListener('change', (e) => {
            const shiftDetailsFields = document.getElementById('shiftDetailsFields');
            if (e.target.checked) {
                shiftDetailsFields.style.display = 'none';
            } else {
                shiftDetailsFields.style.display = 'block';
            }
        });
        
        // Copy days buttons
        document.querySelectorAll('.copy-day-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('selected');
            });
        });
        
        // Photo upload buttons
        document.getElementById('galleryBtn').addEventListener('click', () => {
            document.getElementById('photoInput').click();
        });
        
        document.getElementById('cameraBtn').addEventListener('click', () => {
            document.getElementById('photoInput').click();
        });
        
        document.getElementById('photoInput').addEventListener('change', (e) => {
            this.handlePhotoUpload(e.target.files);
        });
        
        // Form submission
        document.getElementById('shiftForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveShift();
        });
        
        // Modal buttons
        document.getElementById('cancelAddShift').addEventListener('click', () => {
            this.closeModal('addShiftModal');
        });
        
        document.getElementById('editShiftBtn').addEventListener('click', () => {
            this.openEditShiftModal();
        });
        
        document.getElementById('deleteShiftBtn').addEventListener('click', () => {
            this.deleteShift();
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
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        });
        
        if (day) {
            document.getElementById('shiftDay').value = day;
            // Disable the current day in copy buttons
            const currentDayBtn = document.querySelector(`.copy-day-btn[data-day="${day}"]`);
            if (currentDayBtn) {
                currentDayBtn.disabled = true;
                currentDayBtn.style.opacity = '0.5';
                currentDayBtn.style.cursor = 'not-allowed';
            }
        }
        
        this.openModal('addShiftModal');
    }
    
    // Save shift
    async saveShift() {
        console.log('Save shift function called');
        
        const isDayOff = document.getElementById('isDayOff').checked;
        const selectedDay = document.getElementById('shiftDay').value;
        const shiftIdInput = document.getElementById('shiftId');
        const shiftId = shiftIdInput ? shiftIdInput.value.trim() : '';
        
        console.log('Shift data:', { isDayOff, selectedDay, shiftId });
        
        // Validate required fields
        if (!selectedDay || (!isDayOff && !shiftId)) {
            alert('Please enter Shift ID');
            return;
        }
        
        // Get selected copy days
        const selectedButtons = document.querySelectorAll('.copy-day-btn.selected');
        const selectedDays = Array.from(selectedButtons).map(btn => btn.dataset.day);
        
        console.log('Selected copy days:', selectedDays);
        
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
        
        console.log('Shift data to save:', shiftData);
        
        try {
            // Save to selected days
            for (const day of selectedDays) {
                const dayShiftData = { ...shiftData, day };
                
                // Check if shift already exists for this day
                const existingShifts = await this.getShiftsForDay(this.currentWeek, day);
                if (existingShifts.length > 0) {
                    // Update existing shift
                    console.log('Updating existing shift on', day);
                    await this.updateShift(existingShifts[0].id, dayShiftData);
                } else {
                    // Add new shift
                    console.log('Adding new shift on', day);
                    await this.addShift(dayShiftData);
                }
            }
            
            // If no copy days selected, just save to original day
            if (selectedDays.length === 0) {
                const existingShifts = await this.getShiftsForDay(this.currentWeek, selectedDay);
                if (existingShifts.length > 0) {
                    // Update existing shift
                    console.log('Updating existing shift on original day:', selectedDay);
                    await this.updateShift(existingShifts[0].id, shiftData);
                } else {
                    // Add new shift
                    console.log('Adding new shift on original day:', selectedDay);
                    await this.addShift(shiftData);
                }
            }
            
            console.log('Shift saved successfully');
            
            // Close modal and refresh
            this.closeModal('addShiftModal');
            this.closeModal('shiftModal'); // Also close shift details if open
            this.renderWeekView();
        } catch (error) {
            console.error('Error saving shift:', error);
            alert('Error saving shift. Please try again.');
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
                            if (shift.isDayOff) {
                                return `
                                    <div class="day-off-item" data-shift-id="${shift.id}">
                                        <div class="day-off-badge">OFF</div>
                                    </div>
                                `;
                            } else {
                                return `
                                    <div class="shift-item" data-shift-id="${shift.id}">
                                        <div class="shift-content">
                                            <div class="shift-id-large">#${shift.shiftId}</div>
                                            ${photos.length > 0 ? `
                                                <div class="shift-photo-thumbnail" onclick="app.openPhotoFullscreen('${photos[0].data}')">
                                                    <img src="${photos[0].data}" alt="Shift photo">
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                `;
                            }
                        }).join('') : '<div class="no-shifts">Tap to add shift</div>'}
                    </div>
                </div>
            `;
        }
        
        weekView.innerHTML = html;
        
        // Add click listeners to shifts
        document.querySelectorAll('.shift-item, .day-off-item').forEach(item => {
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
    
    // Select week
    selectWeek(weekIndex) {
        this.currentWeek = weekIndex;
        this.renderWeekView();
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
    
    // Open edit shift modal
    async openEditShiftModal() {
        if (!this.currentShift) {
            console.error('No current shift to edit');
            return;
        }
        
        this.editingShift = this.currentShift;
        document.getElementById('addModalTitle').textContent = 'Edit Shift';
        
        // Populate form with current shift data
        document.getElementById('shiftDay').value = this.currentShift.day;
        
        // Set shift ID value with proper check
        const shiftIdInput = document.getElementById('shiftId');
        if (shiftIdInput) {
            shiftIdInput.value = this.currentShift.shiftId;
            console.log('Set shift ID to:', this.currentShift.shiftId);
        } else {
            console.error('Shift ID input not found!');
        }
        
        // Set day off checkbox
        document.getElementById('isDayOff').checked = this.currentShift.isDayOff;
        const event = new Event('change');
        document.getElementById('isDayOff').dispatchEvent(event);
        
        // Reset copy days selection and disable current day
        document.querySelectorAll('.copy-day-btn').forEach(btn => {
            btn.classList.remove('selected');
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        });
        
        // Disable the current day in copy buttons
        const currentDayBtn = document.querySelector(`.copy-day-btn[data-day="${this.currentShift.day}"]`);
        if (currentDayBtn) {
            currentDayBtn.disabled = true;
            currentDayBtn.style.opacity = '0.5';
            currentDayBtn.style.cursor = 'not-allowed';
        }
        
        // Close details modal and open edit modal
        this.closeModal('shiftModal');
        this.openModal('addShiftModal');
    }
    
    // Delete shift
    async deleteShift() {
        if (!this.currentShift) {
            console.error('No current shift to delete');
            return;
        }
        
        if (!confirm(`Are you sure you want to delete shift ${this.currentShift.shiftId}?`)) {
            return;
        }
        
        try {
            console.log('Deleting shift:', this.currentShift.id, 'from day:', this.currentShift.day);
            
            // Delete shift from database
            await this.deleteShiftFromDB(this.currentShift.id);
            
            // Delete associated photos
            const photos = await this.getShiftPhotos(this.currentShift.id);
            console.log('Found photos to delete:', photos.length);
            for (const photo of photos) {
                await this.deletePhotoFromDB(photo.id);
                console.log('Deleted photo:', photo.id);
            }
            
            console.log('Shift and photos deleted successfully from day:', this.currentShift.day);
            
            // Clear current shift
            this.currentShift = null;
            
            // Close modal and refresh
            this.closeModal('shiftModal');
            this.renderWeekView();
        } catch (error) {
            console.error('Error deleting shift:', error);
            alert('Error deleting shift. Please try again.');
        }
    }
    
    // Handle photo upload
    async handlePhotoUpload(files) {
        // Get current shift ID from form
        const shiftId = document.getElementById('shiftId').value.trim();
        const selectedDay = document.getElementById('shiftDay').value;
        
        // Find existing shift for this day
        const existingShifts = await this.getShiftsForDay(this.currentWeek, selectedDay);
        
        if (existingShifts.length === 0) {
            alert('Please save shift first, then upload photos');
            document.getElementById('photoInput').value = '';
            return;
        }
        
        const currentShift = existingShifts[0];
        
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        await this.savePhoto(currentShift.id, e.target.result, file.name);
                        console.log('Photo saved successfully for shift:', currentShift.id);
                        
                        // If we're in a shift details modal, refresh photos
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
    
    // Open photo fullscreen
    openPhotoFullscreen(photoData) {
        document.getElementById('fullscreenPhoto').src = photoData;
        this.openModal('photoFullscreenModal');
    }
    
    // Modal functions
    openModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
    }
    
    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }
    
    // Database functions
    async addShift(shiftData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['shifts'], 'readwrite');
            const store = transaction.objectStore('shifts');
            const request = store.add(shiftData);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async updateShift(shiftId, shiftData) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['shifts'], 'readwrite');
            const store = transaction.objectStore('shifts');
            const request = store.put({ ...shiftData, id: shiftId });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
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
    
    async getShift(shiftId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['shifts'], 'readonly');
            const store = transaction.objectStore('shifts');
            const request = store.get(shiftId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async deleteShiftFromDB(shiftId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['shifts'], 'readwrite');
            const store = transaction.objectStore('shifts');
            const request = store.delete(shiftId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async savePhoto(shiftId, photoData, fileName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['photos'], 'readwrite');
            const store = transaction.objectStore('photos');
            const request = store.add({
                shiftId: shiftId,
                data: photoData,
                fileName: fileName,
                uploadDate: new Date()
            });
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
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
    
    async deletePhotoFromDB(photoId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['photos'], 'readwrite');
            const store = transaction.objectStore('photos');
            const request = store.delete(photoId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async loadShiftPhotos(shiftId) {
        const photos = await this.getShiftPhotos(shiftId);
        const gallery = document.getElementById('photoGallery');
        
        if (photos.length === 0) {
            gallery.innerHTML = '<p>No photos uploaded</p>';
        } else {
            gallery.innerHTML = photos.map(photo => `
                <div class="photo-item">
                    <img src="${photo.data}" alt="${photo.fileName}" onclick="app.openPhotoFullscreen('${photo.data}')">
                    <button class="delete-photo-btn" onclick="app.deletePhoto(${photo.id})">&times;</button>
                </div>
            `).join('');
        }
    }
    
    async deletePhoto(photoId) {
        if (!confirm('Delete this photo?')) return;
        
        try {
            await this.deletePhotoFromDB(photoId);
            
            // Refresh gallery if shift details modal is open
            if (this.currentShift) {
                await this.loadShiftPhotos(this.currentShift.id);
            }
            
            // Refresh week view to update thumbnail
            this.renderWeekView();
        } catch (error) {
            console.error('Error deleting photo:', error);
            alert('Error deleting photo');
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MyShiftApp();
    app.init();
});
