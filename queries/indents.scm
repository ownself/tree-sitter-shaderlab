; ============================================
; Indentation rules for ShaderLab
; ============================================

; Indent after opening braces
[
  "{"
] @indent.begin

; Dedent at closing braces
[
  "}"
] @indent.branch

; Dedent for end braces (end of block)
[
  "}"
] @indent.end