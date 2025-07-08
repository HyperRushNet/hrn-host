// playcanvas-helper.js
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

    if (options.skybox) {
      this.loadSkybox(options.skybox);
    }

    if (options.initCamera !== false) {
      this.createCamera();
    }

    if (options.initLight !== false) {
      this.createLight();
    }
  }

  createBox(position = [0, 0, 0], size = [1, 1, 1], color = [1, 1, 1]) {
    const box = new pc.Entity();
    box.addComponent("model", {
      type: "box"
    });
    box.setLocalScale(...size);
    box.setPosition(...position);

    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(...color);
    material.update();

    box.model.material = material;
    this.app.root.addChild(box);
    return box;
  }

  createCamera(position = [0, 0, 3]) {
    const camera = new pc.Entity("Camera");
    camera.addComponent("camera", {
      clearColor: new pc.Color(0.1, 0.1, 0.1)
    });
    camera.setPosition(...position);
    this.app.root.addChild(camera);
    this.app.camera = camera;
    return camera;
  }

  createLight(position = [10, 10, 10]) {
    const light = new pc.Entity("Directional Light");
    light.addComponent("light", {
      type: "directional",
      color: new pc.Color(1, 1, 1),
      intensity: 1,
      castShadows: true
    });
    light.setEulerAngles(45, 45, 0);
    this.app.root.addChild(light);
    return light;
  }

  loadSkybox(urlPrefix) {
    this.app.assets.loadFromUrl(urlPrefix + ".hdr", "texture", (err, asset) => {
      if (err) return console.error(err);
      const cubeMap = asset.resource;
      cubeMap._levels = [cubeMap._levels[0]]; // fix for mipmaps
      this.app.scene.skyboxMip = 0;
      this.app.scene.setSkybox(cubeMap);
    });
  }

  onUpdate(fn) {
    this.app.on("update", fn);
  }
}
