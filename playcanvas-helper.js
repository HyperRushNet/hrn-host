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

    if (options.skybox) {
      this.loadSkybox(options.skybox);
    }

    if (options.initCamera !== false) {
      this.entities.camera = this.createCamera(options.cameraPosition || [0, 1.5, 5]);
    }

    if (options.initLight !== false) {
      this.entities.light = this.createLight(options.lightPosition || [10, 10, 10]);
    }
  }

  createBox(params = {}) {
    const { position = [0, 0, 0], size = [1, 1, 1], color = [1, 1, 1], name = 'Box' } = params;
    const box = new pc.Entity(name);
    box.addComponent("model", { type: "box" });
    box.setLocalScale(...size);
    box.setPosition(...position);

    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(...color);
    material.update();
    box.model.material = material;

    this.app.root.addChild(box);
    return box;
  }

  createSphere(params = {}) {
    const { position = [0, 0, 0], radius = 0.5, color = [1, 1, 1], name = 'Sphere' } = params;
    const sphere = new pc.Entity(name);
    sphere.addComponent("model", { type: "sphere" });
    sphere.setLocalScale(radius, radius, radius);
    sphere.setPosition(...position);

    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(...color);
    material.update();
    sphere.model.material = material;

    this.app.root.addChild(sphere);
    return sphere;
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

  loadSkybox(urlPrefix) {
    this.app.assets.loadFromUrl(urlPrefix + ".hdr", "texture", (err, asset) => {
      if (err) return console.error(err);
      const cubeMap = asset.resource;
      cubeMap._levels = [cubeMap._levels[0]];
      this.app.scene.skyboxMip = 0;
      this.app.scene.setSkybox(cubeMap);
    });
  }

  onUpdate(fn) {
    this.app.on("update", fn);
  }

  enableMouseRotation(entity, options = {}) {
    const sensitivity = options.sensitivity || 0.005;
    let dragging = false;
    let lastPos = null;
    let pitch = 0; // rotatie rondom X (omhoog/omlaag)
    let yaw = 0;   // rotatie rondom Y (links/rechts)

    const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

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

      yaw += dx * sensitivity;    // positief, muis naar rechts draait object naar rechts
      pitch += dy * sensitivity;  // positief, muis naar beneden kantelt object omhoog
      pitch = clamp(pitch, -Math.PI / 2, Math.PI / 2);

      const quatYaw = new pc.Quat();
      quatYaw.setFromAxisAngle(pc.Vec3.UP, pc.math.RAD_TO_DEG * yaw);

      const quatPitch = new pc.Quat();
      quatPitch.setFromAxisAngle(pc.Vec3.RIGHT, pc.math.RAD_TO_DEG * pitch);

      const combined = quatYaw.clone().mul(quatPitch);
      entity.setLocalRotation(combined);

      e.preventDefault();
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);

    // Return functie om events te verwijderen als nodig
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
    };
  }
}
