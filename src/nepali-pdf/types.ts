export type ExtractedCell = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ExtractedRow = {
  y: number;
  cells: ExtractedCell[];
};
