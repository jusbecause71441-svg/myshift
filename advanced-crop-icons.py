from PIL import Image, ImageOps
import os
import numpy as np

def remove_background(image_path, threshold=240):
    """Remove white/cream background using color threshold"""
    img = Image.open(image_path).convert('RGBA')
    data = np.array(img)
    
    # Create mask for non-white/cream pixels
    # White/cream pixels have high RGB values
    red, green, blue, alpha = data[:,:,0], data[:,:,1], data[:,:,2]
    
    # Create mask where pixels are NOT white/cream
    mask = (red < threshold) | (green < threshold) | (blue < threshold)
    
    # Find bounding box of content
    coords = np.column_stack(np.where(mask))
    if len(coords[0]) > 0:
        y_min, x_min = coords[0].min(axis=0)
        y_max, x_max = coords[0].max(axis=0)
        
        # Crop to content
        cropped = img.crop((x_min, y_min, x_max+1, y_max+1))
        print(f"✅ Auto-cropped from {img.size} to {cropped.size}")
        return cropped
    else:
        print("⚠️  No content found, using original")
        return img

def generate_icons():
    """Generate PWA icons from cropped bus image"""
    try:
        print("🎨 Processing image with advanced background removal...")
        
        # Remove white/cream background
        cropped_img = remove_background('image.jpg', threshold=230)
        
        # Ensure icons directory exists
        icons_dir = 'icons'
        if not os.path.exists(icons_dir):
            os.makedirs(icons_dir)
        
        # Icon sizes required for PWA
        icon_sizes = [72, 96, 128, 144, 152, 192, 384, 512]
        
        # Generate each icon size
        for size in icon_sizes:
            print(f"📐 Generating {size}x{size} icon...")
            
            # Create a new image with the target size
            icon_img = Image.new('RGBA', (size, size), (255, 255, 255, 255))
            
            # Resize cropped image to fill the icon as much as possible
            # Calculate scaling to fill either width or height
            img_width, img_height = cropped_img.size
            scale = max(size / img_width, size / img_height)
            
            new_width = int(img_width * scale)
            new_height = int(img_height * scale)
            
            # Resize with high quality
            resized_img = cropped_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Calculate position to center the image
            x = (size - new_width) // 2
            y = (size - new_height) // 2
            
            # Paste the resized image onto the center
            icon_img.paste(resized_img, (x, y), resized_img)
            
            # Save as PNG
            icon_path = os.path.join(icons_dir, f'icon-{size}x{size}.png')
            icon_img.save(icon_path, 'PNG', optimize=True, quality=95)
            print(f"✅ Generated {icon_path}")
        
        # Generate favicon
        print("📐 Generating favicon...")
        favicon_img = Image.new('RGBA', (32, 32), (255, 255, 255, 255))
        
        scale_favicon = max(32 / img_width, 32 / img_height)
        new_favicon_width = int(img_width * scale_favicon)
        new_favicon_height = int(img_height * scale_favicon)
        
        favicon_resized = cropped_img.resize((new_favicon_width, new_favicon_height), Image.Resampling.LANCZOS)
        
        fx = (32 - new_favicon_width) // 2
        fy = (32 - new_favicon_height) // 2
        favicon_img.paste(favicon_resized, (fx, fy), favicon_resized)
        
        favicon_img.save('favicon.ico', 'PNG', optimize=True, quality=95)
        print("✅ Generated favicon.ico")
        
        print("🎉 All icons generated with maximum bus size!")
        print(f"📁 Icons saved in: {icons_dir}/")
        
    except Exception as error:
        print(f"❌ Error generating icons: {error}")
        exit(1)

if __name__ == "__main__":
    generate_icons()
