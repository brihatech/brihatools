export type ExtractedCell = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
};

export type ExtractedRow = {
  page: number;
  y: number;
  cells: ExtractedCell[];
};
