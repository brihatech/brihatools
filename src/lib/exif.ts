import EXIF from "exif-js";

export async function getExifOrientation(file: File): Promise<number> {
  return new Promise((resolve) => {
    EXIF.getData(file as any, function (this: any) {
      const orientation = EXIF.getTag(this, "Orientation");
      resolve(typeof orientation === "number" ? orientation : 1);
    });
  });
}
