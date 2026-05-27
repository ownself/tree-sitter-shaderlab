; ============================================
; Local definitions and references for ShaderLab
; ============================================

; Property names as definitions
(property_declaration
  name: (identifier) @definition.parameter)

; Shader name as definition
(shader_definition
  name: (string_literal) @namespace)

; Pass name as definition  
(pass_name
  (string_literal) @definition)

; Tag keys as references
(tag_pair
  key: (string_literal) @string.special.key)