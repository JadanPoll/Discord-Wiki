// Required modules
// Mean function
function mean(array) {
  const sum = array.reduce((acc, val) => acc + val, 0);
  return sum / array.length;
}

// Linear interpolation (interp1d)
function interp(xi, x, y) {
  for (let i = 1; i < x.length; i++) {
    if (xi <= x[i]) {
      const t = (xi - x[i - 1]) / (x[i] - x[i - 1]);
      return y[i - 1] * (1 - t) + y[i] * t;
    }
  }
  return null; // If xi is outside the bounds
}

// Polynomial fit (polyfit) - using least squares method for degree 'n'
function polyfit(x, y, degree) {
  const n = degree + 1;
  const X = [];
  for (let i = 0; i < x.length; i++) {
    X.push(Array.from({ length: n }, (_, k) => Math.pow(x[i], k)));
  }
  const XT = transpose(X);
  const XTX = multiplyMatrices(XT, X);
  const XTY = multiplyMatrixVector(XT, y);
  return gaussianElimination(XTX, XTY);
}

// Polynomial evaluation (polyval)
function polyval(coefficients, x) {
  return coefficients.reduce((acc, c, i) => acc + c * Math.pow(x, i), 0);
}

// Helper: Transpose matrix
function transpose(matrix) {
  return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

// Helper: Multiply matrices
function multiplyMatrices(A, B) {
  const result = Array(A.length).fill(0).map(() => Array(B[0].length).fill(0));
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < B[0].length; j++) {
      for (let k = 0; k < B.length; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return result;
}

// Helper: Multiply matrix by vector
function multiplyMatrixVector(A, v) {
  return A.map(row => row.reduce((acc, val, i) => acc + val * v[i], 0));
}

// Helper: Gaussian Elimination to solve linear system (AX = B)
function gaussianElimination(A, B) {
  const n = A.length;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(A[j][i]) > Math.abs(A[maxRow][i])) {
        maxRow = j;
      }
    }
    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    [B[i], B[maxRow]] = [B[maxRow], B[i]];

    for (let j = i + 1; j < n; j++) {
      const factor = A[j][i] / A[i][i];
      for (let k = i; k < n; k++) {
        A[j][k] -= factor * A[i][k];
      }
      B[j] -= factor * B[i];
    }
  }

  const X = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    X[i] = B[i] / A[i][i];
    for (let j = i - 1; j >= 0; j--) {
      B[j] -= A[j][i] * X[i];
    }
  }
  return X;
}

const VALID_CURVE = ["convex", "concave"];
const VALID_DIRECTION = ["increasing", "decreasing"];

export class KneeLocator {
  /**
   * Create a new KneeLocator instance.
   * @param {number[]} x - Array of x values.
   * @param {number[]} y - Array of y values.
   * @param {number} S - Sensitivity parameter.
   * @param {string} curve - Either 'concave' or 'convex'.
   * @param {string} direction - Either 'increasing' or 'decreasing'.
   * @param {string} interpMethod - Either 'interp1d' or 'polynomial'.
   * @param {boolean} online - Whether to allow dynamic knee correction.
   * @param {number} polynomialDegree - Degree of the polynomial for fitting.
   */
  constructor(
    x,
    y,
    S = 1.0,
    curve = "concave",
    direction = "increasing",
    interpMethod = "interp1d",
    online = false,
    polynomialDegree = 7
  ) {
    this.x = x;
    this.y = y;
    this.curve = curve;
    this.direction = direction;
    this.S = S;
    this.online = online;
    this.polynomialDegree = polynomialDegree;
    this.N = x.length;
    this.allKnees = new Set();
    this.allNormKnees = new Set();
    this.allKneesY = [];
    this.allNormKneesY = [];

    if (!VALID_CURVE.includes(this.curve) || !VALID_DIRECTION.includes(this.direction)) {
      throw new Error("Invalid curve or direction argument.");
    }

    // Step 1: Fit a smooth line
    this.DsY = this._interpolate(this.x, this.y, interpMethod);

    // Step 2: Normalize values
    this.xNormalized = this._normalize(this.x);
    this.yNormalized = this._normalize(this.DsY);

    // Step 3: Calculate the Difference curve
    this.yNormalized = this._transformY(this.yNormalized, this.direction, this.curve);
    this.yDifference = this.yNormalized.map((val, i) => val - this.xNormalized[i]);
    this.xDifference = [...this.xNormalized];

    // Step 4: Identify local maxima/minima
    this.maximaIndices = this._findLocalExtrema(this.yDifference, "maxima");
    this.minimaIndices = this._findLocalExtrema(this.yDifference, "minima");
    this.xDifferenceMaxima = this.maximaIndices.map((i) => this.xDifference[i]);
    this.yDifferenceMaxima = this.maximaIndices.map((i) => this.yDifference[i]);
    this.xDifferenceMinima = this.minimaIndices.map((i) => this.xDifference[i]);
    this.yDifferenceMinima = this.minimaIndices.map((i) => this.yDifference[i]);

    // Step 5: Calculate thresholds
    const dxMean = mean(this.xNormalized.slice(1).map((val, i) => val - this.xNormalized[i]));
    this.Tmx = this.yDifferenceMaxima.map((val) => val - this.S * Math.abs(dxMean));

    // Step 6: Find knee
    const kneeInfo = this._findKnee();
    this.knee = kneeInfo.knee;
    this.normKnee = kneeInfo.normKnee;

    // Step 7: Extract knee data
    this.kneeY = null;
    this.normKneeY = null;
    if (this.knee !== null) {
      this.kneeY = this.y[this.x.indexOf(this.knee)];
      this.normKneeY = this.yNormalized[this.xNormalized.indexOf(this.normKnee)];
    }
  }

  _interpolate(x, y, method) {
    if (method === "interp1d") {
      return x.map((xi) => interp(xi, x, y));
    } else if (method === "polynomial") {
      const coefficients = polyfit(x, y, this.polynomialDegree);
      return x.map((xi) => polyval(coefficients, xi));
    } else {
      throw new Error("Invalid interpolation method.");
    }
  }

  _normalize(array) {
    const minVal = Math.min(...array);
    const maxVal = Math.max(...array);
    return array.map((val) => (val - minVal) / (maxVal - minVal));
  }

  _transformY(y, direction, curve) {
    if (direction === "decreasing") {
      return curve === "concave" ? y.reverse() : y.map((val) => Math.max(...y) - val);
    } else if (direction === "increasing" && curve === "convex") {
      return y.reverse().map((val) => Math.max(...y) - val);
    }
    return y;
  }

  _findLocalExtrema(array, type) {
    const extrema = [];
    for (let i = 1; i < array.length - 1; i++) {
      if (
        (type === "maxima" && array[i] >= array[i - 1] && array[i] >= array[i + 1]) ||
        (type === "minima" && array[i] <= array[i - 1] && array[i] <= array[i + 1])
      ) {
        extrema.push(i);
      }
    }
    return extrema;
  }

  _findKnee() {
    if (this.maximaIndices.length === 0) {
      return { knee: null, normKnee: null };
    }

    for (let i = 0; i < this.xDifference.length; i++) {
      if (i < this.maximaIndices[0]) {
        continue;
      }

      const threshold = this.maximaIndices.includes(i)
        ? this.Tmx[this.maximaIndices.indexOf(i)]
        : 0;

      if (this.yDifference[i + 1] < threshold) {
        return {
          knee: this.x[i],
          normKnee: this.xNormalized[i]
        };
      }
    }

    return { knee: null, normKnee: null };
  }
}

module.exports = KneeLocator;
