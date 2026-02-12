import type { PhotoFramerState } from "./state";

export const loadFrame = async (
  file: File | undefined,
  state: PhotoFramerState,
) => {
  if (!file) return null;

  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();

  state.frame = img;
  state.frameBitmap = await createImageBitmap(img);

  return file.name;
};
