import * as THREE from "three";

const TEXTURE_SIZE = 256;
const AXES = [
  { u: 1, v: 2 },
  { u: 0, v: 2 },
  { u: 0, v: 1 },
];

const VERTEX_DECL = [
  "uniform mat4 uWashMeshToModel;",\n  "uniform mat3 uWashMeshNormalMatrix;",
  "varying vec3 vWashPos;",
  "varying vec3 vWashNormal;"
].join("\n");

const FRAGMENT_DECL = [
  "uniform sampler2D uWashMaskX;",
  "uniform sampler2D uWashMaskY;",
  "uniform sampler2D uWashMaskZ;",
  "uniform vec3 uWashBoundsMin;",
  "uniform vec3 uWashBoundsSize;",
  "uniform float uWashTime;",
  "uniform int uDirtProfile;",
  "varying vec3 vWashPos;",
  "varying vec3 vWashNormal;",
  "float washHash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}",
  "float washNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(washHash(i),washHash(i+vec3(1,0,0)),f.x),mix(washHash(i+vec3(0,1,0)),washHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(washHash(i+vec3(0,0,1)),washHash(i+vec3(1,0,1)),f.x),mix(washHash(i+vec3(0,1,1)),washHash(i+vec3(1,1,1)),f.x),f.y),f.z);}",
  "float washTri(vec3 p,vec3 n,float s){vec3 w=pow(abs(normalize(n)),vec3(4.));w/=max(w.x+w.y+w.z,.0001);return washNoise(p.yzx*s)*w.x+washNoise(p.xzy*s)*w.y+washNoise(p.xyz*s)*w.z;}",
  "vec4 washChannels(vec3 p,vec3 n){vec3 q=clamp((p-uWashBoundsMin)/max(uWashBoundsSize,vec3(.0001)),vec3(0.),vec3(1.));vec3 w=pow(abs(normalize(n)),vec3(4.));w/=max(w.x+w.y+w.z,.0001);vec4 a=texture2D(uWashMaskX,q.yz);vec4 b=texture2D(uWashMaskY,q.xz);vec4 c=texture2D(uWashMaskZ,q.xy);vec4 m=a*w.x+b*w.y+c*w.z;return vec4(1.-m.r,m.g,m.b,m.a);}",
  "float washDirtProfile(vec3 p,vec3 n){float noise=washTri(p,n,5.2)*.72+washTri(p*1.7,n,13.)*.28;float lower=1.-smoothstep(-.7,.45,p.y);float top=max(dot(normalize(n),vec3(0.,1.,0.)),0.);if(uDirtProfile==1)return smoothstep(.3,.72,noise)*.58;if(uDirtProfile==2){float spots=washTri(p*2.8,n,9.);return smoothstep(.73,.9,spots)*lower*.95;}if(uDirtProfile==3){float cut=washTri(p*1.4,n,7.);return step(.68,cut)*smoothstep(.6,.9,top)*.9;}return smoothstep(.37,.7,noise)*mix(.28,1.,lower);}"
].join("\n");

export default class ProceduralWashMaterial {
  constructor(mesh, { dirtProfile = "mud", meshToModel = new THREE.Matrix4(), bounds } = {}) {
    this.mesh = mesh;
    this.original = mesh.material;
    this.currentTime = 0;
    this.boundsMin = bounds.min.clone();
    this.boundsSize = bounds.getSize(new THREE.Vector3());
    this.fadeIndices = new Set();
    this.lastFadeUpdate = 0;
    this.textures = AXES.map(() => this.createMaskTexture());
    this.dirtyTextures = new Set();
    this.uniformSets = [];
    const profiles = { mud: 0, soot: 1, tar: 2, debris: 3 };
    const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    this.materials = originals.map((source) => {
      const material = source.clone();
      const uniforms = {
        uWashMaskX: { value: this.textures[0] },
        uWashMaskY: { value: this.textures[1] },
        uWashMaskZ: { value: this.textures[2] },
        uWashBoundsMin: { value: this.boundsMin.clone() },
        uWashBoundsSize: { value: this.boundsSize.clone() },
        uWashTime: { value: 0 },
        uDirtProfile: { value: profiles[dirtProfile] ?? 0 },
        uWashMeshToModel: { value: meshToModel.clone() },\n        uWashMeshNormalMatrix: { value: new THREE.Matrix3().getNormalMatrix(meshToModel) },
      };
      this.uniformSets.push(uniforms);
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\n" + VERTEX_DECL)
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvec4 washModelPosition=uWashMeshToModel*vec4(position,1.);vWashPos=washModelPosition.xyz;vWashNormal=normalize(uWashMeshNormalMatrix*normal);");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\n" + FRAGMENT_DECL)
          .replace("#include <color_fragment>", "#include <color_fragment>\n" + [
            "vec4 washMask=washChannels(vWashPos,vWashNormal);",
            "float dirt=washDirtProfile(vWashPos,vWashNormal)*washMask.r;",
            "float mudGrain=washTri(vWashPos*24.,vWashNormal,1.);",
            "vec3 dirtColor=vec3(.25,.14,.075);",
            "if(uDirtProfile==1)dirtColor=vec3(.39,.36,.29);",
            "if(uDirtProfile==2)dirtColor=vec3(.055,.045,.035);",
            "if(uDirtProfile==3)dirtColor=vec3(.28,.34,.16);",
            "dirtColor*=mix(.72,1.25,mudGrain);",
            "diffuseColor.rgb=mix(diffuseColor.rgb,dirtColor,dirt*.76);",
            "float foamNoise=washTri(vWashPos*19.+vec3(0.,uWashTime*.025,0.),vWashNormal,1.);",
            "float soapFoam=washMask.b*smoothstep(.22,.74,foamNoise);",
            "float denseFoam=washMask.a*smoothstep(.18,.68,foamNoise*.72+washTri(vWashPos*43.,vWashNormal,1.)*.28);",
            "diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.0,.96,1.0),soapFoam*.72);",
            "vec3 dirtyFoam=mix(vec3(.91,.97,.99),vec3(.48,.43,.36),dirt*.62);",
            "vec3 bubbleCoord=vWashPos*vec3(12.,9.,12.);",
            "vec3 bubbleCell=floor(bubbleCoord);",
            "vec3 bubbleLocal=fract(bubbleCoord)-.5;",
            "float bubbleRadius=mix(.18,.43,washHash(bubbleCell));",
            "float bubbleDistance=length(bubbleLocal);",
            "float bubbleFill=1.-smoothstep(bubbleRadius-.035,bubbleRadius+.015,bubbleDistance);",
            "float bubbleRim=smoothstep(bubbleRadius-.085,bubbleRadius-.035,bubbleDistance);",
            "vec3 cartoonFoam=mix(dirtyFoam,vec3(.98,1.,1.),bubbleFill*.9);",
            "cartoonFoam=mix(cartoonFoam,vec3(.02,.48,.62),bubbleRim*.9);",
            "diffuseColor.rgb=mix(diffuseColor.rgb,cartoonFoam,denseFoam*.98);",
            "diffuseColor.rgb*=mix(1.,.74,washMask.g);"
          ].join("\n"))
          .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n" + [
            "vec4 washSurface=washChannels(vWashPos,vWashNormal);",
            "roughnessFactor=mix(roughnessFactor,.065,washSurface.g*.9);",
            "roughnessFactor=mix(roughnessFactor,.28,washSurface.b*.38);",
            "roughnessFactor=mix(roughnessFactor,.19,washSurface.a*.55);"
          ].join("\n"))
          .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n" + [
            "vec4 washFlow=washChannels(vWashPos,vWashNormal);",
            "float runoffPhase=vWashPos.y*27.+uWashTime*1.65+washTri(vWashPos*4.5,vWashNormal,1.)*3.4;",
            "float runoffLines=smoothstep(.72,.96,sin(runoffPhase))*washFlow.g;",
            "float droplets=smoothstep(.91,.99,washTri(vWashPos*vec3(11.,3.,11.)+vec3(0.,uWashTime*.45,0.),vWashNormal,1.))*washFlow.g;",
            "float runoff=runoffLines*.75+droplets*.45;",
            "normal=normalize(normal+vec3(dFdx(runoff),dFdy(runoff),0.)*1.65);"
          ].join("\n"));
      };
      material.customProgramCacheKey = () => "carwash-persistent-triplanar-mask-v1";
      material.needsUpdate = true;
      return material;
    });
    mesh.material = Array.isArray(this.original) ? this.materials : this.materials[0];
  }

  createMaskTexture() {
    const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
    const texture = new THREE.DataTexture(data, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.flipY = false;
    texture.colorSpace = THREE.NoColorSpace;
    texture.needsUpdate = true;
    texture.userData.fadeStarts = new Float32Array(TEXTURE_SIZE * TEXTURE_SIZE);\n    texture.userData.fadeOrigins = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE);
    texture.userData.fadeStarts.fill(-1);
    return texture;
  }

  getProjection(point, axis) {
    const { u, v } = AXES[axis];
    const p = [point.x, point.y, point.z];
    const min = [this.boundsMin.x, this.boundsMin.y, this.boundsMin.z];
    const size = [this.boundsSize.x, this.boundsSize.y, this.boundsSize.z];
    return {
      u: THREE.MathUtils.clamp((p[u] - min[u]) / Math.max(size[u], 0.0001), 0, 1),
      v: THREE.MathUtils.clamp((p[v] - min[v]) / Math.max(size[v], 0.0001), 0, 1),
      radiusU: 0,
      radiusV: 0,
    };
  }

  sample(point, normal = new THREE.Vector3(0, 1, 0)) {
    const weights = [Math.pow(Math.abs(normal.x), 4), Math.pow(Math.abs(normal.y), 4), Math.pow(Math.abs(normal.z), 4)];
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    const result = [0, 0, 0, 0];
    for (let axis = 0; axis < 3; axis++) {
      const projection = this.getProjection(point, axis);
      const x = Math.min(TEXTURE_SIZE - 1, Math.max(0, Math.round(projection.u * (TEXTURE_SIZE - 1))));
      const y = Math.min(TEXTURE_SIZE - 1, Math.max(0, Math.round(projection.v * (TEXTURE_SIZE - 1))));
      const data = this.textures[axis].image.data;
      const offset = (y * TEXTURE_SIZE + x) * 4;
      const weight = weights[axis] / sum;
      for (let channel = 0; channel < 4; channel++) result[channel] += data[offset + channel] / 255 * weight;
    }
    return { clean: result[0], wet: result[1], soap: result[2], foam: result[3] };
  }

  paint(point, radius, tool, time = this.currentTime, normal = new THREE.Vector3(0, 1, 0)) {
    let changed = false;
    let rinsed = false;
    const centerMask = this.sample(point, normal);
    if (tool === "soap" && centerMask.wet < 0.08) return { changed: false, rinsed: false };
    if (tool === "sponge" && centerMask.soap < 0.08) return { changed: false, rinsed: false };
    if (tool === "water") rinsed = centerMask.soap > 0.08 || centerMask.foam > 0.08;

    const pointArray = [point.x, point.y, point.z];
    const min = [this.boundsMin.x, this.boundsMin.y, this.boundsMin.z];
    const size = [this.boundsSize.x, this.boundsSize.y, this.boundsSize.z];

    for (let axis = 0; axis < 3; axis++) {
      const { u, v } = AXES[axis];
      const tex = this.textures[axis];
      const data = tex.image.data;
      const fadeStarts = tex.userData.fadeStarts;
      const uv = this.getProjection(point, axis);
      const radiusU = Math.min(0.4, radius / Math.max(size[u], 0.001));
      const radiusV = Math.min(0.4, radius / Math.max(size[v], 0.001));
      const rx = Math.max(1, Math.ceil(radiusU * TEXTURE_SIZE));
      const ry = Math.max(1, Math.ceil(radiusV * TEXTURE_SIZE));
      const cx = Math.round(uv.u * (TEXTURE_SIZE - 1));
      const cy = Math.round(uv.v * (TEXTURE_SIZE - 1));
      const minX = Math.max(0, cx - rx), maxX = Math.min(TEXTURE_SIZE - 1, cx + rx);
      const minY = Math.max(0, cy - ry), maxY = Math.min(TEXTURE_SIZE - 1, cy + ry);

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance >= 1) continue;
          const softness = 1 - THREE.MathUtils.smoothstep(distance, 0.72, 1);
          const offset = (y * TEXTURE_SIZE + x) * 4;
          const fadeIndex = y * TEXTURE_SIZE + x;
          const strength = Math.round(255 * softness);

          if (tool === "water") {
            if (data[offset + 1] < strength) { data[offset + 1] = strength; changed = true; }
            if (rinsed) {
              if (data[offset + 2] || data[offset + 3]) changed = true;
              data[offset + 2] = 0;
              data[offset + 3] = 0;
              if (data[offset + 1] > 0) {
                fadeStarts[fadeIndex] = time;
                this.fadeIndices.add(axis * TEXTURE_SIZE * TEXTURE_SIZE + fadeIndex);
              }
            }
          } else if (tool === "soap") {
            if (data[offset + 1] > 12 && data[offset + 2] < strength) {
              data[offset + 2] = strength;
              changed = true;
            }
          } else if (tool === "sponge") {
            if (data[offset + 1] > 12 && data[offset + 2] > 12) {
              if (data[offset] < strength) { data[offset] = strength; changed = true; }
              if (data[offset + 3] < strength) { data[offset + 3] = strength; changed = true; }
            }
          }
        }
      }
      if (changed) this.dirtyTextures.add(axis);
    }

    return { changed, rinsed };
  }

  isCleanAt(point, normal = new THREE.Vector3(0, 1, 0)) {
    return this.sample(point, normal).clean > 0.35;
  }

  flush() {
    for (const axis of this.dirtyTextures) this.textures[axis].needsUpdate = true;
    this.dirtyTextures.clear();
  }

  getFoamCount() {
    let count = 0;
    for (const texture of this.textures) {
      const data = texture.image.data;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 12 || data[i - 1] > 12) count++;
    }
    return count;
  }

  setDirtProfile(profile) {
    const profiles = { mud: 0, soot: 1, tar: 2, debris: 3 };
    const value = profiles[profile] ?? 0;
    for (const uniforms of this.uniformSets) uniforms.uDirtProfile.value = value;
  }

  update(time) {
    this.currentTime = time;
    for (const uniforms of this.uniformSets) uniforms.uWashTime.value = time;
    if (time - this.lastFadeUpdate < 0.2 || !this.fadeIndices.size) return;
    this.lastFadeUpdate = time;
    let changed = false;
    for (const encoded of [...this.fadeIndices]) {
      const axis = Math.floor(encoded / (TEXTURE_SIZE * TEXTURE_SIZE));
      const index = encoded % (TEXTURE_SIZE * TEXTURE_SIZE);
      const texture = this.textures[axis];
      const start = texture.userData.fadeStarts[index];
      const age = time - start;
      const offset = index * 4;
      if (age >= 9) {
        texture.image.data[offset + 1] = 0;
        texture.userData.fadeStarts[index] = -1;
        this.fadeIndices.delete(encoded);
      } else {
        texture.image.data[offset + 1] = Math.max(0, Math.round(texture.userData.fadeOrigins[index] * (1 - age / 9)));
      }
      this.dirtyTextures.add(axis);
      changed = true;
    }
    if (changed) this.flush();
  }

  dispose() {
    this.mesh.material = this.original;
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
    this.fadeIndices.clear();
  }
}
