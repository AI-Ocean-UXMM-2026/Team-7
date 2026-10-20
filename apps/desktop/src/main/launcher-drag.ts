type Point = { x: number; y: number };
type Rectangle = Point & { width: number; height: number };

// All inputs come from Electron's screen/window APIs in DIP coordinates.
export class LauncherDragSession {
  private gesture: {
    pointerId: number;
    start: Point;
    offset: Point;
    dragging: boolean;
  } | null = null;

  start(pointerId: number, cursor: Point, bounds: Rectangle) {
    this.gesture = {
      pointerId,
      start: cursor,
      offset: { x: cursor.x - bounds.x, y: cursor.y - bounds.y },
      dragging: false,
    };
  }

  move(pointerId: number, cursor: Point, size: Rectangle, area: Rectangle): Point | null {
    const gesture = this.gesture;
    if (!gesture || gesture.pointerId !== pointerId) return null;
    if (Math.hypot(cursor.x - gesture.start.x, cursor.y - gesture.start.y) >= 6) {
      gesture.dragging = true;
    }
    if (!gesture.dragging) return null;
    return {
      x: Math.round(Math.max(area.x, Math.min(cursor.x - gesture.offset.x,
        area.x + Math.max(0, area.width - size.width)))),
      y: Math.round(Math.max(area.y, Math.min(cursor.y - gesture.offset.y,
        area.y + Math.max(0, area.height - size.height)))),
    };
  }

  end(pointerId: number) {
    if (this.gesture?.pointerId === pointerId) this.cancel();
  }

  cancel() {
    this.gesture = null;
  }
}
