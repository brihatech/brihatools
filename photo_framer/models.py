"""Data plane models - Configuration dataclasses for photo framing."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal


@dataclass
class FrameConfig:
    """Configuration for the photo framing process.
    
    This dataclass holds all configurable parameters, making it easy
    to serialize/deserialize for GUI or API usage later.
    """
    frame_path: Path
    input_dir: Path
    output_dir: Path
    margin_percent: float = 5.0  # Margin as % of frame size
    portrait_scale: float = 0.7  # Scale factor for portrait images
    landscape_scale: float = 0.9  # Scale factor for landscape images
    quality: int = 95  # Output quality for JPEG (1-100)
    output_format: str = "png"  # Output format: png, jpg
    
    def __post_init__(self):
        """Convert string paths to Path objects if needed."""
        if isinstance(self.frame_path, str):
            self.frame_path = Path(self.frame_path)
        if isinstance(self.input_dir, str):
            self.input_dir = Path(self.input_dir)
        if isinstance(self.output_dir, str):
            self.output_dir = Path(self.output_dir)
    
    def validate(self) -> list[str]:
        """Validate configuration and return list of errors."""
        errors = []
        
        if not self.frame_path.exists():
            errors.append(f"Frame file not found: {self.frame_path}")
        
        if not self.input_dir.exists():
            errors.append(f"Input directory not found: {self.input_dir}")
        
        if not 0 <= self.margin_percent <= 50:
            errors.append(f"Margin percent must be between 0 and 50, got: {self.margin_percent}")
        
        if not 0 < self.portrait_scale <= 1:
            errors.append(f"Portrait scale must be between 0 and 1, got: {self.portrait_scale}")
        
        if not 0 < self.landscape_scale <= 1:
            errors.append(f"Landscape scale must be between 0 and 1, got: {self.landscape_scale}")
        
        if not 1 <= self.quality <= 100:
            errors.append(f"Quality must be between 1 and 100, got: {self.quality}")
        
        if self.output_format.lower() not in ("png", "jpg", "jpeg"):
            errors.append(f"Output format must be png or jpg, got: {self.output_format}")
        
        return errors


@dataclass
class ImageMetadata:
    """Metadata about an image being processed."""
    path: Path
    orientation: Literal["portrait", "landscape", "square"]
    original_size: tuple[int, int]  # (width, height)
    
    @property
    def width(self) -> int:
        return self.original_size[0]
    
    @property
    def height(self) -> int:
        return self.original_size[1]


@dataclass
class ProcessingResult:
    """Result of processing a single image."""
    input_path: Path
    output_path: Path | None
    success: bool
    message: str
    metadata: ImageMetadata | None = None
