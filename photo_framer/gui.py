"""Desktop GUI application for Photo Framer using CustomTkinter."""

import customtkinter as ctk
from tkinter import filedialog, messagebox
from pathlib import Path
from PIL import Image
import logging
import threading
from typing import Optional

from .models import FrameConfig
from .gui_service import ImageScanner, PreviewGenerator, DirectoryScanResult, process_batch_async

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set appearance mode and color theme
ctk.set_appearance_mode("light")
ctk.set_default_color_theme("blue")


class PhotoFramerGUI:
    """Main GUI application for Photo Framer."""
    
    def __init__(self):
        self.window = ctk.CTk()
        self.window.title("Photo Framer")
        
        # Set proper base size before layout
        self.window.geometry("1280x820")
        self.window.minsize(1100, 700)
        
        # Application state
        self.frame_path: Optional[Path] = None
        self.input_dir: Optional[Path] = None
        # Default output relative to CWD, resolved to absolute path
        self.output_dir: Optional[Path] = Path("output-framed").resolve()
        self.scan_result: Optional[DirectoryScanResult] = None
        self.preview_generator: Optional[PreviewGenerator] = None
        self.current_preview_image: Optional[Image.Image] = None
        self._preview_job = None  # For debouncing
        
        # Default parameters
        self.portrait_scale = ctk.DoubleVar(value=0.7)
        self.landscape_scale = ctk.DoubleVar(value=0.9)
        self.output_format = ctk.StringVar(value="png")
        
        # Build UI
        self._create_ui()
        
        # Bind parameter changes to preview update (minimal debounce for responsiveness)
        self.portrait_scale.trace_add("write", self._on_parameter_change)
        self.landscape_scale.trace_add("write", self._on_parameter_change)
        self.output_format.trace_add("write", self._on_parameter_change)
        
        # Maximize after layout is done
        self.window.after(100, lambda: self.window.state("zoomed"))
    
    def _create_ui(self):
        """Build the user interface with compact tool panel layout."""
        # Configure main grid: narrow left controls, wide preview
        self.window.grid_columnconfigure(0, weight=1, minsize=320)  # Left - compact controls
        self.window.grid_columnconfigure(1, weight=3, minsize=700)  # Right - large preview
        self.window.grid_rowconfigure(0, weight=1)
        
        # ===== LEFT PANEL - Compact Control Rail =====
        left_panel = ctk.CTkFrame(self.window, fg_color="gray95", corner_radius=0)
        left_panel.grid(row=0, column=0, sticky="nsew")
        left_panel.grid_columnconfigure(0, weight=1)
        
        # Regular frame (no scroll) with proper padding
        controls_frame = ctk.CTkFrame(left_panel, fg_color="transparent")
        controls_frame.grid(row=0, column=0, sticky="nsew", padx=20, pady=20)
        controls_frame.grid_columnconfigure(0, weight=1)
        
        row = 0
        
        # Title (single large font)
        title = ctk.CTkLabel(
            controls_frame,
            text="Photo Framer",
            font=ctk.CTkFont(size=22, weight="bold")
        )
        title.grid(row=row, column=0, pady=(0, 20), sticky="w")
        row += 1
        
        # === FILES SECTION ===
        # Frame Image
        frame_label = ctk.CTkLabel(
            controls_frame,
            text="Frame Image",
            font=ctk.CTkFont(size=14, weight="bold")
        )
        frame_label.grid(row=row, column=0, pady=(0, 6), sticky="w")
        row += 1
        
        frame_btn = ctk.CTkButton(
            controls_frame,
            text="Choose Frame",
            command=self._select_frame,
            height=36,
            font=ctk.CTkFont(size=14)
        )
        frame_btn.grid(row=row, column=0, pady=(0, 4), sticky="ew")
        row += 1
        
        self.frame_path_display = ctk.CTkLabel(
            controls_frame,
            text="No file selected",
            text_color="gray50",
            font=ctk.CTkFont(size=12),
            anchor="w"
        )
        self.frame_path_display.grid(row=row, column=0, pady=(0, 16), sticky="ew")
        row += 1
        
        # Photos Folder
        folder_label = ctk.CTkLabel(
            controls_frame,
            text="Photos Folder",
            font=ctk.CTkFont(size=14, weight="bold")
        )
        folder_label.grid(row=row, column=0, pady=(0, 6), sticky="w")
        row += 1
        
        folder_btn = ctk.CTkButton(
            controls_frame,
            text="Choose Folder",
            command=self._select_input_dir,
            height=36,
            font=ctk.CTkFont(size=14)
        )
        folder_btn.grid(row=row, column=0, pady=(0, 4), sticky="ew")
        row += 1
        
        self.input_dir_display = ctk.CTkLabel(
            controls_frame,
            text="No folder selected",
            text_color="gray50",
            font=ctk.CTkFont(size=12),
            anchor="w"
        )
        self.input_dir_display.grid(row=row, column=0, pady=(0, 4), sticky="ew")
        row += 1
        
        # Status
        self.scan_status = ctk.CTkLabel(
            controls_frame,
            text="",
            text_color="green",
            font=ctk.CTkFont(size=12),
            anchor="w"
        )
        self.scan_status.grid(row=row, column=0, pady=(0, 20), sticky="ew")
        row += 1
        
        # Separator
        sep1 = ctk.CTkFrame(controls_frame, height=1, fg_color="gray80")
        sep1.grid(row=row, column=0, pady=(0, 16), sticky="ew")
        row += 1
        
        # === ORIENTATION CONTROLS ===
        # Portrait
        portrait_label = ctk.CTkLabel(
            controls_frame,
            text="Portrait Size",
            font=ctk.CTkFont(size=14)
        )
        portrait_label.grid(row=row, column=0, pady=(0, 6), sticky="w")
        row += 1
        
        portrait_frame = ctk.CTkFrame(controls_frame, fg_color="transparent")
        portrait_frame.grid(row=row, column=0, pady=(0, 12), sticky="ew")
        portrait_frame.grid_columnconfigure(0, weight=1)
        
        self.portrait_slider = ctk.CTkSlider(
            portrait_frame,
            from_=0.3,
            to=1.0,
            variable=self.portrait_scale,
            number_of_steps=70
        )
        self.portrait_slider.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        
        self.portrait_value_label = ctk.CTkLabel(
            portrait_frame,
            text=f"{int(self.portrait_scale.get() * 100)}%",
            width=45,
            font=ctk.CTkFont(size=14)
        )
        self.portrait_value_label.grid(row=0, column=1)
        row += 1
        
        # Landscape
        landscape_label = ctk.CTkLabel(
            controls_frame,
            text="Landscape Size",
            font=ctk.CTkFont(size=14)
        )
        landscape_label.grid(row=row, column=0, pady=(0, 6), sticky="w")
        row += 1
        
        landscape_frame = ctk.CTkFrame(controls_frame, fg_color="transparent")
        landscape_frame.grid(row=row, column=0, pady=(0, 20), sticky="ew")
        landscape_frame.grid_columnconfigure(0, weight=1)
        
        self.landscape_slider = ctk.CTkSlider(
            landscape_frame,
            from_=0.3,
            to=1.0,
            variable=self.landscape_scale,
            number_of_steps=70
        )
        self.landscape_slider.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        
        self.landscape_value_label = ctk.CTkLabel(
            landscape_frame,
            text=f"{int(self.landscape_scale.get() * 100)}%",
            width=45,
            font=ctk.CTkFont(size=14)
        )
        self.landscape_value_label.grid(row=0, column=1)
        row += 1
        
        # Separator
        sep2 = ctk.CTkFrame(controls_frame, height=1, fg_color="gray80")
        sep2.grid(row=row, column=0, pady=(0, 16), sticky="ew")
        row += 1
        
        # === OUTPUT ===
        
        # Output Folder
        output_label = ctk.CTkLabel(
            controls_frame,
            text="Output Folder",
            font=ctk.CTkFont(size=14, weight="bold")
        )
        output_label.grid(row=row, column=0, pady=(0, 6), sticky="w")
        row += 1
        
        output_btn = ctk.CTkButton(
            controls_frame,
            text="Choose Output Folder",
            command=self._select_output_dir,
            height=36,
            font=ctk.CTkFont(size=14)
        )
        output_btn.grid(row=row, column=0, pady=(0, 4), sticky="ew")
        row += 1
        
        # Display current output dir (truncated if long)
        out_text = self.output_dir.name if self.output_dir else "Not selected"
        self.output_dir_display = ctk.CTkLabel(
            controls_frame,
            text=f"./{out_text}",
            text_color="gray50",
            font=ctk.CTkFont(size=12),
            anchor="w"
        )
        self.output_dir_display.grid(row=row, column=0, pady=(0, 16), sticky="ew")
        row += 1
        
        # Format
        format_label = ctk.CTkLabel(
            controls_frame,
            text="Format",
            font=ctk.CTkFont(size=14)
        )
        format_label.grid(row=row, column=0, pady=(0, 6), sticky="w")
        row += 1
        
        format_frame = ctk.CTkFrame(controls_frame, fg_color="transparent")
        format_frame.grid(row=row, column=0, pady=(0, 24), sticky="w")
        
        png_radio = ctk.CTkRadioButton(
            format_frame,
            text="PNG",
            variable=self.output_format,
            value="png",
            font=ctk.CTkFont(size=14)
        )
        png_radio.grid(row=0, column=0, padx=(0, 16))
        
        jpg_radio = ctk.CTkRadioButton(
            format_frame,
            text="JPG",
            variable=self.output_format,
            value="jpg",
            font=ctk.CTkFont(size=14)
        )
        jpg_radio.grid(row=0, column=1)
        row += 1
        
        # Process button (primary action)
        self.process_btn = ctk.CTkButton(
            controls_frame,
            text="PROCESS PHOTOS",
            font=ctk.CTkFont(size=14, weight="bold"),
            height=48,
            command=self._process_all
        )
        self.process_btn.grid(row=row, column=0, pady=(0, 0), sticky="ew")
        row += 1
        
        # Progress (initially hidden)
        self.progress_bar = ctk.CTkProgressBar(controls_frame)
        self.progress_bar.set(0)
        
        self.progress_label = ctk.CTkLabel(
            controls_frame,
            text="",
            font=ctk.CTkFont(size=12)
        )
        
        # ===== RIGHT PANEL - Dual Preview (Portrait & Landscape) =====
        right_panel = ctk.CTkFrame(self.window, fg_color="gray90", corner_radius=0)
        right_panel.grid(row=0, column=1, sticky="nsew")
        right_panel.grid_columnconfigure(0, weight=1)
        right_panel.grid_columnconfigure(1, weight=1)
        right_panel.grid_rowconfigure(1, weight=1)
        
        # Preview header
        preview_header = ctk.CTkFrame(right_panel, fg_color="transparent")
        preview_header.grid(row=0, column=0, columnspan=2, sticky="ew", padx=30, pady=(30, 10))
        
        preview_title = ctk.CTkLabel(
            preview_header,
            text="Live Preview",
            font=ctk.CTkFont(size=22, weight="bold"),
            anchor="w"
        )
        preview_title.grid(row=0, column=0, sticky="w")
        
        # Portrait preview container
        portrait_section = ctk.CTkFrame(right_panel, fg_color="transparent")
        portrait_section.grid(row=1, column=0, sticky="nsew", padx=(30, 10), pady=(10, 30))
        portrait_section.grid_columnconfigure(0, weight=1)
        portrait_section.grid_rowconfigure(1, weight=1)
        
        portrait_header = ctk.CTkLabel(
            portrait_section,
            text="Portrait",
            font=ctk.CTkFont(size=14, weight="bold"),
            anchor="w"
        )
        portrait_header.grid(row=0, column=0, sticky="w", pady=(0, 8))
        
        self.portrait_preview_container = ctk.CTkFrame(portrait_section, corner_radius=12, fg_color="white")
        self.portrait_preview_container.grid(row=1, column=0, sticky="nsew")
        self.portrait_preview_container.grid_columnconfigure(0, weight=1)
        self.portrait_preview_container.grid_rowconfigure(0, weight=1)
        
        self.portrait_preview_label = ctk.CTkLabel(
            self.portrait_preview_container,
            text="No portrait\nimages found",
            fg_color="transparent",
            text_color="gray50",
            font=ctk.CTkFont(size=12)
        )
        self.portrait_preview_label.grid(row=0, column=0, sticky="nsew", padx=15, pady=15)
        
        # Landscape preview container
        landscape_section = ctk.CTkFrame(right_panel, fg_color="transparent")
        landscape_section.grid(row=1, column=1, sticky="nsew", padx=(10, 30), pady=(10, 30))
        landscape_section.grid_columnconfigure(0, weight=1)
        landscape_section.grid_rowconfigure(1, weight=1)
        
        landscape_header = ctk.CTkLabel(
            landscape_section,
            text="Landscape",
            font=ctk.CTkFont(size=14, weight="bold"),
            anchor="w"
        )
        landscape_header.grid(row=0, column=0, sticky="w", pady=(0, 8))
        
        self.landscape_preview_container = ctk.CTkFrame(landscape_section, corner_radius=12, fg_color="white")
        self.landscape_preview_container.grid(row=1, column=0, sticky="nsew")
        self.landscape_preview_container.grid_columnconfigure(0, weight=1)
        self.landscape_preview_container.grid_rowconfigure(0, weight=1)
        
        self.landscape_preview_label = ctk.CTkLabel(
            self.landscape_preview_container,
            text="No landscape\nimages found",
            fg_color="transparent",
            text_color="gray50",
            font=ctk.CTkFont(size=12)
        )
        self.landscape_preview_label.grid(row=0, column=0, sticky="nsew", padx=15, pady=15)
        
        # Bind resize events for proper preview scaling
        self.portrait_preview_container.bind("<Configure>", lambda e: self._schedule_preview_update())
        self.landscape_preview_container.bind("<Configure>", lambda e: self._schedule_preview_update())
    
    # Event handlers
    
    def _select_frame(self):
        """Handle frame image selection."""
        filename = filedialog.askopenfilename(
            title="Select Background Frame",
            filetypes=[
                ("Image files", "*.png *.jpg *.jpeg"),
                ("All files", "*.*")
            ]
        )
        
        if filename:
            self.frame_path = Path(filename)
            self.frame_path_display.configure(
                text=self.frame_path.name,
                text_color="black"
            )
            self._schedule_preview_update()
    
    def _select_input_dir(self):
        """Handle input directory selection."""
        dirname = filedialog.askdirectory(title="Select Photos Folder")
        
        if dirname:
            self.input_dir = Path(dirname)
            self.input_dir_display.configure(
                text=self.input_dir.name,
                text_color="black"
            )
            
            # Default output to sibling directory
            self.output_dir = self.input_dir.parent / "output-framed"
            self.output_dir_display.configure(
                text=self.output_dir.name,
                text_color="gray50"
            )
            
            # Show scanning status
            self.scan_status.configure(text="Scanning...", text_color="blue")
            
            # Scan in background to avoid freezing UI
            def scan_task():
                scanner = ImageScanner()
                result = scanner.scan_directory(self.input_dir)
                # Update UI on main thread
                self.window.after(0, lambda: self._on_scan_complete(result))
            
            
            threading.Thread(target=scan_task, daemon=True).start()

    def _select_output_dir(self):
        """Handle output directory selection."""
        # Try to start at parent of input dir to be helpful, or CWD
        try:
            initial = self.input_dir.parent if (self.input_dir and self.input_dir.exists()) else Path.cwd()
        except:
            initial = Path.cwd()
            
        dirname = filedialog.askdirectory(
            title="Select Output Folder",
            initialdir=str(initial)
        )
        
        if dirname:
            path = Path(dirname)
            
            # Prevent using input dir as output dir
            if self.input_dir and path.resolve() == self.input_dir.resolve():
                messagebox.showwarning(
                    "Invalid Selection",
                    "Output folder cannot be the same as input folder.\n"
                    "Please select a different folder to prevent mixing original photos with framed ones."
                )
                return

            self.output_dir = path
            self.output_dir_display.configure(
                text=self.output_dir.name,
                text_color="black"
            )

    def _on_scan_complete(self, result: DirectoryScanResult):
        """Handle scan completion on main thread."""
        self.scan_result = result
        
        # Update status with automatic orientation detection
        if self.scan_result.total_images > 0:
            parts = []
            if self.scan_result.portrait_count > 0:
                parts.append(f"{self.scan_result.portrait_count} portrait")
            if self.scan_result.landscape_count > 0:
                parts.append(f"{self.scan_result.landscape_count} landscape")
            if self.scan_result.square_count > 0:
                parts.append(f"{self.scan_result.square_count} square")
            
            status_text = f"Found: {', '.join(parts)}"
            self.scan_status.configure(text=status_text, text_color="green")
        else:
            self.scan_status.configure(
                text="No images found",
                text_color="orange"
            )
        
        self._schedule_preview_update()
    
    def _on_parameter_change(self, *args):
        """Handle parameter changes with debouncing."""
        # Update value labels immediately
        self.portrait_value_label.configure(
            text=f"{int(self.portrait_scale.get() * 100)}%"
        )
        self.landscape_value_label.configure(
            text=f"{int(self.landscape_scale.get() * 100)}%"
        )
        
        # Debounce preview update
        self._schedule_preview_update()
    
    def _schedule_preview_update(self):
        """Minimal debounce for responsive real-time preview."""
        if self._preview_job is not None:
            self.window.after_cancel(self._preview_job)
        self._preview_job = self.window.after(50, self._update_preview)
    
    def _update_preview(self):
        """Update both portrait and landscape previews simultaneously."""
        # Require at least a frame to show anything
        if not self.frame_path:
            return
        
        # Load the raw frame image for fallback
        raw_frame_img = None
        try:
            raw_frame_img = Image.open(self.frame_path)
        except Exception as e:
            logger.error(f"Failed to load frame image: {e}")
            return

        # Prepare generator if we have inputs
        if self.input_dir and self.scan_result and self.scan_result.total_images > 0:
            try:
                config = self._create_config()
                if not self.preview_generator or self.preview_generator.config.frame_path != config.frame_path:
                    self.preview_generator = PreviewGenerator(config)
                else:
                    self.preview_generator.update_config(config)
            except Exception as e:
                logger.error(f"Failed to init preview generator: {e}")
                self.preview_generator = None

        # --- Helper to render preview ---
        def update_single_preview(sample_path, container, label, default_text):
            final_img = None
            
            # Try to generate composite using sample
            if sample_path and self.preview_generator:
                final_img = self.preview_generator.generate_preview(sample_path)
            
            # Fallback to raw frame
            if final_img is None:
                final_img = raw_frame_img
            
            if final_img:
                self._display_image_in_container(final_img, container, label)
            else:
                label.configure(text=default_text, image=None)

        # Update Portrait
        sample_p = self.scan_result.sample_portrait if (self.scan_result) else None
        update_single_preview(
            sample_p, 
            self.portrait_preview_container, 
            self.portrait_preview_label, 
            "No portrait\nimages found"
        )
        
        # Update Landscape
        sample_l = self.scan_result.sample_landscape if (self.scan_result) else None
        update_single_preview(
            sample_l, 
            self.landscape_preview_container, 
            self.landscape_preview_label, 
            "No landscape\nimages found"
        )

    def _display_image_in_container(self, img: Image.Image, container: ctk.CTkFrame, label: ctk.CTkLabel):
        """Render an image into a container handling HiDPI scaling."""
        container.update_idletasks()
        container_width = container.winfo_width()
        container_height = container.winfo_height()
        
        if container_width < 10 or container_height < 10:
            return

        # Prevent container from expanding
        container.grid_propagate(False)
        
        # Get Monitor Scaling Factor
        try:
            scaling = container._get_widget_scaling()
        except AttributeError:
            scaling = 1.0
        
        # Padding (logical -> physical)
        pad_phys = 40 * scaling
        max_w_phys = max(1, container_width - pad_phys)
        max_h_phys = max(1, container_height - pad_phys)
        
        # Resize (Physical)
        display_img = self._resize_for_display(img, max_width=max_w_phys, max_height=max_h_phys)
        
        # Logical size for CTk
        logical_size = (display_img.width / scaling, display_img.height / scaling)
        
        ctk_image = ctk.CTkImage(
            light_image=display_img,
            dark_image=display_img,
            size=logical_size
        )
        
        label.configure(image=ctk_image, text="")
        label.image = ctk_image
    
    def _resize_for_display(self, img: Image.Image, max_width: int, max_height: int) -> Image.Image:
        """Resize image to fit display area while maintaining aspect ratio."""
        w, h = img.size
        ratio = min(max_width / w, max_height / h)
        
        # Always resize to fit (scale up or down) to ensure it fills the available space correctly
        new_size = (int(w * ratio), int(h * ratio))
        return img.resize(new_size, Image.Resampling.LANCZOS)
    
    def _create_config(self) -> FrameConfig:
        """Create FrameConfig from current UI state."""
        # Use temp output dir if not set
        input_dir = self.input_dir or Path("input_images") # Fallback to prevent crash
        output_dir = self.output_dir or input_dir / "framed_output"
        
        return FrameConfig(
            frame_path=self.frame_path,
            input_dir=self.input_dir,
            output_dir=output_dir,
            portrait_scale=self.portrait_scale.get(),
            landscape_scale=self.landscape_scale.get(),
            quality=100,  # Always full quality
            output_format=self.output_format.get()
        )
    
    def _process_all(self):
        """Process all images in the directory."""
        if not self.frame_path:
            messagebox.showerror("Error", "Please select a background frame first")
            return
        
        if not self.input_dir or not self.scan_result or self.scan_result.total_images == 0:
            messagebox.showerror("Error", "Please select a folder with photos first")
            return
        
        # Ensure output dir is set (it should be due to default)
        if not self.output_dir:
            dirname = filedialog.askdirectory(
                title="Choose Save Folder for Framed Photos"
            )
            if not dirname:
                return
            self.output_dir = Path(dirname)
            
        # SAFETY CHECK: Prevent writing to input directory
        # This handles cases where user ignored warnings or paths resolved oddly
        if self.input_dir and self.output_dir.resolve() == self.input_dir.resolve():
             messagebox.showerror(
                "Error",
                "Output directory cannot be the same as input directory.\n"
                "Please select a different output folder."
            )
             return
        
        # Disable process button
        self.process_btn.configure(state="disabled", text="Processing...")
        
        # Show progress
        self.progress_bar.grid(row=100, column=0, pady=(12, 4), sticky="ew")
        self.progress_label.grid(row=101, column=0, pady=(0, 12))
        
        # Create config
        config = self._create_config()
        
        # Progress callback
        def on_progress(current, total, filename):
            progress = current / total
            
            def update_ui():
                self.progress_bar.set(progress)
                self.progress_label.configure(
                    text=f"Processing {current}/{total}: {filename}"
                )
            
            self.window.after(0, update_ui)
        
        # Completion callback
        def on_complete(results):
            def handle_complete():
                success_count = sum(1 for r in results if r.success)
                fail_count = len(results) - success_count
                
                # Hide progress
                self.progress_bar.grid_remove()
                self.progress_label.grid_remove()
                
                # Re-enable button
                self.process_btn.configure(state="normal", text="PROCESS PHOTOS")
                
                # Show results
                if fail_count == 0:
                    messagebox.showinfo(
                        "Success",
                        f"All {success_count} photos processed successfully!\n\n"
                        f"Saved to: {self.output_dir}"
                    )
                else:
                    messagebox.showwarning(
                        "Completed with Errors",
                        f"Processed {success_count} photos successfully.\n"
                        f"{fail_count} photos failed to process.\n\n"
                        f"Saved to: {self.output_dir}"
                    )
            
            self.window.after(0, handle_complete)
        
        # Process in background thread
        process_batch_async(
            config,
            self.scan_result.all_images,
            on_progress,
            on_complete
        )
    
    def run(self):
        """Start the GUI application."""
        self.window.mainloop()


def main():
    """Entry point for GUI application."""
    app = PhotoFramerGUI()
    app.run()


if __name__ == "__main__":
    main()
