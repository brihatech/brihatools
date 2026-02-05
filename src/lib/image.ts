export type OrientationType = "portrait" | "landscape" | "square";

export type Dimensions = {
  width: number;
  height: number;
};

export function getOrientationType(
  width: number,
  height: number,
): OrientationType {
  const diff = Math.abs(width - height) / Math.max(width, height);
  if (diff < 0.01) return "square";
  return height > width ? "portrait" : "landscape";
}

/**
 * Calculates the target dimensions for an image within a frame
 * based on scaling and aspect ratio preservation.
 */
export function calculateTargetSize(
  frame: Dimensions,
  photo: Dimensions,
  scale: number,
  orientation: OrientationType,
): Dimensions {
  if (orientation === "portrait") {
    // Logic for portrait fitting
    let targetHeight = frame.height * scale;
    let targetWidth = targetHeight * (photo.width / photo.height);
    const maxWidth = frame.width * scale;

    // Constrain if it gets too wide
    if (targetWidth > maxWidth) {
      targetWidth = maxWidth;
      targetHeight = targetWidth * (photo.height / photo.width);
    }
    return { width: targetWidth, height: targetHeight };
  }

  // Logic for landscape fitting
  let targetWidth = frame.width * scale;
  let targetHeight = targetWidth * (photo.height / photo.width);
  const maxHeight = frame.height * scale;

  if (targetHeight > maxHeight) {
    targetHeight = maxHeight;
    targetWidth = targetHeight * (photo.width / photo.height);
  }
  return { width: targetWidth, height: targetHeight };
}

/**
 * Swaps dimensions if the EXIF orientation indicates 90-degree rotation.
 */
export function getOrientedDimensions(
  image: HTMLImageElement,
  orientation: number,
): Dimensions {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  // EXIF 5-8 indicate 90 or 270 degree rotation
  if ([5, 6, 7, 8].includes(orientation)) {
    return { width: height, height: width };
  }
  return { width, height };
}
