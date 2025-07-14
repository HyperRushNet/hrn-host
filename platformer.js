// platformer.js
export class Game {
  constructor(canvas, gravity=0.7, friction=0.8) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.gravity = gravity;
    this.friction = friction;
    this.player = null;
    this.platforms = [];
    this.beforeDraw = null;
  }
  addPlayer(p) { this.player = p; }
  addPlatform(p) { this.platforms.push(p); }
  loop = () => {
    if (this.beforeDraw) this.beforeDraw();
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    this.platforms.forEach(p => {
      this.ctx.fillStyle = "#654321";
      this.ctx.fillRect(p.x,p.y,p.w,p.h);
    });
    if (this.player) this.player.draw(this.ctx);
    requestAnimationFrame(this.loop);
  }
  start() { this.loop(); }
}

export class Platform {
  constructor(x,y,w,h){ this.x=x;this.y=y;this.w=w;this.h=h; }
}

export class Player {
  constructor(x,y,w,h){
    this.x=x; this.y=y;
    this.w=w; this.h=h;
    this.vel = {x:0,y:0};
    this.onGround = false;
    this.speed = 2.5;
    this.jumpPower = 8;
    this.facing = 'right';

    // animatie
    this.anim = 0;
    this.attacking=false; this.attackT=0;
    this.attackDur=20; this.swing=0;
  }

  update(input, gravity, platforms) {
    // beweging & gravity
    if (input.left) { this.vel.x = -this.speed; this.facing='left'; }
    else if (input.right) { this.vel.x = this.speed; this.facing='right'; }
    else { this.vel.x *= 0.9; }
    if (input.jump && this.onGround) { this.vel.y = -this.jumpPower; this.onGround=false; }
    this.vel.y += gravity;

    this.x += this.vel.x;
    this.y += this.vel.y;

    // platform collision
    this.onGround = false;
    platforms.forEach(p => {
      if (this.x < p.x+p.w && this.x+this.w > p.x &&
          this.y+this.h > p.y && this.y+this.h < p.y+this.vel.y+1) {
        this.y = p.y - this.h;
        this.vel.y = 0;
        this.onGround = true;
      }
    });

    // animatie progress
    this.anim += Math.abs(this.vel.x)/10;
    if (this.attacking) {
      this.attackT--;
      const pr = 1 - this.attackT/this.attackDur;
      this.swing = -Math.PI/2 + pr*(Math.PI);
      if (this.attackT<=0) { this.attacking=false; this.swing=0; }
    }
  }

  attack() {
    if (!this.attacking) {
      this.attacking = true;
      this.attackT = this.attackDur;
    }
  }

  draw(ctx) {
    this.updateLoop(ctx);
  }

  updateLoop(ctx) {
    this.update(this._input, this.gravity, this.platforms);
    // teken
    ctx.save();
    // armen/benen animatie
    const t = this.anim;
    const armSwing = Math.sin(t*2)*4;
    const legSwing = Math.sin(t*2)*6;

    // deelboxes opslaan
    this.hitboxes = [];

    const X=this.x, Y=this.y, W=this.w, H=this.h;

    // Hoofd
    this._part(ctx, X+W*0.25, Y, W*0.5, H*0.2, "#ffe0bd","head");

    // Romp
    this._part(ctx, X+W*0.2, Y+H*0.2, W*0.6, H*0.4, "#0066cc","torso");

    // Armen
    this._part(ctx, X, Y+H*0.2+armSwing, W*0.2, H*0.3, "#cc6600","armL");
    this._part(ctx, X+W*0.8, Y+H*0.2-armSwing, W*0.2, H*0.3, "#cc6600","armR");

    // Benen
    this._part(ctx, X+W*0.2, Y+H*0.6-legSwing, W*0.2, H*0.4, "#333","legL");
    this._part(ctx, X+W*0.6, Y+H*0.6+legSwing, W*0.2, H*0.4, "#333","legR");

    // Zwaard
    if (this.attacking) {
      ctx.save();
      ctx.translate(X+W/2, Y+H*0.1);
      if (this.facing==='left') ctx.scale(-1,1);
      ctx.rotate(this.swing);
      ctx.fillStyle="silver";
      ctx.fillRect(W*0.2, -W*0.05, W*0.05, H*0.6);
      // zwaardhitbox
      const bx = X + W/2 + Math.cos(this.swing)*W*0.2 - W*0.025;
      const by = Y+H*0.1 + Math.sin(this.swing)*(-W*0.05);
      this.hitboxes.push({x:bx,y:by,w:W*0.05,h:H*0.6,name:"sword"});
      ctx.restore();
    }

    // teken hitboxes
    ctx.strokeStyle="#0008";
    this.hitboxes.forEach(b=>{
      ctx.strokeRect(b.x,b.y,b.w,b.h);
    });

    ctx.restore();
  }

  _part(ctx,x,y,w,h,color,name){
    ctx.fillStyle=color;
    ctx.fillRect(x,y,w,h);
    this.hitboxes.push({x,y,w,h,name});
  }
}
