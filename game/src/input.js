// input.js — keyboard + mouse state for EMBERFALL.
// Tracks held keys, edge-triggered presses, and mouse position in canvas pixels.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 640, y: 380, down: false, clicked: false, clickX: 0, clickY: 0 };

  function toLocal(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / Math.max(1, r.width)),
      y: (e.clientY - r.top) * (canvas.height / Math.max(1, r.height)),
    };
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' || e.code === 'Space') {
      e.preventDefault();
    }
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });

  canvas.addEventListener('mousemove', (e) => {
    const p = toLocal(e);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (e) => {
    const p = toLocal(e);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.down = true;
    mouse.clicked = true;
    mouse.clickX = p.x;
    mouse.clickY = p.y;
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys,
    mouse,
    down(code) {
      return keys.has(code);
    },
    // True once per physical press; consumes the press.
    wasPressed(code) {
      if (pressed.has(code)) {
        pressed.delete(code);
        return true;
      }
      return false;
    },
    // True once per click; returns the click position in canvas pixels.
    consumeClick() {
      if (mouse.clicked) {
        mouse.clicked = false;
        return { x: mouse.clickX, y: mouse.clickY };
      }
      return null;
    },
    // Drop unhandled presses/clicks at the end of each frame.
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
