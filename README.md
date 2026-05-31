# tree-sitter-shaderlab

Tree-sitter grammar for Unity ShaderLab.

This parser focuses on the **outer ShaderLab structure** of `.shader` files, such as `Shader`, `Properties`, `SubShader`, `Pass`, `Tags`, `Stencil`, and related render-state syntax.

For the contents inside `CGPROGRAM` / `CGINCLUDE` / `HLSLPROGRAM` / `HLSLINCLUDE` blocks, this project uses **language injection** and delegates parsing to the **HLSL tree-sitter parser**.

## Features

- Parses the outer ShaderLab syntax in `.shader` files
- Injects HLSL inside `CGPROGRAM` / `HLSLPROGRAM` blocks
- Includes Tree-sitter queries for:
  - highlighting
  - folds
  - indents
  - locals
  - injections

## Design

This grammar intentionally separates responsibilities:

- **ShaderLab parser**: handles the container / host language structure
- **HLSL parser**: handles shader code embedded inside program blocks

This keeps the grammar simpler and makes it easier to reuse the existing HLSL ecosystem.

## Neovim / nvim-treesitter

If your first target is Neovim users, you can use this repository directly without publishing to npm.

Example configuration:

```lua
vim.filetype.add({
  extension = {
    shader = "shader",
  },
})

local function register_shaderlab_parser()
  local parsers = require("nvim-treesitter.parsers")
  parsers.shaderlab = {
    install_info = {
      url = "https://github.com/ownself/tree-sitter-shaderlab",
      files = { "src/parser.c", "src/scanner.c" },
      branch = "main",
      queries = "queries",
    },
    filetype = "shader",
  }

  vim.treesitter.language.register("shaderlab", "shader")
end

register_shaderlab_parser()

vim.api.nvim_create_autocmd("User", {
  pattern = "TSUpdate",
  -- Re-register after TSUpdate because nvim-treesitter may reload and clear custom parser entries.
  callback = register_shaderlab_parser,
})

require("nvim-treesitter").install({ "shaderlab", "hlsl" })
```

### HLSL parser

Because this grammar injects program blocks as HLSL, you should also ensure that an HLSL Tree-sitter parser is available in your editor setup.

## File type

- `.shader`

## Queries included

- `queries/highlights.scm`
- `queries/injections.scm`
- `queries/folds.scm`
- `queries/indents.scm`
- `queries/locals.scm`

## Development

Generate parser files:

```bash
tree-sitter generate
```

Run tests:

```bash
tree-sitter test
```

---

# tree-sitter-shaderlab

Unity ShaderLab 的 Tree-sitter 语法。

这个解析器主要负责 `.shader` 文件中 **外围的 ShaderLab 语法结构**，例如 `Shader`、`Properties`、`SubShader`、`Pass`、`Tags`、`Stencil` 以及相关渲染状态语法。

对于 `CGPROGRAM` / `CGINCLUDE` / `HLSLPROGRAM` / `HLSLINCLUDE` 代码块中的内部语法，本项目通过 **language injection** 的方式，交给 **HLSL 的 Tree-sitter parser** 处理。

## 特性

- 解析 `.shader` 文件外围的 ShaderLab 语法
- 对 `CGPROGRAM` / `HLSLPROGRAM` 块内注入 HLSL
- 内置以下 Tree-sitter queries：
  - highlighting
  - folds
  - indents
  - locals
  - injections

## 实现思路

这个语法的设计刻意做了职责拆分：

- **ShaderLab parser**：负责容器层 / 外围语言结构
- **HLSL parser**：负责 Program 块中的着色器代码

这样可以让语法实现更清晰，也更容易复用现有的 HLSL 生态。

## Neovim / nvim-treesitter

如果你的第一批目标用户是 Neovim 用户，那么可以直接通过这个仓库接入，不一定需要先发布 npm。

示例配置：

```lua
vim.filetype.add({
  extension = {
    shader = "shader",
  },
})

local function register_shaderlab_parser()
  local parsers = require("nvim-treesitter.parsers")
  parsers.shaderlab = {
    install_info = {
      url = "https://github.com/ownself/tree-sitter-shaderlab",
      files = { "src/parser.c", "src/scanner.c" },
      branch = "main",
      queries = "queries",
    },
    filetype = "shader",
  }

  vim.treesitter.language.register("shaderlab", "shader")
end

register_shaderlab_parser()

vim.api.nvim_create_autocmd("User", {
  pattern = "TSUpdate",
  -- 在 TSUpdate 后重新注册，因为 nvim-treesitter 可能会重新加载并清掉自定义 parser 条目。
  callback = register_shaderlab_parser,
})

require("nvim-treesitter").install({ "shaderlab", "hlsl" })
```

### 关于 HLSL parser

由于本语法会把 Program 块注入为 HLSL，因此你的编辑器环境中也需要可用的 HLSL Tree-sitter parser。

## 文件类型

- `.shader`

## 已包含的 Queries

- `queries/highlights.scm`
- `queries/injections.scm`
- `queries/folds.scm`
- `queries/indents.scm`
- `queries/locals.scm`

## 开发

生成 parser 文件：

```bash
tree-sitter generate
```

运行测试：

```bash
tree-sitter test
```
