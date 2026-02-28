// PWA Icon Generator for MyShift App
// This script creates all required PWA icons with "MS" text on blue background

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Icon sizes required for PWA
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Colors
const backgroundColor = '#4a90d9';
const textColor = '#ffffff';

function createIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Draw blue background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, size, size);
    
    // Add rounded corners effect (simple version)
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = 'black';
    roundRect(ctx, 0, 0, size, size, size * 0.15);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw "MS" text
    ctx.fillStyle = textColor;
    ctx.font = `bold ${size * 0.4}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Add text shadow for better readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = size * 0.05;
    ctx.shadowOffsetX = size * 0.02;
    ctx.shadowOffsetY = size * 0.02;
    
    ctx.fillText('MS', size / 2, size / 2);
    
    return canvas.toBuffer('image/png');
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// Create all icons
async function generateIcons() {
    const iconsDir = path.join(__dirname, 'icons');
    
    // Ensure icons directory exists
    if (!fs.existsSync(iconsDir)) {
        fs.mkdirSync(iconsDir);
    }
    
    console.log('Generating PWA icons for MyShift app...');
    
    for (const size of iconSizes) {
        const iconBuffer = createIcon(size);
        const filename = `icon-${size}x${size}.png`;
        const filepath = path.join(iconsDir, filename);
        
        fs.writeFileSync(filepath, iconBuffer);
        console.log(`✅ Created ${filename}`);
    }
    
    console.log('\n🎉 All PWA icons generated successfully!');
    console.log('📱 The app is now ready for PWA installation on Android devices.');
}

// Run the generator
generateIcons().catch(console.error);
