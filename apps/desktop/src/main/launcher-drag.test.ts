import assert from "node:assert/strict";
import { test } from "node:test";
import { LauncherDragSession } from "./launcher-drag.ts";

const bounds = { x: 700, y: 400, width: 108, height: 108 };
const area = { x: 0, y: 0, width: 1536, height: 824 };

test("click-sized movement does not reposition; dragging preserves the initial grab offset", () => {
  const drag = new LauncherDragSession();
  drag.start(1, { x: 740, y: 450 }, bounds);
  assert.equal(drag.move(1, { x: 743, y: 452 }, bounds, area), null);
  assert.deepEqual(drag.move(1, { x: 840, y: 550 }, bounds, area), { x: 800, y: 500 });
});

test("all four work-area edges are reachable and taskbar space is excluded", () => {
  const drag = new LauncherDragSession();
  drag.start(1, { x: 740, y: 450 }, bounds);
  for (const [cursor, expected] of [
    [{ x: 0, y: 0 }, { x: 0, y: 0 }],
    [{ x: 1535, y: 823 }, { x: 1428, y: 716 }],
    [{ x: -500, y: 1000 }, { x: 0, y: 716 }],
  ]) {
    assert.deepEqual(drag.move(1, cursor!, bounds, area), expected);
  }
});

test("negative-origin and fractional DIP coordinates stay inside the destination display", () => {
  const drag = new LauncherDragSession();
  drag.start(1, { x: 740.8, y: 450.4 }, bounds);
  const secondary = { x: -1280, y: -200, width: 1280, height: 984 };
  assert.deepEqual(drag.move(1, { x: -1279.2, y: -199.2 }, bounds, secondary), { x: -1280, y: -200 });
  assert.deepEqual(drag.move(1, { x: -1, y: 783 }, bounds, secondary), { x: -108, y: 676 });
});

test("release/cancel stop movement and a second drag starts with a new offset", () => {
  const drag = new LauncherDragSession();
  drag.start(1, { x: 740, y: 450 }, bounds);
  drag.end(2); // Another pointer cannot end this gesture.
  assert.notEqual(drag.move(1, { x: 840, y: 550 }, bounds, area), null);
  drag.end(1);
  assert.equal(drag.move(1, { x: 900, y: 600 }, bounds, area), null);
  drag.start(2, { x: 750, y: 460 }, bounds);
  assert.deepEqual(drag.move(2, { x: 850, y: 560 }, bounds, area), { x: 800, y: 500 });
  drag.cancel();
  assert.equal(drag.move(2, { x: 900, y: 600 }, bounds, area), null);
});

test("repeated drags do not accumulate offsets or reduce the reachable work area", () => {
  const drag = new LauncherDragSession();
  let current = { ...bounds };
  for (let pointerId = 1; pointerId <= 20; pointerId++) {
    drag.start(pointerId, { x: current.x + 40, y: current.y + 50 }, current);
    const atBottomRight = drag.move(pointerId, { x: 1535, y: 815 }, current, area);
    assert.deepEqual(atBottomRight, { x: 1428, y: 716 });
    const atTopLeft = drag.move(pointerId, { x: 0, y: 0 }, current, area);
    assert.deepEqual(atTopLeft, { x: 0, y: 0 });
    current = { ...current, ...atTopLeft };
    drag.end(pointerId);
  }
});
