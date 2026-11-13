// Susun Balok: pure board logic (no DOM). Board cells: 0 = empty, >0 = color index.
export const SIZE = 8;
export const COLORS = 6;
const LINE_BONUS = 10;

const row = (n) => Array.from({ length: n }, (_, i) => [0, i]);
const col = (n) => Array.from({ length: n }, (_, i) => [i, 0]);
const square = (n) => Array.from({ length: n * n }, (_, i) => [Math.floor(i / n), i % n]);

export const PIECES = [
  [[0, 0]],
  row(2), col(2), row(3), col(3), row(4), col(4), row(5), col(5),
  square(2), square(3),
  // L / J shapes
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 1], [1, 1], [2, 0], [2, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 0]],
  [[0, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 1], [1, 0], [1, 1]],
  // T
  [[0, 0], [0, 1], [0, 2], [1, 1]],
  [[0, 1], [1, 0], [1, 1], [1, 2]],
  // S / Z
  [[0, 1], [0, 2], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1], [1, 2]],
];

export function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

export function canPlace(board, shape, r, c) {
  return shape.every(([dr, dc]) => {
    const rr = r + dr;
    const cc = c + dc;
    return rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && board[rr][cc] === 0;
  });
}

// Rows and columns that are full on the given board.
export function fullLines(board) {
  const rows = [];
  const cols = [];
  for (let i = 0; i < SIZE; i++) {
    if (board[i].every((v) => v !== 0)) rows.push(i);
    if (board.every((line) => line[i] !== 0)) cols.push(i);
  }
  return { rows, cols };
}

function stamp(board, shape, r, c, color) {
  const next = board.map((line) => line.slice());
  for (const [dr, dc] of shape) next[r + dr][c + dc] = color;
  return next;
}

// Lines that would clear if shape were placed at r,c (assumes canPlace).
export function previewClears(board, shape, r, c) {
  return fullLines(stamp(board, shape, r, c, 1));
}

export function place(board, shape, r, c, color) {
  if (!canPlace(board, shape, r, c)) throw new Error('Balok tidak muat di posisi ini');
  const next = stamp(board, shape, r, c, color);
  const { rows, cols } = fullLines(next);
  for (const i of rows) next[i].fill(0);
  for (const j of cols) for (const line of next) line[j] = 0;
  const cleared = rows.length + cols.length;
  return { board: next, cleared, points: shape.length + LINE_BONUS * cleared * cleared };
}

export function randomPieces(rng = Math.random) {
  return Array.from({ length: 3 }, () => ({
    shape: PIECES[Math.floor(rng() * PIECES.length) % PIECES.length],
    color: 1 + (Math.floor(rng() * COLORS) % COLORS),
  }));
}

export function fitsAnywhere(board, shape) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) if (canPlace(board, shape, r, c)) return true;
  }
  return false;
}

export function anyFits(board, shapes) {
  return shapes.some((shape) => fitsAnywhere(board, shape));
}
