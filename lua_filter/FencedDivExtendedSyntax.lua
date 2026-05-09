--[[
  Fenced div extended syntax filter for Pandoc.

  This monolithic filter handles the fenced-div export features used by the
  plugin:
  - normalizing readable shorthand such as `::: Theorem #thm key=1`
  - adding generated titles for titled/classed Div blocks
  - replacing known citations such as `@thm` with numbered reference text
]]

local pandoc = require 'pandoc'
local List = require 'pandoc.List'
local utils = require 'pandoc.utils'

local TEMP_INDEX_ATTRIBUTE = 'data-pem-crossref-index'
local FENCED_DIV_CLASS = 'pem-fenced-div'
local FENCED_DIV_TITLE_CLASS = 'pem-fenced-div-title'
local FENCED_DIV_DOCX_STYLE = 'PEM Fenced Div'
local FENCED_DIV_TITLE_DOCX_STYLE = 'PEM Fenced Div Title'
local PLACEHOLDER_DOT_TOKEN = 'PEMPLACEHOLDERDOT'
local NUMBERING_ESCAPE_CLASSES = {
    ['no-num'] = true,
    ['unnumbered'] = true,
}
local split_line_groups = setmetatable({}, { __mode = 'k' })
local split_line_group_counter = 0

local HTML_STYLE_BLOCK = [[
<style>
.pem-fenced-div {
  border-left: 2px solid #8a8f98;
  margin: 1em 0;
  padding-left: 1em;
}

.pem-fenced-div .pem-fenced-div {
  margin: 0.75em 0 0.75em 0.75em;
}

.pem-fenced-div > .pem-fenced-div-title,
.pem-fenced-div-title {
  display: block;
  font-weight: 700;
}

.pem-fenced-div > .pem-fenced-div-title {
  margin-bottom: 0.35em;
}
</style>
]]

local LATEX_STYLE_BLOCK = [[
\usepackage[most]{tcolorbox}
\newtcolorbox{PEMFencedDivBox}{
  blanker,
  breakable,
  borderline west={1.5pt}{0pt}{black!45},
  left=0.9em,
  right=0pt,
  top=0.4em,
  bottom=0.4em,
  before skip=0.8em,
  after skip=0.8em
}
]]

local function trim(value)
    return (value or ''):gsub('^%s+', ''):gsub('%s+$', '')
end

local function is_html_output()
    return FORMAT and FORMAT:match('html') ~= nil
end

local function is_latex_output()
    return FORMAT == 'latex' or FORMAT == 'beamer'
end

local function is_custom_style_output()
    return FORMAT == 'docx' or FORMAT == 'odt'
end

local function add_class(attr, class_name)
    if not attr.classes:includes(class_name) then
        attr.classes:insert(class_name)
    end
end

local function append_header_include(doc, format, text)
    local block = pandoc.RawBlock(format, text)
    local header_includes = doc.meta['header-includes']

    if not header_includes then
        doc.meta['header-includes'] = pandoc.MetaBlocks({ block })
        return
    end

    doc.meta['header-includes'] = pandoc.MetaList({
        header_includes,
        pandoc.MetaBlocks({ block }),
    })
end

local function strip_quotes(value)
    if #value < 2 then
        return value
    end

    local quote = value:sub(1, 1)
    if (quote ~= '"' and quote ~= "'") or value:sub(-1) ~= quote then
        return value
    end

    local result = ''
    local escaped = false
    for index = 2, #value - 1 do
        local char = value:sub(index, index)
        if escaped then
            if char == '&' then
                result = result .. '\\' .. char
            else
                result = result .. char
            end
            escaped = false
        elseif char == '\\' then
            escaped = true
        else
            result = result .. char
        end
    end

    return escaped and result .. '\\' or result
end

local function split_attribute_tokens(text)
    local tokens = {}
    local current = ''
    local quote = nil
    local escaped = false

    for index = 1, #text do
        local char = text:sub(index, index)

        if escaped then
            current = current .. char
            escaped = false
        elseif char == '\\' and quote then
            current = current .. char
            escaped = true
        elseif (char == '"' or char == "'") and not quote then
            quote = char
            current = current .. char
        elseif char == quote then
            quote = nil
            current = current .. char
        elseif char:match('%s') and not quote then
            if current ~= '' then
                table.insert(tokens, current)
                current = ''
            end
        else
            current = current .. char
        end
    end

    if quote or escaped then
        return nil
    end

    if current ~= '' then
        table.insert(tokens, current)
    end
    return tokens
end

local function is_attribute_key(key)
    return key:match('^[A-Za-z:][A-Za-z0-9_:%.%-]*$') ~= nil
end

local function is_readable_class(token)
    return token:match('^[^%s#={},]+$') ~= nil and token:match('^:+$') == nil
end

local function is_numbering_escape_class(class_name)
    return NUMBERING_ESCAPE_CLASSES[(class_name or ''):lower()] == true
end

local function find_first_placeholder_group(value)
    local escaped = false

    for index = 1, #value do
        local char = value:sub(index, index)
        if escaped then
            escaped = false
        elseif char == '\\' then
            escaped = true
        elseif char == '&' then
            local group_end = index
            local depth = 1
            while value:sub(group_end + 1, group_end + 1) == '.' and
                value:sub(group_end + 2, group_end + 2) == '&' do
                depth = depth + 1
                group_end = group_end + 2
            end
            return {
                start = index,
                finish = group_end,
                depth = depth,
            }
        end
    end

    return nil
end

local function is_placeholder_only_title(value)
    local placeholder_group = find_first_placeholder_group(value or '')
    return placeholder_group ~= nil and
        placeholder_group.start == 1 and
        placeholder_group.finish == #value
end

local function preserve_placeholder_dots(value)
    local result = ''
    for index = 1, #value do
        local char = value:sub(index, index)
        if char == '.' and value:sub(index - 1, index - 1) == '&' and value:sub(index + 1, index + 1) == '&' then
            result = result .. PLACEHOLDER_DOT_TOKEN
        else
            result = result .. char
        end
    end
    return result
end

local function humanize_class_name(class_name)
    local text = preserve_placeholder_dots(class_name or '')
        :gsub('[_:%-]+', ' ')
        :gsub('%.', ' ')
        :gsub('%s+', ' ')
        :gsub(PLACEHOLDER_DOT_TOKEN, '.')
    text = trim(text)
    if text == '' then
        return ''
    end
    return (text:gsub('(%f[%a]%a)', string.upper))
end

local function synthesize_title_from_classes(classes)
    local title_parts = {}
    for _, class_name in ipairs(classes or {}) do
        if not is_numbering_escape_class(class_name) then
            table.insert(title_parts, humanize_class_name(class_name))
        end
    end

    if #title_parts == 0 then
        return ''
    end

    local placeholder_index = nil
    for index, part in ipairs(title_parts) do
        if find_first_placeholder_group(part) then
            placeholder_index = index
            break
        end
    end

    if not placeholder_index then
        return title_parts[1] or ''
    end

    if not is_placeholder_only_title(title_parts[placeholder_index]) then
        return title_parts[placeholder_index] or ''
    end

    local title_index = nil
    for index, part in ipairs(title_parts) do
        if not is_placeholder_only_title(part) then
            title_index = index
            break
        end
    end

    if not title_index then
        return title_parts[placeholder_index] or ''
    end

    if placeholder_index < title_index then
        return title_parts[placeholder_index] .. ' ' .. title_parts[title_index]
    end
    return title_parts[title_index] .. ' ' .. title_parts[placeholder_index]
end

local function has_title_key(key_values)
    for _, pair in ipairs(key_values or {}) do
        if pair[1] == 'title' then
            return true
        end
    end
    return false
end

local function with_synthesized_title(opening)
    if has_title_key(opening.key_values) then
        return opening
    end

    local title = synthesize_title_from_classes(opening.classes)
    if title ~= '' then
        table.insert(opening.key_values, {'title', title})
    end
    return opening
end

local function parse_key_value(token)
    local separator = token:find('=', 1, true)
    if not separator then
        return nil
    end

    local key = token:sub(1, separator - 1)
    if not is_attribute_key(key) then
        return nil
    end
    return key, strip_quotes(token:sub(separator + 1))
end

local function find_closing_brace(value, start_index)
    local quote = nil
    local escaped = false

    for index = start_index, #value do
        local char = value:sub(index, index)
        if escaped then
            escaped = false
        elseif char == '\\' and quote then
            escaped = true
        elseif (char == '"' or char == "'") and not quote then
            quote = char
        elseif char == quote then
            quote = nil
        elseif char == '}' and not quote then
            return index
        end
    end
    return nil
end

local function parse_native_braced_attributes(braced_text)
    local ok, doc = pcall(pandoc.read, '::: ' .. braced_text .. '\n:::', 'markdown')
    if not ok or not doc.blocks or #doc.blocks ~= 1 or doc.blocks[1].t ~= 'Div' then
        return nil
    end

    local div = doc.blocks[1]
    local key_values = {}
    for key, value in pairs(div.attributes or {}) do
        table.insert(key_values, {key, value})
    end
    return {
        id = div.identifier or '',
        classes = div.classes or {},
        key_values = key_values,
    }
end

local function with_title(opening, title)
    table.insert(opening.key_values, {'title', title})
    return opening
end

local function parse_braced_title_after_attributes(attributes)
    if attributes:sub(1, 1) ~= '{' then
        return nil
    end

    local closing_brace = find_closing_brace(attributes, 1)
    if not closing_brace then
        return nil
    end

    local title = trim(attributes:sub(closing_brace + 1))
    if title == '' then
        return nil
    end

    local opening = parse_native_braced_attributes(attributes:sub(1, closing_brace))
    return opening and with_title(opening, title) or nil
end

local function parse_braced_title_before_attributes(attributes)
    if attributes:sub(-1) ~= '}' then
        return nil
    end

    for index = 1, #attributes do
        if attributes:sub(index, index) == '{' then
            local closing_brace = find_closing_brace(attributes, index)
            if closing_brace == #attributes then
                local title = trim(attributes:sub(1, index - 1))
                if title == '' then
                    return nil
                end

                local opening = parse_native_braced_attributes(attributes:sub(index, closing_brace))
                return opening and with_title(opening, title) or nil
            end
        end
    end
    return nil
end

local function parse_readable_opening(text)
    local attributes = text:match('^:::+%s+(.+)$')
    if not attributes then
        return nil
    end

    attributes = attributes:gsub('%s+:+%s*$', '')
    if attributes == '' then
        return nil
    end

    local braced_opening = parse_braced_title_after_attributes(attributes) or
        parse_braced_title_before_attributes(attributes)
    if braced_opening then
        return braced_opening
    end

    local tokens = split_attribute_tokens(attributes)
    if not tokens or #tokens == 0 then
        return nil
    end

    local id = ''
    local classes = {}
    local key_values = {}
    for _, token in ipairs(tokens) do
        local parsed_id = token:match('^#([^%s@,=]+)$')
        if parsed_id then
            id = parsed_id
        elseif token:find('=', 1, true) then
            local key, value = parse_key_value(token)
            if not key then
                return nil
            end
            table.insert(key_values, {key, value})
        elseif is_readable_class(token) then
            table.insert(classes, token)
        else
            return nil
        end
    end

    return with_synthesized_title({
        id = id,
        classes = classes,
        key_values = key_values,
    })
end

local function is_readable_closing(text)
    return text:match('^:::+%s*$') ~= nil
end

local function is_atx_heading(text)
    local hashes = text:match('^(#+)')
    if not hashes or #hashes > 6 then
        return false
    end

    local next_char = text:sub(#hashes + 1, #hashes + 1)
    return next_char == '' or next_char:match('%s') ~= nil
end

local function is_thematic_break(text)
    return text:match('^(%*%s*)%*%s*%*[%*%s]*$') ~= nil or
        text:match('^(%-%s*)%-%s*%-[%-%s]*$') ~= nil or
        text:match('^(_%s*)_%s*_[_%s]*$') ~= nil
end

local function is_single_line_html_block(text)
    local tag = text:match('^<([A-Za-z][A-Za-z0-9%-]*)(%s[^>]*)?>.*</%1>$')
    if not tag then
        return false
    end

    local block_tags = {
        address = true, article = true, aside = true, base = true,
        basefont = true, blockquote = true, body = true, caption = true,
        center = true, col = true, colgroup = true, dd = true,
        details = true, dialog = true, dir = true, div = true,
        dl = true, dt = true, fieldset = true, figcaption = true,
        figure = true, footer = true, form = true, frame = true,
        frameset = true, h1 = true, h2 = true, h3 = true,
        h4 = true, h5 = true, h6 = true, head = true,
        header = true, hr = true, html = true, iframe = true,
        legend = true, li = true, link = true, main = true,
        menu = true, menuitem = true, nav = true, noframes = true,
        ol = true, optgroup = true, option = true, p = true,
        param = true, search = true, section = true, summary = true,
        table = true, tbody = true, td = true, tfoot = true,
        th = true, thead = true, title = true, tr = true,
        track = true, ul = true,
    }
    return block_tags[tag:lower()] == true
end

local function allows_readable_opening_after_line(text)
    local trimmed = trim(text or '')
    return trimmed == '' or
        is_atx_heading(trimmed) or
        is_thematic_break(trimmed) or
        is_single_line_html_block(trimmed)
end

local function split_inline_lines(inlines)
    local lines = List{}
    local current = List{}

    for _, inline in ipairs(inlines) do
        if inline.t == 'SoftBreak' or inline.t == 'LineBreak' then
            lines:insert(current)
            current = List{}
        else
            current:insert(inline)
        end
    end

    lines:insert(current)
    return lines
end

local function block_text(block)
    if block.t ~= 'Para' and block.t ~= 'Plain' then
        return nil
    end
    return utils.stringify(block.content)
end

local function block_contains_processable_readable_fence_lines(block)
    if block.t ~= 'Para' and block.t ~= 'Plain' then
        return false
    end

    local can_open = true
    for _, line in ipairs(split_inline_lines(block.content)) do
        local text = utils.stringify(line)
        if can_open and parse_readable_opening(text) then
            return true
        end

        can_open = allows_readable_opening_after_line(text)
    end
    return false
end

local function expand_fence_paragraphs(blocks)
    local expanded = List{}

    for _, block in ipairs(blocks) do
        if block_contains_processable_readable_fence_lines(block) then
            split_line_group_counter = split_line_group_counter + 1
            for _, line in ipairs(split_inline_lines(block.content)) do
                local paragraph = pandoc.Para(line)
                split_line_groups[paragraph] = split_line_group_counter
                expanded:insert(paragraph)
            end
        else
            expanded:insert(block)
        end
    end
    return expanded
end

local normalize_readable_blocks

local function normalize_child_blocks(block)
    if block.t == 'BlockQuote' then
        return pandoc.BlockQuote(normalize_readable_blocks(block.content))
    end

    if block.t == 'Div' then
        return pandoc.Div(normalize_readable_blocks(block.content), block.attr)
    end

    if block.t == 'BulletList' or block.t == 'OrderedList' then
        local items = List{}
        for _, item in ipairs(block.content) do
            items:insert(normalize_readable_blocks(item))
        end

        if block.t == 'BulletList' then
            return pandoc.BulletList(items)
        end
        return pandoc.OrderedList(items, block.listAttributes)
    end

    return block
end

local function parse_readable_sequence(blocks, start_index, stop_on_close)
    local result = List{}
    local index = start_index
    local can_open = true
    local active_split_group = nil

    while index <= #blocks do
        local block = blocks[index]
        local text = block_text(block)
        local split_group = split_line_groups[block]

        if split_group ~= active_split_group then
            active_split_group = split_group
            can_open = true
        elseif not split_group then
            can_open = true
        end

        if text and is_readable_closing(text) then
            if stop_on_close then
                return result, index + 1, true
            end

            result:insert(block)
            index = index + 1
            can_open = true
        else
            local opening = can_open and text and parse_readable_opening(text) or nil
            if opening then
                local inner, next_index, closed = parse_readable_sequence(blocks, index + 1, true)
                if closed then
                    result:insert(pandoc.Div(
                        inner,
                        pandoc.Attr(opening.id, opening.classes, opening.key_values)
                    ))
                    index = next_index
                    can_open = true
                else
                    io.stderr:write('[FencedDivExtendedSyntax] unmatched readable fenced div opener; leaving content unchanged\n')
                    result:insert(block)
                    for _, inner_block in ipairs(inner) do
                        result:insert(inner_block)
                    end
                    return result, next_index, false
                end
            else
                result:insert(normalize_child_blocks(block))
                index = index + 1
                if split_group and text then
                    can_open = allows_readable_opening_after_line(text)
                else
                    can_open = true
                end
            end
        end
    end

    return result, index, false
end

function normalize_readable_blocks(blocks)
    local expanded = expand_fence_paragraphs(blocks)
    local normalized = parse_readable_sequence(expanded, 1, false)
    return normalized
end

local function title_for_div(div)
    local title = trim(div.attributes and div.attributes.title or '')
    if title ~= '' then
        return title
    end

    for _, class_name in ipairs(div.classes or {}) do
        local raw_title = class_name:match('^title=(.+)$')
        if raw_title then
            return trim(strip_quotes(raw_title))
        end
    end
    return ''
end

local function has_numbering_escape_class(div)
    for _, class_name in ipairs(div.classes or {}) do
        if is_numbering_escape_class(class_name) then
            return true
        end
    end
    return false
end

local function title_stem(title)
    local placeholder_group = find_first_placeholder_group(title or '')
    local stem = title or ''
    if placeholder_group then
        stem = stem:sub(1, placeholder_group.start - 1) .. stem:sub(placeholder_group.finish + 1)
    end
    stem = stem:gsub('\\&', '&')
    return trim(stem:gsub('[^%w%s]+', ' '):gsub('%s+', ' '))
end

local function class_label_for_div(div)
    for _, class_name in ipairs(div.classes or {}) do
        if not is_numbering_escape_class(class_name) and not is_placeholder_only_title(humanize_class_name(class_name)) then
            return humanize_class_name(class_name)
        end
    end
    return ''
end

local function title_template_for_div(div)
    return title_for_div(div)
end

local function should_number_div(div)
    local title = title_template_for_div(div)
    return find_first_placeholder_group(title) ~= nil and not has_numbering_escape_class(div)
end

local function render_numbered_title(title, number_parts)
    local placeholder_group = find_first_placeholder_group(title or '')
    if not placeholder_group then
        return (title or ''):gsub('\\&', '&')
    end

    local index = 0
    local group = title:sub(placeholder_group.start, placeholder_group.finish):gsub('&', function()
        index = index + 1
        return tostring(number_parts[index] or 0)
    end)
    return (
        title:sub(1, placeholder_group.start - 1) ..
        group ..
        title:sub(placeholder_group.finish + 1)
    ):gsub('\\&', '&')
end

local function type_label_for_div(div, numbering_enabled)
    local title = title_template_for_div(div)
    if title ~= '' then
        return numbering_enabled and title_stem(title) or title:gsub('\\&', '&')
    end

    local class_label = class_label_for_div(div)
    return class_label ~= '' and class_label or 'Div'
end

local function should_render_block_title(div)
    if title_for_div(div) ~= '' then
        return true
    end

    for _, class_name in ipairs(div.classes or {}) do
        if not is_numbering_escape_class(class_name) and not is_placeholder_only_title(humanize_class_name(class_name)) then
            return true
        end
    end
    return false
end

local function type_key_for_label(label)
    local key = label:lower():gsub('[^a-z0-9]+', '-'):gsub('^-+', ''):gsub('-+$', '')
    return key == '' and 'div' or key
end

local function is_generated_title_block(block)
    return block and
        block.t == 'Div' and
        block.classes and
        block.classes:includes(FENCED_DIV_TITLE_CLASS)
end

local function title_block(reference)
    local attributes = {}
    local title_inline = pandoc.Str(reference.block_title_text)

    if is_custom_style_output() then
        attributes = {
            { 'custom-style', FENCED_DIV_TITLE_DOCX_STYLE },
        }
        title_inline = pandoc.Span(
            { title_inline },
            pandoc.Attr('', {}, {
                { 'custom-style', FENCED_DIV_TITLE_DOCX_STYLE },
            })
        )
    end

    return pandoc.Div(
        { pandoc.Plain({ pandoc.Strong({ title_inline }) }) },
        pandoc.Attr('', { FENCED_DIV_TITLE_CLASS }, attributes)
    )
end

local function register_div(div, state)
    local title_template = title_template_for_div(div)
    local numbering_enabled = should_number_div(div)
    local type_label = type_label_for_div(div, numbering_enabled)
    local type_key = type_key_for_label(type_label)
    local number_parts = {}
    local number = 0
    local reference_text = type_label

    if numbering_enabled then
        local depth = find_first_placeholder_group(title_template).depth
        local current_parts = state.counters[type_key] or {}
        for index = 1, depth - 1 do
            number_parts[index] = current_parts[index] or 1
        end
        number_parts[depth] = (current_parts[depth] or 0) + 1
        state.counters[type_key] = number_parts
        number = number_parts[#number_parts] or 0
        reference_text = render_numbered_title(title_template, number_parts)
    end

    local reference = {
        type_label = type_label,
        type_key = type_key,
        number = number,
        number_parts = number_parts,
        numbering_enabled = numbering_enabled,
        reference_text = reference_text,
        block_title_text = should_render_block_title(div) and
            reference_text or ''
    }
    table.insert(state.div_metadata, reference)

    local id = div.identifier
    if id and id ~= '' and not state.references[id] then
        state.references[id] = reference
    end
    div.attributes[TEMP_INDEX_ATTRIBUTE] = tostring(#state.div_metadata)
end

local function scan_blocks(blocks, state)
    for _, block in ipairs(blocks) do
        if block.t == 'Div' then
            if not is_generated_title_block(block) then
                register_div(block, state)
            end
            scan_blocks(block.content, state)
        elseif block.t == 'BlockQuote' then
            scan_blocks(block.content, state)
        elseif block.t == 'BulletList' or block.t == 'OrderedList' then
            for _, item in ipairs(block.content) do
                scan_blocks(item, state)
            end
        elseif block.t == 'DefinitionList' then
            for _, item in ipairs(block.content) do
                for _, definition in ipairs(item[2]) do
                    scan_blocks(definition, state)
                end
            end
        end
    end
end

local function has_affixes(citation)
    return (citation.prefix and #citation.prefix > 0) or
        (citation.suffix and #citation.suffix > 0)
end

local function cross_reference_filter(state)
    return {
        Cite = function(cite_node)
            if #cite_node.citations ~= 1 then
                return nil
            end

            local citation = cite_node.citations[1]
            if has_affixes(citation) then
                return nil
            end

            local reference = state.references[citation.id]
            return reference and pandoc.Str(reference.reference_text) or nil
        end,

        Div = function(div_node)
            local index = tonumber(div_node.attributes[TEMP_INDEX_ATTRIBUTE] or '')
            div_node.attributes[TEMP_INDEX_ATTRIBUTE] = nil

            local reference = index and state.div_metadata[index] or nil
            if not reference then
                return nil
            end

            if reference.block_title_text ~= '' and not is_generated_title_block(div_node.content[1]) then
                div_node.content:insert(1, title_block(reference))
            end

            add_class(div_node.attr, FENCED_DIV_CLASS)

            if is_custom_style_output() then
                div_node.attributes['custom-style'] = FENCED_DIV_DOCX_STYLE
            end

            if is_latex_output() then
                local wrapped = List{ pandoc.RawBlock('latex', '\\begin{PEMFencedDivBox}') }
                for _, block in ipairs(div_node.content) do
                    wrapped:insert(block)
                end
                wrapped:insert(pandoc.RawBlock('latex', '\\end{PEMFencedDivBox}'))
                return wrapped
            end
            return div_node
        end,
    }
end

local function process_doc(doc)
    doc.blocks = normalize_readable_blocks(doc.blocks)

    local state = {
        references = {},
        div_metadata = {},
        counters = {},
    }
    scan_blocks(doc.blocks, state)
    doc = doc:walk(cross_reference_filter(state))

    if #state.div_metadata > 0 then
        if is_html_output() then
            append_header_include(doc, 'html', HTML_STYLE_BLOCK)
        elseif is_latex_output() then
            append_header_include(doc, 'latex', LATEX_STYLE_BLOCK)
        end
    end

    return doc
end

return {
    {
        Pandoc = process_doc,
    },
}
