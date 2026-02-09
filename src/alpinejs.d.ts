declare module "alpinejs" {
  export type AlpineMagics = {
    $refs?: Record<string, unknown>;
    $el?: HTMLElement;
    $watch?: (path: string, callback: (value: unknown) => void) => void;
    $nextTick?: (callback: () => void) => void;
  };

  export type AlpineComponent<T extends object> = T &
    ThisType<T & AlpineMagics>;

  export interface AlpineType {
    start: () => void;
    data: <T extends object>(
      name: string,
      factory: () => AlpineComponent<T>,
    ) => void;
  }

  const Alpine: AlpineType;
  export default Alpine;
}
