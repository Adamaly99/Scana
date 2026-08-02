declare module "jscanify/client" {
  interface HighlightOptions {
    color?: string;
    thickness?: number;
  }

  type ImageSource = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

  class JScanify {
    constructor();
    highlightPaper(image: ImageSource, options?: HighlightOptions): HTMLCanvasElement;
    extractPaper(
      image: ImageSource,
      resultWidth: number,
      resultHeight: number
    ): HTMLCanvasElement | null;
  }

  export default JScanify;
}
