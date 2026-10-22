import { GPU } from '../engine/gpu/GPU.js';
import { ShaderModule, UniformBlock } from '../engine/gpu/Shader.js';
import { FullscreenPass } from '../engine/render/FullscreenPass.js';
import { FrameUniforms, setFrameCamera } from '../engine/render/Frame.js';
import { Matrix4, Vector3 } from '../engine/math/index.js';
import { ACES_WGSL } from './PostFX.js';

// Mobile device rendering compatibility. All world systems (including the
// four-cascade FFT, spray, caustics, waves and wildlife) remain active.
// Only desktop temporal screen-effects are replaced by one filmic present pass.
export class MobilePostFX {
 constructor(renderer,{sceneRenderer,camera,underwater}={}){
  this.renderer=renderer;
  this.sceneRenderer=sceneRenderer;
  this.camera=camera;
  this.underwater=underwater;
  this.scale=1;
  this.isCompatibility=true;
  this.aaMode='fxaa';
  this.taau={jitterPhaseOverride:0};
  this.motionBlur=null;
  this.flare=null;
  this.lens={update(){}};
  this.outputTexture=null;
  this.outputSize=null;
  this._built=true;
  this._inW=0;this._inH=0;this._outW=0;this._outH=0;
  this._prevVP=new Matrix4();
  this._prevCameraPos=new Vector3();
  this._hasPrev=false;
  this.uniforms=new UniformBlock('MobileColorParams',{
   aoStrength:['f32',1],bloom:['f32',.05],
   vignette:['f32',.22],saturation:['f32',1.06],contrast:['f32',1.04],
   warmth:['f32',.02],grain:['f32',.009],sharpen:['f32',.22]
  },{label:'bermuda-mobile-filmic'});
  this.params=this.uniforms.fields;
  const colorModule=new ShaderModule({name:'bermudaMobileColor',
   uniforms:this.uniforms,uniformName:'mobileColor'});
  this._finalPass=new FullscreenPass({
   label:'Bermuda mobile one-pass ACES finish',
   colorFormats:[GPU.format],
   modules:[colorModule],
   bindings:{mobileHDR:{texture:()=>this.sceneRenderer.sceneRT.texture}},
   code:ACES_WGSL+"\nfn fragment(in:FSIn)->vec4f {\n let uv=clamp(in.uv,vec2f(0.0),vec2f(1.0));\n let texel=1.0/vec2f(textureDimensions(mobileHDR));\n var c=textureSampleLevel(mobileHDR,smpLinearClamp,uv,0.0).rgb;\n let neighbor=(textureSampleLevel(mobileHDR,smpLinearClamp,uv+vec2f(texel.x,0.0),0.0).rgb+\n  textureSampleLevel(mobileHDR,smpLinearClamp,uv-vec2f(texel.x,0.0),0.0).rgb+\n  textureSampleLevel(mobileHDR,smpLinearClamp,uv+vec2f(0.0,texel.y),0.0).rgb+\n  textureSampleLevel(mobileHDR,smpLinearClamp,uv-vec2f(0.0,texel.y),0.0).rgb)*0.25;\n c=max(c+(c-neighbor)*mobileColor.sharpen*.32,vec3f(0.0));\n c=c*vec3f(1.0+mobileColor.warmth,1.0,1.0-mobileColor.warmth);\n let lum=dot(c,vec3f(.2126,.7152,.0722));\n c=mix(vec3f(lum),c,mobileColor.saturation);\n c=pow(max(c,vec3f(0.0))/.18,vec3f(mobileColor.contrast))*.18;\n let v=(uv-.5)*vec2f(1.0,.82);\n c*=1.0-smoothstep(.25,.8,length(v))*mobileColor.vignette;\n let hashed=fract(sin(dot(in.pos.xy,vec2f(12.9898,78.233))+\n   f32(frame.frameIndex%127u)*.11)*43758.5453);\n c*=1.0+(hashed-.5)*mobileColor.grain;\n let graded=acesFilmicToneMapping(c,frame.exposure);\n return vec4f(linearToSrgb(graded),1.0);\n}\n"
  });
 }
 setScale(s){this.scale=Math.max(.5,Math.min(1,s));this.sceneRenderer.scale=this.scale;}
 beginFrame(){
  const w=this.outputSize?.width||this.renderer.width;
  const h=this.outputSize?.height||this.renderer.height;
  const iw=Math.max(1,Math.round(w*this.scale));
  const ih=Math.max(1,Math.round(h*this.scale));
  if(w!==this._outW||h!==this._outH||iw!==this._inW||ih!==this._inH){
   this._outW=w;this._outH=h;this._inW=iw;this._inH=ih;
   this.sceneRenderer.setSize(iw,ih);
   if(this.underwater?.setSize)this.underwater.setSize(iw,ih);
  }
  const cam=this.camera;
  cam.updateMatrixWorld();
  if(cam.matrixWorldInverse)cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  setFrameCamera(cam,iw,ih,{
   prevViewProj:this._hasPrev?this._prevVP:null,
   prevCameraPos:this._hasPrev?this._prevCameraPos:null
  });
  FrameUniforms.fields.outputResolution.value.set(w,h);
  this._prevVP.copy(FrameUniforms.fields.viewProjNoJitter.value);
  this._prevCameraPos.copy(FrameUniforms.fields.cameraPos.value);
  this._hasPrev=true;
 }
 render(){
  const out=this.outputTexture?this.outputTexture.view({dimension:'2d',mipLevelCount:1}):
   GPU.context.getCurrentTexture().createView();
  this._finalPass.render({colorViews:[out],clear:[0,0,0,1]});
 }
 endFrame(){}
 setBloom(value){this.params.bloom.value=value;}
 internalSize(){return {x:this._inW,y:this._inH};}
 passes(){return [['mobile ACES finish',this._finalPass]];}
}
