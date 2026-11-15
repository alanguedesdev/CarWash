import * as THREE from "three";

const LIMIT = 64;

const VERTEX_DECL = [
  "varying vec3 vWashPos;",
  "varying vec3 vWashNormal;"
].join("\n");

const FRAGMENT_DECL = [
  "uniform vec4 uWashStamps[64];",
  "uniform float uWashTypes[64];",
  "uniform int uWashCount;",
  "uniform float uWashTime;",
  "uniform int uDirtProfile;",
  "varying vec3 vWashPos;",
  "varying vec3 vWashNormal;",
  "float washHash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}",
  "float washNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(washHash(i),washHash(i+vec3(1,0,0)),f.x),mix(washHash(i+vec3(0,1,0)),washHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(washHash(i+vec3(0,0,1)),washHash(i+vec3(1,0,1)),f.x),mix(washHash(i+vec3(0,1,1)),washHash(i+vec3(1,1,1)),f.x),f.y),f.z);}",
  "float washTri(vec3 p,vec3 n,float s){vec3 w=pow(abs(normalize(n)),vec3(4.));w/=max(w.x+w.y+w.z,.0001);return washNoise(p.yzx*s)*w.x+washNoise(p.xzy*s)*w.y+washNoise(p.xyz*s)*w.z;}",
  "vec4 washChannels(vec3 p){float dirtCut=0.,wet=0.,soap=0.,scrubFoam=0.,rinse=0.;for(int i=0;i<64;i++){if(i>=uWashCount)break;vec4 s=uWashStamps[i];float type=uWashTypes[i];float d=length(p-s.xyz);float edge=1.-smoothstep(s.w*.78,s.w,d);if(type<.5){dirtCut=max(dirtCut,edge);scrubFoam=max(scrubFoam,edge);}else if(type<1.5){rinse*=1.-edge;soap=max(soap,edge);}else if(type<2.5){wet=max(wet,edge);float fall=s.y-p.y;float travel=min(uWashTime*.16,1.25);float lateral=length((p-s.xyz).xz);float narrow=1.-smoothstep(s.w*.24,s.w*.62,lateral);float vertical=smoothstep(.025,.11,fall)*(1.-smoothstep(max(.12,travel*.82),max(.13,travel),fall));wet=max(wet,narrow*vertical*.78);}else if(type<3.5){rinse=max(rinse,edge);} }soap*=1.-rinse;scrubFoam*=1.-rinse;return vec4(1.-dirtCut,wet,soap,scrubFoam);}",
  "float washDirtProfile(vec3 p,vec3 n){float noise=washTri(p,n,5.2)*.72+washTri(p*1.7,n,13.)*.28;float lower=1.-smoothstep(-.7,.45,p.y);float top=max(dot(normalize(n),vec3(0.,1.,0.)),0.);if(uDirtProfile==1)return smoothstep(.3,.72,noise)*.58;if(uDirtProfile==2){float spots=washTri(p*2.8,n,9.);return smoothstep(.73,.9,spots)*lower*.95;}if(uDirtProfile==3){float cut=washTri(p*1.4,n,7.);return step(.68,cut)*smoothstep(.6,.9,top)*.9;}return smoothstep(.37,.7,noise)*mix(.28,1.,lower);}"
].join("\n");

export default class ProceduralWashMaterial {
  constructor(mesh, { dirtProfile = "mud" } = {}) {
    this.mesh = mesh;
    this.original = mesh.material;
    this.uniformSets = [];
    const profiles = { mud: 0, soot: 1, tar: 2, debris: 3 };
    const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    this.materials = originals.map((source) => {
      const material = source.clone();
      const uniforms = {
        uWashStamps: { value: Array.from({ length: LIMIT }, () => new THREE.Vector4()) },
        uWashTypes: { value: new Float32Array(LIMIT) },
        uWashCount: { value: 0 },
        uWashTime: { value: 0 },
        uDirtProfile: { value: profiles[dirtProfile] ?? 0 },
      };
      this.uniformSets.push(uniforms);
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\n" + VERTEX_DECL)
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWashPos=position;vWashNormal=normalize(normal);");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\n" + FRAGMENT_DECL)
          .replace("#include <color_fragment>", "#include <color_fragment>\n" + [
            "vec4 washMask=washChannels(vWashPos);",
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
            "diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.73,.9,.96),soapFoam*.76);",
            "diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.91,.98,1.),denseFoam*.94);",
            "diffuseColor.rgb*=mix(1.,.84,washMask.g*.25);"
          ].join("\n"))
          .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n" + [
            "vec4 washSurface=washChannels(vWashPos);",
            "roughnessFactor=mix(roughnessFactor,.065,washSurface.g*.9);",
            "roughnessFactor=mix(roughnessFactor,.28,washSurface.b*.38);",
            "roughnessFactor=mix(roughnessFactor,.19,washSurface.a*.55);"
          ].join("\n"))
          .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n" + [
            "vec4 washFlow=washChannels(vWashPos);",
            "float runoffPhase=vWashPos.y*27.-uWashTime*1.65+washTri(vWashPos*4.5,vWashNormal,1.)*3.4;",
            "float runoffLines=smoothstep(.72,.96,sin(runoffPhase))*washFlow.g;",
            "float droplets=smoothstep(.91,.99,washTri(vWashPos*vec3(11.,3.,11.)+vec3(0.,-uWashTime*.45,0.),vWashNormal,1.))*washFlow.g;",
            "float runoff=runoffLines*.75+droplets*.45;",
            "normal=normalize(normal+vec3(dFdx(runoff),dFdy(runoff),0.)*1.65);"
          ].join("\n"));
      };
      material.customProgramCacheKey = () => "carwash-rgba-triplanar-v2";
      material.needsUpdate = true;
      return material;
    });
    mesh.material = Array.isArray(this.original) ? this.materials : this.materials[0];
  }

  addStamp(point, radius, type) {
    for (const uniforms of this.uniformSets) {
      const i = uniforms.uWashCount.value;
      if (i < LIMIT) {
        uniforms.uWashStamps.value[i].set(point.x, point.y, point.z, radius);
        uniforms.uWashTypes.value[i] = type;
        uniforms.uWashCount.value = i + 1;
      } else {
        for (let j = 1; j < LIMIT; j++) {
          uniforms.uWashStamps.value[j - 1].copy(uniforms.uWashStamps.value[j]);
          uniforms.uWashTypes.value[j - 1] = uniforms.uWashTypes.value[j];
        }
        uniforms.uWashStamps.value[LIMIT - 1].set(point.x, point.y, point.z, radius);
        uniforms.uWashTypes.value[LIMIT - 1] = type;
      }
    }
  }

  setDirtProfile(profile) {
    const profiles = { mud: 0, soot: 1, tar: 2, debris: 3 };
    const value = profiles[profile] ?? 0;
    for (const uniforms of this.uniformSets) uniforms.uDirtProfile.value = value;
  }

  update(time) {
    for (const uniforms of this.uniformSets) uniforms.uWashTime.value = time;
  }

  dispose() {
    this.mesh.material = this.original;
    for (const material of this.materials) material.dispose();
  }
}
