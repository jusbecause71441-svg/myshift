const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateFavicon() {
    try {
        console.log('🎨 Regenerating favicon with cover scaling...');
        
        // Generate favicon (32x32 for compatibility) with cover scaling
        await sharp('image.jpg')
            .resize(32, 32, {
                fit: 'cover',           // Fill entire icon space
                position: 'center',       // Center the image
                background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
            })
            .png({
                quality: 95,            // Higher quality
                compressionLevel: 4        // Less compression
            })
            .toFile('favicon.ico');
        
        console.log('✅ Generated favicon.ico (full cover)');
        console.log('🎉 Favicon regenerated successfully!');
        
    } catch (error) {
        console.error('❌ Error generating favicon:', error);
        process.exit(1);
    }
}

generateFavicon();
