// Deterministic orthogonal visibility routing around node interiors. Shared
// branch junctions are valid; crossing a label or an unrelated node is not.
export function routeConnector(start, end, obstacles, clearance = 8) {
  const xs = [...new Set([start.x, end.x, ...obstacles.flatMap((r) => [r.x - clearance, r.x + r.width + clearance])])].sort((a, b) => a - b);
  const ys = [...new Set([start.y, end.y, ...obstacles.flatMap((r) => [r.y - clearance, r.y + r.height + clearance])])].sort((a, b) => a - b);
  const blocked = (a, b) => obstacles.some((r) => a.x === b.x
    ? a.x > r.x + 0.01 && a.x < r.x + r.width - 0.01 && Math.max(a.y, b.y) > r.y + 0.01 && Math.min(a.y, b.y) < r.y + r.height - 0.01
    : a.y > r.y + 0.01 && a.y < r.y + r.height - 0.01 && Math.max(a.x, b.x) > r.x + 0.01 && Math.min(a.x, b.x) < r.x + r.width - 0.01);
  const key = (x, y, direction) => `${x},${y},${direction}`;
  const first = { x: xs.indexOf(start.x), y: ys.indexOf(start.y), direction: "", cost: 0, path: [start] };
  const queue = [first], costs = new Map([[key(first.x, first.y, ""), 0]]);
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift();
    const point = { x: xs[current.x], y: ys[current.y] };
    if (point.x === end.x && point.y === end.y) return current.path.filter((p, i, path) => i === 0 || i === path.length - 1 || !((path[i - 1].x === p.x && p.x === path[i + 1].x) || (path[i - 1].y === p.y && p.y === path[i + 1].y)));
    for (const [dx, dy, direction] of [[1, 0, "h"], [-1, 0, "h"], [0, 1, "v"], [0, -1, "v"]]) {
      const x = current.x + dx, y = current.y + dy;
      if (x < 0 || y < 0 || x >= xs.length || y >= ys.length) continue;
      const next = { x: xs[x], y: ys[y] };
      if (blocked(point, next)) continue;
      const cost = current.cost + Math.abs(point.x - next.x) + Math.abs(point.y - next.y) + (current.direction && current.direction !== direction ? clearance : 0);
      const id = key(x, y, direction);
      if (cost >= (costs.get(id) ?? Infinity)) continue;
      costs.set(id, cost);
      queue.push({ x, y, direction, cost, path: [...current.path, next] });
    }
  }
  throw new Error("No collision-free connector route; revise the organization layout");
}
