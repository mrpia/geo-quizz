/**
 * How far a pointer may travel between going down and coming up and still
 * count as a tap, in CSS pixels. A chosen value, not a platform constant:
 * enough for a finger that rolls slightly, far below any deliberate drag.
 * Check it on the tablet.
 */
export const TAP_SLOP_PX = 10;

export type Point = { x: number; y: number };

export type TapTracker = {
  down(pointerId: number, x: number, y: number): void;
  move(pointerId: number, x: number, y: number): void;
  /** The tap's position when this was the last pointer up and the gesture was a tap. */
  up(pointerId: number, x: number, y: number): Point | null;
  cancel(pointerId: number): void;
};

/**
 * Tells a tap from a drag or a pinch, over one gesture: from the first
 * pointer down to the last pointer up. A tap is one pointer that never left
 * a `TAP_SLOP_PX` circle around where it went down. Distance is measured
 * from that start point on every event, so a slow drag made of many tiny
 * steps still counts as a drag (three-render-objects only looks at each
 * event's own movement on touch). A second pointer at any time makes the
 * whole gesture a pinch, and a cancelled pointer (the browser took over the
 * gesture) spoils it too.
 */
export const createTapTracker = (): TapTracker => {
  const starts = new Map<number, Point>();
  let spoiled = false;

  const strays = (pointerId: number, x: number, y: number): boolean => {
    const start = starts.get(pointerId);
    return start !== undefined && Math.hypot(x - start.x, y - start.y) > TAP_SLOP_PX;
  };

  return {
    down(pointerId, x, y) {
      // The first pointer starts a new gesture; any further one makes it a pinch.
      spoiled = starts.size > 0;
      starts.set(pointerId, { x, y });
    },
    move(pointerId, x, y) {
      if (strays(pointerId, x, y)) spoiled = true;
    },
    up(pointerId, x, y) {
      if (!starts.has(pointerId)) return null;
      if (strays(pointerId, x, y)) spoiled = true;
      starts.delete(pointerId);
      return starts.size === 0 && !spoiled ? { x, y } : null;
    },
    cancel(pointerId) {
      if (!starts.delete(pointerId)) return;
      spoiled = true;
    },
  };
};
