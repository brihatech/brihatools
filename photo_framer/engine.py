"""Core engine for photo framer tool."""

import logging
from pathlib import Path
from PIL import Image, ImageOps
from .models import FrameConfig, ProcessingResult, ImageMetadata
from typing import Tuple

logger = logging.getLogger(__name__)

class PhotoFramerEngine:
    """Core image processing engine."""
    
    def __init__(self, config: FrameConfig):
        self.config = config
        self._validate_config()
        self._frame_image = None
        
    def _validate_config(self):
        """Ensure config is valid before starting."""
        errors = self.config.validate()
        if errors:
            raise ValueError(f"Invalid configuration: {', '.join(errors)}")

    @property
    def frame_image(self) -> Image.Image:
        """Lazy load and cache the frame image."""
        if self._frame_image is None:
            try:
                self._frame_image = Image.open(self.config.frame_path).convert("RGBA")
            except Exception as e:
                raise RuntimeError(f"Failed to load frame image: {e}")
        return self._frame_image

    def process_directory(self) -> list[ProcessingResult]:
        """Process all images in the input directory."""
        results = []
        
        # Create output directory if it doesn't exist
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
        
        # List common image extensions
        extensions = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff'}
        
        files = [
            f for f in self.config.input_dir.iterdir() 
            if f.is_file() and f.suffix.lower() in extensions
        ]
        
        logger.info(f"Found {len(files)} images in {self.config.input_dir}")
        
        for file_path in files:
            result = self.process_image(file_path)
            results.append(result)
            
        return results

    def process_image(self, input_path: Path) -> ProcessingResult:
        """Process a single image onto the frame."""
        try:
            # Open and rotate image based on EXIF
            with Image.open(input_path) as img:
                img = ImageOps.exif_transpose(img)
                img = img.convert("RGBA")
                
                original_size = img.size
                orientation = self._detect_orientation(img)
                
                metadata = ImageMetadata(
                    path=input_path,
                    orientation=orientation,
                    original_size=original_size
                )
                
                # Calculate target size and position
                target_size = self._calculate_target_size(img.size, orientation)
                
                # Resize image (using LANCZOS for quality)
                resized_img = img.resize(target_size, Image.Resampling.LANCZOS)
                
                # Create composition
                # Start with a copy of the frame
                final_image = self.frame_image.copy()
                
                # Calculate centering position
                frame_w, frame_h = final_image.size
                img_w, img_h = resized_img.size
                
                x = (frame_w - img_w) // 2
                y = (frame_h - img_h) // 2
                
                # Paste resized image onto frame
                # specific logic: Frame is 'background' but usually frames are overlays? 
                # Request says: "using the frame as a background". 
                # If frame is background, we paste the image ON TOP.
                # But wait, usually frames go AROUND. 
                # Re-reading request: "using the frame as a background".
                # "place the images uniformly in the frame using the frame as a background"
                # This implies the provided 'frame.png' is the canvas, and we put the photo ON IT.
                # If 'frame.png' has a transparent hole, we might want to put photo BEHIND.
                # But request says "using the frame as a BACKGROUND".
                # I will assume we paste Image ON TOP of Frame.
                # However, if the user provided frame has a transparent center, maybe they want it behind?
                # Let's stick to "Place image ON Frame" for now unless I see transparency analysis implying otherwise.
                # Actually, standard "branding" often has a footer/header. So we paste image, then maybe frame on top? 
                # "using the frame as a background" -> Frame is bottom layer. Image is top layer.
                # But if the frame has text, the image might cover it?
                # Usually: Background (Color/Texture) -> Image -> Overlay (Logos/Text).
                # Provided input is just "frame".
                # If I paste image on top of "frame", I might cover the branding.
                # Let's fallback to: 
                # 1. Create a canvas of Frame Size.
                # 2. Draw Frame.
                # 3. Draw Image centered (scaled).
                # This matches "frame as background".
                # BUT, if the frame image supplied has the logos, then pasting the photo on top might hide them.
                # Let's inspect the frame.png later or assume the code logic:
                # If I paste Image on Frame, I overwrite Frame content in that center rect.
                
                # Let's assume the user wants the image centered.
                final_image.paste(resized_img, (x, y), resized_img)
                
                # Save result
                output_filename = input_path.stem + f"_framed.{self.config.output_format}"
                output_path = self.config.output_dir / output_filename
                
                if self.config.output_format.lower() in ('jpg', 'jpeg'):
                    final_image = final_image.convert("RGB")
                    final_image.save(output_path, quality=self.config.quality)
                else:
                    final_image.save(output_path)
                
                return ProcessingResult(
                    input_path=input_path,
                    output_path=output_path,
                    success=True,
                    message="Success",
                    metadata=metadata
                )

        except Exception as e:
            logger.error(f"Error processing {input_path}: {e}")
            return ProcessingResult(
                input_path=input_path,
                output_path=None,
                success=False,
                message=str(e)
            )

    def _detect_orientation(self, img: Image.Image) -> str:
        """Detect if image is portrait, landscape, or square."""
        w, h = img.size
        # Add some tolerance for square (e.g., 1%)
        if abs(w - h) / max(w, h) < 0.01:
            return "square"
        return "portrait" if h > w else "landscape"

    def _calculate_target_size(self, original_size: Tuple[int, int], orientation: str) -> Tuple[int, int]:
        """Calculate target dimensions based on config scales."""
        params_w, params_h = original_size
        frame_w, frame_h = self.frame_image.size
        
        # Determine scale factor specific to orientation
        if orientation == "portrait":
            scale_factor = self.config.portrait_scale
            # Scale relative to frame height for portrait? 
            # Usually we want to fit within a box.
            # Let's define the bounding box for the image.
            # If portrait_scale is 0.7, let's say we want the image to be 70% of frame area/height?
            # Let's constrain both width and height to be within (scale * frame_dim).
            
            # Use separate logic? 
            # If I use one scale factor for "portrait", does it mean max_height = 0.7 * frame_height?
            
            target_h = frame_h * scale_factor
            # Calculate width to preserve aspect ratio
            aspect_ratio = params_w / params_h
            target_w = target_h * aspect_ratio
            
            # Check if this width exceeds frame width (unlikely for portrait but possible)
            if target_w > frame_w * scale_factor: # logic: verify?
                 # If width is too big, constrain by width
                 target_w = frame_w * scale_factor
                 target_h = target_w / aspect_ratio
                 
        elif orientation == "landscape":
            scale_factor = self.config.landscape_scale
            # For landscape, constrain by width usually
            target_w = frame_w * scale_factor
            aspect_ratio = params_w / params_h
            target_h = target_w / aspect_ratio
            
             # Check if height exceeds frame height
            if target_h > frame_h * scale_factor:
                target_h = frame_h * scale_factor
                target_w = target_h * aspect_ratio
        
        else: # Square
            # Use the smaller of the two scales or just average?
            # Let's default to landscape scale (often safer) or portrait.
            # Let's use landscape scale for square.
            scale_factor = self.config.landscape_scale
            target_h = frame_h * scale_factor
            target_w = target_h
            # Constrain 
            if target_w > frame_w * scale_factor:
                 target_w = frame_w * scale_factor
                 target_h = target_w

        return int(target_w), int(target_h)
