export function generateInitialPositions(count: number): string[] {
  const positions: string[] = [];
  for (let i = 0; i < count; i++) {
    const first = String.fromCharCode(97 + Math.floor(i / 26));
    const second = String.fromCharCode(97 + (i % 26));
    positions.push(first + second);
  }
  return positions;
}

export function getPositionBetween(before: string, after: string): string {
  const len = Math.max(before.length, after.length);
  const b = before.padEnd(len, "a");
  const a = after.padEnd(len, "a");

  for (let i = 0; i < len; i++) {
    const bc = b.charCodeAt(i);
    const ac = a.charCodeAt(i);
    const diff = ac - bc;

    if (diff >= 2) {
      return b.slice(0, i) + String.fromCharCode(Math.floor((bc + ac) / 2));
    }
    if (diff === 1) {
      return before + "a";
    }
  }

  return before + "a";
}

export function getPositionAtStart(firstPosition: string): string {
  if (firstPosition === "aa") return "a";
  const last = firstPosition.charCodeAt(firstPosition.length - 1);
  return firstPosition.slice(0, -1) + String.fromCharCode(last - 1);
}

export function getPositionAtEnd(lastPosition: string): string {
  const last = lastPosition.charCodeAt(lastPosition.length - 1);
  if (last >= 122) return lastPosition + "a";
  return lastPosition.slice(0, -1) + String.fromCharCode(last + 1);
}

export function needsRebalance(positions: string[]): boolean {
  return positions.some((p) => p.length > 20);
}

export function rebalancePositions(count: number): string[] {
  return generateInitialPositions(count);
}
