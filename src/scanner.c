#include "tree_sitter/parser.h"

#include <string.h>

enum TokenType {
    PROGRAM_CONTENT,
    BLOCK_COMMENT_CONTENT,
};

/// 扫描块注释内容（/* 和 */ 之间），支持嵌套的 /* */。
/// 调用时 lexer 位于 /* 之后的内容起始处。
/// 找到匹配的 */ 后，mark_end 标记在 */ 之前，lexer 停在 * 处。
static bool scan_block_comment_content(TSLexer *lexer) {
    int nesting = 1;

    while (nesting > 0) {
        if (lexer->eof(lexer)) {
            return false;
        }

        // 标记当前位置作为 token 备用结束点
        lexer->mark_end(lexer);

        if (lexer->lookahead == '*') {
            lexer->advance(lexer, false);
            if (lexer->lookahead == '/') {
                // 找到 */ — 不前进，让 grammar 的 '*/' 从当前位置（*）开始匹配
                nesting--;
            }
            // 注意：如果 */ 成立，lexer 停在 * 之后（即 / 处），
            // 但 mark_end 已在上方标记在 * 之前，token 结束位置正确。
        } else if (lexer->lookahead == '/') {
            lexer->advance(lexer, false);
            if (lexer->lookahead == '*') {
                lexer->advance(lexer, false);
                nesting++;
            }
        } else {
            lexer->advance(lexer, false);
        }
    }

    return true;
}

/// 扫描 CGPROGRAM/HLSLPROGRAM/GLSLPROGRAM 块内容，直到遇到 ENDCG / ENDHLSL / ENDGLSL 为止。
/// 与 C 的 raw string 类似，内容作为一个完整 token 返回（供语言注入使用）。
static bool scan_program_content(TSLexer *lexer) {
    bool has_content = false;

    for (;;) {
        if (lexer->eof(lexer)) {
            // 文件末尾：当前已标记的位置到末尾即为内容
            if (has_content) {
                lexer->mark_end(lexer);
                return true;
            }
            return false;
        }

        // 检测 ENDCG、ENDHLSL 或 ENDGLSL
        if (lexer->lookahead == 'E') {
            lexer->mark_end(lexer);  // 标记当前位置（不含关键词）为内容结束
            has_content = true;
            lexer->advance(lexer, false);

            if (lexer->lookahead == 'N') {
                lexer->advance(lexer, false);
                if (lexer->lookahead == 'D') {
                    lexer->advance(lexer, false);
                    if (lexer->lookahead == 'C') {
                        lexer->advance(lexer, false);
                        if (lexer->lookahead == 'G') {
                            // 找到 ENDCG
                            return true;
                        }
                    } else if (lexer->lookahead == 'H') {
                        lexer->advance(lexer, false);
                        if (lexer->lookahead == 'L') {
                            lexer->advance(lexer, false);
                            if (lexer->lookahead == 'S') {
                                lexer->advance(lexer, false);
                                if (lexer->lookahead == 'L') {
                                    // 找到 ENDHLSL
                                    return true;
                                }
                            }
                        }
                    } else if (lexer->lookahead == 'G') {
                        lexer->advance(lexer, false);
                        if (lexer->lookahead == 'L') {
                            lexer->advance(lexer, false);
                            if (lexer->lookahead == 'S') {
                                lexer->advance(lexer, false);
                                if (lexer->lookahead == 'L') {
                                    // 找到 ENDGLSL
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
            // E 开头但不是 ENDCG/ENDHLSL/ENDGLSL：继续
        }

        lexer->advance(lexer, false);
    }
}

void *tree_sitter_shaderlab_external_scanner_create() {
    return NULL;
}

bool tree_sitter_shaderlab_external_scanner_scan(
    void *payload,
    TSLexer *lexer,
    const bool *valid_symbols
) {
    (void)payload;

    if (valid_symbols[PROGRAM_CONTENT]) {
        lexer->result_symbol = PROGRAM_CONTENT;
        return scan_program_content(lexer);
    }

    if (valid_symbols[BLOCK_COMMENT_CONTENT]) {
        lexer->result_symbol = BLOCK_COMMENT_CONTENT;
        return scan_block_comment_content(lexer);
    }

    return false;
}

unsigned tree_sitter_shaderlab_external_scanner_serialize(
    void *payload,
    char *buffer
) {
    (void)payload;
    (void)buffer;
    return 0;
}

void tree_sitter_shaderlab_external_scanner_deserialize(
    void *payload,
    const char *buffer,
    unsigned length
) {
    (void)payload;
    (void)buffer;
    (void)length;
}

void tree_sitter_shaderlab_external_scanner_destroy(void *payload) {
    (void)payload;
}