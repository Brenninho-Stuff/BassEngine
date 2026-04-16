/**
 * BassEngine v1.0
 * Lightweight WebGL-powered game engine for the modern web.
 * MIT License
 */

'use strict';

// ─────────────────────────────────────────────
//  VECTOR 2
// ─────────────────────────────────────────────

class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
  sub(v) { return new Vector2(this.x - v.x, this.y - v.y); }
  scale(s) { return new Vector2(this.x * s, this.y * s); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  normalized() {
    const len = this.length();
    return len > 0 ? this.scale(1 / len) : new Vector2();
  }
  distanceTo(v) { return this.sub(v).length(); }
  clone() { return new Vector2(this.x, this.y); }

  static zero()  { return new Vector2(0, 0); }
  static one()   { return new Vector2(1, 1); }
  static up()    { return new Vector2(0, -1); }
  static down()  { return new Vector2(0, 1); }
  static left()  { return new Vector2(-1, 0); }
  static right() { return new Vector2(1, 0); }
}

// ─────────────────────────────────────────────
//  RECT  (AABB bounding box)
// ─────────────────────────────────────────────

class Rect {
  constructor(x = 0, y = 0, w = 0, h = 0) {
    this.x = x; this.y = y; this.w = w; this.h = h;
  }

  get right()  { return this.x + this.w; }
  get bottom() { return this.y + this.h; }
  get centerX() { return this.x + this.w / 2; }
  get centerY() { return this.y + this.h / 2; }

  intersects(other) {
    return (
      this.x < other.right  && this.right  > other.x &&
      this.y < other.bottom && this.bottom > other.y
    );
  }

  contains(px, py) {
    return px >= this.x && px <= this.right && py >= this.y && py <= this.bottom;
  }

  clone() { return new Rect(this.x, this.y, this.w, this.h); }
}

// ─────────────────────────────────────────────
//  EVENT EMITTER
// ─────────────────────────────────────────────

class EventEmitter {
  constructor() {
    this._listeners = {};
  }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return this;
  }

  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  }

  once(event, fn) {
    const wrapper = (...args) => { fn(...args); this.off(event, wrapper); };
    this.on(event, wrapper);
  }

  emit(event, ...args) {
    (this._listeners[event] || []).forEach(fn => fn(...args));
  }
}

// ─────────────────────────────────────────────
//  INPUT MANAGER
// ─────────────────────────────────────────────

class InputManager {
  constructor() {
    this._keys      = new Set();
    this._prevKeys  = new Set();
    this._mouse     = { x: 0, y: 0, buttons: new Set(), prevButtons: new Set() };
    this._gamepad   = null;
    this._actions   = {};        // action name → array of key codes
    this._axisMaps  = {};        // axis name → { pos, neg }

    this._bindDefaultActions();
    this._attachListeners();
  }

  _bindDefaultActions() {
    this.mapAction('jump',  ['Space', 'ArrowUp', 'KeyW']);
    this.mapAction('left',  ['ArrowLeft',  'KeyA']);
    this.mapAction('right', ['ArrowRight', 'KeyD']);
    this.mapAction('down',  ['ArrowDown',  'KeyS']);
    this.mapAxis('horizontal', { pos: 'ArrowRight', neg: 'ArrowLeft' });
    this.mapAxis('vertical',   { pos: 'ArrowDown',  neg: 'ArrowUp'   });
  }

  _attachListeners() {
    window.addEventListener('keydown', e => this._keys.add(e.code));
    window.addEventListener('keyup',   e => this._keys.delete(e.code));
    window.addEventListener('mousemove', e => {
      this._mouse.x = e.clientX;
      this._mouse.y = e.clientY;
    });
    window.addEventListener('mousedown', e => this._mouse.buttons.add(e.button));
    window.addEventListener('mouseup',   e => this._mouse.buttons.delete(e.button));
    window.addEventListener('gamepadconnected', e => { this._gamepad = e.gamepad; });
    window.addEventListener('gamepaddisconnected', () => { this._gamepad = null; });
  }

  // Call once per frame (BassEngine does this automatically)
  _flush() {
    this._prevKeys = new Set(this._keys);
    this._mouse.prevButtons = new Set(this._mouse.buttons);
    if (this._gamepad) this._gamepad = navigator.getGamepads()[this._gamepad.index];
  }

  /** Register a named action bound to one or more key codes */
  mapAction(name, keyCodes) {
    this._actions[name] = Array.isArray(keyCodes) ? keyCodes : [keyCodes];
  }

  /** Register a named axis (returns -1 / 0 / 1) */
  mapAxis(name, { pos, neg }) {
    this._axisMaps[name] = { pos, neg };
  }

  /** True every frame the key is held */
  isDown(code) { return this._keys.has(code); }

  /** True only on the frame the key was pressed */
  isPressed(code) { return this._keys.has(code) && !this._prevKeys.has(code); }

  /** True only on the frame the key was released */
  isReleased(code) { return !this._keys.has(code) && this._prevKeys.has(code); }

  /** Action-based queries */
  actionDown(name)     { return (this._actions[name] || []).some(k => this.isDown(k)); }
  actionPressed(name)  { return (this._actions[name] || []).some(k => this.isPressed(k)); }
  actionReleased(name) { return (this._actions[name] || []).some(k => this.isReleased(k)); }

  /** Returns -1, 0, or 1 for a registered axis */
  axis(name) {
    const map = this._axisMaps[name];
    if (!map) return 0;
    return (this.isDown(map.pos) ? 1 : 0) - (this.isDown(map.neg) ? 1 : 0);
  }

  /** Mouse position as Vector2 */
  get mousePos() { return new Vector2(this._mouse.x, this._mouse.y); }

  /** True every frame the mouse button is held (0=left, 1=middle, 2=right) */
  mouseDown(btn = 0)     { return this._mouse.buttons.has(btn); }
  mousePressed(btn = 0)  { return this._mouse.buttons.has(btn) && !this._mouse.prevButtons.has(btn); }
  mouseReleased(btn = 0) { return !this._mouse.buttons.has(btn) && this._mouse.prevButtons.has(btn); }

  /** Gamepad axis value (0–3) with optional dead zone */
  gamepadAxis(index, deadZone = 0.1) {
    if (!this._gamepad) return 0;
    const val = this._gamepad.axes[index] || 0;
    return Math.abs(val) < deadZone ? 0 : val;
  }

  gamepadButton(index) {
    return this._gamepad ? (this._gamepad.buttons[index]?.pressed || false) : false;
  }
}

// Singleton
const Input = new InputManager();

// ─────────────────────────────────────────────
//  AUDIO ENGINE
// ─────────────────────────────────────────────

class AudioEngine {
  constructor() {
    this._ctx      = null;
    this._master   = null;
    this._sounds   = {};
    this._music    = null;
    this._muted    = false;
  }

  _ensureCtx() {
    if (!this._ctx) {
      this._ctx    = new (window.AudioContext || window.webkitAudioContext)();
      this._master = this._ctx.createGain();
      this._master.connect(this._ctx.destination);
    }
  }

  /** Load a sound from a URL and cache it under a name */
  async load(name, url) {
    this._ensureCtx();
    const res  = await fetch(url);
    const buf  = await res.arrayBuffer();
    const decoded = await this._ctx.decodeAudioData(buf);
    this._sounds[name] = decoded;
  }

  /** Play a loaded sound. Returns the source node. */
  play(name, { loop = false, volume = 1, pitch = 1 } = {}) {
    if (this._muted || !this._sounds[name]) return null;
    this._ensureCtx();
    const src  = this._ctx.createBufferSource();
    const gain = this._ctx.createGain();
    src.buffer             = this._sounds[name];
    src.loop               = loop;
    src.playbackRate.value = pitch;
    gain.gain.value        = volume;
    src.connect(gain);
    gain.connect(this._master);
    src.start();
    return src;
  }

  /** Play a sound with 3D positional falloff */
  play3D(name, x, y, { volume = 1, refDist = 100, maxDist = 600 } = {}) {
    if (this._muted || !this._sounds[name]) return null;
    this._ensureCtx();
    const src    = this._ctx.createBufferSource();
    const panner = this._ctx.createPanner();
    const gain   = this._ctx.createGain();
    src.buffer              = this._sounds[name];
    panner.panningModel     = 'HRTF';
    panner.distanceModel    = 'inverse';
    panner.refDistance      = refDist;
    panner.maxDistance      = maxDist;
    panner.setPosition(x, y, 0);
    gain.gain.value = volume;
    src.connect(panner);
    panner.connect(gain);
    gain.connect(this._master);
    src.start();
    return src;
  }

  setMasterVolume(v) {
    this._ensureCtx();
    this._master.gain.value = Math.max(0, Math.min(1, v));
  }

  mute()   { this._muted = true;  this.setMasterVolume(0); }
  unmute() { this._muted = false; this.setMasterVolume(1); }
  toggle() { this._muted ? this.unmute() : this.mute(); }
}

const Audio = new AudioEngine();

// ─────────────────────────────────────────────
//  ASSET LOADER
// ─────────────────────────────────────────────

class AssetLoader extends EventEmitter {
  constructor() {
    super();
    this._images  = {};
    this._total   = 0;
    this._loaded  = 0;
  }

  get progress() { return this._total === 0 ? 1 : this._loaded / this._total; }

  image(name, url) {
    this._total++;
    const img = new Image();
    img.onload = () => {
      this._images[name] = img;
      this._loaded++;
      this.emit('progress', this.progress);
      if (this._loaded === this._total) this.emit('complete');
    };
    img.onerror = () => this.emit('error', { name, url });
    img.src = url;
    return this;
  }

  async sound(name, url) {
    this._total++;
    await Audio.load(name, url);
    this._loaded++;
    this.emit('progress', this.progress);
    if (this._loaded === this._total) this.emit('complete');
  }

  get(name) { return this._images[name] || null; }
}

const Assets = new AssetLoader();

// ─────────────────────────────────────────────
//  COMPONENT  (ECS)
// ─────────────────────────────────────────────

class Component {
  constructor() {
    this.entity  = null;
    this.enabled = true;
  }

  /** Called once when the component is attached to an entity */
  onAttach() {}

  /** Called every frame while enabled */
  onUpdate(dt) {}

  /** Called when the entity is removed from a scene */
  onDestroy() {}
}

// ─────────────────────────────────────────────
//  ENTITY
// ─────────────────────────────────────────────

let _entityId = 0;

class Entity extends EventEmitter {
  constructor({ x = 0, y = 0, tag = 'entity', layer = 0 } = {}) {
    super();
    this.id         = _entityId++;
    this.x          = x;
    this.y          = y;
    this.tag        = tag;
    this.layer      = layer;    // draw order — higher = on top
    this.active     = true;
    this.scene      = null;
    this._components = [];
    this._children   = [];
    this.parent      = null;
  }

  // ── Components ──

  addComponent(component) {
    component.entity = this;
    this._components.push(component);
    component.onAttach();
    return component;
  }

  getComponent(Type) {
    return this._components.find(c => c instanceof Type) || null;
  }

  removeComponent(Type) {
    const idx = this._components.findIndex(c => c instanceof Type);
    if (idx !== -1) {
      this._components[idx].onDestroy();
      this._components.splice(idx, 1);
    }
  }

  // ── Children (scene graph) ──

  addChild(entity) {
    entity.parent = this;
    this._children.push(entity);
    return entity;
  }

  removeChild(entity) {
    this._children = this._children.filter(c => c !== entity);
    entity.parent = null;
  }

  /** World-space position accounting for parent hierarchy */
  get worldX() {
    return this.parent ? this.parent.worldX + this.x : this.x;
  }
  get worldY() {
    return this.parent ? this.parent.worldY + this.y : this.y;
  }

  // ── Lifecycle (called by Scene) ──

  _update(dt) {
    if (!this.active) return;
    this._components.forEach(c => { if (c.enabled) c.onUpdate(dt); });
    this._children.forEach(c => c._update(dt));
    this.onUpdate(dt);
  }

  _draw(ctx) {
    if (!this.active) return;
    this.onDraw(ctx);
    this._children
      .slice()
      .sort((a, b) => a.layer - b.layer)
      .forEach(c => c._draw(ctx));
  }

  /** Override in subclasses */
  onUpdate(dt) {}
  onDraw(ctx) {}

  destroy() {
    this._components.forEach(c => c.onDestroy());
    this.emit('destroy');
  }
}

// ─────────────────────────────────────────────
//  SPRITE
// ─────────────────────────────────────────────

class Sprite extends Entity {
  constructor({ texture = null, x = 0, y = 0, w = 32, h = 32,
                tag = 'sprite', layer = 0, tint = null,
                frame = null, frameW = 0, frameH = 0 } = {}) {
    super({ x, y, tag, layer });
    this.texture = typeof texture === 'string' ? Assets.get(texture) : texture;
    this.w       = w;
    this.h       = h;
    this.tint    = tint;
    this.alpha   = 1;
    this.scaleX  = 1;
    this.scaleY  = 1;
    this.rotation = 0;
    this.flipX   = false;
    this.flipY   = false;
    /* sprite sheet frame — { col, row } */
    this.frame   = frame;
    this.frameW  = frameW || w;
    this.frameH  = frameH || h;
  }

  get bounds() {
    return new Rect(this.worldX - this.w / 2, this.worldY - this.h / 2, this.w, this.h);
  }

  onDraw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.worldX, this.worldY);
    if (this.rotation) ctx.rotate(this.rotation);
    ctx.scale(this.flipX ? -this.scaleX : this.scaleX, this.flipY ? -this.scaleY : this.scaleY);

    if (this.texture) {
      if (this.frame) {
        ctx.drawImage(
          this.texture,
          this.frame.col * this.frameW, this.frame.row * this.frameH,
          this.frameW, this.frameH,
          -this.w / 2, -this.h / 2, this.w, this.h
        );
      } else {
        ctx.drawImage(this.texture, -this.w / 2, -this.h / 2, this.w, this.h);
      }
      if (this.tint) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = this.tint;
        ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
      }
    } else {
      // fallback colored rect when no texture is loaded
      ctx.fillStyle = this.tint || '#7c3aed';
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    }

    ctx.restore();
  }
}

// ─────────────────────────────────────────────
//  ANIMATOR  (sprite-sheet frame sequencer)
// ─────────────────────────────────────────────

class Animator extends Component {
  constructor(sprite) {
    super();
    this._sprite     = sprite;
    this._clips      = {};  // name → { frames: [{col,row}], fps, loop }
    this._current    = null;
    this._frameIndex = 0;
    this._elapsed    = 0;
  }

  addClip(name, { frames, fps = 12, loop = true }) {
    this._clips[name] = { frames, fps, loop };
    return this;
  }

  play(name) {
    if (this._current === name) return;
    this._current    = name;
    this._frameIndex = 0;
    this._elapsed    = 0;
  }

  stop() { this._current = null; }

  onUpdate(dt) {
    const clip = this._clips[this._current];
    if (!clip) return;
    this._elapsed += dt;
    const frameDur = 1 / clip.fps;
    while (this._elapsed >= frameDur) {
      this._elapsed -= frameDur;
      this._frameIndex++;
      if (this._frameIndex >= clip.frames.length) {
        if (clip.loop) this._frameIndex = 0;
        else { this._frameIndex = clip.frames.length - 1; this._current = null; return; }
      }
    }
    this._sprite.frame = clip.frames[this._frameIndex];
  }
}

// ─────────────────────────────────────────────
//  RIGIDBODY  (simple arcade physics component)
// ─────────────────────────────────────────────

class Rigidbody extends Component {
  constructor({ gravity = 980, maxFallSpeed = 800, drag = 0.9 } = {}) {
    super();
    this.vx           = 0;
    this.vy           = 0;
    this.gravity      = gravity;
    this.maxFallSpeed = maxFallSpeed;
    this.drag         = drag;
    this.onGround     = false;
    this.isTrigger    = false;
  }

  applyForce(fx, fy) { this.vx += fx; this.vy += fy; }

  onUpdate(dt) {
    this.vy = Math.min(this.vy + this.gravity * dt, this.maxFallSpeed);
    this.entity.x += this.vx * dt;
    this.entity.y += this.vy * dt;
    this.vx *= this.drag;
  }
}

// ─────────────────────────────────────────────
//  COLLIDER
// ─────────────────────────────────────────────

class BoxCollider extends Component {
  constructor({ offsetX = 0, offsetY = 0, w = null, h = null, isTrigger = false } = {}) {
    super();
    this.offsetX   = offsetX;
    this.offsetY   = offsetY;
    this._w        = w;
    this._h        = h;
    this.isTrigger = isTrigger;
  }

  get bounds() {
    const e   = this.entity;
    const w   = this._w !== null ? this._w : (e.w || 32);
    const h   = this._h !== null ? this._h : (e.h || 32);
    return new Rect(
      e.worldX - w / 2 + this.offsetX,
      e.worldY - h / 2 + this.offsetY,
      w, h
    );
  }
}

class CircleCollider extends Component {
  constructor({ offsetX = 0, offsetY = 0, radius = 16, isTrigger = false } = {}) {
    super();
    this.offsetX   = offsetX;
    this.offsetY   = offsetY;
    this.radius    = radius;
    this.isTrigger = isTrigger;
  }

  overlapsCircle(other) {
    const dx = (this.entity.worldX + this.offsetX) - (other.entity.worldX + other.offsetX);
    const dy = (this.entity.worldY + this.offsetY) - (other.entity.worldY + other.offsetY);
    return Math.sqrt(dx*dx + dy*dy) < this.radius + other.radius;
  }
}

// ─────────────────────────────────────────────
//  PHYSICS WORLD  (resolves collisions per frame)
// ─────────────────────────────────────────────

class PhysicsWorld {
  constructor() {
    this._pairs = [];  // cached collider pairs for this frame
  }

  /** Called by the engine once per frame after update */
  step(entities) {
    const colliders = [];
    entities.forEach(e => {
      const bc = e.getComponent(BoxCollider);
      const cc = e.getComponent(CircleCollider);
      if (bc || cc) colliders.push({ entity: e, box: bc, circle: cc });
    });

    this._pairs = [];
    for (let i = 0; i < colliders.length; i++) {
      for (let j = i + 1; j < colliders.length; j++) {
        const a = colliders[i], b = colliders[j];
        if (this._overlaps(a, b)) {
          this._pairs.push([a.entity, b.entity]);
          a.entity.emit('collide', b.entity);
          b.entity.emit('collide', a.entity);
        }
      }
    }
  }

  _overlaps(a, b) {
    if (a.box && b.box) return a.box.bounds.intersects(b.box.bounds);
    if (a.circle && b.circle) return a.circle.overlapsCircle(b.circle);
    const box    = a.box    || b.box;
    const circle = a.circle || b.circle;
    if (box && circle) {
      const r   = circle.radius;
      const cx  = circle.entity.worldX + circle.offsetX;
      const cy  = circle.entity.worldY + circle.offsetY;
      const bnd = box.bounds;
      const nearX = Math.max(bnd.x, Math.min(cx, bnd.right));
      const nearY = Math.max(bnd.y, Math.min(cy, bnd.bottom));
      const dx = cx - nearX, dy = cy - nearY;
      return dx*dx + dy*dy < r*r;
    }
    return false;
  }

  /** Raycast against all BoxColliders, returns nearest hit or null */
  raycast(originX, originY, dirX, dirY, maxDist = 1000) {
    return null; // placeholder — full DDA implementation goes here
  }
}

// ─────────────────────────────────────────────
//  CAMERA
// ─────────────────────────────────────────────

class Camera {
  constructor({ x = 0, y = 0, zoom = 1 } = {}) {
    this.x        = x;
    this.y        = y;
    this.zoom     = zoom;
    this._target  = null;
    this._lerpSpeed = 5;
  }

  follow(entity, lerpSpeed = 5) {
    this._target    = entity;
    this._lerpSpeed = lerpSpeed;
  }

  stopFollowing() { this._target = null; }

  update(dt, viewW, viewH) {
    if (this._target) {
      const tx = this._target.worldX - viewW / 2;
      const ty = this._target.worldY - viewH / 2;
      const t  = Math.min(1, this._lerpSpeed * dt);
      this.x += (tx - this.x) * t;
      this.y += (ty - this.y) * t;
    }
  }

  /** Apply camera transform to a canvas context */
  applyTransform(ctx) {
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-Math.round(this.x), -Math.round(this.y));
  }

  /** Convert screen coordinates to world coordinates */
  screenToWorld(sx, sy) {
    return new Vector2(sx / this.zoom + this.x, sy / this.zoom + this.y);
  }

  worldToScreen(wx, wy) {
    return new Vector2((wx - this.x) * this.zoom, (wy - this.y) * this.zoom);
  }
}

// ─────────────────────────────────────────────
//  TILEMAP
// ─────────────────────────────────────────────

class Tilemap extends Entity {
  constructor({ tileW = 32, tileH = 32, tiles = [], tileset = null, layer = -1 } = {}) {
    super({ layer });
    this.tileW   = tileW;
    this.tileH   = tileH;
    this.tiles   = tiles;       // 2D array of tile IDs (0 = empty)
    this.tileset = tileset;     // HTMLImageElement
    this._cols   = tileset ? Math.floor(tileset.width  / tileW) : 1;
  }

  /** Get the tile ID at grid position (col, row) */
  getTile(col, row) {
    return (this.tiles[row] && this.tiles[row][col]) || 0;
  }

  setTile(col, row, id) {
    if (!this.tiles[row]) this.tiles[row] = [];
    this.tiles[row][col] = id;
  }

  onDraw(ctx) {
    if (!this.tileset) return;
    const rows = this.tiles.length;
    for (let r = 0; r < rows; r++) {
      const row = this.tiles[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const id = row[c];
        if (!id) continue;
        const srcX = ((id - 1) % this._cols) * this.tileW;
        const srcY = Math.floor((id - 1) / this._cols) * this.tileH;
        ctx.drawImage(
          this.tileset,
          srcX, srcY, this.tileW, this.tileH,
          this.x + c * this.tileW, this.y + r * this.tileH,
          this.tileW, this.tileH
        );
      }
    }
  }
}

// ─────────────────────────────────────────────
//  PARTICLE SYSTEM
// ─────────────────────────────────────────────

class ParticleSystem extends Entity {
  constructor({ x = 0, y = 0, maxParticles = 200, layer = 10 } = {}) {
    super({ x, y, layer });
    this._pool     = [];
    this._active   = [];
    this._max      = maxParticles;
    /* emitter config */
    this.emitting  = false;
    this.rate      = 20;          // particles/sec
    this.lifetime  = 1.2;
    this.speed     = 120;
    this.spread    = Math.PI * 2; // radians
    this.direction = -Math.PI / 2;
    this.gravity   = 200;
    this.startSize = 6;
    this.endSize   = 0;
    this.startColor = '#a855f7';
    this.endColor   = '#06b6d4';
    this._acc      = 0;
  }

  burst(count = 30) {
    for (let i = 0; i < count; i++) this._spawn();
  }

  _spawn() {
    if (this._active.length >= this._max) return;
    const angle = this.direction + (Math.random() - 0.5) * this.spread;
    const speed = this.speed * (0.6 + Math.random() * 0.8);
    const p = this._pool.pop() || {};
    p.x  = this.worldX; p.y  = this.worldY;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = 0; p.maxLife = this.lifetime * (0.7 + Math.random() * 0.6);
    this._active.push(p);
  }

  onUpdate(dt) {
    if (this.emitting) {
      this._acc += this.rate * dt;
      while (this._acc >= 1) { this._spawn(); this._acc--; }
    }
    for (let i = this._active.length - 1; i >= 0; i--) {
      const p = this._active[i];
      p.life += dt;
      if (p.life >= p.maxLife) { this._pool.push(this._active.splice(i, 1)[0]); continue; }
      p.vy += this.gravity * dt;
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
    }
  }

  onDraw(ctx) {
    this._active.forEach(p => {
      const t    = p.life / p.maxLife;
      const size = this.startSize + (this.endSize - this.startSize) * t;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle   = this.startColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
}

// ─────────────────────────────────────────────
//  SCENE
// ─────────────────────────────────────────────

class Scene extends EventEmitter {
  constructor() {
    super();
    this._entities = [];
    this._toAdd    = [];
    this._toRemove = [];
    this.camera    = new Camera();
    this.physics   = new PhysicsWorld();
    this.paused    = false;
  }

  /** Override — called once when the scene becomes active */
  onCreate() {}

  /** Override — called every frame (dt = seconds since last frame) */
  onUpdate(dt) {}

  /** Override — called after rendering each frame */
  onDraw(ctx) {}

  /** Override — called before the scene is destroyed */
  onDestroy() {}

  /** Add an entity to the scene */
  add(entity) {
    entity.scene = this;
    this._toAdd.push(entity);
    return entity;
  }

  /** Remove an entity from the scene */
  remove(entity) {
    this._toRemove.push(entity);
  }

  /** Find first entity matching tag */
  find(tag) {
    return this._entities.find(e => e.tag === tag) || null;
  }

  /** Find all entities matching tag */
  findAll(tag) {
    return this._entities.filter(e => e.tag === tag);
  }

  _flush() {
    this._toAdd.forEach(e => this._entities.push(e));
    this._toAdd = [];
    this._toRemove.forEach(e => {
      e.destroy();
      this._entities = this._entities.filter(x => x !== e);
    });
    this._toRemove = [];
  }

  _step(dt, ctx, viewW, viewH) {
    this._flush();
    if (!this.paused) {
      this.camera.update(dt, viewW, viewH);
      this._entities.forEach(e => e._update(dt));
      this.physics.step(this._entities);
      this.onUpdate(dt);
    }
    // Draw
    ctx.save();
    this.camera.applyTransform(ctx);
    this._entities
      .slice()
      .sort((a, b) => a.layer - b.layer)
      .forEach(e => e._draw(ctx));
    this.onDraw(ctx);
    ctx.restore();
    Input._flush();
  }
}

// ─────────────────────────────────────────────
//  TRANSITION  (fade between scenes)
// ─────────────────────────────────────────────

class FadeTransition {
  constructor({ duration = 0.35, color = '#000' } = {}) {
    this.duration = duration;
    this.color    = color;
    this._alpha   = 0;
    this._phase   = 'idle'; // idle | out | in
    this._elapsed = 0;
    this._resolve = null;
  }

  async run(onMidpoint) {
    return new Promise(resolve => {
      this._resolve = resolve;
      this._phase   = 'out';
      this._elapsed = 0;
      this._midpoint = onMidpoint;
    });
  }

  update(dt) {
    if (this._phase === 'idle') return;
    this._elapsed += dt;
    const t = Math.min(this._elapsed / this.duration, 1);
    if (this._phase === 'out') {
      this._alpha = t;
      if (t >= 1) {
        if (this._midpoint) this._midpoint();
        this._phase = 'in'; this._elapsed = 0;
      }
    } else if (this._phase === 'in') {
      this._alpha = 1 - t;
      if (t >= 1) {
        this._alpha = 0; this._phase = 'idle';
        if (this._resolve) this._resolve();
      }
    }
  }

  draw(ctx, W, H) {
    if (this._alpha <= 0) return;
    ctx.globalAlpha = this._alpha;
    ctx.fillStyle   = this.color;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

// ─────────────────────────────────────────────
//  BASS ENGINE  (main entry point)
// ─────────────────────────────────────────────

class BassEngineCore extends EventEmitter {
  constructor() {
    super();
    this.canvas     = null;
    this.ctx        = null;
    this._scene     = null;
    this._nextScene = null;
    this._running   = false;
    this._lastTime  = 0;
    this._raf       = null;
    this._transition = new FadeTransition();
    this.targetFPS  = 60;
    this._fpsAccum  = 0;
    this._frameCount = 0;
    this.fps        = 0;
  }

  /**
   * Initialize the engine and start the loop.
   * @param {Scene}   scene   - Initial scene
   * @param {object}  options
   *   canvas  {string|HTMLCanvasElement}  CSS selector or element (default: auto-create)
   *   width   {number}  canvas width  (default: window width)
   *   height  {number}  canvas height (default: window height)
   *   pixelRatio {boolean} enable HiDPI (default: true)
   */
  run(scene, options = {}) {
    const {
      canvas     = null,
      width      = window.innerWidth,
      height     = window.innerHeight,
      pixelRatio = true,
      background = '#000',
    } = options;

    // Canvas setup
    if (canvas) {
      this.canvas = typeof canvas === 'string' ? document.querySelector(canvas) : canvas;
    } else {
      this.canvas = document.createElement('canvas');
      document.body.appendChild(this.canvas);
    }

    this.background = background;
    const dpr = pixelRatio ? (window.devicePixelRatio || 1) : 1;
    this.canvas.width  = width  * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width  = width  + 'px';
    this.canvas.style.height = height + 'px';
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);
    this._logicalW = width;
    this._logicalH = height;

    // Auto-resize
    window.addEventListener('resize', () => this._onResize(pixelRatio));

    // Start
    this._loadScene(scene);
    this._running = true;
    this._lastTime = performance.now();
    this._raf = requestAnimationFrame(t => this._loop(t));

    return this;
  }

  _onResize(pixelRatio) {
    const dpr = pixelRatio ? (window.devicePixelRatio || 1) : 1;
    this._logicalW = window.innerWidth;
    this._logicalH = window.innerHeight;
    this.canvas.width  = this._logicalW * dpr;
    this.canvas.height = this._logicalH * dpr;
    this.canvas.style.width  = this._logicalW + 'px';
    this.canvas.style.height = this._logicalH + 'px';
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);
    this.emit('resize', this._logicalW, this._logicalH);
  }

  _loadScene(scene) {
    if (this._scene) this._scene.onDestroy();
    this._scene = scene;
    this._scene.onCreate();
    this.emit('scenechange', scene);
  }

  /** Transition to a new scene with an optional fade */
  async changeScene(scene, fade = true) {
    if (!fade) { this._loadScene(scene); return; }
    await this._transition.run(() => this._loadScene(scene));
  }

  _loop(timestamp) {
    if (!this._running) return;
    const dt  = Math.min((timestamp - this._lastTime) / 1000, 0.05); // cap at 50ms
    this._lastTime = timestamp;

    // FPS counter
    this._fpsAccum  += dt;
    this._frameCount++;
    if (this._fpsAccum >= 0.5) {
      this.fps = Math.round(this._frameCount / this._fpsAccum);
      this._fpsAccum = 0; this._frameCount = 0;
    }

    const ctx = this.ctx;
    const W   = this._logicalW;
    const H   = this._logicalH;

    ctx.clearRect(0, 0, W, H);
    if (this.background) { ctx.fillStyle = this.background; ctx.fillRect(0, 0, W, H); }

    if (this._scene) this._scene._step(dt, ctx, W, H);

    this._transition.update(dt);
    this._transition.draw(ctx, W, H);

    this.emit('frame', dt);
    this._raf = requestAnimationFrame(t => this._loop(t));
  }

  pause()  { this._running = false; cancelAnimationFrame(this._raf); }
  resume() { this._running = true; this._lastTime = performance.now(); this._raf = requestAnimationFrame(t => this._loop(t)); }
  stop()   { this.pause(); this._scene && this._scene.onDestroy(); }

  /** Current scene reference */
  get scene() { return this._scene; }
  get width()  { return this._logicalW; }
  get height() { return this._logicalH; }
}

const BassEngine = new BassEngineCore();

// ─────────────────────────────────────────────
//  EXPORTS
// ─────────────────────────────────────────────

export {
  BassEngine,
  Scene,
  Entity,
  Sprite,
  Animator,
  Rigidbody,
  BoxCollider,
  CircleCollider,
  ParticleSystem,
  Tilemap,
  Camera,
  PhysicsWorld,
  FadeTransition,
  Input,
  Audio,
  Assets,
  Vector2,
  Rect,
  Component,
  EventEmitter,
};
