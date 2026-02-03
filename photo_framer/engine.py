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
           
            target_h = frame_h * scale_factor
            # Calculate width to preserve aspect ratio
            aspect_ratio = params_w / params_h
            target_w = target_h * aspect_ratio
            
            if target_w > frame_w * scale_factor:
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
            scale_factor = self.config.landscape_scale
            target_h = frame_h * scale_factor
            target_w = target_h
            # Constrain 
            if target_w > frame_w * scale_factor:
                 target_w = frame_w * scale_factor
                 target_h = target_w

        return int(target_w), int(target_h)
