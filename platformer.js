// PlatformerLib.js - simpele, ruime 2D platformer lib

export class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  copy() { return new Vec2(this.x, this.y); }
}

export class Rect {
  constructor(x=0,y=0,width=0,height=0) {
    this.pos = new Vec2(x,y);
    this.size = new Vec2(width,height);
  }
  get x() { return this.pos.x; }
  get y() { return this.pos.y; }
  get width() { return this.size.x; }
  get height() { return this.size.y; }
  set x(v) { this.pos.x = v; }
  set y(v) { this.pos.y = v; }
  set width(w) { this.size.x = w; }
  set height(h) { this.size.y = h; }
  intersects(other) {
    return !(this.x > other.x + other.width ||
             this.x + this.width < other.x ||
             this.y > other.y + other.height ||
             this.y + this.height < other.y);
  }
}

export class Entity extends Rect {
  constructor(x,y,w,h) {
    super(x,y,w,h);
    this.vel = new Vec2();
    this.acc = new Vec2();
    this.speed = 0;
  }
  update(dt) {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
  }
  draw(ctx) {
    ctx.fillStyle = '#f00';
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

export class Player extends Entity {
  constructor(x,y,w,h,image=null) {
    super(x,y,w,h);
    this.jumping = false;
    this.facing = 'right';
    this.speed = 4;
    this.image = image;
  }
  update(dt, gravity) {
    this.acc = new Vec2(0, gravity);
    super.update(dt);
    if (Math.abs(this.vel.x) > 0.1) this.facing = this.vel.x > 0 ? 'right' : 'left';
  }
  draw(ctx) {
    if(this.image){
      ctx.save();
      ctx.translate(this.x + this.width/2, this.y + this.height/2);
      if(this.facing === 'left') ctx.scale(-1,1);
      ctx.drawImage(this.image, -this.width/2, -this.height/2, this.width, this.height);
      ctx.restore();
    } else {
      super.draw(ctx);
    }
  }
}

export class Platform extends Rect {
  constructor(x,y,w,h) {
    super(x,y,w,h);
  }
  draw(ctx) {
    ctx.fillStyle = '#654321';
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeStyle = '#00000000'; // transparant border
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x, this.y, this.width, this.height);
  }
}

export class Game {
  constructor(canvas, gravity=0.7, friction=0.8) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gravity = gravity;
    this.friction = friction;
    this.player = null;
    this.platforms = [];
    this.keys = {};
    this.epsilon = 0.1;
    this._setupInput();
  }

  _setupInput(){
    window.addEventListener('keydown', e => this.keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', e => this.keys[e.key.toLowerCase()] = false);
  }

  addPlayer(player){ this.player = player; }
  addPlatform(platform){ this.platforms.push(platform); }

  rectCollision(r1, r2) {
    return r1.intersects(r2);
  }

  resolveCollision() {
    const p = this.player;
    for (const platform of this.platforms) {
      if(this.rectCollision(p, platform)) {
        const prevX = p.x - p.vel.x;
        const prevY = p.y - p.vel.y;

        if (prevY + p.height <= platform.y) {
          p.y = platform.y - p.height - this.epsilon;
          p.vel.y = 0;
          p.jumping = false;
        } else if (prevY >= platform.y + platform.height) {
          p.y = platform.y + platform.height + this.epsilon;
          p.vel.y = 0;
        } else {
          if (prevX + p.width <= platform.x) {
            p.x = platform.x - p.width - this.epsilon;
            p.vel.x = 0;
          } else if (prevX >= platform.x + platform.width) {
            p.x = platform.x + platform.width + this.epsilon;
            p.vel.x = 0;
          }
        }
      }
    }
  }

  update() {
    const p = this.player;
    if(!p) return;

    if (this.keys['arrowleft'] || this.keys['a']) {
      p.vel.x = -p.speed;
    } else if (this.keys['arrowright'] || this.keys['d']) {
      p.vel.x = p.speed;
    } else {
      p.vel.x *= this.friction;
      if(Math.abs(p.vel.x) < 0.1) p.vel.x = 0;
    }
    if ((this.keys['arrowup'] || this.keys['w'] || this.keys[' ']) && !p.jumping) {
      p.vel.y = -15;
      p.jumping = true;
    }

    p.update(1, this.gravity);
    this.resolveCollision();
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.platforms.forEach(p => p.draw(ctx));
    if(this.player) this.player.draw(ctx);
  }

  loop() {
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }

  start() {
    this.loop();
  }
}
