# vscode-unitylabshader 调研：可用于 tree-sitter-shaderlab 的资源

> 调研日期：2026-05-23
> 源项目：`vscode-unitylabshader`（VS Code Unity ShaderLab 扩展）
> 目标：从中提取预设信息以辅助 `tree-sitter-shaderlab` 语法定义

---

## 一、项目概览

`vscode-unitylabshader` 是一个 VS Code 扩展，提供 Unity ShaderLab 的语法高亮、代码补全、悬停提示、符号导航等功能。它使用**TextMate 语法**实现高亮，通过**预定义的 TypeScript 数据结构**实现补全和 Hover。

对 `tree-sitter-shaderlab` 有价值的有三类资源：

| 类别 | 文件 | 用途 |
|------|------|------|
| 语法结构 | `syntaxes/unityshader.tmLanguage.json` | 完整的关键词/类型/语义列表，层级关系 |
| 预设数据 | `src/hlsl/hlslGlobals.ts` (1768行) | HLSL 内置函数、语义、数据类型、关键字 |
| | `src/unity/unityGlobals.ts` (603行) | Unity 内置变量/函数/宏、ShaderLab 关键字、属性类型、Pragma 指令 |
| | `src/unity/urpGlobals.ts` (493行) | URP 管线变量/函数 |
| 解析逻辑 | `src/cache/symbolParser.ts` | 正则模式揭示语法结构 |
| | `src/analysis/variantAnalyzer.ts` | CGPROGRAM/HLSLPROGRAM 块边界检测 |

---

## 二、ShaderLab 语法结构（来自 TextMate 语法）

TextMate 语法定义了完整的 ShaderLab 层级结构，可直接映射为 tree-sitter 的 grammar 规则。

### 2.1 顶层声明

```
Shader "Name" {
    Properties { ... }
    [CustomEditor "..."]
    [FallBack "..."]
    [Category { ... }]          // 旧版
    SubShader { ... }           // 可多个，按优先级
}
```

### 2.2 ShaderLab 关键字全集

**结构关键字**（`keyword.structure.shaderlab`）：
```
Shader, Properties, SubShader, Pass, Category, LOD,
FallBack, CustomEditor, UsePass, GrabPass, Name
```

**属性类型**（`storage.type.property.shaderlab`）：
```
2D, 3D, Cube, CubeArray, 2DArray, Color, Vector, Float, Int, Integer, Range
```

**渲染状态命令**（`keyword.renderstate.shaderlab`）：
```
Blend, BlendOp, AlphaToMask, ColorMask, Cull, ZWrite, ZTest, ZClip,
Offset, Stencil, Comp, Pass, Fail, ZFail, ReadMask, WriteMask, Ref
```

**混合模式常量**（`constant.language.blendmode`）：
```
One, Zero, SrcColor, SrcAlpha, DstColor, DstAlpha,
OneMinusSrcColor, OneMinusSrcAlpha, OneMinusDstColor, OneMinusDstAlpha
```

**混合操作常量**（`constant.language.blendop`）：
```
Add, Sub, RevSub, Min, Max
```

**剔除模式常量**（`constant.language.cullmode`）：
```
Back, Front, Off
```

**比较函数常量**（`constant.language.comparison`）：
```
Less, Greater, LEqual, GEqual, Equal, NotEqual, Always, Never
```

**Tags 关键字**（`keyword.tags.shaderlab`）：
```
Tags, Queue, RenderType, LightMode, RenderPipeline,
DisableBatching, ForceNoShadowCasting, IgnoreProjector,
CanUseSpriteAtlas, PreviewType
```

**旧版关键字**（`keyword.other.shaderlab`）：
```
Lighting, Material, SetTexture, Fog, AlphaTest, BindChannels, Bind
```

**旧版纹理合成器**（`keyword.legacy.shaderlab`）：
```
combine, constantColor, matrix, previous, primary,
texture, constant, Double, Quad
```

### 2.3 CGPROGRAM / HLSLPROGRAM 块

TextMate 语法将 CGPROGRAM 和 HLSLPROGRAM 定义为独立块区域：

```
CGPROGRAM ... ENDCG       → cgprogram-block
CGINCLUDE ... ENDCG       → cgprogram-block
HLSLPROGRAM ... ENDHLSL   → hlslprogram-block
HLSLINCLUDE ... ENDHLSL   → hlslprogram-block
```

在 tree-sitter 中，这部分对应**语言注入点**（injection point），内部委托给 `tree-sitter-hlsl`。

### 2.4 预处理器指令

**基础指令**：
```
#define, #elif, #else, #endif, #error, #if, #ifdef, #ifndef,
#include, #line, #pragma, #undef, #warning
```

**Unity #pragma 子命令**（从 TextMate 的 `keyword.pragma.unityshader` 和 `unityGlobals.ts` 汇总）：

| Pragma | 说明 |
|--------|------|
| `#pragma vertex <name>` | 指定顶点着色器入口 |
| `#pragma fragment <name>` | 指定片元着色器入口 |
| `#pragma geometry <name>` | 指定几何着色器入口 |
| `#pragma hull <name>` | 指定 Hull 着色器入口 |
| `#pragma domain <name>` | 指定 Domain 着色器入口 |
| `#pragma surface <name> <lighting_model>` | 指定表面着色器 |
| `#pragma target <2.0/3.0/3.5/4.0/4.5/5.0>` | 指定 Shader Model 版本 |
| `#pragma multi_compile [_] <keywords>` | 全局多编译变体 |
| `#pragma multi_compile_local [_] <keywords>` | 本地多编译变体 |
| `#pragma shader_feature <keywords>` | 着色器特性（全局） |
| `#pragma shader_feature_local <keywords>` | 着色器特性（本地） |
| `#pragma multi_compile_fog` | 雾效变体 |
| `#pragma multi_compile_instancing` | GPU 实例化变体 |
| `#pragma multi_compile_shadowcaster` | 阴影投射变体 |
| `#pragma multi_compile_fwdbase` | 前向基础光照变体 |
| `#pragma multi_compile_fwdadd` | 前向附加光照变体 |
| `#pragma multi_compile_fwdadd_fullshadows` | 前向附加光照（带阴影） |
| `#pragma only_renderers <list>` | 限制渲染后端 |
| `#pragma exclude_renderers <list>` | 排除渲染后端 |
| `#pragma enable_d3d11_debug_symbols` | 启用 D3D11 调试符号 |
| `#pragma instancing_options <options>` | GPU 实例化选项 |
| `#pragma require <feature>` | 要求硬件特性 |
| `#pragma skip_variants <variant>` | 跳过特定变体 |

### 2.5 HLSL 语义全集

**数值语义**（可带数字后缀，如 `TEXCOORD0`-`TEXCOORD15`）：
```
BINORMAL[n], BLENDINDICES[n], BLENDWEIGHT[n], COLOR[n],
NORMAL[n], POSITION[n], PSIZE[n], TANGENT[n],
TEXCOORD[n], TESSFACTOR[n], DEPTH[n], SV_TARGET[n]
```

**固定语义**：
```
POSITIONT, FOG, VFACE, VPOS,
SV_CLIPDISTANCE[n], SV_CULLDISTANCE[n],
SV_COVERAGE, SV_DEPTH, SV_DEPTHGREATEREQUAL, SV_DEPTHLESSEQUAL,
SV_DISPATCHTHREADID, SV_DOMAINLOCATION,
SV_GROUPID, SV_GROUPINDEX, SV_GROUPTHREADID,
SV_GSINSTANCEID, SV_INNERCOVERAGE, SV_INSIDETESSFACTOR,
SV_INSTANCEID, SV_ISFRONTFACE, SV_OUTPUTCONTROLPOINTID,
SV_POSITION, SV_PRIMITIVEID, SV_RENDERTARGETARRAYINDEX,
SV_SAMPLEINDEX, SV_STENCILREF, SV_TESSFACTOR,
SV_VERTEXID, SV_VIEWPORTARRAYINDEX
```

---

## 三、HLSL 语法数据（来自 hlslGlobals.ts）

### 3.1 内置函数（~160+）

该文件完整列出了所有 HLSL intrinsic functions，包含参数签名。对 tree-sitter 的用处：可作为**验证数据集**（确保 parser 能正确解析它们的调用形式），但通常不需要作为 grammar 规则定义（它们只是普通函数调用）。

完整列表摘录（来自 Microsoft D3D HLSL 文档）：

| 分类 | 函数 |
|------|------|
| 数学 | `abs, acos, asin, atan, atan2, ceil, clamp, cos, cosh, cross, degrees, determinant, distance, dot, exp, exp2, floor, fma, fmod, frac, frexp, length, lerp, lit, log, log10, log2, mad, max, min, modf, mul, normalize, pow, radians, rcp, reflect, refract, round, rsqrt, saturate, sign, sin, sincos, sinh, smoothstep, sqrt, step, tan, tanh, trunc` |
| 类型转换 | `asdouble, asfloat, asint, asuint, f16tof32, f32tof16, D3DCOLORtoUBYTE4` |
| 位操作 | `countbits, firstbithigh, firstbitlow, reversebits` |
| 偏导数 | `ddx, ddx_coarse, ddx_fine, ddy, ddy_coarse, ddy_fine, fwidth` |
| 比较 | `all, any, isfinite, isinf, isnan` |
| 同步 | `AllMemoryBarrier, AllMemoryBarrierWithGroupSync, DeviceMemoryBarrier, DeviceMemoryBarrierWithGroupSync, GroupMemoryBarrier, GroupMemoryBarrierWithGroupSync` |
| 原子操作 | `InterlockedAdd, InterlockedAnd, InterlockedCompareExchange, InterlockedCompareStore, InterlockedExchange, InterlockedMax, InterlockedMin, InterlockedOr, InterlockedXor` |
| 纹理采样 | `tex1D, tex1Dbias, tex1Dgrad, tex1Dlod, tex1Dproj, tex2D, tex2Dbias, tex2Dgrad, tex2Dlod, tex2Dproj, tex3D, tex3Dbias, tex3Dgrad, tex3Dlod, tex3Dproj, texCUBE, texCUBEbias, texCUBEgrad, texCUBElod, texCUBEproj` |
| 纹理对象方法 | `Sample, SampleBias, SampleCmp, SampleCmpLevelZero, SampleGrad, SampleLevel, Load, Gather, GatherRed, GatherGreen, GatherBlue, GatherAlpha` |
| 特殊查询 | `CheckAccessFullyMapped, EvaluateAttributeAtCentroid, EvaluateAttributeAtSample, EvaluateAttributeSnapped, GetRenderTargetSampleCount, GetRenderTargetSamplePosition` |
| Wave Intrinsics | `WaveActiveAllEqual, WaveActiveBallot, WaveActiveBitAnd, WaveActiveBitOr, WaveActiveBitXor, WaveActiveCountBits, WaveActiveMax, WaveActiveMin, WaveActiveProduct, WaveActiveSum, WaveActiveAllTrue, WaveActiveAnyTrue, WaveGetLaneCount, WaveGetLaneIndex, WaveIsFirstLane, WavePrefixProduct, WavePrefixSum, WaveReadLaneAt, WaveReadLaneFirst` |
| Quad Intrinsics | `QuadReadLaneAt, QuadReadAcrossDiagonal, QuadReadAcrossX, QuadReadAcrossY` |
| 其他 | `clip/discard, abort, msad4, noise, NonUniformResourceIndex` |

### 3.2 数据类型全集

**标量类型**：
```
bool, int, uint, dword, half, float, double, fixed, void, string
min16float, min10float, min16int, min12int, min16uint
```

**向量类型**（各类型 × [1-4] 维度）：
```
bool1-4, int1-4, uint1-4, half1-4, float1-4, double1-4, fixed1-4
min16float1-4, min10float1-4, min16int1-4, min12int1-4, min16uint1-4
```

**矩阵类型**（各类型 × [1-4]×[1-4] 维度）：
```
float1x1-4x4, half1x1-4x4, double1x1-4x4, int1x1-4x4, uint1x1-4x4, bool1x1-4x4, fixed1x1-4x4
```

**纹理类型**：
```
texture, Texture1D, Texture1DArray, Texture2D, Texture2DArray,
Texture2DMS, Texture2DMSArray, Texture3D, TextureCube, TextureCubeArray
```

**可读写纹理**：
```
RWTexture1D, RWTexture1DArray, RWTexture2D, RWTexture2DArray, RWTexture3D
```

**采样器类型**：
```
sampler, sampler1D, sampler2D, sampler3D, samplerCUBE,
sampler_state, SamplerState, SamplerComparisonState
```

**Buffer 类型**：
```
Buffer, RWBuffer, StructuredBuffer, RWStructuredBuffer,
AppendStructuredBuffer, ConsumeStructuredBuffer,
ByteAddressBuffer, RWByteAddressBuffer,
cbuffer, tbuffer, ConstantBuffer
```

**输出流类型**：
```
PointStream, LineStream, TriangleStream
```

**其他**：
```
InputPatch, OutputPatch, PixelShader, VertexShader,
GeometryShader, HullShader, DomainShader, ComputeShader
```

### 3.3 HLSL 关键字全集（~130+）

```
AppendStructuredBuffer, BlendState, Buffer, ByteAddressBuffer,
CompileShader, ComputeShader, ConsumeStructuredBuffer,
DepthStencilState, DepthStencilView, DomainShader,
GeometryShader, Hullshader, InputPatch,
LineStream, OutputPatch, PixelShader, PointStream,
RasterizerState, RenderTargetView, RWBuffer,
RWByteAddressBuffer, RWStructuredBuffer,
RWTexture1D, RWTexture1DArray, RWTexture2D, RWTexture2DArray, RWTexture3D,
SamplerState, SamplerComparisonState, StructuredBuffer,
Texture1D, Texture1DArray, Texture2D, Texture2DArray,
Texture2DMS, Texture2DMSArray, Texture3D, TextureCube, TextureCubeArray,
TriangleStream, VertexShader,
// C-like keywords
asm, asm_fragment, bool, break, case, cbuffer, centroid, class,
column_major, compile, compile_fragment, const, continue, default,
discard, do, double, dword, else, export, extern, false, float,
for, fxgroup, groupshared, half, if, in, inline, inout, int,
interface, line, lineadj, linear, matrix, namespace,
nointerpolation, noperspective, NULL, out, packoffset,
pass, pixelfragment, point, precise,
register, return, row_major, sample, sampler, shared,
snorm, stateblock, stateblock_state, static, string, struct,
switch, tbuffer, technique, technique10, technique11,
texture, true, typedef, triangle, triangleadj, uint,
uniform, unorm, unsigned, vector, vertexfragment, void, volatile, while
```

---

## 四、Unity 内置数据（来自 unityGlobals.ts）

### 4.1 Unity 内置变量（~70+）

**变换矩阵（Matrix）**：
```
UNITY_MATRIX_MVP, UNITY_MATRIX_MV, UNITY_MATRIX_V, UNITY_MATRIX_P,
UNITY_MATRIX_VP, UNITY_MATRIX_T_MV, UNITY_MATRIX_IT_MV,
UNITY_MATRIX_M, UNITY_MATRIX_I_M, UNITY_MATRIX_I_V,
unity_ObjectToWorld, unity_WorldToObject,
unity_MatrixVP, unity_MatrixV, unity_MatrixInvV
```

**相机参数（Camera）**：
```
_WorldSpaceCameraPos, _ProjectionParams, _ScreenParams,
_ZBufferParams, unity_OrthoParams, unity_CameraProjection,
unity_CameraInvProjection, unity_CameraWorldClipPlanes
```

**时间变量（Time）**：
```
_Time, _SinTime, _CosTime, unity_DeltaTime
```

**光照变量（Lighting）**：
```
_WorldSpaceLightPos0, _LightPositionRange, _LightColor0,
unity_4LightPosX0, unity_4LightPosY0, unity_4LightPosZ0,
unity_4LightAtten0, unity_LightColor,
unity_WorldToShadow, _LightShadowData,
unity_ShadowFadeCenterAndType
```

**环境光/球谐（Ambient）**：
```
unity_AmbientSky, unity_AmbientEquator, unity_AmbientGround,
UNITY_LIGHTMODEL_AMBIENT,
unity_SHAr, unity_SHAg, unity_SHAb,
unity_SHBr, unity_SHBg, unity_SHBb, unity_SHC
```

**雾效（Fog）**：
```
unity_FogColor, unity_FogParams
```

**光照贴图（Lightmap）**：
```
unity_Lightmap, unity_LightmapST,
unity_DynamicLightmap, unity_DynamicLightmapST
```

### 4.2 Unity 内置函数（~40）

| 分类 | 函数 |
|------|------|
| 空间变换 | `UnityObjectToClipPos`, `UnityObjectToViewPos`, `UnityWorldToClipPos`, `UnityViewToClipPos`, `UnityObjectToWorldNormal`, `UnityObjectToWorldDir`, `UnityWorldToObjectDir`, `UnityWorldSpaceViewDir`, `UnityWorldSpaceLightDir`, `ObjSpaceViewDir`, `ObjSpaceLightDir` |
| 屏幕坐标 | `ComputeScreenPos`, `ComputeGrabScreenPos` |
| 深度 | `LinearEyeDepth`, `Linear01Depth`, `COMPUTE_EYEDEPTH`, `DECODE_EYEDEPTH` |
| 光照 | `Shade4PointLights`, `ShadeSH9`, `ShadeSH3Order`, `ShadeVertexLights` |
| 纹理采样 | `tex2D`, `tex2Dlod`, `tex2Dbias`, `tex2Dgrad`, `tex2Dproj`, `texCUBE`, `texCUBElod`, `texCUBEbias` |
| 编解码 | `DecodeFloatRG`, `EncodeFloatRG`, `DecodeFloatRGBA`, `EncodeFloatRGBA`, `DecodeHDR`, `EncodeHDR` |
| 色彩空间 | `GammaToLinearSpace`, `LinearToGammaSpace` |
| 法线 | `UnpackNormal`, `UnpackNormalWithScale` |

### 4.3 Unity 宏

**通用宏**：
```
UNITY_VERTEX_INPUT_INSTANCE_ID, UNITY_VERTEX_OUTPUT_STEREO,
UNITY_SETUP_INSTANCE_ID, UNITY_TRANSFER_INSTANCE_ID,
UNITY_SETUP_STEREO_EYE_INDEX_POST_VERTEX,
UNITY_INITIALIZE_OUTPUT, UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO
```

**变换宏**：
```
TRANSFORM_TEX, UNITY_TRANSFER_FOG, UNITY_APPLY_FOG, UNITY_FOG_COORDS
```

**阴影宏**：
```
SHADOW_COORDS, TRANSFER_SHADOW, SHADOW_ATTENUATION,
UNITY_SHADOW_COORDS, UNITY_TRANSFER_SHADOW,
UNITY_SHADOW_ATTENUATION, UNITY_LIGHT_ATTENUATION
```

**纹理声明/采样宏（URP 风格）**：
```
UNITY_DECLARE_TEX2D, UNITY_DECLARE_TEX2D_NOSAMPLER,
UNITY_DECLARE_TEX2DARRAY, UNITY_DECLARE_TEXCUBE,
UNITY_DECLARE_TEXCUBEARRAY, UNITY_DECLARE_TEX3D,
UNITY_SAMPLE_TEX2D, UNITY_SAMPLE_TEX2D_SAMPLER,
UNITY_SAMPLE_TEX2DARRAY, UNITY_SAMPLE_TEX2DARRAY_LOD,
UNITY_SAMPLE_TEXCUBE, UNITY_SAMPLE_TEXCUBE_LOD,
UNITY_SAMPLE_TEX3D, UNITY_SAMPLE_TEX3D_LOD
```

**纹理采样宏（SRP Batch 兼容，定义于 URP）**：
```
SAMPLE_TEXTURE2D, SAMPLE_TEXTURE2D_LOD, SAMPLE_TEXTURE2D_BIAS,
SAMPLE_TEXTURE2D_GRAD, SAMPLE_TEXTURE2D_ARRAY,
SAMPLE_TEXTURE2D_ARRAY_LOD,
SAMPLE_TEXTURECUBE, SAMPLE_TEXTURECUBE_LOD,
SAMPLE_TEXTURE3D, SAMPLE_TEXTURE3D_LOD,
LOAD_TEXTURE2D, LOAD_TEXTURE2D_LOD, LOAD_TEXTURE2D_MSAA,
GATHER_TEXTURE2D, GATHER_RED_TEXTURE2D, GATHER_GREEN_TEXTURE2D,
GATHER_BLUE_TEXTURE2D, GATHER_ALPHA_TEXTURE2D
```

**CBUFFER 宏（SRP）**：
```
CBUFFER_START, CBUFFER_END
```

**纹理声明宏（SRP）**：
```
TEXTURE2D, TEXTURE2D_ARRAY, TEXTURECUBE, TEXTURE3D,
SAMPLER, SAMPLER_CMP
```

---

## 五、对 tree-sitter-shaderlab 的具体帮助

### 5.1 可直接转化为 grammar 规则的信息

**ShaderLab 层级结构**（从 TextMate + snippets + unityGlobals 推断）：

```javascript
// ShaderLab 顶层结构
shader_definition := 'Shader' string_literal '{'
    optional(properties_block)
    [custom_editor]
    [fallback]
    [category_block | subshader_block]+
'}'

properties_block := 'Properties' '{' property_declaration* '}'
property_declaration := identifier '(' string_literal ',' property_type ')' '=' default_value
property_type := '2D' | '3D' | 'Cube' | 'CubeArray' | '2DArray'
               | 'Color' | 'Vector' | 'Float' | 'Int' | 'Integer'
               | 'Range' '(' number ',' number ')'

subshader_block := 'SubShader' '{'
    [tags_block]
    [lod_declaration]
    render_state*
    (pass_block | use_pass | grab_pass)*
'}'

pass_block := 'Pass' '{'
    ['Name' string_literal]
    [tags_block]
    render_state*
    (cg_program_block | hlsl_program_block)
'}'

tags_block := 'Tags' '{' (string_literal '=' string_literal)+ '}'

render_state := 'Cull' cull_mode
              | 'ZWrite' ('On' | 'Off')
              | 'ZTest' comparison_func
              | 'Blend' blend_mode [blend_mode]
              | 'BlendOp' blend_op
              | 'ColorMask' ('RGBA' | 'RGB' | 'A' | '0' | number)
              | 'Offset' number ',' number
              | 'AlphaToMask' ('On' | 'Off')
              | 'ZClip' ('True' | 'False')
              | 'Stencil' '{' stencil_op* '}'
              | 'Conservative' ('True' | 'False')

cg_program_block := ('CGPROGRAM' | 'CGINCLUDE') ... 'ENDCG'
hlsl_program_block := ('HLSLPROGRAM' | 'HLSLINCLUDE') ... 'ENDHLSL'
```

### 5.2 关键词 token 列表

该扩展提供了**完整的、生产验证的** token 词表，可直接作为 tree-sitter grammar 中的 `token()` 或 `choice()` 候选列表。所有分类见上文的第二章。

### 5.3 属性语法参考

从 `unityGlobals.ts` 的 `shaderLabPropertyTypes` 和 `snippets/unityshader.json` 中可获取**精确的属性定义语法**：

```
_Name ("Display Name", Type [options]) = DefaultValue

类型      | 默认值格式         | 示例
2D        | "white" {}         | _MainTex ("Texture", 2D) = "white" {}
3D        | "" {}              | _Volume ("Volume", 3D) = "" {}
Cube      | "_Skybox" {}       | _Cube ("Cubemap", Cube) = "_Skybox" {}
CubeArray | "" {}              |
2DArray   | "" {}              |
Color     | (r,g,b,a)          | _Color ("Color", Color) = (1,1,1,1)
Vector    | (x,y,z,w)          | _Vector ("Vector", Vector) = (0,0,0,0)
Float     | number             | _Float ("Float", Float) = 1.0
Int       | number             | _Int ("Int", Int) = 1
Integer   | number             | _Integer ("Integer", Integer) = 1
Range     | number             | _Range ("Range", Range(0, 1)) = 0.5
```

注意：`Color`/`Vector` 的默认值 `(1,1,1,1)` 语法在 tree-sitter-hlsl 中会被解析为括号表达式或参数列表，因此在 ShaderLab grammar 中需要特别处理这个上下文。

### 5.4 Stencil 操作的完整语法

```
Stencil {
    Ref <referenceValue>
    ReadMask <readMask>
    WriteMask <writeMask>
    Comp <comparisonFunc>        // Back/Front 可选前缀
    Pass <stencilOp>
    Fail <stencilOp>
    ZFail <stencilOp>
    CompBack <comparisonFunc>
    PassBack <stencilOp>
    FailBack <stencilOp>
    ZFailBack <stencilOp>
    CompFront <comparisonFunc>
    PassFront <stencilOp>
    FailFront <stencilOp>
    ZFailFront <stencilOp>
}
```

### 5.5 预处理器在 ShaderLab 中的特殊性

与普通 C/HLSI 文件不同，ShaderLab 中的预处理器只存在于 `CGPROGRAM`/`HLSLPROGRAM` 块内（ShaderLab 本体不使用预处理器）。因此 tree-sitter-shaderlab 可以将预处理器语法**仅在 injection block 内激活**。

---

## 六、建议的 tree-sitter-shaderlab 架构

基于以上调研，推荐以下架构：

```
tree-sitter-shaderlab/
├── grammar.js          ← ShaderLab 主语法（独立，不继承 CPP/HLSL）
├── src/
│   ├── scanner.c       ← 外部扫描器（可能需要处理属性默认值歧义）
│   ├── parser.c        ← 自动生成
│   └── grammar.json    ← 自动生成
├── queries/
│   ├── highlights.scm  ← 语法高亮查询
│   └── injections.scm  ← 语言注入配置
└── test/
    └── corpus/
        ├── basic.txt       ← 基础 ShaderLab 结构
        ├── properties.txt  ← 属性块测试
        ├── stencil.txt     ← Stencil 操作测试
        └── cgprogram.txt   ← CGPROGRAM 块测试
```

### 语言注入配置 (`queries/injections.scm`)

```
((cg_program_block) @content
  (#set! "language" "hlsl"))

((hlsl_program_block) @content
  (#set! "language" "hlsl"))
```

这样 `CGPROGRAM...ENDCG` 块内部的内容会自动委托给 `tree-sitter-hlsl` 解析，无需在 ShaderLab grammar 中重复定义 HLSL 语法。

---

## 七、总结：关键可复用资源

| 优先级 | 资源 | 来源文件 | 用途 |
|--------|------|----------|------|
| ⭐⭐⭐ | ShaderLab 关键字分类 | `tmLanguage.json` §shaderlab | Grammar token 定义 |
| ⭐⭐⭐ | CG/HLSL 块边界标记 | `tmLanguage.json` §cgprogram-block | Injection point 定义 |
| ⭐⭐⭐ | 属性类型及默认值语法 | `unityGlobals.ts` `shaderLabPropertyTypes` | Properties 语法规则 |
| ⭐⭐⭐ | 渲染状态命令全集 | `tmLanguage.json` + `unityGlobals.ts` | Render state 语法规则 |
| ⭐⭐ | Stencil 操作 | `unityGlobals.ts` `shaderLabKeywords` | Stencil 块语法 |
| ⭐⭐ | Pragma 指令全集 | `unityGlobals.ts` `pragmaDirectives` | Preprocessor 规则 |
| ⭐⭐ | 语义全集 | `hlslGlobals.ts` `semantics` + `semanticsNum` | HLSL injection 内的语义高亮 |
| ⭐ | HLSL 内置函数/类型 | `hlslGlobals.ts` | 验证数据（HLSL parser 已处理） |
| ⭐ | Unity 内置变量/宏 | `unityGlobals.ts` + `urpGlobals.ts` | 验证数据 |
| ⭐ | 完整代码模板 | `snippets/unityshader.json` | 测试用例参考 |

**最大价值**：TextMate 语法 (`tmLanguage.json`) 提供了经过生产验证的完整关键词分类和层级关系，可以直接转化为 tree-sitter grammar 的规则定义。全局定义文件 (`*Globals.ts`) 提供了完整的 token 词表，可用于验证 parser 覆盖的完整性。