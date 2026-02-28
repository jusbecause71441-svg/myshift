from PIL import Image, ImageOps
import os

def crop_to_content(image_path):
    """Crop image to remove white/cream background"""
    img = Image.open(image_path)
    
    # Convert to RGBA if not already
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    # Get the bounding box of non-white content
    bbox = img.getbbox()
    
    if bbox:
        # Crop to content
        cropped = img.crop(bbox)
        print(f"✅ Cropped image from {img.size} to {cropped.size}")
        return cropped
    else:
        print("⚠️  No content found, using original image")
        return img

def generate_icons():
    """Generate PWA icons from cropped bus image"""
    try:
        print("🎨 Processing image with Pillow...")
        
        # First crop the image to remove white background
        cropped_img = crop_to_content('image.jpg')
        
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
            
            # Resize cropped image to fit within icon while maintaining aspect ratio
            cropped_resized = cropped_img.copy()
            cropped_resized.thumbnail((size, size), Image.Resampling.LANCZOS)
            
            # Calculate position to center the image
            x = (size - cropped_resized.width) // 2
            y = (size - cropped_resized.height) // 2
            
            # Paste the resized image onto the center
            icon_img.paste(cropped_resized, (x, y), cropped_resized)
            
            # Save as PNG
            icon_path = os.path.join(icons_dir, f'icon-{size}x{size}.png')
            icon_img.save(icon_path, 'PNG', optimize=True)
            print(f"✅ Generated {icon_path}")
        
        # Generate favicon
        print("📐 Generating favicon...")
        favicon_img = Image.new('RGBA', (32, 32), (255, 255, 255, 255))
        favicon_resized = cropped_img.copy()
        favicon_resized.thumbnail((32, 32), Image.Resampling.LANCZOS)
        
        fx = (32 - favicon_resized.width) // 2
        fy = (32 - favicon_resized.height) // 2
        favicon_img.paste(favicon_resized, (fx, fy), favicon_resized)
        
        favicon_img.save('favicon.ico', 'PNG', optimize=True)
        print("✅ Generated favicon.ico")
        
        print("🎉 All icons generated successfully!")
        print(f"📁 Icons saved in: {icons_dir}/")
        
    except Exception as error:
        print(f"❌ Error generating icons: {error}")
        exit(1)

if __name__ == "__main__":
    generate_icons()
