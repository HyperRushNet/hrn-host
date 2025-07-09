class PlayCanvasHelper {
  constructor(canvas, options = {}) {
    this.app = new pc.Application(canvas, {
      mouse: new pc.Mouse(canvas),
      touch: new pc.TouchDevice(canvas),
    });
    this.app.start();
    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    window.addEventListener('resize', () => this.app.resizeCanvas());

    this.app.scene.gammaCorrection = pc.GAMMA_SRGB;
    this.app.scene.toneMapping = pc.TONEMAP_ACES;

    this.entities = {};

    this.physicsObjects = [];

    // Physics setup
    if (typeof CANNON !== "undefined") {
      this.initPhysics();
    }

    if (options.initCamera !== false) {
      this.entities.camera = this.createCamera(options.cameraPosition || [0, 3, 6]);
    }

    if (options.initLight !== false) {
      this.entities.light = this.createLight(options.lightPosition || [10, 10, 10]);
    }

    // Physics timing accumulator for fixed timestep
    this._accumulator = 0;
    this._fixedTimeStep = 1 / 60;

    if (this.world) {
      this.app.on('update', (dt) => this._updatePhysics(dt));
    }
  }

  initPhysics() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 10;

    this.physicsMaterial = new CANNON.Material("defaultMaterial");
    const contactMaterial = new CANNON.ContactMaterial(this.physicsMaterial, this.physicsMaterial, {
      friction: 0.4,
      restitution: 0.3,
    });
    this.world.addContactMaterial(contactMaterial);
  }

  _updatePhysics(dt) {
    // Accumulate dt and step physics fixed time steps
    this._accumulator += dt;
    const maxSteps = 5;  // Avoid spiral of death
    let steps = 0;

    while (this._accumulator >= this._fixedTimeStep && steps < maxSteps) {
      this.world.step(this._fixedTimeStep);
      this._accumulator -= this._fixedTimeStep;
      steps++;
    }

    // Sync positions & rotations once per frame (after stepping physics)
    for (const { entity, body } of this.physicsObjects) {
      const p = body.position;
      entity.setPosition(p.x, p.y, p.z);

      const q = body.quaternion;
      entity.setRotation(q.x, q.y, q.z, q.w);
    }
  }

  createBox(params = {}) {
    const {
      position = [0, 0, 0],
      size = [1, 1, 1],
      color = [1, 1, 1],
      name = 'Box',
      mass = 1,
      textureUrl = null
    } = params;

    const box = new pc.Entity(name);
    box.addComponent("model", { type: "box" });
    box.setLocalScale(...size);
    box.setPosition(...position);

    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(...color);

    if (textureUrl) {
      if (!this._textureCache) this._textureCache = new Map();

      if (this._textureCache.has(textureUrl)) {
        material.diffuseMap = this._textureCache.get(textureUrl);
        material.diffuseMapTiling = new pc.Vec2(size[0], size[2]);
        material.diffuseMapAddressU = pc.ADDRESS_REPEAT;
        material.diffuseMapAddressV = pc.ADDRESS_REPEAT;
        material.update();
      } else {
        const textureAsset = new pc.Asset('texture', 'texture', { url: textureUrl });
        this.app.assets.add(textureAsset);
        this.app.assets.load(textureAsset);

        textureAsset.ready(() => {
          this._textureCache.set(textureUrl, textureAsset.resource);
          material.diffuseMap = textureAsset.resource;
          material.diffuseMapTiling = new pc.Vec2(size[0], size[2]);
          material.diffuseMapAddressU = pc.ADDRESS_REPEAT;
          material.diffuseMapAddressV = pc.ADDRESS_REPEAT;
          material.update();
        });
      }
    } else {
      material.update();
    }

    box.model.material = material;

    this.app.root.addChild(box);

    if (this.world) {
      const halfExtents = new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2);
      const shape = new CANNON.Box(halfExtents);
      const body = new CANNON.Body({
        mass,
        shape,
        position: new CANNON.Vec3(...position),
        material: this.physicsMaterial,
        linearDamping: 0.01,    // Lagere damping = natuurlijker
        angularDamping: 0.01,
        allowSleep: true,
        sleepSpeedLimit: 0.1,
        sleepTimeLimit: 1
      });
      this.world.addBody(body);

      this.physicsObjects.push({ entity: box, body });
    }

    return box;
  }

  createPlane(params = {}) {
    const {
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      size = [10, 10],
      color = [0.2, 0.2, 0.2],
      name = 'Plane'
    } = params;

    const plane = new pc.Entity(name);
    plane.addComponent("model", { type: "box" }); // dunne box als vloer
    plane.setLocalScale(size[0], 0.1, size[1]);
    plane.setPosition(...position);
    plane.setEulerAngles(...rotation);

    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(...color);
    material.update();
    plane.model.material = material;

    this.app.root.addChild(plane);

    if (this.world) {
      const shape = new CANNON.Box(new CANNON.Vec3(size[0] / 2, 0.05, size[1] / 2));
      const body = new CANNON.Body({
        mass: 0,
        shape,
        position: new CANNON.Vec3(...position),
        quaternion: new CANNON.Quaternion().setFromEuler(...rotation.map(v => v * Math.PI / 180)),
        material: this.physicsMaterial,
        linearDamping: 0.01,
        angularDamping: 0.01,
        allowSleep: true,
        sleepSpeedLimit: 0.1,
        sleepTimeLimit: 1
      });
      this.world.addBody(body);

      this.physicsObjects.push({ entity: plane, body });
    }

    return plane;
  }

  createCamera(position = [0, 0, 3], lookAt = [0, 0, 0]) {
    const camera = new pc.Entity("Camera");
    camera.addComponent("camera", {
      clearColor: new pc.Color(0.1, 0.1, 0.1)
    });
    camera.setPosition(...position);
    camera.lookAt(new pc.Vec3(...lookAt));
    this.app.root.addChild(camera);
    this.app.camera = camera;
    return camera;
  }

  createLight(position = [10, 10, 10], color = [1, 1, 1], intensity = 1) {
    const light = new pc.Entity("Directional Light");
    light.addComponent("light", {
      type: "directional",
      color: new pc.Color(...color),
      intensity,
      castShadows: true,
    });
    light.setPosition(...position);
    light.setEulerAngles(45, 45, 0);
    this.app.root.addChild(light);
    return light;
  }
}
