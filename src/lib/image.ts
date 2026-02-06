export type OrientationType = "portrait" | "landscape" | "square";

export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Determines the orientation type of a set of dimensions.
 */
export function getOrientationType(
  width: number,
  height: number,
): OrientationType {
  const ratio = width / height;
  if (Math.abs(1 - ratio) < 0.05) return "square";
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
  const isPortrait = orientation === "portrait";

  // Base target size on the dominant dimension for the orientation
  let targetWidth: number;
  let targetHeight: number;

  if (isPortrait) {
    targetHeight = frame.height * scale;
    targetWidth = targetHeight * (photo.width / photo.height);
    const maxWidth = frame.width * scale;
    if (targetWidth > maxWidth) {
      targetWidth = maxWidth;
      targetHeight = targetWidth * (photo.height / photo.width);
    }
  } else {
    targetWidth = frame.width * scale;
    targetHeight = targetWidth * (photo.height / photo.width);
    const maxHeight = frame.height * scale;
    if (targetHeight > maxHeight) {
      targetHeight = maxHeight;
      targetWidth = targetHeight * (photo.width / photo.height);
    }
  }

  return { width: targetWidth, height: targetHeight };
}
