/// <reference types="tree-sitter-cli/dsl" />

module.exports = grammar({
    name: 'shaderlab',

    word: $ => $.identifier,

    externals: $ => [
        $.program_content,
    ],

    extras: $ => [
        /\s/,
        $.comment,
    ],

    rules: {
        source_file: $ => repeat($._top_level_item),

        _top_level_item: $ => choice(
            $.shader_definition,
            $.subshader_block,  // 允许裸 SubShader 用于部分解析
            $.pass_block,       // 允许裸 Pass 用于部分解析
        ),

        // =============================================
        // Shader 定义：Shader "Name" { body }
        // =============================================
        shader_definition: $ => seq(
            'Shader',
            field('name', $.string_literal),
            field('body', $.shader_body),
        ),

        shader_body: $ => seq(
            '{',
            repeat($._shader_body_item),
            '}',
        ),

        _shader_body_item: $ => choice(
            $.properties_block,
            $.subshader_block,
            $.custom_editor,
            $.fallback,
            $.use_pass,
            $.grab_pass,
            $.category_block,
        ),

        // =============================================
        // Properties 块（Phase 3 会完善属性类型细节）
        // =============================================
        properties_block: $ => seq(
            'Properties',
            '{',
            repeat($.property_declaration),
            '}',
        ),

        property_declaration: $ => seq(
            repeat($.property_attribute),
            field('name', $.identifier),
            '(',
            field('display', $.string_literal),
            ',',
            field('type', $.property_type),
            ')',
            '=',
            field('default', $._property_default),
        ),

        property_attribute: $ => seq(
            '[',
            $.identifier,
            optional(seq('(', alias($._attr_args, $.attribute_arguments), ')')),
            ']',
        ),

        _attr_args: $ => choice(
            $._attr_arg,
            seq($._attr_arg, ',', $._attr_args),
        ),

        _attr_arg: $ => choice(
            $.identifier,
            $.number_literal,
            $.string_literal,
        ),

        property_type: $ => choice(
            '2D',
            '3D',
            'Cube',
            'CubeArray',
            '2DArray',
            'Color',
            'Vector',
            'Float',
            'Int',
            'Integer',
            seq('Range', '(', $._number, ',', $._number, ')'),
        ),

        _property_default: $ => choice(
            $.texture_default,   // "name" {} — 纹理类属性
            $.color_default,     // (r,g,b,a)   — Color/Vector 属性
            $.number_literal,
            $.string_literal,
        ),

        texture_default: $ => seq($.string_literal, '{', '}'),
        color_default: $ => seq('(', $.number_literal, ',', $.number_literal, ',', $.number_literal, ',', $.number_literal, ')'),

        // =============================================
        // SubShader 块
        // =============================================
        subshader_block: $ => seq(
            'SubShader',
            '{',
            repeat($._subshader_body_item),
            '}',
        ),

        _subshader_body_item: $ => choice(
            $.tags_block,
            $.lod,
            $._render_state,
            $.pass_block,
            $.use_pass,
            $.grab_pass,
            $.cg_include,
            $.hlsl_include,
        ),

        // =============================================
        // Pass 块
        // =============================================
        pass_block: $ => seq(
            'Pass',
            '{',
            repeat($._pass_body_item),
            '}',
        ),

        _pass_body_item: $ => choice(
            $.pass_name,
            $.tags_block,
            $._render_state,
            $.cg_program_block,
            $.hlsl_program_block,
        ),

        pass_name: $ => seq('Name', $.string_literal),

        // =============================================
        // Tags 块
        // =============================================
        tags_block: $ => seq(
            'Tags',
            '{',
            repeat($.tag_pair),
            '}',
        ),

        tag_pair: $ => seq(
            field('key', $.string_literal),
            '=',
            field('value', $.string_literal),
        ),

        // =============================================
        // 渲染状态（Phase 4 会完善）
        // =============================================
        _render_state: $ => choice(
            $.cull_command,
            $.zwrite_command,
            $.ztest_command,
            $.blend_command,
            $.blend_op_command,
            $.color_mask_command,
            $.offset_command,
            $.alpha_to_mask_command,
            $.zclip_command,
            $.stencil_block,
            $.conservative_command,
        ),

        cull_command: $ => seq('Cull', field('mode', $.cull_mode)),
        cull_mode: $ => choice('Back', 'Front', 'Off'),

        zwrite_command: $ => seq('ZWrite', field('mode', $.on_off)),
        ztest_command: $ => seq('ZTest', field('func', $.comparison_func)),
        zclip_command: $ => seq('ZClip', field('mode', $.true_false)),

        blend_command: $ => seq(
            'Blend',
            optional(field('index', $.number_literal)),
            field('src_color', $.blend_factor),
            field('dst_color', $.blend_factor),
            optional(seq(',', field('src_alpha', $.blend_factor), field('dst_alpha', $.blend_factor))),
        ),
        blend_op_command: $ => seq(
            'BlendOp',
            optional(field('index', $.number_literal)),
            field('op_color', $.blend_op),
            optional(seq(',', field('op_alpha', $.blend_op))),
        ),

        color_mask_command: $ => seq('ColorMask', field('mask', $.color_mask_value)),
        color_mask_value: $ => choice('RGBA', 'RGB', 'A', 'R', 'G', 'B', '0', $.number_literal),

        offset_command: $ => seq('Offset', field('factor', $.signed_number), ',', field('units', $.signed_number)),
        signed_number: $ => choice($.number_literal, seq('-', $.number_literal)),
        alpha_to_mask_command: $ => seq('AlphaToMask', field('mode', $.on_off)),

        blend_factor: $ => choice(
            'One', 'Zero',
            'SrcColor', 'SrcAlpha',
            'DstColor', 'DstAlpha',
            'OneMinusSrcColor', 'OneMinusSrcAlpha',
            'OneMinusDstColor', 'OneMinusDstAlpha',
        ),
        blend_op: $ => choice('Add', 'Sub', 'RevSub', 'Min', 'Max'),
        comparison_func: $ => choice('Less', 'Greater', 'LEqual', 'GEqual', 'Equal', 'NotEqual', 'Always', 'Never'),
        on_off: $ => choice('On', 'Off'),
        true_false: $ => choice('True', 'False'),

        conservative_command: $ => seq('Conservative', field('mode', $.true_false)),

        // =============================================
        // Stencil 块
        // =============================================
        stencil_block: $ => seq(
            'Stencil',
            '{',
            repeat($._stencil_op),
            '}',
        ),

        _stencil_op: $ => choice(
            seq('Ref', field('value', $.number_literal)),
            seq('ReadMask', field('value', $.number_literal)),
            seq('WriteMask', field('value', $.number_literal)),
            seq(field('command', $._stencil_comp), field('func', $.comparison_func)),
            seq(field('command', $._stencil_pass), field('op', $.stencil_op_value)),
            seq(field('command', $._stencil_fail), field('op', $.stencil_op_value)),
            seq(field('command', $._stencil_zfail), field('op', $.stencil_op_value)),
        ),

        _stencil_comp: $ => choice('Comp', 'CompFront', 'CompBack'),
        _stencil_pass: $ => choice('Pass', 'PassFront', 'PassBack'),
        _stencil_fail: $ => choice('Fail', 'FailFront', 'FailBack'),
        _stencil_zfail: $ => choice('ZFail', 'ZFailFront', 'ZFailBack'),

        stencil_op_value: $ => choice(
            'Keep', 'Zero', 'Replace', 'IncrSat',
            'DecrSat', 'Invert', 'IncrWrap', 'DecrWrap',
        ),

        // =============================================
        // CGPROGRAM / HLSLPROGRAM 块
        // =============================================
        cg_program_block: $ => seq(
            field('start', choice('CGPROGRAM', 'CGINCLUDE')),
            field('content', alias($.program_content, $.cg_content)),
            field('end', 'ENDCG'),
        ),

        hlsl_program_block: $ => seq(
            field('start', choice('HLSLPROGRAM', 'HLSLINCLUDE')),
            field('content', alias($.program_content, $.hlsl_content)),
            field('end', 'ENDHLSL'),
        ),

        // 全局 CGINCLUDE / HLSLINCLUDE（在 SubShader 级别）
        cg_include: $ => seq('CGINCLUDE', alias($.program_content, $.cg_content), 'ENDCG'),
        hlsl_include: $ => seq('HLSLINCLUDE', alias($.program_content, $.hlsl_content), 'ENDHLSL'),

        // =============================================
        // 其他 ShaderLab 声明
        // =============================================
        custom_editor: $ => seq('CustomEditor', field('name', $.string_literal)),
        fallback: $ => seq('FallBack', field('shader', choice($.string_literal, 'Off'))),
        use_pass: $ => seq('UsePass', field('pass', $.string_literal)),
        grab_pass: $ => seq('GrabPass', '{', optional(field('texture', $.string_literal)), '}'),
        lod: $ => seq('LOD', field('value', $.number_literal)),

        // 旧版 Category 块 — 只包含 SubShader
        category_block: $ => seq(
            'Category',
            '{',
            repeat($.subshader_block),
            '}',
        ),

        // =============================================
        // 基础词法
        // =============================================
        comment: $ => choice(
            seq('//', /.*/),
            seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/'),
        ),

        string_literal: $ => seq('"', field('content', alias(/[^"]*/, $.string_content)), '"'),

        number_literal: $ => {
            const float = /[0-9]+\.[0-9]*([eE][+-]?[0-9]+)?[fFhH]?/;
            const float2 = /[0-9]*\.[0-9]+([eE][+-]?[0-9]+)?[fFhH]?/;
            const int = /[0-9]+/;
            const exponent = /[0-9]+[eE][+-]?[0-9]+[fFhH]?/;
            return token(choice(float, float2, exponent, int));
        },

        _number: $ => choice($.number_literal, $.identifier),

        identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,
    },
});