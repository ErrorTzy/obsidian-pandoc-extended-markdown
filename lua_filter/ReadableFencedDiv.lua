--[[
  Readable fenced div normalizer for Pandoc.

  Pandoc does not parse custom readable shorthand like:

    ::: Theorem #thm data=1
    content
    :::

  This filter rewrites those parsed paragraph/block sequences into native Div
  blocks with attributes equivalent to:

    ::: {.Theorem #thm data=1}
--]]

local pandoc = require 'pandoc'
local List = require 'pandoc.List'
local utils = require 'pandoc.utils'

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
            result = result .. char
            escaped = false
        elseif char == '\\' then
            escaped = true
        else
            result = result .. char
        end
    end

    if escaped then
        result = result .. '\\'
    end

    return result
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

local function parse_readable_opening(text)
    local attributes = text:match('^:::+%s+(.+)$')
    if not attributes then
        return nil
    end

    attributes = attributes:gsub('%s+:+%s*$', '')
    if attributes == '' then
        return nil
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

    return {
        id = id,
        classes = classes,
        key_values = key_values,
    }
end

local function is_readable_closing(text)
    return text:match('^:::+%s*$') ~= nil
end

local function block_text(block)
    if block.t ~= 'Para' and block.t ~= 'Plain' then
        return nil
    end

    return utils.stringify(block.content)
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

local function block_contains_readable_fence_lines(block)
    if block.t ~= 'Para' and block.t ~= 'Plain' then
        return false
    end

    for _, line in ipairs(split_inline_lines(block.content)) do
        local text = utils.stringify(line)
        if parse_readable_opening(text) or is_readable_closing(text) then
            return true
        end
    end

    return false
end

local function expand_fence_paragraphs(blocks)
    local expanded = List{}

    for _, block in ipairs(blocks) do
        if block_contains_readable_fence_lines(block) then
            for _, line in ipairs(split_inline_lines(block.content)) do
                expanded:insert(pandoc.Para(line))
            end
        else
            expanded:insert(block)
        end
    end

    return expanded
end

local normalize_blocks

local function normalize_child_blocks(block)
    if block.t == 'BlockQuote' then
        return pandoc.BlockQuote(normalize_blocks(block.content))
    end

    if block.t == 'Div' then
        return pandoc.Div(normalize_blocks(block.content), block.attr)
    end

    if block.t == 'BulletList' then
        local items = List{}
        for _, item in ipairs(block.content) do
            items:insert(normalize_blocks(item))
        end
        return pandoc.BulletList(items)
    end

    if block.t == 'OrderedList' then
        local items = List{}
        for _, item in ipairs(block.content) do
            items:insert(normalize_blocks(item))
        end
        return pandoc.OrderedList(items, block.listAttributes)
    end

    return block
end

local function parse_sequence(blocks, start_index, stop_on_close)
    local result = List{}
    local index = start_index

    while index <= #blocks do
        local block = blocks[index]
        local text = block_text(block)

        if text and is_readable_closing(text) then
            if stop_on_close then
                return result, index + 1, true
            end

            result:insert(block)
            index = index + 1
        else
            local opening = text and parse_readable_opening(text) or nil
            if opening then
                local inner, next_index, closed = parse_sequence(blocks, index + 1, true)
                if closed then
                    result:insert(pandoc.Div(
                        inner,
                        pandoc.Attr(opening.id, opening.classes, opening.key_values)
                    ))
                    index = next_index
                else
                    io.stderr:write('[ReadableFencedDiv] unmatched readable fenced div opener; leaving content unchanged\n')
                    result:insert(block)
                    for _, inner_block in ipairs(inner) do
                        result:insert(inner_block)
                    end
                    return result, next_index, false
                end
            else
                result:insert(normalize_child_blocks(block))
                index = index + 1
            end
        end
    end

    return result, index, false
end

function normalize_blocks(blocks)
    local expanded = expand_fence_paragraphs(blocks)
    local normalized = parse_sequence(expanded, 1, false)
    return normalized
end

local function process_doc(doc)
    doc.blocks = normalize_blocks(doc.blocks)
    return doc
end

return {
    {
        Pandoc = process_doc,
    },
}
