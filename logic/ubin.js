// Sambung Ubin: pure board logic (no DOM). Empty cells are null.
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const MAX_SEGMENTS = 3; // 3 straight segments = at most 2 turns

function permute(list, rng) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function chunk(flat, cols) {
  const rows = [];
  for (let i = 0; i < flat.length; i += cols) rows.push(flat.slice(i, i + cols));
  return rows;
}

export function makeBoard(rows, cols, symbolCount, rng = Math.random) {
  const total = rows * cols;
  if (total % 2 !== 0) throw new Error('rows*cols must be even');
  const tiles = [];
  for (let i = 0; i < total / 2; i++) tiles.push(i % symbolCount, i % symbolCount);
  let board;
  do {
    board = chunk(permute(tiles, rng), cols);
  } while (!findAnyPair(board));
  return board;
}

// Padded grid: one empty ring around the board; padded (r, c) = board (r-1, c-1).
function isFreeOrTarget(board, r, c, target) {
  const rows = board.length;
  const cols = board[0].length;
  if (r < 0 || c < 0 || r > rows + 1 || c > cols + 1) return false;
  if (r === target.r && c === target.c) return true;
  if (r === 0 || c === 0 || r === rows + 1 || c === cols + 1) return true;
  return board[r - 1][c - 1] === null;
}

function tracePath(parent, end) {
  const points = [];
  let key = `${end.r},${end.c}`;
  while (key) {
    const [r, c] = key.split(',').map(Number);
    points.unshift({ r, c });
    key = parent.get(key);
  }
  return points;
}

// BFS by segment count: every cell is reached with the fewest straight segments.
export function findPath(board, a, b) {
  if (a.r === b.r && a.c === b.c) return null;
  const va = board[a.r]?.[a.c];
  const vb = board[b.r]?.[b.c];
  if (va == null || va !== vb) return null;
  const start = { r: a.r + 1, c: a.c + 1 };
  const target = { r: b.r + 1, c: b.c + 1 };
  const parent = new Map([[`${start.r},${start.c}`, null]]);
  let frontier = [start];
  for (let seg = 1; seg <= MAX_SEGMENTS && frontier.length; seg++) {
    const next = [];
    for (const cur of frontier) {
      for (const [dr, dc] of DIRS) {
        let r = cur.r + dr;
        let c = cur.c + dc;
        while (isFreeOrTarget(board, r, c, target)) {
          const key = `${r},${c}`;
          if (!parent.has(key)) {
            parent.set(key, `${cur.r},${cur.c}`);
            if (r === target.r && c === target.c) return tracePath(parent, target);
            next.push({ r, c });
          }
          if (r === target.r && c === target.c) break;
          r += dr;
          c += dc;
        }
      }
    }
    frontier = next;
  }
  return null;
}

export function findAnyPair(board) {
  const bySymbol = new Map();
  board.forEach((row, r) => row.forEach((v, c) => {
    if (v === null) return;
    if (!bySymbol.has(v)) bySymbol.set(v, []);
    bySymbol.get(v).push({ r, c });
  }));
  for (const cells of bySymbol.values()) {
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        if (findPath(board, cells[i], cells[j])) return [cells[i], cells[j]];
      }
    }
  }
  return null;
}

export function shuffle(board, rng = Math.random) {
  const values = permute(board.flat().filter((v) => v !== null), rng);
  let i = 0;
  return board.map((row) => row.map((v) => (v === null ? null : values[i++])));
}

export function removePair(board, a, b) {
  return board.map((row, r) => row.map((v, c) =>
    ((r === a.r && c === a.c) || (r === b.r && c === b.c) ? null : v)));
}

export function isCleared(board) {
  return board.every((row) => row.every((v) => v === null));
}
