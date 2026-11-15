import * as THREE from "three";

const LIMIT = 48;
const VERTEX_DECL = "varying vec3 vWashPos; varying vec3 vWashNormal;";
const FRAGMENT_DECL = [
  "uniform vec4 uWashStamps[48]; uniform float uWashTypes[48]; uniform int uWashCount; uniform float uWashTime;",
  "varying vec3 vWashPos; varying vec3 vWashNormal;",
  "float washHash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}",
  "float washNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(washHash(i),washHash(i+vec3(1,0,0)),f.x),mix(washHash(i+vec3(0,1,0)),washHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(washHash(i+vec3(0,0,1)),washHash(i+vec3(1,0,1)),f.x),mix(washHash(i+vec3(0,1,1)),washHash(i+vec3(1,1,1)),f.x),f.y),f.z);}",
  "float washTri(vec3 p,vec3 n,float s){vec3 w=pow(abs(normalize(n)),vec3(4.));w/=max(w.x+w.y+w.z,.0001);return washNoise(p.yzx*s)*w.x+washNoise(p.xzy*s)*w.y+washNoise(p.xyz*s)*w.z;}",
  "vec3 washState(vec3 p){float scrub=0.,soap=0.,wet=0.,rinse=0.;for(int i=0;i<48;i++){if(i>=uWashCount)break;vec4 s=uWashStamps[i];float d=length(p-s.xyz);float a=1.-smoothstep(s.w*.5,s.w,d);float t=uWashTypes[i];if(t<.5)scrub=max(scrub,a);else if(t<1.5)soap=max(soap,a);else if(t<2.5)wet=max(wet,a);else rinse=max(rinse,a);}soap*=1.-rinse;wet=max(wet,rinse);return vec3(scrub,soap,wet);}"
].join("\n");

export default class ProceduralWashMaterial {
  constructor(mesh) {
    this.mesh = mesh;
    this.original = mesh.material;
    this.uniformSets = [];
    const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    this.materials = originals.map((source) => {
      const material = source.clone();
      const uniforms = {
        uWashStamps: { value: Array.from({ length: LIMIT }, () => new THREE.Vector4()) },
        uWashTypes: { value: new Float32Array(LIMIT) },
        uWashCount: { value: 0 },
        uWashTime: { value: 0 },
      };
      this.uniformSets.push(uniforms);
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\n" + VERTEX_DECL)
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWashPos=position;vWashNormal=normalize(normal);");
        shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\n" + FRAGMENT_DECL)
          .replace("#include <color_fragment>", "#include <color_fragment>\n" +
            "float dn=washTri(vWashPos,vWashNormal,5.2);float dg=washTri(vWashPos*1.7,vWashNormal,13.);float dirt=smoothstep(.43,.76,dn*.78+dg*.22)*smoothstep(-.9,.35,vWashPos.y+.25);vec3 ws=washState(vWashPos);diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.36,.25,.15),dirt*(1.-ws.x*.98)*.72);float fp=washTri(vWashPos*18.+vec3(0.,uWashTime*.08,0.),vWashNormal,1.);float foam=ws.y*smoothstep(.28,.72,fp);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.88,.97,1.),foam*.82);diffuseColor.rgb*=mix(1.,.82,ws.z*.42);")
          .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nvec3 wsR=washState(vWashPos);roughnessFactor=mix(roughnessFactor,.075,wsR.z*.88);roughnessFactor=mix(roughnessFactor,.32,wsR.y*.35);")
          .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nvec3 wsN=washState(vWashPos);float flow=sin(vWashPos.y*34.-uWashTime*2.8+washTri(vWashPos*5.,vWashNormal,1.)*4.);float streak=smoothstep(.72,.98,flow)*wsN.z;normal=normalize(normal+vec3(dFdx(streak),dFdy(streak),0.)*1.8);");
      };
      material.customProgramCacheKey = () => "carwash-triplanar-procedural-v1";
      material.needsUpdate = true;
      return material;
    });
    mesh.material = Array.isArray(this.original) ? this.materials : this.materials[0];
  }
  addStamp(point, radius, type) {
    for (const u of this.uniformSets) {
      const i = u.uWashCount.value;
      if (i < LIMIT) {
        u.uWashStamps.value[i].set(point.x, point.y, point.z, radius);
        u.uWashTypes.value[i] = type;
        u.uWashCount.value = i + 1;
      } else {
        for (let j=1;j<LIMIT;j++) { u.uWashStamps.value[j-1].copy(u.uWashStamps.value[j]); u.uWashTypes.value[j-1]=u.uWashTypes.value[j]; }
        u.uWashStamps.value[LIMIT-1].set(point.x,point.y,point.z,radius);
        u.uWashTypes.value[LIMIT-1]=type;
      }
    }
  }
  update(time) { for (const u of this.uniformSets) u.uWashTime.value=time; }
  dispose() { this.mesh.material=this.original; for (const m of this.materials) m.dispose(); }
}