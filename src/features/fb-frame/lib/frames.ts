export interface FbFrame {
  id: string;
  name: string;
  src: string;
  thumbSrc?: string;
  width: number;
  height: number;
  categories?: string[];
}

const FRAMES_DIR = "/frames/facebook";

export const FB_FRAMES: FbFrame[] = [
  {
    id: "chunna-fb",
    name: "Chunna Facebook Frame",
    src: `${FRAMES_DIR}/frame_chunna_fb.png`,
    thumbSrc: `${FRAMES_DIR}/thumbs/frame_chunna_fb.webp`,
    width: 1080,
    height: 1080,
    categories: ["Chunna Poudel"],
  },
  {
    id: "binod-fb",
    name: "Binod Facebook Frame",
    src: `${FRAMES_DIR}/frame_binod_fb.png`,
    thumbSrc: `${FRAMES_DIR}/thumbs/frame_binod_fb.webp`,
    width: 1080,
    height: 1080,
    categories: ["Binod Chaudhary"],
  },
];
