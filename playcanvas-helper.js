class PlayCanvasHelper {
  constructor(canvas, options = {}) {
    this.app = new pc.Application(canvas, {mouse:new pc.Mouse(canvas), touch:new pc.TouchDevice(canvas)});
    this.app.start();
    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    window.addEventListener('resize', () => this.app.resizeCanvas());
    this.app.scene.gammaCorrection = pc.GAMMA_SRGB;
    this.app.scene.toneMapping = pc.TONEMAP_ACES;
    this.entities = {};
    if (typeof CANNON !== "undefined") this.initPhysics();
    if (options.initCamera !== false) this.entities.camera = this.createCamera([0,3,6]);
    if (options.initLight !== false) this.entities.light = this.createLight([10,10,10]);
    this.physicsObjects = [];
    if (this.world) this.app.on('update', () => {
      this.world.step(1/60);
      for (const {entity, body} of this.physicsObjects) {
        const p = body.position;
        entity.setPosition(p.x, p.y, p.z);
        const q = body.quaternion;
        entity.setRotation(q.x, q.y, q.z, q.w);
      }
    });
  }
  
  initPhysics() {
    this.world = new CANNON.World();
    this.world.gravity.set(0,-9.82,0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 10;
    const mat = new CANNON.Material("default");
    this.world.addContactMaterial(new CANNON.ContactMaterial(mat, mat, {friction:0.4, restitution:0.3}));
  }
  
  createBox({position=[0,0,0], size=[1,1,1], textureUrl=null, mass=1, name='Box', rotation=[0,0,0]}={}) {
    const box = new pc.Entity(name);
    const mat = new pc.StandardMaterial();
    if (textureUrl) {
      const tex = new pc.Texture(this.app.graphicsDevice);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { tex.setSource(img); mat.diffuseMap = tex; mat.update(); };
      img.src = textureUrl;
    } else mat.update();
    box.addComponent('render', {type:'box', material:mat});
    box.setLocalScale(size[0], size[1], size[2]);
    box.setPosition(...position);
    box.setEulerAngles(...rotation);
    this.app.root.addChild(box);
    if (this.world && mass > 0) {
      const shape = new CANNON.Box(new CANNON.Vec3(size[0]/2, size[1]/2, size[2]/2));
      const body = new CANNON.Body({mass});
      body.addShape(shape);
      body.position.set(...position);
      this.world.addBody(body);
      this.physicsObjects.push({entity: box, body});
    }
    return box;
  }
  
  createPlane({position=[0,0,0], size=[10,10], textureUrl=null, mass=0, name='Plane', rotation=[-90,0,0]}={}) {
    const plane = new pc.Entity(name);
    const mat = new pc.StandardMaterial();
    if (textureUrl) {
      const tex = new pc.Texture(this.app.graphicsDevice);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { tex.setSource(img); mat.diffuseMap = tex; mat.update(); };
      img.src = textureUrl;
    } else mat.update();
    plane.addComponent('render', {type:'plane', material:mat});
    plane.setLocalScale(size[0], size[1], 1);
    plane.setPosition(...position);
    plane.setEulerAngles(...rotation);
    this.app.root.addChild(plane);
    if (this.world) {
      const shape = new CANNON.Plane();
      const body = new CANNON.Body({mass});
      body.addShape(shape);
      body.position.set(...position);
      body.quaternion.setFromEuler(
        pc.math.DEG_TO_RAD * rotation[0],
        pc.math.DEG_TO_RAD * rotation[1],
        pc.math.DEG_TO_RAD * rotation[2]
      );
      this.world.addBody(body);
      this.physicsObjects.push({entity: plane, body});
    }
    return plane;
  }
  
  createCamera(position=[0,3,6]) {
    const camera = new pc.Entity('Camera');
    camera.addComponent('camera', {clearColor: new pc.Color(0.4,0.45,0.5)});
    camera.setPosition(...position);
    this.app.root.addChild(camera);
    return camera;
  }
  
  createLight(position=[10,10,10]) {
    const light = new pc.Entity('Light');
    light.addComponent('light', {type:'directional', color: new pc.Color(1,1,1), intensity:1, castShadows:true});
    light.setPosition(...position);
    light.setEulerAngles(-45,45,0);
    this.app.root.addChild(light);
    return light;
  }
  
  enableMouseRotation(canvas) {
    if (!this.entities.camera) return;
    const camera = this.entities.camera;
    let dragging = false, lastX=0, lastY=0;
    canvas.addEventListener('mousedown', e => { dragging=true; lastX=e.clientX; lastY=e.clientY; });
    canvas.addEventListener('mouseup', () => dragging=false);
    canvas.addEventListener('mouseout', () => dragging=false);
    canvas.addEventListener('mousemove', e => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      const rot = camera.getEulerAngles();
      camera.setEulerAngles(rot.x - dy*0.25, rot.y - dx*0.25, 0);
    });
  }
}
window.PlayCanvasHelper = PlayCanvasHelper;
