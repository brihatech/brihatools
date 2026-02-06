import type { PhotoFramerState } from "./state";
import type { PhotoFramerUI } from "./ui";

export const loadFrame = async (
  file: File | undefined,
  state: PhotoFramerState,
  ui: PhotoFramerUI,
  onReady: () => void,
) => {
  if (!file) return;

  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();

  state.frame = img;
  state.frameBitmap = await createImageBitmap(img);
  ui.frameStatus.textContent = file.name;

  onReady();
};
