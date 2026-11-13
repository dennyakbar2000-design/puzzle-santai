// Pure logic for Gabung Angka (4x4 number-merge slide puzzle). No DOM.
export const SIZE = 4;
export const GOAL = 2048;

export function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

// Slides toward index 0; each tile merges at most once, leftmost pair first.
export function slideRow(row) {
  const tiles = row.filter((v) => v !== 0);
  const out = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === tiles[i + 1]) {
      const sum = tiles[i] * 2;
      out.push(sum);
      gained += sum;
      i++;
    } else {
      out.push(tiles[i]);
    }
  }
  while (out.length < row.length) out.push(0);
  return { row: out, gained };
}

const transpose = (b) => b[0].map((_, c) => b.map((r) => r[c]));
const reverseRows = (b) => b.map((r) => [...r].reverse());

// Bring board into "slide left" orientation and back again.
const TO_LEFT = {
  left: (b) => b,
  right: reverseRows,
  up: transpose,
  down: (b) => reverseRows(transpose(b)),
};
const FROM_LEFT = {
  left: (b) => b,
  right: reverseRows,
  up: transpose,
  down: (b) => transpose(reverseRows(b)),
};

export function move(board, dir) {
  if (!TO_LEFT[dir]) throw new Error('Arah tidak dikenal: ' + dir);
  let gained = 0;
  const slid = TO_LEFT[dir](board.map((r) => [...r])).map((r) => {
    const res = slideRow(r);
    gained += res.gained;
    return res.row;
  });
  const next = FROM_LEFT[dir](slid);
  const moved = next.some((r, y) => r.some((v, x) => v !== board[y][x]));
  return { board: next, gained, moved };
}

export function addRandomTile(board, rng = Math.random) {
  const next = board.map((r) => [...r]);
  const empty = [];
  next.forEach((r, y) => r.forEach((v, x) => { if (v === 0) empty.push([y, x]); }));
  if (empty.length === 0) return next;
  const [y, x] = empty[Math.floor(rng() * empty.length)];
  next[y][x] = rng() < 0.9 ? 2 : 4;
  return next;
}

export function canMove(board) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const v = board[y][x];
      if (v === 0) return true;
      if (x + 1 < SIZE && board[y][x + 1] === v) return true;
      if (y + 1 < SIZE && board[y + 1][x] === v) return true;
    }
  }
  return false;
}

export function hasWon(board) {
  return board.some((r) => r.some((v) => v >= GOAL));
}
