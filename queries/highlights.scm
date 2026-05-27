; ============================================
; Syntax highlighting for ShaderLab
; ============================================

; --- Structure keywords ---
"Shader" @keyword
"Properties" @keyword
"SubShader" @keyword
"Pass" @keyword
"Category" @keyword

; --- CG/HLSL block delimiters ---
"CGPROGRAM" @keyword.import
"CGINCLUDE" @keyword.import
"ENDCG" @keyword.import
"HLSLPROGRAM" @keyword.import
"HLSLINCLUDE" @keyword.import
"ENDHLSL" @keyword.import

; --- Property types ---
[
  "2D" "2d"
  "3D" "3d"
  "Cube" "cube" "CUBE"
  "CubeArray" "cubearray"
  "2DArray" "2darray"
  "Color" "color"
  "Vector" "vector"
  "Float" "float"
  "Int" "int"
  "Integer" "integer"
  "any" "Any"
  "Range" "range"
] @type.builtin

; --- Render state commands ---
[
  "Blend"
  "BlendOp"
  "ColorMask"
  "Cull"
  "ZWrite"
  "ZTest"
  "ZClip"
  "Offset"
  "AlphaToMask"
  "Conservative"
] @keyword

; --- Stencil ---
"Stencil" @keyword
[
  "Ref"
  "ReadMask"
  "WriteMask"
  "Comp" "CompFront" "CompBack"
  "Pass" "PassFront" "PassBack"
  "Fail" "FailFront" "FailBack"
  "ZFail" "ZFailFront" "ZFailBack"
] @keyword

; --- Stencil values ---
[
  "Keep" "Zero" "Replace" "IncrSat"
  "DecrSat" "Invert" "IncrWrap" "DecrWrap"
] @constant.builtin

; --- Comparison functions ---
[
  "Less" "Greater" "LEqual" "GEqual"
  "Equal" "NotEqual" "Always" "Never"
] @constant.builtin

; --- Blend modes ---
[
  "One" "Zero"
  "SrcColor" "SrcAlpha"
  "DstColor" "DstAlpha"
  "OneMinusSrcColor" "OneMinusSrcAlpha"
  "OneMinusDstColor" "OneMinusDstAlpha"
] @constant.builtin

; --- Blend ops ---
[
  "Add" "Sub" "RevSub" "Min" "Max"
] @constant.builtin

; --- Cull / OnOff / TrueFalse ---
[
  "Back" "Front" "Off"
  "On"
  "True" "False"
] @constant.builtin

; --- ColorMask values ---
[
  "RGBA" "RGB" "A" "R" "G" "B" "0"
] @constant.builtin

; --- Legacy commands (Phase 7: Fixed Function) ---
"Lighting" @keyword
"Fog" @keyword
"ColorMaterial" @keyword
"Material" @keyword
"SetTexture" @keyword
"AlphaTest" @keyword
"BindChannels" @keyword

; --- Legacy values ---
[ "AmbientAndDiffuse" "Emission" ] @constant.builtin
(legacy_material_block [ "Diffuse" "Ambient" "Specular" "Emission" "Shininess" ] @keyword)
(legacy_set_texture_command [ "combine" "constantColor" "Matrix" ] @keyword)
(legacy_set_texture_command [
  "texture" "primary" "previous" "constant" "one" "One"
  "alpha" "invalpha"
  "double" "quad" "lerp"
] @constant.builtin)
(legacy_bind_channels_command "Bind" @keyword)
(legacy_fog_command "Mode" @keyword)
(legacy_fog_command "Color" @keyword)
(legacy_fog_command "Density" @keyword)
(legacy_fog_command "Range" @keyword)
(legacy_fog_command [ "Global" "Linear" "Exp" "Exp2" ] @constant.builtin)

; --- Tags ---
"Tags" @keyword
"LOD" @keyword

; --- Auxiliary declarations ---
[ "Name" "FallBack" "Fallback" "CustomEditor" "UsePass" "GrabPass" "Dependency" ] @keyword

; --- Strings ---
(string_literal) @string

; --- Numbers ---
(number_literal) @number

; --- Comments ---
(comment) @comment @spell

; --- Property attributes ---
(property_attribute) @attribute

; --- Identifiers ---
(identifier) @variable

; --- Property names (highlight as member variables / fields) ---
(property_declaration name: (identifier) @variable.member)

; --- Property attribute identifiers (override generic @variable) ---
(property_attribute (dotted_identifier (identifier) @attribute))
; Also match identifiers inside attribute arguments (e.g. [Enum(UnityEngine.Rendering.BlendMode)])
(property_attribute (attribute_arguments (dotted_identifier (identifier) @attribute)))

; --- Property references (e.g. [_MainTex] in Pass/SubShader) ---
(property_reference (identifier) @variable.member)