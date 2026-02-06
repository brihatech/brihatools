# Photo Framer - Web Application Specifications

## 1. Project Overview
The "Photo Framer" is a client-side web application designed to batch-process a collection of photos by compositing them onto a user-selected "Frame" (a branded background image).

**Key Consumer Features:**
1.  **Frame Selection:** User uploads a customized background/template image.
2.  **Photo Selection:** User uploads multiple source images (batch).
3.  **Configuration:** User adjusts scale and vertical offset independently for Portrait vs. Landscape photos.
4.  **Processing:** The app automatically standardizes orientation, resizes source photos, and composites them onto the frame.
5.  **Output:** Users can preview results in real-time and download processed images (individually or as a ZIP archive).

## 2. Architecture & Tech Stack
*   **Structure:** Single Page Application (SPA).
*   **Markup:** Semantic HTML5 for the control panel and preview area.
*   **Styling:** CSS Flexbox/Grid for split-pane layout.
*   **Scripting:** Vanilla JavaScript (ES6+).
*   **Core Processing:** HTML5 `<canvas>` API for all image manipulation.
*   **Dependencies:**
    *   `jszip` (for batch downloading/archiving results).
    *   `exif-js` (to handle EXIF orientation data correctly).


## 4. Engine Specification
The core image processing logic handles orientation detection, resizing, and composition via the Canvas API.

### 4.1. Orientation Detection
The engine determines the orientation of a source image to apply the correct distinct layout settings.

**Logic:**
1.  Compare Width vs. Height.
2.  Apply a tolerance (e.g., 1%) to detect Square images.
3.  **Rules:**
    *   If `|width - height| / max(width, height) < 0.01` → **Square**
    *   If `height > width` → **Portrait**
    *   Otherwise → **Landscape**

### 4.2. Target Size Calculation
Detailed logic for determining the dimensions of the photo on the canvas.

**Inputs:**
*   `Frame Dimensions` (Width, Height)
*   `Photo Dimensions` (Width, Height)
*   `Orientation` (Portrait/Landscape/Square)
*   `Scale Settings` (Portrait Scale / Landscape Scale)

**Algorithm:**
1.  **Portrait Mode:**
    *   Base the target height on the frame height: `targetHeight = frameHeight * portraitScale`.
    *   Calculate width to preserve aspect ratio: `targetWidth = targetHeight * (photoWidth / photoHeight)`.
    *   *Constraint:* If `targetWidth` exceeds `(frameWidth * portraitScale)`, clamp the width and recalculate the height to fit.

2.  **Landscape & Square Mode:**
    *   Base the target width on the frame width: `targetWidth = frameWidth * landscapeScale`.
    *   Calculate height to preserve aspect ratio: `targetHeight = targetWidth * (photoHeight / photoWidth)`.
    *   *Constraint:* If `targetHeight` exceeds `(frameHeight * landscapeScale)`, clamp the height and recalculate the width to fit.

### 4.3. Composition & Positioning
The rendering pipeline for a single image.

**Pipeline Steps:**
1.  **Canvas Setup:** Initialize an `OffscreenCanvas` (or standard Canvas) matching the Frame's dimensions.
2.  **Draw Frame:** Render the Frame image at coordinates `(0, 0)`.
3.  **Centering Calculation:**
    *   Horizontal Center: `x = (frameWidth - targetWidth) / 2`
    *   Vertical Center: `y = (frameHeight - targetHeight) / 2`
4.  **Offset Application:**
    *   If Portrait: Apply `portraitOffsetY` * Frame Height.
    *   If Landscape/Square: Apply `landscapeOffsetY` * Frame Height.
    *   Add this calculated offset to the `y` coordinate.
5.  **Composite:** Draw the resized source image at the calculated `(x, y)` coordinates.
6.  **Export:** Convert the canvas content to a reusable format (Blob or Data URL).

### 4.4. EXIF Rotation Handling
Standard HTML Canvas drawing <img> elements ignores EXIF orientation tags (common in phone photography).
*   **Requirement:** The app must read the EXIF data of uploaded files via `exif-js`.
*   **Result:** If an orientation tag exists (e.g., 90° rotation), the canvas context must be rotated/translated *before* the draw operation to ensure the image appears upright.

## 5. UI Specification
The interface follows a split-pane design.

### 5.1. Layout
*   **Left Panel (Controls):** Fixed width (approx. 320px). Contains all inputs for configuration.
*   **Right Panel (Preview):** Flexible width. Displays the rendered result against a neutral/dark background.

### 5.2. Control Panel Inputs
1.  **Frame Upload:** File picker for the background template.
2.  **Batch Upload:** Multi-file picker for source photos. Displays count of selected files.
3.  **Sliders:**
    *   **Portrait Scale:** 0.1 - 1.0 (Default: 0.7)
    *   **Portrait Offset:** -1.0 - 1.0 (Default: 0.0)
    *   **Landscape Scale:** 0.1 - 1.0 (Default: 0.9)
    *   **Landscape Offset:** -1.0 - 1.0 (Default: 0.0)
    *   *Note: Sliders trigger a debounced preview update.*
4.  **Actions:**
    *   "Download All (ZIP)" button.

### 5.3. Preview Area
*   Displays the currently processed image.
*   **Navigation:** "Previous" and "Next" buttons allow the user to cycle through their uploaded batch to verify how settings affect different images (e.g., checking a Portrait vs. a Landscape photo).

## 6. Suggested File Structure
```text
/
├── index.html           # Main application markup
├── styles.css           # Layout and theming
├── js/
│   ├── app.js           # Main controller & Event listeners
│   ├── state.js         # Configuration state management
│   ├── engine.js        # Canvas processing logic
│   └── utils.js         # Helpers (Debounce, File reading)
└── assets/              # Static assets
```
