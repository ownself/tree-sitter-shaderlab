/// <reference types="tree-sitter-cli/dsl" />

module.exports = grammar({
    name: 'shaderlab',

    word: $ => $.identifier,

    externals: $ => [
        $.program_content,
        $._block_comment_content,
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
            $.cg_include,
            $.hlsl_include,
            $.glsl_include,
            $.custom_editor,
            $.dependency,
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

        dotted_identifier: $ => seq(
            $.identifier,
            repeat(seq('.', $.identifier)),
        ),

        property_attribute: $ => seq(
            '[',
            $.dotted_identifier,
            optional(seq('(', alias($._attr_args, $.attribute_arguments), ')')),
            ']',
        ),

        _attr_args: $ => choice(
            $._attr_arg,
            seq($._attr_arg, ',', $._attr_args),
        ),

        _attr_arg: $ => choice(
            $.dotted_identifier,
            seq($.identifier, repeat1(seq(' ', $.identifier))),
            seq($.number_literal, repeat(seq(' ', $.identifier))),
            $.number_literal,
            $.string_literal,
        ),

        property_type: $ => choice(
            '2D', '2d',
            '3D', '3d',
            'Cube', 'cube', 'CUBE',
            'CubeArray', 'cubearray',
            '2DArray', '2darray',
            'Color', 'color',
            'Vector', 'vector',
            'Float', 'float',
            'Int', 'int',
            'Integer', 'integer',
            'any', 'Any',
            'RECT', 'rect',
            seq(choice('Range', 'range', 'RANGE'), '(', $._number, ',', $._number, ')'),
        ),

        _property_default: $ => choice(
            $.texture_default,   // "name" {} — 纹理类属性
            $.color_default,     // (r,g,b,a)   — Color/Vector 属性
            $._number,
            $.string_literal,
        ),

        texture_default: $ => seq($.string_literal, '{', repeat($.identifier), '}'),
        color_default: $ => seq('(', $._number, ',', $._number, ',', $._number, optional(seq(',', $._number)), ')'),

        // =============================================
        // SubShader 块
        // =============================================
        subshader_block: $ => seq(
            choice('SubShader', 'Subshader'),
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
            $.cg_program_block,
            $.hlsl_program_block,
            $.glsl_program_block,
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
            $.lod,
            $._render_state,
            $.cg_program_block,
            $.hlsl_program_block,
            $.glsl_program_block,
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
            $.blend_off_command,
            $.blend_op_command,
            $.color_mask_command,
            $.offset_command,
            $.alpha_to_mask_command,
            $.zclip_command,
            $.stencil_block,
            $.conservative_command,
            // Phase 7 legacy commands (minimal support)
            $.legacy_lighting_command,
            $.legacy_fog_command,
            $.legacy_color_material_command,
            $.legacy_material_block,
            $.legacy_set_texture_command,
            $.legacy_alpha_test_command,
            $.legacy_bind_channels_command,
            $.separate_specular_command,
            $.legacy_color_command,
        ),

        cull_command: $ => seq('Cull', field('mode', choice($.cull_mode, $.property_reference))),
        cull_mode: $ => choice('Back', 'Front', 'Off', 'back', 'front', 'off'),

        zwrite_command: $ => seq('ZWrite', field('mode', choice($.on_off, $.property_reference))),
        ztest_command: $ => seq(choice('ZTest', 'Ztest', 'ztest'), field('func', choice($.comparison_func, $.property_reference))),

        separate_specular_command: $ => seq('SeparateSpecular', field('mode', $.on_off)),
        zclip_command: $ => seq('ZClip', field('mode', choice($.true_false, $.property_reference))),

        _blend_value: $ => choice($.blend_factor, $.property_reference),
        blend_command: $ => seq(
            'Blend',
            optional(field('index', $.number_literal)),
            field('src_color', $._blend_value),
            field('dst_color', $._blend_value),
            optional(seq(',', field('src_alpha', $._blend_value), field('dst_alpha', $._blend_value))),
        ),
        blend_off_command: $ => seq('Blend', 'Off'),
        blend_op_command: $ => seq(
            'BlendOp',
            optional(field('index', $.number_literal)),
            field('op_color', choice($.blend_op, $.property_reference)),
            optional(seq(',', field('op_alpha', choice($.blend_op, $.property_reference)))),
        ),

        color_mask_command: $ => seq('ColorMask', field('mask', choice($.color_mask_value, $.property_reference))),
        color_mask_value: $ => choice('RGBA', 'RGB', 'A', 'R', 'G', 'B', '0', 'rgba', 'rgb', 'GBA', 'RG', $.number_literal),

        offset_command: $ => seq('Offset', field('factor', $.signed_value), ',', field('units', $.signed_value)),
        signed_number: $ => choice($.number_literal, seq('-', $.number_literal)),
        signed_value: $ => choice($.signed_number, $.property_reference),
        alpha_to_mask_command: $ => seq('AlphaToMask', field('mode', choice($.on_off, $.true_false, $.property_reference))),

        blend_factor: $ => choice(
            'One', 'Zero',
            'SrcColor', 'SrcAlpha',
            'DstColor', 'DstAlpha',
            'OneMinusSrcColor', 'OneMinusSrcAlpha',
            'OneMinusDstColor', 'OneMinusDstAlpha',
        ),
        blend_op: $ => choice('Add', 'Sub', 'RevSub', 'Min', 'Max'),
        comparison_func: $ => choice(
            'Less', 'less',
            'Greater', 'greater',
            'LEqual', 'lequal',
            'GEqual', 'gequal',
            'Equal', 'equal',
            'NotEqual', 'notequal',
            'Always', 'always',
            'Never', 'never',
            'Off', 'off',
        ),
        on_off: $ => choice('On', 'Off', 'on', 'off'),
        true_false: $ => choice('True', 'False', 'true', 'false'),

        conservative_command: $ => seq('Conservative', field('mode', choice($.true_false, $.property_reference))),

        // =============================================
        // Phase 7 旧版 Fixed Function 命令（完整支持）
        // =============================================
        legacy_lighting_command: $ => seq('Lighting', field('mode', $.on_off)),
        legacy_fog_command: $ => seq(
            'Fog',
            '{',
            repeat($._legacy_fog_item),
            '}',
        ),
        _legacy_fog_item: $ => choice(
            seq('Mode', field('mode', choice('Off', 'off', 'Global', 'Linear', 'Exp', 'Exp2'))),
            seq('Color', '(', $._number, ',', $._number, ',', $._number, optional(seq(',', $._number)), ')'),
            seq('Density', $._number),
            seq('Range', $._number, ',', $._number),
        ),
        legacy_color_material_command: $ => seq('ColorMaterial', field('mode', choice('AmbientAndDiffuse', 'Emission'))),

        // Color (r,g,b,a) or Color [_Property]
        legacy_color_command: $ => seq('Color', field('color', choice($.color_default, $.property_reference))),

        // Material { Diffuse/Ambient/Specular/Emission/Shininess }
        legacy_material_block: $ => seq(
            'Material',
            '{',
            repeat($._legacy_material_item),
            '}',
        ),
        _legacy_material_item: $ => choice(
            seq('Diffuse', field('color', choice($.color_default, $.property_reference))),
            seq('Ambient', field('color', choice($.color_default, $.property_reference))),
            seq('Specular', field('color', choice($.color_default, $.property_reference))),
            seq('Emission', field('color', choice($.color_default, $.property_reference))),
            seq('Shininess', field('value', choice($._number, $.property_reference))),
        ),

        // SetTexture [name] { combine / constantColor / Matrix }
        legacy_set_texture_command: $ => seq(
            'SetTexture',
            '[', $.identifier, ']',
            '{',
            repeat($._legacy_set_texture_item),
            '}',
        ),
        _legacy_set_texture_item: $ => choice(
            seq(choice('combine', 'Combine'), repeat1($._legacy_combine_value)),
            seq(choice('constantColor', 'ConstantColor'), field('color', choice($.color_default, $.property_reference))),
            seq('Matrix', '[', $.identifier, ']'),
        ),
        _legacy_combine_value: $ => choice(
            $.identifier,
            $.number_literal,
            seq('(', $._legacy_combine_value, ')'),
            'texture', 'primary', 'previous', 'constant', 'one', 'One',
            'alpha', 'invalpha',
            '*', '+', '-', 'double', 'quad', 'lerp',
            'DOUBLE', 'QUAD', 'LERP',
            ',',
        ),

        // AlphaTest comparison [cutoff]
        legacy_alpha_test_command: $ => seq(
            choice('AlphaTest', 'Alphatest', 'alphatest'),
            field('func', $.comparison_func),
            optional(field('cutoff', choice($._number, $.property_reference))),
        ),

        // BindChannels { Bind "channel", property }
        legacy_bind_channels_command: $ => seq(
            'BindChannels',
            '{',
            repeat($._legacy_bind_channel),
            '}',
        ),
        _legacy_bind_channel: $ => seq(
            'Bind',
            field('channel', $.string_literal),
            ',',
            field('target', choice($.identifier, 'vertex', 'normal', 'tangent', 'color', 'texcoord0', 'texcoord1')),
        ),

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
            seq(choice('Ref', 'ref'), field('value', $._stencil_value)),
            seq(choice('ReadMask', 'readMask', 'readmask'), field('value', $._stencil_value)),
            seq(choice('WriteMask', 'writeMask', 'writemask'), field('value', $._stencil_value)),
            seq(field('command', $._stencil_comp), field('func', choice($.comparison_func, $.property_reference))),
            seq(field('command', $._stencil_pass), field('op', choice($.stencil_op_value, $.property_reference))),
            seq(field('command', $._stencil_fail), field('op', choice($.stencil_op_value, $.property_reference))),
            seq(field('command', $._stencil_zfail), field('op', choice($.stencil_op_value, $.property_reference))),
        ),

        _stencil_value: $ => choice($.number_literal, $.property_reference),

        _stencil_comp: $ => choice('Comp', 'CompFront', 'CompBack', 'comp', 'compfront', 'compback'),
        _stencil_pass: $ => choice('Pass', 'PassFront', 'PassBack', 'pass', 'passfront', 'passback'),
        _stencil_fail: $ => choice('Fail', 'FailFront', 'FailBack', 'fail', 'failfront', 'failback'),
        _stencil_zfail: $ => choice('ZFail', 'ZFailFront', 'ZFailBack', 'zfail', 'zfailfront', 'zfailback'),

        stencil_op_value: $ => choice(
            'Keep', 'keep',
            'Zero', 'zero',
            'Replace', 'replace',
            'IncrSat', 'incrsat',
            'DecrSat', 'decrsat',
            'Invert', 'invert',
            'IncrWrap', 'incrwrap',
            'DecrWrap', 'decrwrap',
        ),

        // =============================================
        // CGPROGRAM / HLSLPROGRAM / GLSLPROGRAM 块
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

        glsl_program_block: $ => seq(
            field('start', choice('GLSLPROGRAM', 'GLSLINCLUDE')),
            field('content', alias($.program_content, $.glsl_content)),
            field('end', 'ENDGLSL'),
        ),

        // 全局 CGINCLUDE / HLSLINCLUDE / GLSLINCLUDE（在 SubShader 级别）
        cg_include: $ => seq('CGINCLUDE', alias($.program_content, $.cg_content), 'ENDCG'),
        hlsl_include: $ => seq('HLSLINCLUDE', alias($.program_content, $.hlsl_content), 'ENDHLSL'),
        glsl_include: $ => seq('GLSLINCLUDE', alias($.program_content, $.glsl_content), 'ENDGLSL'),

        // =============================================
        // 其他 ShaderLab 声明
        // =============================================
        custom_editor: $ => seq('CustomEditor', field('name', $.string_literal)),
        dependency: $ => seq('Dependency', field('name', $.string_literal), '=', field('shader', $.string_literal)),
        fallback: $ => seq(choice('FallBack', 'Fallback'), field('shader', choice($.string_literal, 'Off', 'off'))),
        use_pass: $ => seq('UsePass', field('pass', $.string_literal)),
        grab_pass: $ => seq('GrabPass', '{', repeat(choice($.tags_block, $.pass_name, field('texture', $.string_literal))), '}'),
        lod: $ => seq('LOD', field('value', $.number_literal)),

        // 旧版 Category 块 — 可包含渲染状态和 SubShader
        category_block: $ => seq(
            'Category',
            '{',
            repeat(choice(
                $.tags_block,
                $.lod,
                $._render_state,
                $.subshader_block,
            )),
            '}',
        ),

        // =============================================
        // 基础词法
        // =============================================
        comment: $ => choice(
            seq('//', /.*/),
            seq('/*', $._block_comment_content, '*/'),
        ),

        string_literal: $ => seq('"', field('content', alias(/[^"]*/, $.string_content)), '"'),

        number_literal: $ => {
            const float = /[0-9]+\.[0-9]*([eE][+-]?[0-9]+)?[fFhH]?/;
            const float2 = /[0-9]*\.[0-9]+([eE][+-]?[0-9]+)?[fFhH]?/;
            const int = /[0-9]+/;
            const exponent = /[0-9]+[eE][+-]?[0-9]+[fFhH]?/;
            return token(choice(float, float2, exponent, int));
        },

        _number: $ => choice(
            $.number_literal,
            seq('-', $.number_literal),
            $.identifier,
        ),

        property_reference: $ => seq('[', $.identifier, ']'),

        identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,
    },
});