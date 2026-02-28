const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Icon sizes required for PWA
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
    try {
        console.log('🎨 Regenerating PWA icons with cover scaling...');
        
        // Ensure icons directory exists
        const iconsDir = path.join(__dirname, 'icons');
        if (!fs.existsSync(iconsDir)) {
            fs.mkdirSync(iconsDir, { recursive: true });
        }
        
        // Generate each icon size with cover scaling
        for (const size of iconSizes) {
            console.log(`📐 Generating ${size}x${size} icon with cover scaling...`);
            
            await sharp('image.jpg')
                .resize(size, size, {
                    fit: 'cover',           // Fill entire icon space
                    position: 'center',       // Center the image
                    background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
                })
                .png({
                    quality: 95,            // Higher quality for better appearance
                    compressionLevel: 4        // Less compression for clarity
                })
                .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
            
            console.log(`✅ Generated icon-${size}x${size}.png (full cover)`);
        }
        
        console.log('🎉 All PWA icons regenerated with full cover scaling!');
        console.log('📁 Icons saved in: ./icons/');
        
    } catch (error) {
        console.error('❌ Error generating icons:', error);
        process.exit(1);
    }
}

generateIcons();
