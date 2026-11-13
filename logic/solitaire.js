// Tri-Peaks solitaire: pure logic, no DOM. States are never mutated; every move returns a new state.

const ROW_SIZES = [3, 6, 9, 10];
const ROW_START = [0, 3, 9, 18];
const BOARD_SIZE = 28;
const POINTS_PER_CARD = 10;
const PEAK_BONUS = 50;
const STOCK_BONUS = 20;

function rowX(row, i) {
  if (row === 3) return i;
  if (row === 2) return i + 0.5;
  const p = row === 1 ? Math.floor(i / 2) : i;
  return row === 1 ? i + p + 1 : 3 * p + 1.5;
}

function coverOf(row, i) {
  if (row === 3) return [];
  if (row === 2) return [ROW_START[3] + i, ROW_START[3] + i + 1];
  if (row === 1) {
    const p = Math.floor(i / 2);
    return [ROW_START[2] + i + p, ROW_START[2] + i + p + 1];
  }
  return [ROW_START[1] + 2 * i, ROW_START[1] + 2 * i + 1];
}

export const LAYOUT = [];
export const COVERED_BY = [];
ROW_SIZES.forEach((size, row) => {
  for (let i = 0; i < size; i++) {
    LAYOUT.push({ row, x: rowX(row, i) });
    COVERED_BY.push(coverOf(row, i));
  }
});

export function makeDeck(rng = Math.random) {
  const deck = [];
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 1; rank <= 13; rank++) deck.push({ rank, suit });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function deal(deck) {
  const rest = deck.slice(BOARD_SIZE);
  return {
    board: deck.slice(0, BOARD_SIZE),
    stock: rest.slice(1),
    waste: [rest[0]],
    score: 0,
    streak: 1,
  };
}

export function isFree(state, i) {
  return state.board[i] != null && COVERED_BY[i].every((c) => state.board[c] == null);
}

export function isAdjacent(a, b) {
  const diff = Math.abs(a.rank - b.rank);
  return diff === 1 || diff === 12;
}

function wasteTop(state) {
  return state.waste[state.waste.length - 1];
}

export function canPlay(state, i) {
  const top = wasteTop(state);
  return isFree(state, i) && top != null && isAdjacent(state.board[i], top);
}

export function playCard(state, i) {
  if (!canPlay(state, i)) return null;
  const board = state.board.map((c, k) => (k === i ? null : c));
  let score = state.score + POINTS_PER_CARD * state.streak;
  if (LAYOUT[i].row === 0) score += PEAK_BONUS;
  if (board.every((c) => c == null)) score += STOCK_BONUS * state.stock.length;
  return {
    ...state,
    board,
    waste: [...state.waste, state.board[i]],
    score,
    streak: state.streak + 1,
  };
}

export function draw(state) {
  if (state.stock.length === 0) return null;
  return {
    ...state,
    stock: state.stock.slice(0, -1),
    waste: [...state.waste, state.stock[state.stock.length - 1]],
    streak: 1,
  };
}

export function isWon(state) {
  return state.board.every((c) => c == null);
}

export function isStuck(state) {
  if (isWon(state) || state.stock.length > 0) return false;
  return !state.board.some((_, i) => canPlay(state, i));
}
