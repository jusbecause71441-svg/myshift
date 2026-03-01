// MyShift App - Bus Driver Schedule Manager
// Claude AI Configuration - moved inline to fix loading issues
const CLAUDE_API_KEY = 'sk-ant-api03-8Q2yGj3zGhJvE6c6JgQ7V3Ff8y6mKbWqJ5kKp1Qh-6p4g8g';
const CLAUDE_API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';
const CLAUDE_MAX_TOKENS = 1000;
const CLAUDE_TIMEOUT = 15000; // 15 seconds

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
        
        // Initialize OCR functionality
        this.setupOCR();
        
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
    
    // Open shift details modal (READ-ONLY - no data modification)
    async openShiftDetails(shiftId) {
        const shift = await this.getShift(shiftId);
        if (!shift) return;
        
        // Store reference for viewing only (no modification)
        this.currentShift = shift;
        
        // Populate modal with shift data (no modification)
        document.getElementById('modalShiftId').textContent = shift.shiftId;
        document.getElementById('modalSignOn').textContent = this.formatTime(shift.signOn);
        document.getElementById('modalFinish').textContent = this.formatTime(shift.finish);
        document.getElementById('modalTotalHours').textContent = this.formatHours(shift.totalHours);
        
        // Load photos (read-only display)
        await this.loadShiftPhotos(shiftId);
        
        // Show modal for viewing only
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
    
        // OCR functionality - completely redesigned
    setupOCR() {
        const selectBtn = document.getElementById('selectPhotoForOCR');
        const photoInput = document.getElementById('ocrPhotoInput');
        const preview = document.getElementById('ocrPreview');
        const previewImg = document.getElementById('ocrPreviewImg');
        const processing = document.getElementById('ocrProcessing');
        const status = document.getElementById('ocrStatus');
        
        // Handle button click to open file picker
        selectBtn.addEventListener('click', () => {
            photoInput.click();
        });
        
        // Handle file selection
        photoInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Show preview
            this.showOCRPreview(file);
            
            // Start OCR processing
            await this.processOCR(file);
        });
    }
    
    // Show OCR preview
    showOCRPreview(file) {
        const preview = document.getElementById('ocrPreview');
        const previewImg = document.getElementById('ocrPreviewImg');
        const processing = document.getElementById('ocrProcessing');
        const status = document.getElementById('ocrStatus');
        
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            preview.style.display = 'block';
            processing.style.display = 'flex';
            
            // Update status
            status.textContent = 'Processing photo...';
            status.className = 'ocr-status processing';
        };
        reader.readAsDataURL(file);
    }
    
    // Process OCR using Claude AI
    async processOCR(file) {
        const status = document.getElementById('ocrStatus');
        const processing = document.getElementById('ocrProcessing');
        const selectBtn = document.getElementById('selectPhotoForOCR');
        
        try {
            alert('🔍 Step 1: Starting OCR process');
            console.log('🔍 Step 1: Starting OCR process');
            
            // Check if Claude config is loaded
            if (typeof CLAUDE_API_KEY === 'undefined') {
                alert('❌ ERROR: Claude API key not loaded! Check claude-config.js');
                throw new Error('Claude API key not loaded');
            }
            
            alert(`🔑 Step 2: API Key loaded: ${CLAUDE_API_KEY ? 'YES' : 'NO'}`);
            console.log('🔑 Step 2: API Key loaded:', typeof CLAUDE_API_KEY !== 'undefined');
            
            // Disable button during processing
            selectBtn.disabled = true;
            processing.style.display = 'block';
            
            alert('📸 Step 3: Converting image to base64...');
            console.log('📸 Step 3: Converting image to base64...');
            
            // Convert file to base64
            const base64Image = await this.fileToBase64(file);
            
            alert(`📏 Step 4: Image converted to base64 (${base64Image.length} chars)`);
            console.log('📏 Step 4: Image converted to base64, length:', base64Image.length);
            
            // Prepare Claude API request
            const prompt = `Please extract shift information from this bus driver shift sheet image. Look for:
1. Shift ID (usually a number like 12345)
2. Sign On time (in HH:MM format, 24-hour)
3. Finish time (in HH:MM format, 24-hour)  
4. Total Hours (in decimal format like 8.5)

Return the data in this exact JSON format:
{
  "shiftId": "extracted_shift_id",
  "signOn": "HH:MM",
  "finish": "HH:MM", 
  "totalHours": "decimal_hours"
}

Only return JSON, no other text.`;

            alert('🤖 Step 5: Sending request to Claude API...');
            console.log('🤖 Step 5: Sending request to Claude API...');
            console.log('🌐 API Endpoint:', CLAUDE_API_ENDPOINT);
            console.log('🔑 Using API Key:', CLAUDE_API_KEY.substring(0, 10) + '...');
            
            // Call Claude API
            const response = await fetch(CLAUDE_API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': CLAUDE_API_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: CLAUDE_MODEL,
                    max_tokens: CLAUDE_MAX_TOKENS,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'image',
                                    source: {
                                        type: 'base64',
                                        media_type: file.type,
                                        data: base64Image.split(',')[1] // Remove data:image/...;base64, prefix
                                    }
                                },
                                {
                                    type: 'text',
                                    text: prompt
                                }
                            ]
                        }
                    ]
                })
            });

            alert(`📡 Step 6: Response received: ${response.status} ${response.statusText}`);
            console.log('📡 Step 6: Response received:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                alert(`❌ Step 7: API Error: ${errorText}`);
                throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            alert('📋 Step 8: Parsed JSON response');
            console.log('📋 Step 8: Parsed JSON response:', result);

            if (result.content && result.content[0] && result.content[0].text) {
                const extractedText = result.content[0].text;
                
                alert('🔍 Step 9: Extracted text from Claude');
                console.log('🔍 Step 9: Extracted text from Claude:', extractedText);
                
                // Try to parse JSON from Claude's response
                let shiftData;
                try {
                    // Find JSON in the response
                    const jsonMatch = extractedText.match(/\{[^}]+\}/);
                    if (jsonMatch) {
                        shiftData = JSON.parse(jsonMatch[0]);
                        alert('✅ Step 10: Successfully parsed JSON');
                        console.log('✅ Step 10: Successfully parsed JSON:', shiftData);
                    } else {
                        alert('⚠️ Step 10: No JSON found in response');
                        console.log('⚠️ Step 10: No JSON found in response');
                    }
                } catch (parseError) {
                    alert(`❌ Step 10: JSON Parse Error: ${parseError.message}`);
                    console.error('❌ Step 10: JSON Parse Error:', parseError);
                }

                if (shiftData) {
                    alert('📝 Step 11: Populating form with extracted data');
                    console.log('📝 Step 11: Populating form with extracted data:', shiftData);
                    
                    // Populate form with extracted data
                    this.populateFormWithExtractedData(shiftData);
                    status.textContent = '✅ Shift info extracted successfully!';
                    status.className = 'ocr-status success';
                    alert('🎉 Step 12: OCR Complete!');
                } else {
                    alert('⚠️ Step 11: No shift data extracted');
                    status.textContent = '⚠️ Could not extract shift information from photo';
                    status.className = 'ocr-status error';
                }
            } else {
                alert('❌ Step 9: No content in Claude response');
                status.textContent = '⚠️ No response from Claude AI';
                status.className = 'ocr-status error';
            }
            
        } catch (error) {
            alert(`❌ FATAL ERROR: ${error.message}`);
            console.error('❌ FATAL ERROR:', error);
            console.error('❌ ERROR STACK:', error.stack);
            
            let errorMessage = '❌ Error processing photo';
            
            if (error.message.includes('API key')) {
                errorMessage = '❌ Claude API key not configured';
            } else if (error.message.includes('network')) {
                errorMessage = '❌ Network error - check internet connection';
            } else if (error.message.includes('timeout')) {
                errorMessage = '❌ Request timed out';
            } else if (error.message) {
                errorMessage = `❌ ${error.message}`;
            }
            
            status.textContent = errorMessage;
            status.className = 'ocr-status error';
        } finally {
            // Hide processing overlay and re-enable button
            processing.style.display = 'none';
            selectBtn.disabled = false;
            alert('🔄 Process ended - button re-enabled');
        }
    }

    // Convert file to base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }
    
    // Optimize image for faster OCR processing
    async optimizeImageForOCR(file) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions (max 1000px width)
                const maxWidth = 1000;
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                
                // Set canvas dimensions
                canvas.width = width;
                canvas.height = height;
                
                // Draw and optimize image
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to blob
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                }, 'image/jpeg', 0.8);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }
    
    // Show shift selection popup
    showShiftSelectionPopup(shifts) {
        // Create popup HTML
        const popupHtml = `
            <div class="shift-selection-popup" id="shiftSelectionPopup">
                <div class="shift-selection-content">
                    <h3>Which shift is yours?</h3>
                    <p>We found multiple shifts in the image:</p>
                    <div class="shift-options">
                        ${shifts.map(shift => `
                            <button class="shift-option-btn" data-shift='${JSON.stringify(shift)}'>
                                <strong>SHIFT ${shift.shiftId}</strong><br>
                                <small>Sign On: ${shift.signOn} | Finish: ${shift.finish} | Hours: ${shift.totalHours}h ${shift.totalMinutes}m</small>
                            </button>
                        `).join('')}
                    </div>
                    <button class="shift-selection-cancel" id="cancelShiftSelection">Cancel</button>
                </div>
            </div>
        `;
        
        // Add popup to body
        document.body.insertAdjacentHTML('beforeend', popupHtml);
        
        // Add event listeners
        document.querySelectorAll('.shift-option-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const shiftData = JSON.parse(e.target.dataset.shift);
                this.populateFormWithExtractedData(shiftData);
                this.closeShiftSelectionPopup();
                
                // Update status
                const status = document.getElementById('ocrStatus');
                status.textContent = '✅ Shift info extracted successfully!';
                status.className = 'ocr-status success';
            });
        });
        
        document.getElementById('cancelShiftSelection').addEventListener('click', () => {
            this.closeShiftSelectionPopup();
            
            // Update status
            const status = document.getElementById('ocrStatus');
            status.textContent = '⚠️ Shift selection cancelled';
            status.className = 'ocr-status error';
        });
    }
    
    // Close shift selection popup
    closeShiftSelectionPopup() {
        const popup = document.getElementById('shiftSelectionPopup');
        if (popup) {
            popup.remove();
        }
    }
    
    // Parse Connecteam shift sheet specifically
    parseConnecteamShiftSheet(ocrText) {
        const text = ocrText;
        console.log('Parsing Connecteam shift sheet:', text);
        
        // Find all shifts in the text
        const allShifts = this.extractAllShifts(text);
        
        if (allShifts.length === 0) {
            return null; // No shifts found
        } else if (allShifts.length === 1) {
            // Single shift found
            return {
                shiftData: allShifts[0],
                multipleShifts: null
            };
        } else {
            // Multiple shifts found
            return {
                shiftData: null,
                multipleShifts: allShifts
            };
        }
    }
    
    // Extract all shifts from OCR text
    extractAllShifts(text) {
        const shifts = [];
        
        // Find all shift IDs and their associated data
        const shiftIdPattern = /SHIFT\s*([0-9]{4,5})/gi;
        const shiftMatches = [...text.matchAll(shiftIdPattern)];
        
        for (const shiftMatch of shiftMatches) {
            const shiftId = shiftMatch[1];
            const shiftStart = shiftMatch.index;
            
            // Extract data for this specific shift
            const shiftData = this.extractShiftData(text, shiftId, shiftStart);
            if (shiftData) {
                shifts.push(shiftData);
            }
        }
        
        // If no SHIFT patterns found, try alternative patterns
        if (shifts.length === 0) {
            const altPatterns = [
                /Shift\s*([0-9]{4,5})/gi,
                /([0-9]{4,5})/gi
            ];
            
            for (const pattern of altPatterns) {
                const matches = [...text.matchAll(pattern)];
                for (const match of matches) {
                    const shiftId = match[1];
                    if (!shifts.find(s => s.shiftId === shiftId)) {
                        const shiftData = this.extractShiftData(text, shiftId, match.index);
                        if (shiftData) {
                            shifts.push(shiftData);
                        }
                    }
                }
            }
        }
        
        console.log('Found shifts:', shifts);
        return shifts;
    }
    
    // Extract data for a specific shift
    extractShiftData(text, shiftId, startIndex) {
        // Look for associated times near this shift ID
        const contextStart = Math.max(0, startIndex - 100);
        const contextEnd = Math.min(text.length, startIndex + 200);
        const context = text.substring(contextStart, contextEnd);
        
        const patterns = {
            signOn: [
                /Sign\s*On\s*([0-9]{4})/i,
                /Sign\s*on\s*([0-9]{4})/i,
                /SIGN\s*ON\s*([0-9]{4})/i
            ],
            finish: [
                /Depot\s*Finish\s*([0-9]{4})/i,
                /Depot\s*finish\s*([0-9]{4})/i,
                /DEPOT\s*FINISH\s*([0-9]{4})/i
            ],
            totalHours: [
                /Total\s*Hours\s*([0-9]+(?:\.[0-9]+)?)/i,
                /Total\s*hours\s*([0-9]+(?:\.[0-9]+)?)/i,
                /TOTAL\s*HOURS\s*([0-9]+(?:\.[0-9]+)?)/i
            ]
        };
        
        const extracted = { shiftId };
        
        // Extract Sign On time
        for (const pattern of patterns.signOn) {
            const match = context.match(pattern);
            if (match) {
                const timeStr = match[1];
                if (timeStr.length === 4) {
                    extracted.signOn = `${timeStr.substring(0, 2)}:${timeStr.substring(2)}`;
                } else {
                    extracted.signOn = timeStr;
                }
                break;
            }
        }
        
        // Extract Finish time
        for (const pattern of patterns.finish) {
            const match = context.match(pattern);
            if (match) {
                const timeStr = match[1];
                if (timeStr.length === 4) {
                    extracted.finish = `${timeStr.substring(0, 2)}:${timeStr.substring(2)}`;
                } else {
                    extracted.finish = timeStr;
                }
                break;
            }
        }
        
        // Extract Total Hours
        for (const pattern of patterns.totalHours) {
            const match = context.match(pattern);
            if (match) {
                const hoursStr = match[1];
                if (hoursStr.includes('.')) {
                    const [hours, minutes] = hoursStr.split('.');
                    extracted.totalHours = parseInt(hours);
                    extracted.totalMinutes = Math.round((parseFloat(minutes) * 60) / 100);
                } else {
                    extracted.totalHours = parseInt(hoursStr);
                    extracted.totalMinutes = 0;
                }
                break;
            }
        }
        
        // Only return if we found at least some data
        if (extracted.signOn || extracted.finish || extracted.totalHours !== undefined) {
            return extracted;
        }
        
        return null;
    }
    
    // Parse OCR text to extract shift information
    parseShiftInfo(ocrText) {
        const text = ocrText.toLowerCase();
        
        // Enhanced patterns for better recognition
        const patterns = {
            shiftId: [
                /shift\s*[:\s]*([a-z0-9]+)/i,
                /id\s*[:\s]*([a-z0-9]+)/i,
                /([a-z]\d{3,4})/i,
                /(\d{3,4})/i
            ],
            signOn: [
                /sign\s*on\s*([0-9]{1,2}[:\s]*[0-9]{2})/i,
                /start\s*([0-9]{1,2}[:\s]*[0-9]{2})/i,
                /([0-9]{1,2}[:\s]*[0-9]{2})\s*(?:am|pm)?/i
            ],
            finish: [
                /sign\s*off\s*([0-9]{1,2}[:\s]*[0-9]{2})/i,
                /finish\s*([0-9]{1,2}[:\s]*[0-9]{2})/i,
                /end\s*([0-9]{1,2}[:\s]*[0-9]{2})/i,
                /([0-9]{1,2}[:\s]*[0-9]{2})\s*(?:am|pm)?/i
            ],
            totalHours: [
                /total\s*hours?\s*([0-9]+)\s*(?:hours?|hrs?|h)?/i,
                /([0-9]+)\s*(?:hours?|hrs?|h)/i,
                /([0-9]+)\s*(?:hours?|hrs?|h)?\s*([0-9]+)\s*(?:minutes?|mins?|m)?/i
            ]
        };
        
        const extracted = {};
        
        // Extract Shift ID
        for (const pattern of patterns.shiftId) {
            const match = text.match(pattern);
            if (match) {
                extracted.shiftId = match[1] || match[2];
                break;
            }
        }
        
        // Extract Sign On time
        for (const pattern of patterns.signOn) {
            const match = text.match(pattern);
            if (match) {
                let time = match[1];
                if (match[2]) time += ':' + match[2];
                else time += ':00';
                extracted.signOn = time;
                break;
            }
        }
        
        // Extract Finish time
        for (const pattern of patterns.finish) {
            const match = text.match(pattern);
            if (match) {
                let time = match[1];
                if (match[2]) time += ':' + match[2];
                else time += ':00';
                extracted.finish = time;
                break;
            }
        }
        
        // Extract Total Hours
        for (const pattern of patterns.totalHours) {
            const match = text.match(pattern);
            if (match) {
                if (match[1] && match[2]) {
                    extracted.totalHours = parseInt(match[1]);
                    extracted.totalMinutes = parseInt(match[2]);
                } else if (match[1]) {
                    extracted.totalHours = parseInt(match[1]);
                    extracted.totalMinutes = 0;
                }
                break;
            }
        }
        
        // Return data if we found anything
        return Object.keys(extracted).length > 0 ? extracted : null;
    }
    
    // Populate form with extracted data
    populateFormWithExtractedData(data) {
        const fields = [];
        
        if (data.shiftId) {
            document.getElementById('shiftId').value = data.shiftId;
            fields.push('Shift ID');
        }
        if (data.signOn) {
            document.getElementById('signOnTime').value = data.signOn;
            fields.push('Sign On');
        }
        if (data.finish) {
            document.getElementById('finishTime').value = data.finish;
            fields.push('Finish');
        }
        if (data.totalHours !== undefined) {
            document.getElementById('totalHoursHours').value = data.totalHours || 0;
            document.getElementById('totalHoursMinutes').value = data.totalMinutes || 0;
            fields.push('Total Hours');
        }
        
        // Show which fields were populated
        if (fields.length > 0) {
            const status = document.getElementById('ocrStatus');
            status.textContent = `📋 Auto-filled: ${fields.join(', ')}`;
            status.className = 'ocr-status success';
        }
    }
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
        
        // Create base shift data
        let baseFormData;
        
        if (isDayOff) {
            baseFormData = {
                week: this.currentWeek,
                isDayOff: true,
                shiftId: 'DAY OFF',
                signOn: '00:00',
                finish: '00:00',
                totalHours: { hours: 0, minutes: 0 }
            };
        } else {
            const hours = parseInt(document.getElementById('totalHoursHours').value);
            const minutes = parseInt(document.getElementById('totalHoursMinutes').value);
            
            baseFormData = {
                week: this.currentWeek,
                isDayOff: false,
                shiftId: document.getElementById('shiftId').value,
                signOn: document.getElementById('signOnTime').value,
                finish: document.getElementById('finishTime').value,
                totalHours: { hours, minutes }
            };
        }
        
        try {
            // Collect all days to save (primary + copy days)
            const allDaysToSave = [selectedDay, ...copyDays];
            
            for (const day of allDaysToSave) {
                console.log('Processing day:', day);
                
                // Check if shift already exists on this day
                const existingShifts = await this.getShiftsForDay(this.currentWeek, day);
                const existingShift = existingShifts[0]; // Get first (and should be only) shift
                
                const dayFormData = { ...baseFormData, day };
                
                if (existingShift) {
                    // Update existing shift
                    console.log('Updating existing shift on day:', day);
                    await this.updateShift(existingShift.id, dayFormData);
                } else {
                    // Add new shift
                    console.log('Adding new shift on day:', day);
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
