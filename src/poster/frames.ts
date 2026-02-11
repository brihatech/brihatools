export type FrameTextConfig = {
  xPct: number;
  yPct: number;
  color: string;
  fontFamily: string;
  fontSizePx: number;
  fontWeight: string;
  scale: number;
  backgroundColor: string;
};

export type FrameConfig = {
  id: string;
  src: string;
  thumbSrc?: string;
  hasOverlay: boolean;
  overlaySrc?: string;
  categories: Array<"Chunna Poudel" | "Binod Chaudhary">;
  nameText: FrameTextConfig;
  roleText: FrameTextConfig;
};

export const FRAMES: FrameConfig[] = [
  {
    id: "frame1",
    src: "/frames/frame_chunnu_1.png",
    thumbSrc: "/frames/frame_chunnu_1.png",
    categories: ["Chunna Poudel"],
    hasOverlay: false,
    nameText: {
      xPct: 8,
      yPct: 82,
      color: "#007400",
      fontFamily: "Yatra",
      fontSizePx: 42,
      fontWeight: "600",
      scale: 1,
      backgroundColor: "transparent",
    },
    roleText: {
      xPct: 8,
      yPct: 88,
      color: "#007400",
      fontFamily: "Vespre",
      fontSizePx: 28,
      fontWeight: "500",
      scale: 1,
      backgroundColor: "transparent",
    },
  },
  {
    id: "frame2",
    src: "/frames/frame_chunnu_2.png",
    thumbSrc: "/frames/frame_chunnu_2.png",
    categories: ["Chunna Poudel"],
    hasOverlay: false,
    nameText: {
      xPct: 8,
      yPct: 82,
      color: "#007400",
      fontFamily: "Yatra",
      fontSizePx: 42,
      fontWeight: "600",
      scale: 1,
      backgroundColor: "transparent",
    },
    roleText: {
      xPct: 8,
      yPct: 88,
      color: "#007400",
      fontFamily: "Vespre",
      fontSizePx: 28,
      fontWeight: "500",
      scale: 1,
      backgroundColor: "transparent",
    },
  },
  {
    id: "frame3",
    src: "/frames/frame_chunnu_3.png",
    thumbSrc: "/frames/frame_chunnu_3.png",
    categories: ["Chunna Poudel"],
    hasOverlay: false,
    nameText: {
      xPct: 8,
      yPct: 82,
      color: "#007400",
      fontFamily: "Yatra",
      fontSizePx: 42,
      fontWeight: "600",
      scale: 1,
      backgroundColor: "transparent",
    },
    roleText: {
      xPct: 8,
      yPct: 88,
      color: "#007400",
      fontFamily: "Vespre",
      fontSizePx: 28,
      fontWeight: "500",
      scale: 1,
      backgroundColor: "transparent",
    },
  },

  {
    id: "frame4",
    src: "/frames/frame_binod_1.png",
    thumbSrc: "/frames/frame_binod_1.png",
    categories: ["Binod Chaudhary"],
    hasOverlay: true,
    overlaySrc: "/frames/frame_binod_1_overlay.png",
    nameText: {
      xPct: 52.15,
      yPct: 85.18,
      color: "#ffffff",
      fontFamily: "Yatra",
      fontSizePx: 44,
      fontWeight: "600",
      scale: 1,
      backgroundColor: "transparent",
    },
    roleText: {
      xPct: 52.15,
      yPct: 92.21,
      color: "#ffffff",
      fontFamily: "Vespre",
      fontSizePx: 28,
      fontWeight: "500",
      scale: 1,
      backgroundColor: "transparent",
    },
  },
  {
    id: "frame5",
    src: "/frames/frame_binod_2.png",
    thumbSrc: "/frames/frame_binod_2.png",
    categories: ["Binod Chaudhary"],
    hasOverlay: false,
    nameText: {
      xPct: 62,
      yPct: 83,
      color: "#007400",
      fontFamily: "Yatra",
      fontSizePx: 42,
      fontWeight: "600",
      scale: 1,
      backgroundColor: "transparent",
    },
    roleText: {
      xPct: 62,
      yPct: 89,
      color: "#007400",
      fontFamily: "Vespre",
      fontSizePx: 28,
      fontWeight: "500",
      scale: 1,
      backgroundColor: "transparent",
    },
  },
  {
    id: "frame6",
    src: "/frames/frame_binod_3.png",
    thumbSrc: "/frames/frame_binod_3.png",
    categories: ["Binod Chaudhary"],
    hasOverlay: false,
    nameText: {
      xPct: 62,
      yPct: 83,
      color: "#007400",
      fontFamily: "Yatra",
      fontSizePx: 42,
      fontWeight: "600",
      scale: 1,
      backgroundColor: "transparent",
    },
    roleText: {
      xPct: 62,
      yPct: 89,
      color: "#007400",
      fontFamily: "Vespre",
      fontSizePx: 28,
      fontWeight: "500",
      scale: 1,
      backgroundColor: "transparent",
    },
  },
  {
    id: "frame7",
    src: "/frames/frame_binod_4.png",
    thumbSrc: "/frames/frame_binod_4.png",
    categories: ["Binod Chaudhary"],
    hasOverlay: false,
    nameText: {
      xPct: 8,
      yPct: 82,
      color: "#007400",
      fontFamily: "Yatra",
      fontSizePx: 42,
      fontWeight: "600",
      scale: 1,
      backgroundColor: "transparent",
    },
    roleText: {
      xPct: 8,
      yPct: 88,
      color: "#007400",
      fontFamily: "Vespre",
      fontSizePx: 28,
      fontWeight: "500",
      scale: 1,
      backgroundColor: "transparent",
    },
  },

  {
    id: "frame8",
    src: "/frames/Congress Frame.png",
    thumbSrc: "/frames/Congress Frame.png",
    categories: ["Chunna Poudel", "Binod Chaudhary"],
    hasOverlay: false,
    nameText: {
      xPct: 8,
      yPct: 82,
      color: "#007400",
      fontFamily: "Yatra",
      fontSizePx: 42,
      fontWeight: "600",
      scale: 1,
      backgroundColor: "transparent",
    },
    roleText: {
      xPct: 8,
      yPct: 88,
      color: "#007400",
      fontFamily: "Vespre",
      fontSizePx: 28,
      fontWeight: "500",
      scale: 1,
      backgroundColor: "transparent",
    },
  },
];

export const DEFAULT_FRAME_SRC = FRAMES[0]?.src ?? "/frames/frame1.png";
