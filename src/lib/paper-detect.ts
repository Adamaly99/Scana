/* eslint-disable @typescript-eslint/no-explicit-any */

type CvNamespace = Record<string, any>;
type JScanifyInstance = any;
type CvMat = any;

export interface Point {
  x: number;
  y: number;
}

export interface Corners {
  topLeftCorner: Point;
  topRightCorner: Point;
  bottomLeftCorner: Point;
  bottomRightCorner: Point;
}

export interface HighlightOptions {
  color: string;
  thickness: number;
  minAreaRatio?: number;
  previousCorners?: Corners | null;
  smoothing?: number;
}

export interface DetectOptions {
  minAreaRatio?: number;
}

export function cornersAreClose(
  a: Corners,
  b: Corners,
  maxDistancePx: number
): boolean {
  const distance = (p1: Point, p2: Point) =>
    Math.hypot(p1.x - p2.x, p1.y - p2.y);

  return (
    distance(a.topLeftCorner, b.topLeftCorner) <= maxDistancePx &&
    distance(a.topRightCorner, b.topRightCorner) <= maxDistancePx &&
    distance(a.bottomLeftCorner, b.bottomLeftCorner) <= maxDistancePx &&
    distance(a.bottomRightCorner, b.bottomRightCorner) <=
      maxDistancePx
  );
}

function isFinitePoint(point: Point | undefined): boolean {
  return Boolean(
    point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y)
  );
}

function isValidCorners(
  corners: Partial<Corners>
): corners is Corners {
  return (
    isFinitePoint(corners.topLeftCorner) &&
    isFinitePoint(corners.topRightCorner) &&
    isFinitePoint(corners.bottomLeftCorner) &&
    isFinitePoint(corners.bottomRightCorner)
  );
}

function polygonArea(corners: Corners): number {
  const points = [
    corners.topLeftCorner,
    corners.topRightCorner,
    corners.bottomRightCorner,
    corners.bottomLeftCorner,
  ];

  let area = 0;

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];

    area += current.x * next.y;
    area -= next.x * current.y;
  }

  return Math.abs(area) / 2;
}

function findValidCorners(
  scanner: JScanifyInstance,
  cv: CvNamespace,
  img: CvMat,
  minAreaRatio: number
): Corners | null {
  let contour: CvMat | null = null;

  try {
    contour = scanner.findPaperContour(img);

    if (!contour) {
      return null;
    }

    const frameArea = img.cols * img.rows;

    if (!frameArea) {
      return null;
    }

    const contourArea = Math.abs(
      cv.contourArea(contour)
    );

    if (
      !Number.isFinite(contourArea) ||
      contourArea < frameArea * minAreaRatio
    ) {
      return null;
    }

    const perimeter = cv.arcLength(
      contour,
      true
    );

    const approximation = new cv.Mat();

    try {
      cv.approxPolyDP(
        contour,
        approximation,
        0.02 * perimeter,
        true
      );

      const vertexCount = approximation.rows;

      if (vertexCount < 4 || vertexCount > 6) {
        return null;
      }
    } finally {
      approximation.delete();
    }

    const detected = scanner.getCornerPoints(
      contour
    ) as Partial<Corners>;

    if (!isValidCorners(detected)) {
      return null;
    }

    const area = polygonArea(detected);

    if (
      !Number.isFinite(area) ||
      area < frameArea * minAreaRatio
    ) {
      return null;
    }

    return {
      topLeftCorner: detected.topLeftCorner,
      topRightCorner: detected.topRightCorner,
      bottomLeftCorner: detected.bottomLeftCorner,
      bottomRightCorner: detected.bottomRightCorner,
    };
  } catch {
    return null;
  } finally {
    contour?.delete();
  }
}

function preprocessForDetection(
  cv: CvNamespace,
  img: CvMat
): CvMat {
  const gray = new cv.Mat();
  const enhanced = new cv.Mat();

  try {
    cv.cvtColor(
      img,
      gray,
      cv.COLOR_RGBA2GRAY
    );

    const clahe = new cv.CLAHE(
      2.0,
      new cv.Size(8, 8)
    );

    try {
      clahe.apply(gray, enhanced);
    } finally {
      clahe.delete();
    }

    return enhanced;
  } finally {
    gray.delete();
  }
}

function smoothCorners(
  previous: Corners | null | undefined,
  current: Corners,
  smoothing = 0.35
): Corners {
  if (!previous) {
    return current;
  }

  const amount = Math.min(
    1,
    Math.max(0, smoothing)
  );

  const blend = (
    oldPoint: Point,
    newPoint: Point
  ): Point => ({
    x:
      oldPoint.x * (1 - amount) +
      newPoint.x * amount,
    y:
      oldPoint.y * (1 - amount) +
      newPoint.y * amount,
  });

  return {
    topLeftCorner: blend(
      previous.topLeftCorner,
      current.topLeftCorner
    ),
    topRightCorner: blend(
      previous.topRightCorner,
      current.topRightCorner
    ),
    bottomLeftCorner: blend(
      previous.bottomLeftCorner,
      current.bottomLeftCorner
    ),
    bottomRightCorner: blend(
      previous.bottomRightCorner,
      current.bottomRightCorner
    ),
  };
}

export function highlightPaperStable(
  scanner: JScanifyInstance,
  sourceCanvas: HTMLCanvasElement,
  overlayCanvas: HTMLCanvasElement,
  options: HighlightOptions
): Corners | null {
  const cv = window.cv as unknown as CvNamespace;

  const img = cv.imread(sourceCanvas);

  let corners: Corners | null = null;

  try {
    corners = findValidCorners(
      scanner,
      cv,
      img,
      options.minAreaRatio ?? 0.15
    );

    if (!corners) {
      const processed =
        preprocessForDetection(cv, img);

      try {
        corners = findValidCorners(
          scanner,
          cv,
          processed,
          options.minAreaRatio ?? 0.15
        );
      } finally {
        processed.delete();
      }
    }
  } finally {
    img.delete();
  }

  const ctx = overlayCanvas.getContext("2d");

  if (!ctx) {
    return null;
  }

  ctx.clearRect(
    0,
    0,
    overlayCanvas.width,
    overlayCanvas.height
  );

  if (!corners) {
    return null;
  }

  const smoothed = smoothCorners(
    options.previousCorners,
    corners,
    options.smoothing ?? 0.35
  );

  const {
    topLeftCorner,
    topRightCorner,
    bottomLeftCorner,
    bottomRightCorner,
  } = smoothed;

  ctx.strokeStyle = options.color;
  ctx.lineWidth = options.thickness;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();

  ctx.moveTo(
    topLeftCorner.x,
    topLeftCorner.y
  );

  ctx.lineTo(
    topRightCorner.x,
    topRightCorner.y
  );

  ctx.lineTo(
    bottomRightCorner.x,
    bottomRightCorner.y
  );

  ctx.lineTo(
    bottomLeftCorner.x,
    bottomLeftCorner.y
  );

  ctx.closePath();
  ctx.stroke();

  return smoothed;
}

export function detectCorners(
  scanner: JScanifyInstance,
  sourceCanvas: HTMLCanvasElement,
  options: DetectOptions = {}
): Corners | null {
  const cv = window.cv as unknown as CvNamespace;

  const img = cv.imread(sourceCanvas);

  try {
    let corners = findValidCorners(
      scanner,
      cv,
      img,
      options.minAreaRatio ?? 0.15
    );

    if (!corners) {
      const processed =
        preprocessForDetection(cv, img);

      try {
        corners = findValidCorners(
          scanner,
          cv,
          processed,
          options.minAreaRatio ?? 0.15
        );
      } finally {
        processed.delete();
      }
    }

    return corners;
  } finally {
    img.delete();
  }
}

export function warpToCorners(
  sourceCanvas: HTMLCanvasElement,
  corners: Corners,
  resultWidth: number,
  resultHeight: number
): HTMLCanvasElement {
  if (
    resultWidth <= 0 ||
    resultHeight <= 0
  ) {
    throw new Error(
      "Dimensions de sortie invalides."
    );
  }

  const cv = window.cv as unknown as CvNamespace;

  const img = cv.imread(sourceCanvas);

  const warpedDst = new cv.Mat();

  const srcTri = cv.matFromArray(
    4,
    1,
    cv.CV_32FC2,
    [
      corners.topLeftCorner.x,
      corners.topLeftCorner.y,

      corners.topRightCorner.x,
      corners.topRightCorner.y,

      corners.bottomRightCorner.x,
      corners.bottomRightCorner.y,

      corners.bottomLeftCorner.x,
      corners.bottomLeftCorner.y,
    ]
  );

  const dstTri = cv.matFromArray(
    4,
    1,
    cv.CV_32FC2,
    [
      0,
      0,

      resultWidth,
      0,

      resultWidth,
      resultHeight,

      0,
      resultHeight,
    ]
  );

  const matrix = cv.getPerspectiveTransform(
    srcTri,
    dstTri
  );

  const destinationSize = new cv.Size(
    resultWidth,
    resultHeight
  );

  const outputCanvas =
    document.createElement("canvas");

  outputCanvas.width = resultWidth;
  outputCanvas.height = resultHeight;

  try {
    cv.warpPerspective(
      img,
      warpedDst,
      matrix,
      destinationSize,
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255)
    );

    cv.imshow(
      outputCanvas,
      warpedDst
    );

    return outputCanvas;
  } finally {
    img.delete();
    warpedDst.delete();
    srcTri.delete();
    dstTri.delete();
    matrix.delete();
  }
}