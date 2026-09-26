import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../dist/home.js', import.meta.url), 'utf8');

function fixture({ reduced = false, width = 390 } = {}) {
  const events = () => ({
    listeners: new Map(),
    addEventListener(name, fn) { this.listeners.set(name, fn); },
    removeEventListener(name) { this.listeners.delete(name); },
    emit(name, value) { this.listeners.get(name)?.(value); },
  });
  const element = () => ({ ...events(), style: {}, clientWidth: 100,
    classList: { toggle() {} }, setAttribute() {},
    getBoundingClientRect: () => ({ width, height: 222, top: 1000 }), offsetHeight: 800,
  });
  const context = () => new Proxy({ paints: 0, clearRect() { this.paints++; },
    createRadialGradient: () => ({ addColorStop() {} }),
  }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  const front = context(), back = context(), canvas = { ...element(), getContext: () => front };
  const button = element(), stages = [element(), element(), element()];
  const media = { ...events(), matches: reduced }, compact = { ...events(), matches: width <= 760 };
  const document = { ...events(), hidden: false, documentElement: element(),
    querySelector: s => s === '#globe' ? canvas : s === '#motion-toggle' ? button : element(),
    querySelectorAll: () => stages,
    createElement: () => ({ getContext: () => back }),
  };
  const window = { ...events(), innerWidth: width, innerHeight: 844, devicePixelRatio: 3,
    matchMedia: s => s.includes('reduced-motion') ? media : compact,
  };
  let id = 0, observer, resizeObserver;
  const frames = new Map();
  vm.runInNewContext(source, { document, window,
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; },
    cancelAnimationFrame: frame => frames.delete(frame),
    IntersectionObserver: class { constructor(fn) { observer = fn; } observe() {} },
    ResizeObserver: class { constructor(fn) { resizeObserver = fn; } observe() {} },
  });
  return { front, back, canvas, button, document, window, frames, media,
    intersect: visible => observer([{ isIntersecting: visible }]),
    resize: () => resizeObserver(),
    tick(time) { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(time)); },
  };
}

test('mobile globe paints at 30 fps, caches gradients, and avoids redundant resize', () => {
  const f = fixture();
  assert.equal(f.canvas.width, 585, 'mobile backing resolution is capped at 1.5x');
  assert.equal(f.back.paints, 1);
  f.tick(100); const painted = f.front.paints;
  f.tick(116); assert.equal(f.front.paints, painted);
  f.tick(134); assert.equal(f.front.paints, painted + 1);
  f.resize(); f.window.emit('resize');
  assert.equal(f.back.paints, 1, 'unchanged bounds do not regenerate gradients');
  assert.equal(f.window.listeners.has('scroll'), false, 'mobile avoids narrative scroll work');
});

test('pause, offscreen, hidden tab, and page lifecycle stop and resume without duplicate loops', () => {
  const f = fixture();
  assert.equal(f.frames.size, 1);
  f.button.emit('click'); assert.equal(f.frames.size, 0); assert.equal(f.button.textContent, 'Play motion');
  f.button.emit('click'); assert.equal(f.frames.size, 1);
  f.intersect(false); assert.equal(f.frames.size, 0);
  f.intersect(true); f.intersect(true); assert.equal(f.frames.size, 1);
  f.document.hidden = true; f.document.emit('visibilitychange'); assert.equal(f.frames.size, 0);
  f.document.hidden = false; f.document.emit('visibilitychange'); assert.equal(f.frames.size, 1);
  f.window.emit('pagehide'); assert.equal(f.frames.size, 0);
  f.window.emit('pageshow'); assert.equal(f.frames.size, 1);
});

test('reduced motion starts with a visible static globe and allows explicit playback', () => {
  const f = fixture({ reduced: true });
  assert.ok(f.front.paints > 0);
  assert.equal(f.frames.size, 0);
  assert.equal(f.button.textContent, 'Play motion');
  f.button.emit('click'); assert.equal(f.frames.size, 1);
  f.media.emit('change', { matches: true }); assert.equal(f.frames.size, 0);
});
