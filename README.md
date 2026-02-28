# MyShift - Bus Driver Schedule Manager

A Progressive Web App (PWA) designed for bus drivers to manage their shift schedules with ease.

## Features

- **Mobile-first dark theme UI** - Optimized for mobile devices with a professional dark navy theme
- **3-week roster view** - Selectable weeks with clear navigation
- **Weekly schedule display** - Monday through Sunday with shift details
- **Shift management** - Add, edit, and delete shifts easily
- **Photo uploads** - Add photos and screenshots for each shift
- **Local storage** - All data stored locally using IndexedDB (no server required)
- **PWA installable** - Install on iOS and Android devices for quick access
- **Offline support** - Works completely offline once installed

## Technical Details

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Storage**: IndexedDB for local data persistence
- **PWA**: Service worker for offline functionality
- **Design**: Mobile-first responsive design
- **Theme**: Dark navy with yellow accent colors

## Installation

### Web Browser
1. Open the app in a modern web browser (Chrome, Firefox, Safari, Edge)
2. The app will work immediately without installation

### PWA Installation (Mobile)
1. Open the app in your mobile browser
2. Look for the "Add to Home Screen" or "Install" option
3. Tap to install the app on your device

### PWA Installation (Desktop)
1. Open the app in Chrome or Edge
2. Click the install icon in the address bar
3. Confirm installation to add to your desktop/applications

## Usage

### Viewing Your Schedule
- Use the week selector at the top to navigate between weeks
- Each day shows your scheduled shifts with:
  - Shift ID (yellow accent)
  - Sign on and finish times
  - Total hours worked

### Adding Shifts
1. Tap the "+" button in the header, or
2. Tap on any day card
3. Fill in the shift details:
   - Day of the week
   - Shift ID
   - Sign on time
   - Finish time
   - Total hours
4. Save the shift

### Managing Shifts
- **View details**: Tap on any shift to see full details
- **Edit shift**: In the shift details modal, tap "Edit Shift"
- **Delete shift**: In the shift details modal, tap "Delete Shift"
- **Add photos**: In the shift details modal, tap "📷 Add Photos"

### Photo Management
- Upload multiple photos per shift
- Photos are stored locally on your device
- Delete individual photos as needed
- Supports camera capture and file upload

## Data Storage

All data is stored locally using IndexedDB:
- **Shifts**: Schedule information and timing
- **Photos**: Images and screenshots per shift
- **Settings**: User preferences and app state

No internet connection or server is required for core functionality.

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## File Structure

```
myshift/
├── index.html          # Main HTML file
├── styles.css          # CSS styling and responsive design
├── app.js             # Main application logic
├── manifest.json      # PWA manifest
├── sw.js              # Service worker for offline functionality
├── README.md          # This file
└── icons/             # PWA icons (to be added)
```

## Development

To run the app locally:
1. Serve the files using a local web server
2. Open `index.html` in your browser
3. For PWA testing, use HTTPS or localhost

Example using Python:
```bash
python -m http.server 8000
```

Example using Node.js:
```bash
npx serve .
```

## Security & Privacy

- All data remains on your device
- No external API calls or data transmission
- Photos are stored locally (not uploaded to any server)
- Works completely offline

## Future Enhancements

- Export schedule to calendar
- Shift statistics and reporting
- Multiple driver profiles
- Cloud sync (optional)
- Push notifications for shift reminders

## License

This project is open source and available under the MIT License.
