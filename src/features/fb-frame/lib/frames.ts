export interface FbFrame {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
}

const FRAMES_DIR = "/frames/facebook";

export const FB_FRAMES: FbFrame[] = [
  {
    id: "chunna-fb",
    name: "Chunna Facebook Frame",
    src: `${FRAMES_DIR}/frame_chunna_fb.png`,
    width: 1080,
    height: 1080,
  },
  // Add more frames here in the future
];
