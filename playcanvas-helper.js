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
      this.app.on('update', dt => {
        const fixedTimeStep = 1 / 60;
        this.world.step(fixedTimeStep);

        for (const { entity, body } of this.physicsObjects) {
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
    const {
      position = [0, 0, 0],
      size = [1, 1, 1],
      color = [1, 1, 1],
      name = 'Box',
      mass = 1,
      textureUrl = null,
      rotation = [0, 0, 0]
    } = params;

    const box = new pc.Entity(name);

    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(color[0], color[1], color[2]);
    material.update();

    if (textureUrl) {
      const texture = new pc.Texture(this.app.graphicsDevice);
      const img = new Image();
      img.crossOrigin = "anonymous";  // CORS fix
      img.onload = () => {
        texture.setSource(img);
        material.diffuseMap = texture;
        material.update();
      };
      img.src = textureUrl;
    }

    box.addComponent('render', {
      type: 'box',
      material: material,
    });

    box.setLocalScale(size[0], size[1], size[2]);
    box.setPosition(position[0], position[1], position[2]);
    box.setEulerAngles(rotation[0], rotation[1], rotation[2]);

    this.app.root.addChild(box);

    if (this.world && mass > 0) {
      const shape = new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2));
      const body = new CANNON.Body({ mass });
      body.addShape(shape);
      body.position.set(position[0], position[1], position[2]);
      this.world.addBody(body);
      this.physicsObjects.push({ entity: box, body });
    }

    return box;
  }

  createPlane(params = {}) {
    const {
      position = [0, 0, 0],
      size = [10, 10],
      color = [0.5, 0.5, 0.5],
      name = 'Plane',
      rotation = [-90, 0, 0],
      mass = 0,
      textureUrl = null,
    } = params;

    const plane = new pc.Entity(name);

    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(color[0], color[1], color[2]);
    material.update();

    if (textureUrl) {
      const texture = new pc.Texture(this.app.graphicsDevice);
      const img = new Image();
      img.crossOrigin = "anonymous";  // CORS fix
      img.onload = () => {
        texture.setSource(img);
        material.diffuseMap = texture;
        material.update();
      };
      img.src = textureUrl;
    }

    plane.addComponent('render', {
      type: 'plane',
      material: material,
    });

    plane.setLocalScale(size[0], size[1], 1);
    plane.setPosition(position[0], position[1], position[2]);
    plane.setEulerAngles(rotation[0], rotation[1], rotation[2]);

    this.app.root.addChild(plane);

    if (this.world) {
      const shape = new CANNON.Plane();
      const body = new CANNON.Body({ mass });
      body.addShape(shape);
      body.position.set(position[0], position[1], position[2]);
      body.quaternion.setFromEuler(
        pc.math.DEG_TO_RAD * rotation[0],
        pc.math.DEG_TO_RAD * rotation[1],
        pc.math.DEG_TO_RAD * rotation[2]
      );
      this.world.addBody(body);
      this.physicsObjects.push({ entity: plane, body });
    }

    return plane;
  }

  createCamera(position = [0, 3, 6]) {
    const camera = new pc.Entity('Camera');
    camera.addComponent('camera', {
      clearColor: new pc.Color(0.4, 0.45, 0.5),
    });
    camera.setPosition(position[0], position[1], position[2]);
    this.app.root.addChild(camera);

    return camera;
  }

  createLight(position = [10, 10, 10]) {
    const light = new pc.Entity('Light');
    light.addComponent('light', {
      type: 'directional',
      color: new pc.Color(1, 1, 1),
      intensity: 1,
      castShadows: true,
    });
    light.setPosition(position[0], position[1], position[2]);
    light.setEulerAngles(-45, 45, 0);
    this.app.root.addChild(light);

    return light;
  }

  enableMouseRotation(canvas) {
    if (!this.entities.camera) {
      console.warn('No camera to rotate.');
      return;
    }

    const camera = this.entities.camera;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });

    canvas.addEventListener('mouseup', () => {
      isDragging = false;
    });

    canvas.addEventListener('mouseout', () => {
      isDragging = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      const rot = camera.getEulerAngles();
      const newX = rot.x - dy * 0.25;
      const newY = rot.y - dx * 0.25;
      camera.setEulerAngles(newX, newY, 0);
    });
  }
}

window.PlayCanvasHelper = PlayCanvasHelper;
