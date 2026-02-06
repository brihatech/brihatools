import exifr from "exifr";

/**
 * Extracts EXIF orientation from a file.
 * Returns 1 (normal) if orientation is missing or invalid.
 */
export async function getExifOrientation(file: File): Promise<number> {
  try {
    const orientation = await exifr.orientation(file);
    return typeof orientation === "number" ? orientation : 1;
  } catch (err) {
    console.warn("Failed to extract EXIF orientation:", err);
    return 1;
  }
}