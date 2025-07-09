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
        const fixedTimeStep = 1/60;
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

  // Maak een custom box mesh met vlakke normals (flat shading)
  createFlatBoxMesh(size) {
    const app = this.app;
    const halfSize = size.map(s => s / 2);

    // Vertices per vlak, elke vlak heeft eigen 4 vertices (geen sharing)
    const positions = [
      // Front face
      -halfSize[0], -halfSize[1],  halfSize[2],
       halfSize[0], -halfSize[1],  halfSize[2],
       halfSize[0],  halfSize[1],  halfSize[2],
      -halfSize[0],  halfSize[1],  halfSize[2],

      // Back face
       halfSize[0], -halfSize[1], -halfSize[2],
      -halfSize[0], -halfSize[1], -halfSize[2],
      -halfSize[0],  halfSize[1], -halfSize[2],
       halfSize[0],  halfSize[1], -halfSize[2],

      // Left face
      -halfSize[0], -halfSize[1], -halfSize[2],
      -halfSize[0], -halfSize[1],  halfSize[2],
      -halfSize[0],  halfSize[1],  halfSize[2],
      -halfSize[0],  halfSize[1], -halfSize[2],

      // Right face
       halfSize[0], -halfSize[1],  halfSize[2],
       halfSize[0], -halfSize[1], -halfSize[2],
       halfSize[0],  halfSize[1], -halfSize[2],
       halfSize[0],  halfSize[1],  halfSize[2],

      // Top face
      -halfSize[0],  halfSize[1],  halfSize[2],
       halfSize[0],  halfSize[1],  halfSize[2],
       halfSize[0],  halfSize[1], -halfSize[2],
      -halfSize[0],  halfSize[1], -halfSize[2],

      // Bottom face
      -halfSize[0], -halfSize[1], -halfSize[2],
       halfSize[0], -halfSize[1], -halfSize[2],
       halfSize[0], -halfSize[1],  halfSize[2],
      -halfSize[0], -halfSize[1],  halfSize[2],
    ];

    // Vlakke normals, per vlak 4x dezelfde normale
    const normals = [
      // Front
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
      // Back
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
      // Left
      -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
      // Right
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
      // Top
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      // Bottom
      0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    ];

    // UV coords per vertex voor hele vlak
    const uvs = [
      // Front
      0,0, 1,0, 1,1, 0,1,
      // Back
      0,0, 1,0, 1,1, 0,1,
      // Left
      0,0, 1,0, 1,1, 0,1,
      // Right
      0,0, 1,0, 1,1, 0,1,
      // Top
      0,0, 1,0, 1,1, 0,1,
      // Bottom
      0,0, 1,0, 1,1, 0,1,
    ];

    // Index buffer (2 triangles per vlak)
    const indices = [
      0,1,2, 0,2,3,         // Front
      4,5,6, 4,6,7,         // Back
      8,9,10, 8,10,11,      // Left
      12,13,14, 12,14,15,   // Right
      16,17,18, 16,18,19,   // Top
      20,21,22, 20,22,23,   // Bottom
    ];

    const vertexFormat = new pc.VertexFormat(this.app.graphicsDevice, [
      { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
      { semantic: pc.SEMANTIC_NORMAL, components: 3, type: pc.TYPE_FLOAT32 },
      { semantic: pc.SEMANTIC_TEXCOORD0, components: 2, type: pc.TYPE_FLOAT32 },
    ]);

    const vertexBuffer = new pc.VertexBuffer(this.app.graphicsDevice, vertexFormat, 24);

    // Data interleaved: pos(3), normal(3), uv(2) = 8 floats per vertex
    const vertexData = new Float32Array(24 * 8);
    for(let i=0; i<24; i++) {
      vertexData[i*8 + 0] = positions[i*3 + 0];
      vertexData[i*8 + 1] = positions[i*3 + 1];
      vertexData[i*8 + 2] = positions[i*3 + 2];
      vertexData[i*8 + 3] = normals[i*3 + 0];
      vertexData[i*8 + 4] = normals[i*3 + 1];
      vertexData[i*8 + 5] = normals[i*3 + 2];
      vertexData[i*8 + 6] = uvs[i*2 + 0];
      vertexData[i*8 + 7] = uvs[i*2 + 1];
    }

    vertexBuffer.setData(vertexData);

    const indexBuffer = new pc.IndexBuffer(this.app.graphicsDevice, pc.INDEXFORMAT_UINT16, indices.length);
    indexBuffer.setData(new Uint16Array(indices));

    const mesh = new pc.Mesh();
    mesh.vertexBuffer = vertexBuffer;
    mesh.indexBuffer[0] = indexBuffer;
    mesh.primitive[0].type = pc.PRIMITIVE_TRIANGLES;
    mesh.primitive[0].base = 0;
    mesh.primitive[0].count = indices.length;

    return mesh;
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

  // Maak materiaal eerst
  const material = new pc.StandardMaterial();
  material.diffuse = new pc.Color(...color);
  material.update();

  // Bouw mesh en instance
  const mesh = this.createFlatBoxMesh(size);
  const meshInstance = new pc.MeshInstance(mesh, material);

  // Render component toevoegen zonder type
  box.addComponent('render');
  box.render.meshInstances = [meshInstance];

  // Transform
  box.setPosition(...position);
  box.setEulerAngles(...rotation);

  this.app.root.addChild(box);

  // Laad texture (async)
  if (textureUrl) {
    const textureAsset = new pc.Asset('texture', 'texture', { url: textureUrl });
    this.app.assets.add(textureAsset);
    this.app.assets.load(textureAsset);
    textureAsset.ready(() => {
      material.diffuseMap = textureAsset.resource;
      material.diffuseMapAddressU = pc.ADDRESS_CLAMP_TO_EDGE;
      material.diffuseMapAddressV = pc.ADDRESS_CLAMP_TO_EDGE;
      material.diffuseMapTiling = new pc.Vec2(size[0], size[2]);
      material.update();
    });
  }

  // Physics
  if (this.world) {
    const halfExtents = new CANNON.Vec3(size[0]/2, size[1]/2, size[2]/2);
    const shape = new CANNON.Box(halfExtents);
    const body = new CANNON.Body({
      mass,
      shape,
      position: new CANNON.Vec3(...position),
      quaternion: new CANNON.Quaternion().setFromEuler(
        rotation[0] * Math.PI / 180,
        rotation[1] * Math.PI / 180,
        rotation[2] * Math.PI / 180,
        'XYZ'
      ),
      material: this.physicsMaterial,
      linearDamping: 0.05,
      angularDamping: 0.05,
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
        quaternion: new CANNON.Quaternion().setFromEuler(
          rotation[0] * Math.PI / 180,
          rotation[1] * Math.PI / 180,
          rotation[2] * Math.PI / 180
        ),
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
      shadowBias: 0.05,
      shadowDistance: 50,
      normalOffsetBias: 0.01
    });
    light.setPosition(...position);
    light.setEulerAngles(45, 45, 0);
    this.app.root.addChild(light);
    return light;
  }
}
