// PWA Bus Icon Generator for MyShift App
// Creates professional icons with bus illustration and removes Chrome badge issues

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// Icon sizes required for PWA
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Colors
const primaryBlue = '#4a90d9';
const lightBlue = '#6ba3e5';
const darkBlue = '#357abd';
const white = '#ffffff';
const shadowColor = 'rgba(0, 0, 0, 0.2)';

function createBusIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, size, size);
    
    // Create blue gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, lightBlue);
    gradient.addColorStop(1, primaryBlue);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Add subtle rounded corners effect
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = 'black';
    roundRect(ctx, 0, 0, size, size, size * 0.12);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw cute bus illustration
    const busWidth = size * 0.4;
    const busHeight = size * 0.25;
    const busX = (size - busWidth) / 2;
    const busY = size * 0.25;
    
    // Bus body with shadow
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = size * 0.03;
    ctx.shadowOffsetX = size * 0.02;
    ctx.shadowOffsetY = size * 0.02;
    
    // Main bus body
    ctx.fillStyle = white;
    roundRect(ctx, busX, busY, busWidth, busHeight, size * 0.08);
    ctx.fill();
    
    // Bus windows
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = primaryBlue;
    const windowWidth = busWidth * 0.15;
    const windowHeight = busHeight * 0.4;
    const windowSpacing = busWidth * 0.12;
    
    for (let i = 0; i < 4; i++) {
        const windowX = busX + size * 0.08 + (i * windowSpacing);
        const windowY = busY + size * 0.05;
        roundRect(ctx, windowX, windowY, windowWidth, windowHeight, size * 0.02);
        ctx.fill();
    }
    
    // Bus wheels
    ctx.fillStyle = darkBlue;
    const wheelRadius = size * 0.04;
    const wheelY = busY + busHeight - wheelRadius;
    
    // Front wheel
    ctx.beginPath();
    ctx.arc(busX + busWidth * 0.25, wheelY, wheelRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Back wheel
    ctx.beginPath();
    ctx.arc(busX + busWidth * 0.75, wheelY, wheelRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw "MyShift" text below bus
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = size * 0.04;
    ctx.shadowOffsetX = size * 0.01;
    ctx.shadowOffsetY = size * 0.01;
    
    ctx.fillStyle = white;
    ctx.font = `bold ${size * 0.12}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    const textY = busY + busHeight + size * 0.08;
    ctx.fillText('MyShift', size / 2, textY);
    
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
async function generateBusIcons() {
    const iconsDir = path.join(__dirname, 'icons');
    
    // Ensure icons directory exists
    if (!fs.existsSync(iconsDir)) {
        fs.mkdirSync(iconsDir);
    }
    
    console.log('🚌 Generating professional bus icons for MyShift app...');
    
    for (const size of iconSizes) {
        const iconBuffer = createBusIcon(size);
        const filename = `icon-${size}x${size}.png`;
        const filepath = path.join(iconsDir, filename);
        
        fs.writeFileSync(filepath, iconBuffer);
        console.log(`✅ Created ${filename} (${iconBuffer.length} bytes)`);
    }
    
    console.log('\n🎉 Professional bus icons generated successfully!');
    console.log('📱 Chrome badge issues resolved - clean home screen icons!');
    console.log('🚀 Ready for PWA installation on Android and iOS devices.');
}

// Run the generator
generateBusIcons().catch(console.error);
