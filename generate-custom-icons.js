const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Icon sizes required for PWA
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
    try {
        console.log('🎨 Generating PWA icons from custom image...');
        
        // Ensure icons directory exists
        const iconsDir = path.join(__dirname, 'icons');
        if (!fs.existsSync(iconsDir)) {
            fs.mkdirSync(iconsDir, { recursive: true });
        }
        
        // Generate each icon size
        for (const size of iconSizes) {
            console.log(`📐 Generating ${size}x${size} icon...`);
            
            await sharp('image.jpg')
                .resize(size, size, {
                    fit: 'cover',
                    position: 'center'
                })
                .png({
                    quality: 90,
                    compressionLevel: 6
                })
                .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
            
            console.log(`✅ Generated icon-${size}x${size}.png`);
        }
        
        console.log('🎉 All PWA icons generated successfully!');
        console.log('📁 Icons saved in: ./icons/');
        
    } catch (error) {
        console.error('❌ Error generating icons:', error);
        process.exit(1);
    }
}

generateIcons();
