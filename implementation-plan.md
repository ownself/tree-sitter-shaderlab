# tree-sitter-shaderlab 实现计划

> 创建日期：2026-05-23
> 目标：为 Unity ShaderLab 语言实现完整的 tree-sitter 语法解析器
>
> 参考文档：
> - `research-vscode-extension.md` — vscode-unitylabshader 插件调研
> - `../tree-sitter-hlsl/grammar.js` — tree-sitter-hlsl 的继承模式参考
> - [tree-sitter 官方文档](https://tree-sitter.github.io/tree-sitter/)

---

## 一、总体设计思路

### 1.1 核心架构决策

**决策 1：独立语法，不继承 CPP/HLSL**

与 `tree-sitter-hlsl` 继承 `tree-sitter-cpp` 不同，ShaderLab 的语法结构与 C-like 语言差异巨大。ShaderLab 是一个**声明式配置语言 + HLSL 嵌入的混合体**：

```
Shader "Name" {           ← ShaderLab 声明式语法
    Properties { ... }    ← 属性定义（独有语法）
    SubShader {           ← 层级结构
        Tags { ... }      ← key-value 对
        Cull Back         ← 命令式渲染状态
        Pass {
            CGPROGRAM     ← 从此开始是纯 HLSL
            ...           ← 委托给 tree-sitter-hlsl
            ENDCG
        }
    }
}
```

因此采用**独立语法定义**，不继承任何现有 grammar。

**决策 2：CGPROGRAM/HLSLPROGRAM 通过语言注入委托给 tree-sitter-hlsl**

ShaderLab 语法只定义 CGPROGRAM/ENDCG 的**边界标记**，块内内容作为一个 token 节点，通过 tree-sitter 的 injection query 机制委托给 `tree-sitter-hlsl` 解析。这避免了在 ShaderLab grammar 中重复定义整个 HLSL 语法。

**决策 3：不需要外部扫描器（初期）**

tree-sitter-hlsl 的外部扫描器仅用于 raw string literal `R"(...)"`。ShaderLab 本体不包含需要外部扫描器的 token。CGPROGRAM 块内的 raw string 由注入的 HLSL parser 处理。因此 Phase 1-3 不需要 `scanner.c`。

### 1.2 项目结构

```
tree-sitter-shaderlab/
├── grammar.js              ← 核心语法定义（手工编写，~300-500 行）
├── src/
│   ├── scanner.c           ← 外部扫描器（可能后期需要，初期为空桩）
│   ├── parser.c            ← tree-sitter generate 自动生成
│   └── grammar.json        ← 自动生成的中间表示
├── queries/
│   ├── highlights.scm      ← 语法高亮查询
│   ├── injections.scm      ← 语言注入配置（CGPROGRAM → HLSL）
│   └── locals.scm          ← 局部变量/定义查询
├── test/
│   └── corpus/
│       ├── shader.txt      ← Shader 声明 + 基础结构
│       ├── properties.txt  ← Properties 块
│       ├── render-state.txt← 渲染状态
│       ├── stencil.txt     ← Stencil 块
│       ├── cgprogram.txt   ← CGPROGRAM 边界
│       └── legacy.txt      ← 旧版语法
├── examples/               ← 真实 Shader 示例
├── package.json
├── Cargo.toml
├── tree-sitter.json
├── Makefile
└── README.md
```

### 1.3 技术参考

| 参考源 | 参考内容 |
|--------|----------|
| `tree-sitter-hlsl/grammar.js` | 继承模式、`grammar()` 调用结构、`conflicts` 配置 |
| `tree-sitter-hlsl/src/scanner.c` | 外部扫描器的实现模板（如后期需要） |
| `tree-sitter-hlsl/package.json` | npm 包配置、构建脚本 |
| `tree-sitter-hlsl/tree-sitter.json` | 项目元数据格式 |
| `tree-sitter-hlsl/Makefile` | C 库构建流程 |
| `vscode-unitylabshader/syntaxes/unityshader.tmLanguage.json` | **完整的关键词分类和层级关系**（直接可转译） |
| `vscode-unitylabshader/src/unity/unityGlobals.ts` | ShaderLab 属性类型、Pragma 指令、渲染状态列表 |
| `vscode-unitylabshader/snippets/unityshader.json` | 真实语法模板（作为测试用例参考） |
| [tree-sitter 创建 parser 指南](https://tree-sitter.github.io/tree-sitter/creating-parsers) | `tree-sitter generate` 用法、grammar DSL 语法 |
| [tree-sitter 语言注入](https://tree-sitter.github.io/tree-sitter/syntax-highlighting#language-injection) | `#set!` injection query 语法 |

---

## 二、分阶段实现计划

---

### Phase 1：项目初始化与基础框架 ✅

**目标**：搭建可编译、可测试的最小 tree-sitter 项目骨架。

#### Todo

- [x] **1.1** 使用 `tree-sitter generate` 的脚手架或手动创建项目目录结构
  - 创建 `grammar.js`（初始只包含最小的 `source_file` 规则）
  - 创建 `package.json`（依赖 `tree-sitter-cli` 作为 devDependency，`tree-sitter-hlsl` 作为测试用 devDependency）
  - 创建 `Cargo.toml`（Rust binding）
  - 创建 `tree-sitter.json`
  - 创建 `Makefile`

- [x] **1.2** 编写最小 grammar.js，验证 `tree-sitter generate` 能正常生成 parser
  ```javascript
  module.exports = grammar({
      name: 'shaderlab',
      rules: {
          source_file: $ => repeat($._statement),
          _statement: $ => choice(
              $.shader_definition,
          ),
          shader_definition: $ => seq(
              'Shader',
              $.string_literal,
              '{', '}',
          ),
          string_literal: $ => seq('"', /[^"]*/, '"'),
      }
  });
  ```
  - 运行 `npx tree-sitter generate` 确认生成 `src/parser.c`
  - 运行 `npx tree-sitter test` 确认测试框架工作

- [x] **1.3** 确认项目文件类型注册
  - 在 `tree-sitter.json` 中注册 `.shader` 文件类型
  - 作用域设为 `source.shaderlab`（区别于 `source.cpp` / `source.hlsl`）

- [x] **1.4** 编写第一个测试用例 `test/corpus/shader.txt`
  ```
  ============================================
  Minimal Shader
  ============================================
  Shader "Custom/Test" { }
  --------------------------------------------
  (source_file
    (shader_definition
      (string_literal)))
  ```

- [x] **1.5** 运行 `tree-sitter test` 确认通过

---

### Phase 2：Shader 顶层结构 ✅

**目标**：完整支持 `Shader "Name" { SubShader { Pass { } } }` 层级结构，以及 Tags、LOD、FallBack、CustomEditor、UsePass、GrabPass、Category。

#### Todo

- [x] **2.1** 定义 `shader_definition` 的完整语法
  - `Shader` `string_literal` `{` `shader_body` `}`
  - `shader_body` 包含：`properties_block`、`custom_editor`、`fallback`、`category_block`、`subshader_block`（重复）

- [x] **2.2** 实现 `properties_block` 的基础结构
  - `Properties` `{` `property_declaration*` `}`
  - 初期 `property_declaration` 用宽松规则：`identifier` `(` `string_literal` `,` `identifier` `)` `=` `_expression`  （避免早期陷入属性类型细节）

- [x] **2.3** 实现 `subshader_block`
  - `SubShader` `{` `subshader_body` `}`
  - `subshader_body`：`tags_block`? `lod`? `render_state*` `pass_block*` `use_pass*` `grab_pass*`

- [x] **2.4** 实现 `pass_block`
  - `Pass` `{` `pass_body` `}`
  - `pass_body`：`name`? `tags_block`? `render_state*` (`cg_program_block` | `hlsl_program_block`)?

- [x] **2.5** 实现 `tags_block`
  - `Tags` `{` `tag_pair*` `}`
  - `tag_pair`：`string_literal` `=` `string_literal` （可选逗号分隔）

- [x] **2.6** 实现辅助声明
  - `custom_editor`：`CustomEditor` `string_literal`
  - `fallback`：`FallBack` `string_literal` | `"Off"`
  - `lod`：`LOD` `number`
  - `use_pass`：`UsePass` `string_literal`
  - `grab_pass`：`GrabPass` `{` `string_literal`? `}`
  - `name`：`Name` `string_literal`

- [x] **2.7** 实现 `category_block`
  - `Category` `{` `category_body` `}` （内部结构类似 SubShader）

- [x] **2.8** 编写完整测试用例（12 个，全部通过）
  ```hlsl
  Shader "Custom/MyShader" {
      Properties {
          _MainTex ("Texture", 2D) = "white" {}
      }
      CustomEditor "MyEditor"
      FallBack "Diffuse"
      SubShader {
          Tags { "RenderType" = "Opaque" }
          LOD 200
          Pass {
              Name "ForwardBase"
              Tags { "LightMode" = "ForwardBase" }
          }
      }
      UsePass "Legacy/VertexLit/SHADOWCASTER"
  }
  ```

---

### Phase 3：Properties 块语法 🟡

**目标**：精确解析 Properties 中的所有属性类型及其默认值语法。这是 ShaderLab 最独特的语法。

#### Todo

- [x] **3.1** 枚举所有属性类型及默认值格式

  | 类型 | 语法模式 | 默认值格式 |
  |------|----------|-----------|
  | `2D` | `_Name ("Display", 2D) = "default" {}` | 纹理 + 空花括号或 `{}` |
  | `3D` | `_Name ("Display", 3D) = "" {}` | 同上 |
  | `Cube` | `_Name ("Display", Cube) = "_Skybox" {}` | 同上 |
  | `CubeArray` | `_Name ("Display", CubeArray) = "" {}` | 同上 |
  | `2DArray` | `_Name ("Display", 2DArray) = "" {}` | 同上 |
  | `Color` | `_Name ("Display", Color) = (1,1,1,1)` | `(r,g,b,a)` |
  | `Vector` | `_Name ("Display", Vector) = (0,0,0,0)` | `(x,y,z,w)` |
  | `Float` | `_Name ("Display", Float) = 1.0` | 数字字面量 |
  | `Int` | `_Name ("Display", Int) = 1` | 数字字面量 |
  | `Integer` | `_Name ("Display", Integer) = 1` | 数字字面量（同 Int） |
  | `Range` | `_Name ("Display", Range(min, max)) = 0.5` | 数字字面量 |

- [x] **3.2** 定义 `property_type` 规则
  - 纹理类（带初始化花括号）：`2D`、`3D`、`Cube`、`CubeArray`、`2DArray`
  - 颜色/向量类（带括号元组）：`Color`、`Vector`
  - 数值类（带浮点数）：`Float`、`Int`、`Integer`
  - 范围类（带参数）：`Range` `(` `number` `,` `number` `)`

- [x] **3.3** 定义纹理属性的 `{}` 部分语法（`texture_default`）
  - 通常为空 `{ }`
  - 可能包含纹理参数：`{ TexGen ... }`（旧版 Fixed Function 语法，低优先级）

- [x] **3.4** 处理 `Color`/`Vector` 默认值的括号表达式歧义（`color_default` 规则无冲突）
  - `(1,1,1,1)` 在 tree-sitter 中可能被解析为优先级括号或参数列表
  - 需要确认是否需要在 grammar 中特殊处理（prec 优先级），或在 scanner 中区分上下文
  - **这是 Phase 3 的主要难点**

- [x] **3.5** 编写 Properties 专项测试用例
  ```hlsl
  Properties {
      _MainTex ("Albedo", 2D) = "white" {}
      _BumpMap ("Normal Map", 2D) = "bump" {}
      _Cube ("Reflection", Cube) = "_Skybox" {}
      _Color ("Color", Color) = (1,1,1,1)
      _Vector ("Vector", Vector) = (0,0,0,0)
      _Cutoff ("Cutoff", Range(0, 1)) = 0.5
      _Glossiness ("Smoothness", Range(0,1)) = 0.5
      _Metallic ("Metallic", Range(0,1)) = 0.0
      _IntValue ("Integer Value", Int) = 42
      _FloatValue ("Float Value", Float) = 3.14
      [HideInInspector] _Hidden ("Hidden", Float) = 0
      [Toggle] _Toggle ("Toggle", Float) = 0
      [Enum(Off,0,On,1)] _Enum ("Enum", Float) = 0
  }
  ```

- [x] **3.6** 处理 Property Attributes（`[HideInInspector]`、`[Toggle]`、`[Enum(...)]`、`[NoScaleOffset]`、`[HDR]`、`[Normal]` 等）
  - `[HideInInspector]`、`[Toggle]`、`[Enum(...)]`、`[NoScaleOffset]`、`[HDR]`、`[Gamma]`、`[Normal]`、`[PerRendererData]` 等
  - 使用属性化的 property declaration：`attribute*` 前缀

---

### Phase 4：渲染状态命令 🟡

**目标**：支持所有 Pass/SubShader 级别的渲染状态设置，包括完整的 Stencil 语法。

#### Todo

- [x] **4.1** 实现简单渲染状态命令
  - `Cull` (`Back` | `Front` | `Off`)
  - `ZWrite` (`On` | `Off`)
  - `ZTest` (`Less` | `Greater` | `LEqual` | `GEqual` | `Equal` | `NotEqual` | `Always`)
  - `ZClip` (`True` | `False`)
  - `ColorMask` (`RGBA` | `RGB` | `A` | `R` | `G` | `B` | `0` | `number`)
  - `Offset` `number` `,` `number`
  - `AlphaToMask` (`On` | `Off`)
  - `Conservative` (`True` | `False`)

- [x] **4.2** 实现 `Blend` 和 `BlendOp` 命令（含多目标、颜色/Alpha 分离、索引形式）
  ```hlsl
  Blend SrcAlpha OneMinusSrcAlpha
  Blend SrcAlpha OneMinusSrcAlpha, SrcAlpha One
  BlendOp Add
  BlendOp Min, Max
  Blend One Zero, SrcAlpha One  // 多目标混合
  // 索引形式
  Blend 0 SrcAlpha OneMinusSrcAlpha
  Blend 1 One Zero
  ```
  需要支持：
  - 基础双参数形式：`Blend src dst`
  - 四参数形式（Color + Alpha 分离）：`Blend srcColor dstColor, srcAlpha dstAlpha`
  - 索引形式：`Blend [index] src dst`
  - `BlendOp` 支持 `Add | Sub | RevSub | Min | Max`

- [x] **4.3** 实现完整的 `Stencil` 块语法（含 Front/Back 前缀变体）

- [x] **4.4** 定义所有 Stencil 操作值类型

- [x] **4.5** 编写渲染状态测试用例
  ```hlsl
  Pass {
      Cull Back
      ZWrite On
      ZTest LEqual
      Blend SrcAlpha OneMinusSrcAlpha
      BlendOp Add
      ColorMask RGBA
      Offset 0, -1
      Stencil {
          Ref 1
          Comp Always
          Pass Replace
      }
  }
  ```

---

### Phase 5：CGPROGRAM/HLSLPROGRAM 块与语言注入 🟡

**目标**：正确定义 CGPROGRAM/ENDCG 和 HLSLPROGRAM/ENDHLSL 的边界，配置树内对该区域的 HLSL 注入。

#### Todo

- [x] **5.1** 定义 CGPROGRAM/HLSLPROGRAM 块边界（通过外部扫描器 `program_content`）
- [x] **5.2** 确定块内内容的 token 化策略（方案 A：外部扫描器，单 token 委托）
- [x] **5.3** 处理 CGINCLUDE / HLSLINCLUDE 变体
- [x] **5.4** 编写 `queries/injections.scm`
- [ ] **5.5** 编写 `queries/highlights.scm`（初始版本已完成，后续可完善）
- [x] **5.6** 编写 CGPROGRAM 边界测试用例
- [ ] **5.7** 在文档中记录验证方法（需编辑器集成后验证）

---

### Phase 6：预处理器与 Pragma 指令 ✅

**目标**：支持 CGPROGRAM/HLSLPROGRAM 块内的完整预处理器语法，尤其是 Unity 特有的 `#pragma` 指令。

> **架构决策**：Phase 5 选择了方案 A（外部扫描器 + language injection），因此预处理器指令由 `tree-sitter-hlsl` 在注入层处理，ShaderLab parser 自身不实现预处理器规则。Phase 6 的工作重点为**验证集成**和**边界测试**。

#### Todo

- [x] **6.1** 验证 tree-sitter-hlsl 对预处理器指令的处理（通过注入）
  - `#define` / `#undef` / `#if` / `#ifdef` / `#ifndef` / `#else` / `#elif` / `#endif` / `#include` / `#line` / `#pragma` — 全部由 HLSL parser 内部处理
  - HLSL parser 继承自 tree-sitter-cpp，预处理器支持完整

- [x] **6.2** 验证对 Unity #pragma 指令的解析
  - 测试 `#pragma vertex vert`、`#pragma fragment frag`、`#pragma target 3.0`
  - 测试 `#pragma multi_compile _ _NORMALMAP`、`#pragma multi_compile_fog`、`#pragma multi_compile_instancing`
  - 测试 `#include` Unity 路径格式
  - 测试 `#define` + `#if`/`#endif` 条件编译

- [x] **6.3** 处理 `#include` 路径（Unity 特殊路径由 HLSL parser 处理）
  - `#include "UnityCG.cginc"` ✓
  - `#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"` ✓

- [x] **6.4** 编写预处理器集成测试用例
  - CGPROGRAM with multiple pragmas ✓
  - HLSLPROGRAM with URP includes ✓
  - CGINCLUDE with #ifdef conditionals ✓
  - Empty CGPROGRAM block ✓ (boundary edge case)

- [x] **6.5** 已知限制文档化
  - `ENDCG`/`ENDHLSL` 出现在字符串字面量中会提前终止块（低概率，但存在）
  - `ENDCG`/`ENDHLSL` 出现在注释中会提前终止块
  - 两个场景均有回归测试覆盖（标注为 KNOWN LIMIT）
  - **后期改进**：可增强外部扫描器跟踪字符串/注释上下文状态
  ```hlsl
  CGPROGRAM
  #pragma vertex vert
  #pragma fragment frag
  #pragma target 3.5
  #pragma multi_compile _ _NORMALMAP
  #pragma multi_compile_fog
  #pragma multi_compile_instancing
  #include "UnityCG.cginc"
  #define MY_CONSTANT 42
  #if MY_CONSTANT > 0
  float4 _MyVar;
  #endif
  ENDCG
  ```

---

### Phase 7：旧版语法兼容

**目标**：支持 Unity 旧版 Fixed Function Shader 语法，确保对遗留 shader 文件的解析不会崩溃。

#### Todo

- [ ] **7.1** 实现旧版渲染命令
  - `Lighting` (`On` | `Off`)
  - `Material` `{` `material_property*` `}`
    - `Diffuse (r,g,b,a)` / `Ambient (r,g,b,a)` / `Specular (r,g,b,a)` / `Emission (r,g,b)` / `Shininess number` 等
  - `Fog` `{` `fog_property*` `}` 或 `Fog Color (r,g,b,a)` / `Fog Mode ...` / `Fog Density ...` / `Fog Range ...`
  - `AlphaTest` (`Greater` | `GEqual` | `Less` | `LEqual` | `Equal` | `NotEqual` | `Always` | `Never`) `number`?
  - `BindChannels` `{` `Bind "channel", property` `}`

- [ ] **7.2** 实现 `SetTexture` 命令（旧版纹理合成器语法）
  ```hlsl
  SetTexture [_MainTex] {
      constantColor (1,1,1,1)
      combine texture * primary
      Matrix [_ColorMatrix]
  }
  ```
  - 关键词：`combine`, `constantColor`, `matrix`, `previous`, `primary`, `texture`, `constant`, `Double`, `Quad`
  - `combine` 接受特殊语法：`texture * primary Double` 等

- [ ] **7.3** 标记旧版语法为废弃
  - 在 `highlights.scm` 中为旧版语法使用特殊颜色/样式标记
  - 例如：`@text.warning` 或 `@comment.warning`

- [ ] **7.4** 编写旧版语法测试用例
  ```hlsl
  Shader "Legacy/VertexLit" {
      Properties {
          _Color ("Main Color", Color) = (1,1,1,1)
      }
      SubShader {
          Lighting On
          Material {
              Diffuse [_Color]
              Ambient [_Color]
          }
          SetTexture [_MainTex] {
              constantColor [_Color]
              combine texture * primary
          }
      }
  }
  ```

---

### Phase 8：查询文件完善（queries） 🟡

**目标**：编写完整的高亮、注入、折叠、缩进、代码大纲查询文件。

#### Todo

- [x] **8.1** 编写 `queries/highlights.scm`（初版，覆盖全部 keyword/type/constant/string/number/comment）
- [x] **8.2** 编写 `queries/injections.scm`（CGPROGRAM/HLSLPROGRAM → HLSL 注入）
- [x] **8.3** 编写 `queries/locals.scm`（property name → definition，shader name → namespace）
- [x] **8.4** 编写 `queries/folds.scm`（所有花括号块 → 折叠）
- [x] **8.5** 编写 `queries/indents.scm`（`{` 缩进，`}` 回退）
- [ ] **8.6** 在编辑器中验证高亮/注入/折叠效果

**目标**：编写完整的高亮、注入、折叠、缩进、代码大纲查询文件。

#### Todo

- [ ] **8.1** 完善 `queries/highlights.scm`
  - 结构关键字 → `@keyword`（Shader, Properties, SubShader, Pass, Category）
  - 控制关键字 → `@keyword.control`（CGPROGRAM, ENDCG, HLSLPROGRAM, ENDHLSL）
  - Tags 关键字 → `@keyword`（Tags, RenderType, Queue, LightMode 等）
  - 渲染状态命令 → `@keyword`（Cull, ZWrite, Blend, Stencil 等）
  - 属性类型 → `@type`（2D, Color, Float, Range 等）
  - 字符串 → `@string`
  - 数字 → `@number`
  - 注释 → `@comment`

- [ ] **8.2** 完善 `queries/injections.scm`
  - CGPROGRAM/HLSLPROGRAM → `@injection.content` + `(#set! injection.language "hlsl")`

- [ ] **8.3** 编写 `queries/locals.scm`
  - 属性名称作为定义：`(property_declaration name: (identifier) @definition)`
  - Shader 名称作为定义
  - Pass 的 Name 作为定义

- [ ] **8.4** 编写 `queries/folds.scm`
  - Shader 块、SubShader 块、Pass 块、Properties 块、Stencil 块、CGPROGRAM 块、Tags 块

- [ ] **8.5** 编写 `queries/indents.scm`
  - 所有花括号 `{ }` 块 → 缩进

---

### Phase 9：边界情况、错误恢复与测试完善

**目标**：确保 parser 面对不完整/错误语法时不会崩溃，覆盖真实 Shader 文件的边缘情况。

#### Todo

- [ ] **9.1** 处理注释
  - `//` 单行注释
  - `/* */` 块注释
  - tree-sitter 通过 `extras` 配置自动处理

- [ ] **9.2** 处理花括号不匹配
  - 测试缺失 `}` 时的错误恢复
  - 测试多余 `}` 时的错误恢复

- [ ] **9.3** 处理属性块内部的非标准写法
  - 含 `#ifdef` 的属性定义（跨平台属性）
  - 含 `[MaterialToggle]` 等的属性 attribute

- [ ] **9.4** 处理空 Pass / 空 SubShader
  ```hlsl
  SubShader { }  // 空 SubShader
  Pass { }        // 空 Pass
  ```

- [ ] **9.5** 处理多 SubShader（依赖顺序）
  ```hlsl
  SubShader { Tags { "RenderType" = "Opaque" } ... }
  SubShader { Tags { "RenderType" = "Transparent" } ... }
  ```

- [ ] **9.6** 收集真实测试文件
  - 从 Unity 官方文档和 Asset Store 收集 5-10 个真实 `.shader` 文件
  - 放入 `examples/` 目录
  - 用 `tree-sitter parse` 逐个验证解析不报错

- [ ] **9.7** 整理测试覆盖率报告
  - 编写脚本统计 corpus 覆盖了哪些规则
  - 标记未覆盖的规则进行补充

---

### Phase 10：发布与集成

**目标**：多平台发布，与编辑器集成验证。

#### Todo

- [ ] **10.1** 配置 npm 发布
  - 补充 `package.json`：version, description, keywords, files, author, license
  - 配置 `prebuildify` 用于预编译二进制（参考 `tree-sitter-hlsl`）
  - 发布到 npm：`tree-sitter-shaderlab`

- [ ] **10.2** 配置 Cargo 发布
  - 完善 `Cargo.toml`
  - 发布到 crates.io

- [ ] **10.3** 编写 README.md
  - 项目介绍
  - 安装说明
  - 在 Neovim/Helix 中的配置方法
  - 贡献指南

- [ ] **10.4** 编辑器集成验证
  - **Neovim**（nvim-treesitter）：创建 parser 配置，验证语法高亮和代码折叠
  - **Helix**：验证开箱即用的支持
  - 验证语言注入（CGPROGRAM 内 HLSL 高亮）

- [ ] **10.5** 配置 CI/CD
  - GitHub Actions：每次 push 运行 `tree-sitter test`
  - 自动发布到 npm/crates.io（tag 触发）

---

## 三、关键难点与风险预案

| 难点 | 位置 | 风险 | 预案 | 状态 |
|------|------|------|------|------|
| `(1,1,1,1)` 属性默认值歧义 | Phase 3 | 与 HLSL 的 `(expr)` 括号表达式冲突 | 使用 `color_default` 规则在 Properties 上下文中解析 ✓ | 已解决 |
| CGPROGRAM 内部 token 化 | Phase 5 | 方案 A 丢块内信息，方案 B 解析不够精确 | 方案 A 配合 injection 是最佳实践；块内符号查找由 HLSL parser 处理 | 已实现 |
| 旧版 Fixed Function 语法 | Phase 7 | 语法高度不规则，文档稀少 | 参考 Unity 旧版文档 + 实际 `.shader` 文件 | 待实现 |
| Property Attributes `[...]` | Phase 3 | 与 HLSL attribute `[unroll]` 语法相似但不完全相同 | 在 ShaderLab 顶层使用独立的 `property_attribute` 规则 | 已解决 |
| tree-sitter-hlsl 版本兼容 | Phase 5/6 | tree-sitter-hlsl 更新可能导致注入行为变化 | 固定版本依赖，定期测试兼容性 | 持续监控 |
| **ENDCG/ENDHLSL 关键字出现在字符串/注释中** | Phase 6 | 外部扫描器不跟踪字符串/注释上下文，会提前终止块 | 已文档化为已知限制；真实场景中极少出现；后续可增强扫描器状态机 | 已知限制 |

---

## 四、里程碑总结

| 阶段 | 状态 | 里程碑 | 输出 |
|------|------|--------|------|
| Phase 1 | ✅ | 项目骨架运行 | 26 个文件，`tree-sitter generate` + `tree-sitter test` 通过 |
| Phase 2 | ✅ | 完整层级结构 | Shader/SubShader/Pass/Tags/Category 全部解析 |
| Phase 3 | ✅ | Properties 支持 | 所有属性类型 + Property Attributes |
| Phase 4 | ✅ | 渲染状态 | Cull/ZWrite/Blend/Stencil/Conservative 全部支持 |
| Phase 5 | 🟡 | HLSL 注入 | CGPROGRAM 边界 + injection queries 就绪 |
| Phase 6 | ✅ | 预处理器集成 | #pragma/#include/#define 通过注入验证；已知限制已文档化 |
| Phase 7 | ⬜ | 旧版兼容 | Fixed Function 语法 |
| Phase 8 | 🟡 | 查询完善 | 5 个 .scm 文件就绪，待编辑器验证 |
| Phase 9 | ⬜ | 健壮性 | 真实文件测试 + 错误恢复 |
| Phase 10 | ⬜ | 发布 | npm + crates.io + 编辑器集成 |