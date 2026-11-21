import { TAP_SLOP_PX, createTapTracker } from '../domain/gesture';

describe('tap tracker', () => {
  it('reports a tap where a single pointer went down and up in place', () => {
    const tracker = createTapTracker();
    tracker.down(1, 100, 200);
    expect(tracker.up(1, 100, 200)).toEqual({ x: 100, y: 200 });
  });

  it('allows a little jitter, measured from where the pointer went down', () => {
    const tracker = createTapTracker();
    tracker.down(1, 100, 200);
    tracker.move(1, 100 + TAP_SLOP_PX - 1, 200);
    expect(tracker.up(1, 100, 200 + TAP_SLOP_PX - 1)).toEqual({ x: 100, y: 200 + TAP_SLOP_PX - 1 });
  });

  it('never reports a drag, however slowly it moved', () => {
    // three-render-objects only calls a touch move a drag when one event
    // moves more than 1 px; a slow drag made of 1 px steps slips through.
    const tracker = createTapTracker();
    tracker.down(1, 100, 200);
    for (let x = 101; x <= 140; x++) tracker.move(1, x, 200);
    expect(tracker.up(1, 140, 200)).toBeNull();
  });

  it('never reports a drag that came back to where it started', () => {
    const tracker = createTapTracker();
    tracker.down(1, 100, 200);
    tracker.move(1, 160, 200);
    tracker.move(1, 100, 200);
    expect(tracker.up(1, 100, 200)).toBeNull();
  });

  it('measures a move that only shows up in the final pointerup', () => {
    const tracker = createTapTracker();
    tracker.down(1, 100, 200);
    expect(tracker.up(1, 100, 200 + TAP_SLOP_PX + 1)).toBeNull();
  });

  it('never reports a pinch, even when neither finger travels far', () => {
    const tracker = createTapTracker();
    tracker.down(1, 100, 200);
    tracker.down(2, 300, 200);
    expect(tracker.up(1, 100, 200)).toBeNull();
    expect(tracker.up(2, 300, 200)).toBeNull();
  });

  it('does not let the second finger of a pinch end as a tap', () => {
    // One finger lifts, the other stays and lifts later without moving.
    const tracker = createTapTracker();
    tracker.down(1, 100, 200);
    tracker.down(2, 300, 200);
    tracker.up(2, 300, 200);
    expect(tracker.up(1, 100, 200)).toBeNull();
  });

  it('never reports a gesture the browser cancelled', () => {
    const tracker = createTapTracker();
    tracker.down(1, 100, 200);
    tracker.cancel(1);
    expect(tracker.up(1, 100, 200)).toBeNull();
  });

  it('starts afresh after every gesture', () => {
    const tracker = createTapTracker();
    tracker.down(1, 0, 0);
    tracker.move(1, 50, 0);
    expect(tracker.up(1, 50, 0)).toBeNull();
    tracker.down(2, 10, 10);
    expect(tracker.up(2, 10, 10)).toEqual({ x: 10, y: 10 });
    tracker.down(3, 0, 0);
    tracker.down(4, 9, 9);
    tracker.up(3, 0, 0);
    tracker.up(4, 9, 9);
    tracker.down(5, 20, 20);
    expect(tracker.up(5, 20, 20)).toEqual({ x: 20, y: 20 });
  });

  it('ignores moves and ups of pointers it never saw go down', () => {
    // A mouse hovering in from outside, or a pointer that went down before
    // the globe mounted.
    const tracker = createTapTracker();
    tracker.move(7, 10, 10);
    expect(tracker.up(7, 10, 10)).toBeNull();
    tracker.down(1, 0, 0);
    tracker.move(7, 500, 500);
    expect(tracker.up(1, 0, 0)).toEqual({ x: 0, y: 0 });
  });
});
