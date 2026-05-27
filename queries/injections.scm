; ============================================
; Language injection: delegate CGPROGRAM / HLSLPROGRAM
; content to the tree-sitter-hlsl parser
; ============================================

; CGPROGRAM / CGINCLUDE blocks
((cg_content) @injection.content
  (#set! injection.language "hlsl")
  (#set! injection.combined))

; HLSLPROGRAM / HLSLINCLUDE blocks
((hlsl_content) @injection.content
  (#set! injection.language "hlsl")
  (#set! injection.combined))