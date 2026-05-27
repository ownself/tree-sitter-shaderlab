#include "tree_sitter/parser.h"

#include <string.h>

enum TokenType {
    PROGRAM_CONTENT,
};

/// 扫描 CGPROGRAM/HLSLPROGRAM 块内容，直到遇到 ENDCG 或 ENDHLSL 为止。
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

        // 检测 ENDCG 或 ENDHLSL（5-7 字符的关键词）
        // 为简单起见，检测到换行符后的 ENDCG/ENDHLSL 或文件开头的
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
                    }
                }
            }
            // E 开头但不是 ENDCG/ENDHLSL：继续
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