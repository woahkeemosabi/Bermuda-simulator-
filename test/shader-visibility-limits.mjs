import assert from 'node:assert/strict';
import { GPU } from '../src/engine/gpu/GPU.js';
import { ShaderModule, composeShader, setFrameUniforms } from '../src/engine/gpu/Shader.js';
// No device required: inspect actual generated bind-group layouts on a mock adapter.
globalThis.GPUShaderStage={VERTEX:1,FRAGMENT:2,COMPUTE:4};
GPU.features=new Set();
GPU.limits={maxUniformBuffersPerShaderStage:12,maxStorageBuffersInVertexStage:4,maxStorageBuffersInFragmentStage:8};
GPU.device={createBindGroupLayout:desc=>desc};
setFrameUniforms({structName:'FakeFrame',wgsl:'struct FakeFrame { x: f32, }'});
const tex={defaultViewDimension:'2d',sampleType:'float',sampleCount:1,wgslType:()=> 'texture_2d<f32>'};
const bindings=Object.fromEntries(Array.from({length:21},(_,i)=>['t'+i,{texture:tex}]));
const m=new ShaderModule({name:'inherited-module',bindings});
const c=composeShader({modules:[m],stage:'compute',label:'reachability-compute-test',
 code:'fn helper() -> vec4f { return textureLoad(t17, vec2i(0,0), 0); }\n@compute @workgroup_size(8,8,1) fn main() { let v = helper(); }'});
const count=(set,flag)=>set.layout.entries.filter(e=>(e.visibility&flag) && !!e.texture).length;
assert.equal(count(c.bindings,4),1,'only reachable compute texture counts');
assert.equal(c.bindings.layout.entries[17].visibility,4);
assert.equal(c.bindings.layout.entries[16].visibility,0);
const render=composeShader({modules:[m],stage:'render',label:'reachability-render-test',
 code:'@vertex fn vs() -> vec4f { return vec4f(0.0); }\n@fragment fn fs() -> vec4f { return textureLoad(t2, vec2i(0,0), 0); }'});
assert.equal(count(render.bindings,1),0,'no inherited unused vertex textures');
assert.equal(count(render.bindings,2),1,'only reachable fragment texture counts');
assert.equal(render.bindings.layout.entries[2].visibility,2);
assert.equal(render.bindings.layout.entries[3].visibility,0);
console.log('Entry-point resource visibility tests passed (21 inherited textures, only one used).');
