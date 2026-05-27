# tree-sitter-shaderlab 实现计划

> 创建日期：2026-05-23
> 最后更新：2026-05-27（基于 643 个真实 Shader 批量测试）
> 目标：为 Unity ShaderLab 语言实现完整的 tree-sitter 语法解析器
>
> 参考文档：
> - `research-vscode-extension.md` — vscode-unitylabshader 插件调研
> - `../tree-sitter-hlsl/grammar.js` — tree-sitter-hlsl 的继承模式参考
> - [tree-sitter 官方文档](https://tree-sitter.github.io/tree-sitter/)
> - `test_shader_list.txt` — 643 个真实项目 Shader 文件列表
> - `builtin_fix_plan.md` — Unity 内置 Shader 修复计划
> - `parse_errors.txt` — 批量测试失败文件列表

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

**决策 3：使用外部扫描器处理 program_content**

CGPROGRAM/HLSLPROGRAM 块内容由外部扫描器（`src/scanner.c`）处理，逐字符扫描直到遇到 `ENDCG`/`ENDHLSL` 边界标记。已知限制：边界标记出现在字符串字面量或注释中会提前终止块。

### 1.2 项目结构

```
tree-sitter-shaderlab/
├── grammar.js              ← 核心语法定义（~380 行）
├── src/
│   ├── scanner.c           ← 外部扫描器（program_content 边界检测）
│   ├── parser.c            ← tree-sitter generate 自动生成
│   └── grammar.json        ← 自动生成的中间表示
├── queries/
│   ├── highlights.scm      ← 语法高亮查询
│   ├── injections.scm      ← 语言注入配置（CGPROGRAM → HLSL）
│   ├── locals.scm          ← 局部变量/定义查询
│   ├── folds.scm           ← 代码折叠查询
│   └── indents.scm         ← 缩进查询
├── test/
│   └── corpus/
│       └── shader.txt      ← 全部 18 个测试用例
├── package.json
├── Cargo.toml
├── tree-sitter.json
├── Makefile
├── batch_test.sh           ← 批量测试脚本
├── test_shader_list.txt    ← 643 个真实 Shader 路径
├── parse_errors.txt        ← 批量测试失败列表
├── builtin_errors.txt      ← 内置 Shader 失败列表
└── builtin_fix_plan.md     ← 内置 Shader 修复计划
```

### 1.3 技术参考

| 参考源 | 参考内容 |
|--------|----------|
| `tree-sitter-hlsl/grammar.js` | 继承模式、`grammar()` 调用结构、`conflicts` 配置 |
| `tree-sitter-hlsl/src/scanner.c` | 外部扫描器的实现模板 |
| `vscode-unitylabshader/syntaxes/unityshader.tmLanguage.json` | 完整的关键词分类和层级关系 |
| `vscode-unitylabshader/src/unity/unityGlobals.ts` | ShaderLab 属性类型、渲染状态列表 |
| [tree-sitter 创建 parser 指南](https://tree-sitter.github.io/tree-sitter/creating-parsers) | grammar DSL 语法 |

---

## 二、分阶段实现计划

---

### Phase 1：项目初始化与基础框架 ✅

**目标**：搭建可编译、可测试的最小 tree-sitter 项目骨架。

- [x] **1.1** 创建项目目录结构（`grammar.js`, `package.json`, `Cargo.toml`, `tree-sitter.json`, `Makefile`）
- [x] **1.2** 编写最小 grammar.js，验证 `tree-sitter generate` 正常生成 parser
- [x] **1.3** 注册 `.shader` 文件类型，作用域 `source.shaderlab`
- [x] **1.4** 编写第一个测试用例 `test/corpus/shader.txt` — Minimal Shader
- [x] **1.5** `tree-sitter test` 通过

---

### Phase 2：Shader 顶层结构 ✅

**目标**：完整支持 `Shader "Name" { SubShader { Pass { } } }` 层级结构。

- [x] **2.1** `shader_definition` 完整语法（含 `custom_editor`, `fallback`, `category_block`）
- [x] **2.2** `properties_block` 基础结构
- [x] **2.3** `subshader_block`（含 Tags, LOD, render states, Pass）
- [x] **2.4** `pass_block`（含 Name, Tags, render states, CGPROGRAM/HLSLPROGRAM）
- [x] **2.5** `tags_block`（key-value 对）
- [x] **2.6** 辅助声明：`custom_editor`, `fallback`, `lod`, `use_pass`, `grab_pass`, `pass_name`
- [x] **2.7** `category_block`
- [x] **2.8** 12 个完整测试用例全部通过

---

### Phase 3：Properties 块语法 ✅

**目标**：精确解析所有属性类型、默认值、Property Attributes。

- [x] **3.1** 枚举并实现全部属性类型：`2D`, `3D`, `Cube`, `CubeArray`, `2DArray`, `Color`, `Vector`, `Float`, `Int`, `Integer`, `Range(min, max)`
- [x] **3.2** `texture_default` — 纹理类默认值 `"white" {}`
- [x] **3.3** `color_default` — 颜色/向量默认值 `(r,g,b,a)`，支持 3 分量省略 alpha
- [x] **3.4** Property Attributes：`[HideInInspector]`, `[Toggle]`, `[Enum(...)]`, `[NoScaleOffset]`, `[HDR]`, `[Gamma]`, `[Normal]`, `[PerRendererData]`, `[ToggleNoKey(...)]`, `[ShowIf(...)]`
- [x] **3.5** 属性类型大小写兼容（`int`/`Int`, `float`/`Float`, `2d`/`2D` 等）
- [x] **3.6** `any` 属性类型 — Unity 内部类型
- [x] **3.7** `dotted_identifier` — 属性参数中点号分隔标识符（`UnityEngine.Rendering.BlendMode`）
- [x] **3.8** 负数默认值支持（`= -0.2`）
- [x] **3.9** `[Enum]` 多词显示名支持（`[Enum(Metallic Alpha,0,Albedo Alpha,1)]`）— 空格分隔枚举名

> **🏗️ 真实测试发现的额外修复：**
> - `any` 类型（12 个 Internal-* shader 使用）
> - `[Enum]` 含空格枚举名（Standard.shader 等）
> - 负数默认值（ASE 生成文件使用 `= -0.2`）
> - 3 分量 color_default（`_EmissionColor("Color", Color) = (0,0,0)`）

---

### Phase 4：渲染状态命令 ✅

**目标**：支持所有 Pass/SubShader 级别的渲染状态，包括 Stencil 语法。

- [x] **4.1** 简单渲染状态：`Cull`, `ZWrite`, `ZTest`, `ZClip`, `ColorMask`, `Offset`, `AlphaToMask`, `Conservative`
- [x] **4.2** `Blend` 和 `BlendOp`（含多目标、颜色/Alpha 分离、索引形式）
- [x] **4.3** 完整 `Stencil` 块（含 Front/Back 前缀变体）
- [x] **4.4** `property_reference` — `[_SrcBlend]` / `[_StencilNonBackground]` 方括号属性引用
- [x] **4.5** Stencil 大小写兼容（`ref`/`Ref`, `readmask`/`readMask`/`ReadMask`, `compback`/`CompBack` 等）
- [x] **4.6** `comparison_func` 大小写兼容（`equal`/`Equal`, `less`/`Less`, `always`/`Always` 等）
- [x] **4.7** `on_off` / `true_false` 大小写兼容
- [x] **4.8** `cull_mode` 大小写兼容（`back`/`Back`, `front`/`Front`, `off`/`Off`）
- [x] **4.9** 渲染状态可通过属性引用设置（`ZWrite [_ZWrite]`, `Blend [_SrcBlend] [_DstBlend]`）

> **🏗️ 真实测试发现的额外修复：**
> - Stencil 全小写命令（DeferredShading.shader 使用 `ref`, `readmask`, `compback`, `compfront`, `equal`）
> - `Cull back` 小写（CubeBlend.shader 使用）
> - 12 个测试用例全部通过

---

### Phase 5：CGPROGRAM/HLSLPROGRAM 块与语言注入 ✅

**目标**：正确定义边界标记，配置 HLSL 注入。

- [x] **5.1** CGPROGRAM/HLSLPROGRAM 块边界（通过外部扫描器 `program_content`）
- [x] **5.2** 外部扫描器单 token 委托策略
- [x] **5.3** CGINCLUDE / HLSLINCLUDE 在 Pass 内支持
- [x] **5.4** CGPROGRAM/CGINCLUDE 在 SubShader 层支持（surface shader 模式，92 个 built-in 文件使用）
- [x] **5.5** CGINCLUDE/HLSLINCLUDE 在 Shader 顶层支持（~5 个 built-in 文件使用）
- [x] **5.6** 编写 `queries/injections.scm`
- [ ] **5.7** 编写 `queries/highlights.scm`（初始版本已完成，后续可完善）
- [x] **5.8** CGPROGRAM 边界测试用例（含 CGINCLUDE）
- [ ] **5.9** 在编辑器中验证注入效果

> **🏗️ 真实测试发现的额外修复：**
> - 92 个 Surface Shader 使用 CGPROGRAM 在 SubShader 层（无 Pass 包裹）
> - CGINCLUDE 出现在 Shader 顶层（Properties 和 SubShader 之间）

---

### Phase 6：预处理器与 Pragma 指令 ✅

**目标**：验证通过注入的 HLSL parser 正确处理预处理器指令。

- [x] **6.1** 验证 tree-sitter-hlsl 对预处理器指令的处理
- [x] **6.2** 验证 Unity `#pragma` 指令解析
- [x] **6.3** 验证 `#include` Unity 路径格式
- [x] **6.4** 编写预处理器集成测试用例
- [x] **6.5** 已知限制文档化（ENDCG 在字符串/注释中提前终止）

---

### Phase 7：旧版语法兼容 🟡

**目标**：支持 Unity 旧版 Fixed Function Shader 语法。

- [x] **7.1** 旧版渲染命令（已实现部分）
  - `Lighting` (`On` | `Off`) ✅
  - `Fog { Mode ... Color (...) Density ... Range ... }` ✅
  - `Category { Tags ... render_states ... SubShader ... }` — 含渲染状态 ✅
- [ ] **7.2** `Material { ... }` 旧版材质块
  - `Diffuse (r,g,b,a)` / `Ambient (r,g,b,a)` / `Specular (r,g,b,a)` / `Emission (r,g,b)` / `Shininess number` 等
- [ ] **7.3** `SetTexture [name] { combine ... constantColor ... Matrix ... }` 旧版纹理合成器
- [ ] **7.4** `AlphaTest` (`Greater` | `GEqual` | ...) `number`?
- [ ] **7.5** `BindChannels { Bind "channel", property }` 旧版顶点输入绑定
- [ ] **7.6** 标记旧版语法为废弃（highlights.scm 特殊样式）
- [ ] **7.7** 编写旧版语法测试用例

> **状态：** 已实现 Lighting、Fog、Category 渲染状态。剩余 Material、SetTexture、AlphaTest、BindChannels 待实现——这些语法在真实项目中使用率极低，优先级低。

---

### Phase 8：查询文件完善 🟡

- [x] **8.1** `queries/highlights.scm`（初版完成）
- [x] **8.2** `queries/injections.scm`
- [x] **8.3** `queries/locals.scm`
- [x] **8.4** `queries/folds.scm`
- [x] **8.5** `queries/indents.scm`
- [ ] **8.6** 在编辑器中验证高亮/注入/折叠效果

---

### Phase 9：批量测试与边界情况 🟡

**目标**：用真实项目 Shader 文件验证解析健壮性，覆盖边缘情况。

- [x] **9.1** 收集 643 个真实 Shader 文件路径（`test_shader_list.txt`）
- [x] **9.2** 编写批量测试脚本 `batch_test.sh`
- [x] **9.3** 逐个分析并修复失败模式（详见 `builtin_fix_plan.md`）
- [x] **9.4** 处理注释（`//`, `/* */`）— 通过 `extras` 配置
- [ ] **9.5** 处理花括号不匹配的错误恢复
- [ ] **9.6** 处理属性块内部 `#ifdef` 条件编译（跨平台属性）
- [ ] **9.7** 整理测试覆盖率报告

#### 批量测试结果

| 阶段 | 成功 | 失败 | 通过率 | 内置 Shader 失败 |
|------|:---:|:---:|:---:|:---:|
| 原始 grammar | 327 | 316 | 50.9% | 202 |
| + 属性扩展 (Phase 3 增强) | 345 | 298 | 53.7% | 202 |
| + CGPROGRAM 在 SubShader | 417 | 226 | 64.9% | 155 |
| + `any` 类型 | 437 | 206 | 68.0% | 135 |
| + 顶层 CGINCLUDE + 小写 stencil/comparison | 460 | 183 | 71.5% | 117 |
| + `[Enum]` 空格 + Category 渲染状态 + 小写渲染 | **496** | **147** | **77.1%** | **96** |

> 累计修复 **169 个文件** (+26.2%)，内置 Shader 失败从 202 降至 96（**-52%**）。

---

### Phase 10：发布与集成 ⬜

- [ ] **10.1** 配置 npm 发布（完善 `package.json`，配置 `prebuildify`）
- [ ] **10.2** 配置 Cargo 发布
- [ ] **10.3** 编写 README.md
- [ ] **10.4** 编辑器集成验证（Neovim / Helix）
- [ ] **10.5** 配置 CI/CD（GitHub Actions）

---

## 三、关键难点与风险预案

| 难点 | 位置 | 风险 | 预案 | 状态 |
|------|------|------|------|------|
| `(1,1,1,1)` 属性默认值歧义 | Phase 3 | 与 HLSL 的 `(expr)` 括号表达式冲突 | 使用 `color_default` 规则在 Properties 上下文中解析 | ✅ 已解决 |
| `[Enum]` 空格枚举名 | Phase 3 | `Metallic Alpha` 被 token 化为两个标识符 | `_attr_arg` 支持空格分隔多标识符 (`repeat1`) | ✅ 已解决 |
| CGPROGRAM 内部 token 化 | Phase 5 | 外部扫描器不解析 HLSL 内容 | 方案 A 配合 injection 是最佳实践 | ✅ 已实现 |
| CGPROGRAM 在 SubShader 层 (无 Pass) | Phase 5 | Surface Shader 特有模式，原 grammar 不支持 | `_subshader_body_item` 中添加 `cg_program_block` | ✅ 已解决 |
| CGINCLUDE 在 Shader 顶层 | Phase 5 | 旧版 Shader 将 CGINCLUDE 放在 Properties 和 SubShader 之间 | `_shader_body_item` 中添加 `cg_include`/`hlsl_include` | ✅ 已解决 |
| Stencil 大小写混乱 | Phase 4 | Unity 实际文件使用 `readmask`/`compback`/`equal` 等小写变体 | 在关键字 `choice` 中添加大小写变体 | ✅ 已解决 |
| `any` 属性类型 | Phase 3 | Unity 内部类型，原始文档未提及 | 在 `property_type` 中添加 `any`/`Any` | ✅ 已解决 |
| 旧版 Fixed Function 语法 | Phase 7 | 语法高度不规则，文档稀少 | 参考 Unity 旧版文档 + 实际 shader 文件；Lighting/Fog 已实现 | 🟡 部分 |
| ENDCG/ENDHLSL 在字符串/注释中 | Phase 6 | 外部扫描器不跟踪上下文 | 已文档化为已知限制；真实场景极少出现 | ⚠️ 已知限制 |
| tree-sitter-hlsl 版本兼容 | Phase 5/6 | tree-sitter-hlsl 更新可能导致注入变化 | 固定版本依赖，定期测试兼容性 | ⚠️ 持续监控 |

---

## 四、里程碑总结

| 阶段 | 状态 | 里程碑 | 关键输出 |
|------|:---:|--------|------|
| Phase 1 | ✅ | 项目骨架运行 | `tree-sitter generate` + `tree-sitter test` 通过 |
| Phase 2 | ✅ | 完整层级结构 | Shader/SubShader/Pass/Tags/Category 解析 |
| Phase 3 | ✅ | Properties 全支持 | 所有类型 + Attributes + 大小写兼容 + 空格枚举 + 负数默认 |
| Phase 4 | ✅ | 渲染状态全支持 | Cull/Blend/Stencil + 属性引用 + 大小写兼容 |
| Phase 5 | ✅ | HLSL 注入就绪 | CGPROGRAM 边界 + SubShader/顶层 CGINCLUDE + injection queries |
| Phase 6 | ✅ | 预处理器集成 | #pragma/#include/#define 通过注入验证；已知限制文档化 |
| Phase 7 | 🟡 | 旧版兼容 | Lighting/Fog/Category 已支持；Material/SetTexture 待实现 |
| Phase 8 | 🟡 | 查询文件就绪 | 5 个 .scm 文件完成，待编辑器验证 |
| Phase 9 | 🟡 | 真实测试 | 643 文件批量测试，通过率 77.1%；内置 Shader 失败 -52% |
| Phase 10 | ⬜ | 发布 | npm + crates.io + 编辑器集成 |

---

## 五、grammar.js 当前完整语法能力

### 已支持的语法结构

```
Shader "Name" {
    Properties {
        [attribute] _Name ("Display", type) = default
        // type: 2D/3D/Cube/CubeArray/2DArray/Color/Vector/Float/Int/Integer/Range/any
        // attribute: HideInInspector, Toggle, ToggleNoKey, Enum, NoScaleOffset,
        //            HDR, Gamma, Normal, PerRendererData, ShowIf, BranchProperty,
        //            ASEBegin, ASEEnd, MainTexture, ...
        // default:  texture → "white" {}
        //           color   → (r,g,b) or (r,g,b,a)
        //           number  → 1.0 or -0.5
        //           string  → "value"
    }
    CGINCLUDE / HLSLINCLUDE        ← 顶层共享代码块
    SubShader {
        LOD 200
        Tags { "key" = "value" }
        Cull/ZWrite/ZTest/Blend/BlendOp/ColorMask/Offset/AlphaToMask/Conservative/ZClip
        Stencil { Ref/ReadMask/WriteMask/Comp/Pass/Fail/ZFail }
        Lighting On/Off             ← 旧版光照
        Fog { Mode/Color/Density/Range }  ← 旧版雾效
        CGINCLUDE/CGPROGRAM/HLSLINCLUDE/HLSLPROGRAM  ← 可在 SubShader 层
        Pass {
            Name "PassName"
            Tags { }
            render_states
            Stencil { }
            CGPROGRAM/HLSLPROGRAM
        }
        UsePass "Shader/PassName"
        GrabPass { "textureName" }
    }
    Category {                     ← 旧版分类（含渲染状态和 SubShader）
        Tags { }
        render_states
        SubShader { }
    }
    CustomEditor "EditorName"
    FallBack "ShaderName" / Off
    Fallback "ShaderName"          ← 小写变体
}
```

### 当前限制与待实现功能

| 功能 | 状态 | 优先级 | 说明 |
|------|:---:|:---:|------|
| `Material { Diffuse/Ambient/... }` | ⬜ | 低 | 旧版 Fixed Function 材质块 |
| `SetTexture [name] { combine ... }` | ⬜ | 低 | 旧版纹理合成器 |
| `AlphaTest` | ⬜ | 低 | 旧版 Alpha 测试命令 |
| `BindChannels { Bind ... }` | ⬜ | 低 | 旧版顶点输入绑定 |
| `#ifdef` 在 Properties 块内 | ⬜ | 中 | 跨平台属性定义 |
| 编辑器集成验证 | ⬜ | 高 | Neovim/Helix 实际效果 |
| 外部扫描器增强（字符串/注释追踪） | ⬜ | 低 | 修复 ENDCG 已知限制 |
| 错误恢复增强 | ⬜ | 中 | 不完整文件友好处理 |