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

    // Init physics wereld als CANNON globaal bestaat
    if (typeof CANNON !== "undefined") {
      this.initPhysics();
    }

    if (options.initCamera !== false) {
      this.entities.camera = this.createCamera(options.cameraPosition || [0, 3, 6]);
    }

    if (options.initLight !== false) {
      this.entities.light = this.createLight(options.lightPosition || [10, 10, 10]);
    }

    this.physicsObjects = [];

    if (this.world) {
      this.app.on('update', dt => {
        this.world.step(dt);

        // Sync physics bodies met PlayCanvas entities
        for (const entry of this.physicsObjects) {
          const { entity, body } = entry;
          const p = body.position;
          entity.setPosition(p.x, p.y, p.z);

          const q = body.quaternion;
          entity.setRotation(q.x, q.y, q.z, q.w);
        }
      });
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

  createBox(params = {}) {
    const { position = [0, 0, 0], size = [1, 1, 1], color = [1, 1, 1], name = 'Box', mass = 1 } = params;
    const box = new pc.Entity(name);
    box.addComponent("model", { type: "box" });
    box.setLocalScale(...size);
    box.setPosition(...position);

    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(...color);
    material.update();
    box.model.material = material;

    this.app.root.addChild(box);

    if (this.world) {
      const halfExtents = new CANNON.Vec3(size[0]/2, size[1]/2, size[2]/2);
      const shape = new CANNON.Box(halfExtents);
      const body = new CANNON.Body({
        mass,
        shape,
        position: new CANNON.Vec3(...position),
        material: this.physicsMaterial,
      });
      this.world.addBody(body);

      this.physicsObjects.push({ entity: box, body });
    }

    return box;
  }

  createPlane(params = {}) {
    const { position = [0, 0, 0], rotation = [0, 0, 0], size = [10, 10], color = [0.2, 0.2, 0.2], name = 'Plane' } = params;
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
      const shape = new CANNON.Box(new CANNON.Vec3(size[0]/2, 0.05, size[1]/2));
      const body = new CANNON.Body({
        mass: 0,
        shape,
        position: new CANNON.Vec3(...position),
        quaternion: new CANNON.Quaternion().setFromEuler(...rotation.map(v => v * Math.PI/180)),
        material: this.physicsMaterial,
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

  onUpdate(fn) {
    this.app.on("update", fn);
  }

  enableMouseRotation(entity, options = {}) {
    const sensitivity = options.sensitivity || 0.005;
    let dragging = false;
    let lastPos = null;
    let pitch = 0;
    let yaw = 0;

    entity.setLocalRotation(0, 0, 0, 1);

    const onDown = (e) => {
      dragging = true;
      lastPos = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    };

    const onUp = (e) => {
      dragging = false;
    };

    const onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      lastPos = { x: e.clientX, y: e.clientY };

      yaw -= dx * sensitivity;  // om correcte richting te krijgen
      pitch -= dy * sensitivity;

      // Geen limiet op pitch/yaw, rotatie kan onbeperkt

      const quatYaw = new pc.Quat();
      quatYaw.setFromAxisAngle(pc.Vec3.UP, yaw * (180/Math.PI));

      const quatPitch = new pc.Quat();
      quatPitch.setFromAxisAngle(pc.Vec3.RIGHT, pitch * (180/Math.PI));

      const combined = quatYaw.clone().mul(quatPitch);
      entity.setLocalRotation(combined);

      e.preventDefault();
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);

    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
    };
  }
}
