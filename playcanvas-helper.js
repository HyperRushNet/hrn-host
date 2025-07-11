// Functie om scripts dynamisch te laden en te wachten tot ze klaar zijn
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Script ${src} kon niet geladen worden`));
    document.head.appendChild(script);
  });
}

// Je PlayCanvasHelper class, precies zoals jij gaf
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
      this.accumulator = 0;
      this.fixedTimeStep = 1 / 60;

      this.app.on('update', dt => {
        this.accumulator += dt;
        while (this.accumulator >= this.fixedTimeStep) {
          this.world.step(this.fixedTimeStep, this.fixedTimeStep, 10);
          this.accumulator -= this.fixedTimeStep;
        }

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
    this.world.gravity.set(0, -7.82, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 20;
    this.world.solver.tolerance = 0.001;
    this.world.allowSleep = true;

    this.physicsMaterial = new CANNON.Material("defaultMaterial");
    const contactMaterial = new CANNON.ContactMaterial(this.physicsMaterial, this.physicsMaterial, {
      friction: 0.5,
      restitution: 0.1,
      contactEquationStiffness: 1e7,
      contactEquationRelaxation: 3,
    });
    this.world.addContactMaterial(contactMaterial);
  }

  createBox(params = {}) {
    const {
      position = [0, 0, 0],
      size = [1, 1, 1],
      color = [1, 1, 1],
      name = 'Box',
      mass = 1,
      textureUrl = null,
      rotation = [0, 0, 0],
    } = params;

    const box = new pc.Entity(name);
    box.addComponent("model", { type: "box" });
    box.setLocalScale(...size);
    box.setPosition(...position);
    box.setEulerAngles(...rotation);

    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(...color);

    if (textureUrl) {
      const textureAsset = new pc.Asset('texture', 'texture', { url: textureUrl });
      this.app.assets.add(textureAsset);
      this.app.assets.load(textureAsset);
      textureAsset.ready(() => {
        material.diffuseMap = textureAsset.resource;
        material.diffuseMapAddressU = pc.ADDRESS_REPEAT;
        material.diffuseMapAddressV = pc.ADDRESS_REPEAT;
        material.diffuseMapTiling = new pc.Vec2(size[0], size[2]);
        material.diffuseMapMinFilter = pc.FILTER_LINEAR;
        material.diffuseMapMagFilter = pc.FILTER_LINEAR;
        material.update();
      });
    } else {
      material.update();
    }

    box.model.material = material;
    this.app.root.addChild(box);

    if (this.world) {
      const halfExtents = new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2);
      const shape = new CANNON.Box(halfExtents);

      const eulerRad = rotation.map(deg => deg * Math.PI / 180);
      const quat = new CANNON.Quaternion();
      quat.setFromEuler(eulerRad[0], eulerRad[1], eulerRad[2], "XYZ");

      const body = new CANNON.Body({
        mass,
        shape,
        position: new CANNON.Vec3(...position),
        quaternion: quat,
        material: this.physicsMaterial,
        linearDamping: 0.05,
        angularDamping: 0.05,
        allowSleep: true,
        sleepSpeedLimit: 0.1,
        sleepTimeLimit: 1,
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
      name = 'Plane',
    } = params;

    const plane = new pc.Entity(name);
    plane.addComponent("model", { type: "box" });
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

// Nu laden we dynamisch PlayCanvas en Cannon, en dan initialiseren we PlayCanvasHelper
(async () => {
  try {
    await loadScript("https://code.playcanvas.com/playcanvas-stable.min.js");
    console.log("PlayCanvas is geladen");

    await loadScript("https://cdn.jsdelivr.net/npm/cannon@0.6.2/build/cannon.min.js");
    console.log("Cannon.js is geladen");

    const canvas = document.getElementById("application-canvas");
    const helper = new PlayCanvasHelper(canvas, {
      initCamera: true,
      initLight: true,
      cameraPosition: [0, 5, 10],
      lightPosition: [5, 10, 5],
    });

    helper.createPlane({ size: [10, 10], position: [0, 0, 0] });
    helper.createBox({ position: [0, 2, 0], size: [1, 1, 1], color: [1, 0, 0] });

  } catch (error) {
    console.error("Error tijdens laden of initialisatie:", error);
  }
})();
