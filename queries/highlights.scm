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
  "2D"
  "3D"
  "Cube"
  "CubeArray"
  "2DArray"
  "Color"
  "Vector"
  "Float"
  "Int"
  "Integer"
  "Range"
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

; --- Tags ---
"Tags" @keyword
"LOD" @keyword

; --- Auxiliary declarations ---
[
  "Name"
  "FallBack"
  "CustomEditor"
  "UsePass"
  "GrabPass"
] @keyword

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