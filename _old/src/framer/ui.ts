import type {
  PhotoFramerState,
  PreviewOrientation,
  PreviewSettings,
} from "./state";

export interface PhotoFramerUI {
  frameInput: HTMLInputElement;
  photoInput: HTMLInputElement;
  portraitCanvas: HTMLCanvasElement;
  landscapeCanvas: HTMLCanvasElement;
  portraitMeta: HTMLElement;
  landscapeMeta: HTMLElement;
  portraitLoading: HTMLDivElement;
  landscapeLoading: HTMLDivElement;
  portraitPrevBtn: HTMLButtonElement;
  portraitNextBtn: HTMLButtonElement;
  landscapePrevBtn: HTMLButtonElement;
  landscapeNextBtn: HTMLButtonElement;
  downloadBtn: HTMLButtonElement;
  status: HTMLDivElement;
  frameStatus: HTMLElement;
  photoStatus: HTMLElement;
  qualitySelect: HTMLSelectElement;
  sliders: {
    portraitScale: HTMLInputElement;
    portraitOffset: HTMLInputElement;
    landscapeScale: HTMLInputElement;
    landscapeOffset: HTMLInputElement;
  };
  labels: {
    portraitScale: HTMLSpanElement;
    portraitOffset: HTMLSpanElement;
    landscapeScale: HTMLSpanElement;
    landscapeOffset: HTMLSpanElement;
  };
}

export const initUI = (): PhotoFramerUI => ({
  frameInput: document.getElementById("frameInput") as HTMLInputElement,
  photoInput: document.getElementById("photoInput") as HTMLInputElement,
  portraitCanvas: document.getElementById(
    "portraitPreviewCanvas",
  ) as HTMLCanvasElement,
  landscapeCanvas: document.getElementById(
    "landscapePreviewCanvas",
  ) as HTMLCanvasElement,
  portraitMeta: document.getElementById("portraitPreviewMeta") as HTMLElement,
  landscapeMeta: document.getElementById("landscapePreviewMeta") as HTMLElement,
  portraitLoading: document.getElementById("portraitLoading") as HTMLDivElement,
  landscapeLoading: document.getElementById(
    "landscapeLoading",
  ) as HTMLDivElement,
  portraitPrevBtn: document.getElementById("portraitPrev") as HTMLButtonElement,
  portraitNextBtn: document.getElementById("portraitNext") as HTMLButtonElement,
  landscapePrevBtn: document.getElementById(
    "landscapePrev",
  ) as HTMLButtonElement,
  landscapeNextBtn: document.getElementById(
    "landscapeNext",
  ) as HTMLButtonElement,
  downloadBtn: document.getElementById("downloadZip") as HTMLButtonElement,
  status: document.getElementById("downloadStatus") as HTMLDivElement,
  frameStatus: document.getElementById("frameStatus") as HTMLElement,
  photoStatus: document.getElementById("photoStatus") as HTMLElement,
  qualitySelect: document.getElementById("exportQuality") as HTMLSelectElement,
  sliders: {
    portraitScale: document.getElementById("portraitScale") as HTMLInputElement,
    portraitOffset: document.getElementById(
      "portraitOffset",
    ) as HTMLInputElement,
    landscapeScale: document.getElementById(
      "landscapeScale",
    ) as HTMLInputElement,
    landscapeOffset: document.getElementById(
      "landscapeOffset",
    ) as HTMLInputElement,
  },
  labels: {
    portraitScale: document.getElementById(
      "portraitScaleValue",
    ) as HTMLSpanElement,
    portraitOffset: document.getElementById(
      "portraitOffsetValue",
    ) as HTMLSpanElement,
    landscapeScale: document.getElementById(
      "landscapeScaleValue",
    ) as HTMLSpanElement,
    landscapeOffset: document.getElementById(
      "landscapeOffsetValue",
    ) as HTMLSpanElement,
  },
});

export const bindSliderInputs = (
  ui: PhotoFramerUI,
  state: PhotoFramerState,
  onChange: () => void,
) => {
  const sliderMap: Record<
    keyof PhotoFramerUI["sliders"],
    {
      type: "portrait" | "landscape";
      field: "scale" | "offset";
    }
  > = {
    portraitScale: { type: "portrait", field: "scale" },
    portraitOffset: { type: "portrait", field: "offset" },
    landscapeScale: { type: "landscape", field: "scale" },
    landscapeOffset: { type: "landscape", field: "offset" },
  };

  (
    Object.entries(ui.sliders) as [
      keyof PhotoFramerUI["sliders"],
      HTMLInputElement,
    ][]
  ).forEach(([key, input]) => {
    input.addEventListener("input", (event: Event) => {
      const config = sliderMap[key];
      if (!config) return;
      const nextValue = Number((event.target as HTMLInputElement).value);
      state.settings[config.type][config.field] = nextValue;
      onChange();
    });
  });
};

const getNavButtons = (ui: PhotoFramerUI, type: PreviewOrientation) =>
  type === "portrait"
    ? { prev: ui.portraitPrevBtn, next: ui.portraitNextBtn }
    : { prev: ui.landscapePrevBtn, next: ui.landscapeNextBtn };

const getLoadingElement = (ui: PhotoFramerUI, type: PreviewOrientation) =>
  type === "portrait" ? ui.portraitLoading : ui.landscapeLoading;

export const setNavState = (
  ui: PhotoFramerUI,
  type: PreviewOrientation,
  count: number,
) => {
  const { prev, next } = getNavButtons(ui, type);
  const disabled = count <= 1;
  prev.disabled = disabled;
  next.disabled = disabled;
};

export const setPreviewLoading = (
  ui: PhotoFramerUI,
  type: PreviewOrientation,
  isLoading: boolean,
) => {
  getLoadingElement(ui, type).classList.toggle("active", isLoading);
};

export const updateLabels = (ui: PhotoFramerUI, settings: PreviewSettings) => {
  ui.labels.portraitScale.textContent = settings.portrait.scale.toFixed(2);
  ui.labels.portraitOffset.textContent = settings.portrait.offset.toFixed(2);
  ui.labels.landscapeScale.textContent = settings.landscape.scale.toFixed(2);
  ui.labels.landscapeOffset.textContent = settings.landscape.offset.toFixed(2);
};
