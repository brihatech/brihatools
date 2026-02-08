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
  nameText: FrameTextConfig;
  roleText: FrameTextConfig;
};

export const FRAMES: FrameConfig[] = [
  {
    id: "frame1",
    src: "/frames/frame1.png",
    thumbSrc: "/frames/frame1.png",
    hasOverlay: false,
    nameText: {
      xPct: 8,
      yPct: 84,
      color: "#0f172a",
      fontFamily: "system-ui",
      fontSizePx: 18,
      fontWeight: "600",
      scale: 1,
      backgroundColor: "transparent",
    },
    roleText: {
      xPct: 8,
      yPct: 90,
      color: "#0f172a",
      fontFamily: "system-ui",
      fontSizePx: 12,
      fontWeight: "500",
      scale: 1,
      backgroundColor: "transparent",
    },
  },
  {
    id: "frame2",
    src: "/frames/frame2.png",
    thumbSrc: "/frames/frame2.png",
    hasOverlay: false,
    nameText: {
      xPct: 8,
      yPct: 84,
      color: "#0f172a",
      fontFamily: "system-ui",
      fontSizePx: 18,
      fontWeight: "600",
      scale: 1,
      backgroundColor: "transparent",
    },
    roleText: {
      xPct: 8,
      yPct: 90,
      color: "#0f172a",
      fontFamily: "system-ui",
      fontSizePx: 12,
      fontWeight: "500",
      scale: 1,
      backgroundColor: "transparent",
    },
  },
  {
    id: "frame3",
    src: "/frames/frame3.png",
    thumbSrc: "/frames/frame3.png",
    hasOverlay: false,
    nameText: {
      xPct: 8,
      yPct: 84,
      color: "#0f172a",
      fontFamily: "system-ui",
      fontSizePx: 18,
      fontWeight: "600",
      scale: 1,
      backgroundColor: "transparent",
    },
    roleText: {
      xPct: 8,
      yPct: 90,
      color: "#0f172a",
      fontFamily: "system-ui",
      fontSizePx: 12,
      fontWeight: "500",
      scale: 1,
      backgroundColor: "transparent",
    },
  },
  {
    id: "frame4",
    src: "/frames/frame4.png",
    thumbSrc: "/frames/frame4.png",
    hasOverlay: false,
    nameText: {
      xPct: 48,
      yPct: 84,
      color: "#0f172a",
      fontFamily: "system-ui",
      fontSizePx: 18,
      fontWeight: "600",
      scale: 1,
      backgroundColor: "transparent",
    },
    roleText: {
      xPct: 48,
      yPct: 90,
      color: "#0f172a",
      fontFamily: "system-ui",
      fontSizePx: 12,
      fontWeight: "500",
      scale: 1,
      backgroundColor: "transparent",
    },
  },
];

export const DEFAULT_FRAME_SRC = FRAMES[0]?.src ?? "/frames/frame1.png";
