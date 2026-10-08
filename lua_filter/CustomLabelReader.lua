-- Source companion to CustomLabelList.lua. Only normalization-sensitive pieces
-- are shielded: Markdown still parses containers, bodies, and rich boundaries.
-- Verified with Pandoc 3.10.2; other versions may work but are untested.

local pandoc = require 'pandoc'
local List = require 'pandoc.List'
local support = dofile(pandoc.path.join {
    pandoc.path.directory(PANDOC_SCRIPT_FILE), 'CustomLabelSupport.lua',
})
local Annotations, TextRun = support.Annotations, support.TextRun
local TOKEN_END = utf8.char(0x2063)
local TOKEN_ZERO, TOKEN_ONE = utf8.char(0x200b), utf8.char(0x200c)

Extensions = pandoc.format.extensions('markdown')

local function new_protection(source)
    -- Format characters have zero display width. Unlike long ASCII tokens,
    -- they do not move grid/simple-table cell boundaries or column widths.
    local prefix = utf8.char(0x2060)
    while source:find(prefix, 1, true) do prefix = prefix .. utf8.char(0x2060) end
    local tokens, by_value = {}, {}
    local function token(kind, raw, padded, literal)
        local number, bits = #tokens + 1, {}
        repeat
            bits[#bits + 1] = number % 2 == 0 and TOKEN_ZERO or TOKEN_ONE
            number = math.floor(number / 2)
        until number == 0
        local value = prefix .. table.concat(bits) .. TOKEN_END
        local width = padded and #(literal or raw) or 0
        local left = width >= 2 and ' ' or ''
        local right = string.rep(' ', width - #left)
        local entry = { value = value, kind = kind, raw = raw, left = left, right = right, literal = literal }
        tokens[#tokens + 1], by_value[value] = entry, entry
        return left .. value .. right
    end
    return { prefix = prefix, tokens = tokens, by_value = by_value, token = token }
end

-- --preserve-tabs is required to receive original tabs from Pandoc. Expand
-- ordinary tabs ourselves at their original columns, before tokens change
-- lengths, so indentation, code, and trailing-space breaks retain Markdown's
-- usual behavior. Label tokens keep both exact and ordinary expanded forms.
local function expand_tabs(text, column, tab_stop)
    local result = {}
    for _, codepoint in utf8.codes(text) do
        if codepoint == 9 then
            local width = tab_stop - column % tab_stop
            result[#result + 1] = string.rep(' ', width)
            column = column + width
        else
            result[#result + 1] = utf8.char(codepoint)
            column = (codepoint == 10 or codepoint == 13) and 0 or column + 1
        end
    end
    return table.concat(result), column
end

local function protect_label(label, protection, column, tab_stop)
    local cursor, result = 1, {}
    while true do
        local first, last = label:find('[ \t]+', cursor)
        if not first then break end
        local prefix = label:sub(cursor, first - 1)
        local expanded
        expanded, column = expand_tabs(prefix, column, tab_stop)
        local space = label:sub(first, last)
        expanded, column = expand_tabs(space, column, tab_stop)
        result[#result + 1] = prefix .. (space == ' ' and space
            or protection.token(Annotations.WHITESPACE, space, true, expanded))
        cursor = last + 1
    end
    result[#result + 1] = label:sub(cursor)
    return table.concat(result)
end

local function protect_source(source, protection, tab_stop)
    local cursor, column, result = 1, 0, {}
    while true do
        local first, last, slashes, label, space = source:find('(\\*){::([^}\r\n]+)}([ \t]*)', cursor)
        if not first then break end
        local prefix
        prefix, column = expand_tabs(source:sub(cursor, first - 1), column, tab_stop)
        result[#result + 1] = prefix
        local raw_marker = slashes .. '{::' .. label .. '}'
        local expanded, label_column = expand_tabs(slashes .. '{::', column, tab_stop)
        local opening = '{'
        if #slashes % 2 == 1 then
            slashes = slashes:sub(1, -2)
            -- Keep the original escaped brace's display width for tables.
            opening = protection.token(Annotations.ESCAPED_OPENING, '') .. '\\{'
        end
        label = protect_label(label, protection, label_column, tab_stop)
        expanded, column = expand_tabs(raw_marker, column, tab_stop)
        space, column = expand_tabs(space, column, tab_stop)
        -- Do not consume the spaces: two trailing spaces still mean LineBreak.
        local separator = space ~= '' and protection.token(Annotations.SEPARATOR, '') or ''
        result[#result + 1] = slashes .. opening .. '::' .. label .. '}' .. separator .. space
        cursor = last + 1
    end
    result[#result + 1] = expand_tabs(source:sub(cursor), column, tab_stop)
    return table.concat(result)
end

local function restore_text(text, protection, uri)
    if type(text) ~= 'string' then return text end
    if not text:find(protection.prefix, 1, true) and not uri then return text end
    for _, token in ipairs(protection.tokens) do
        local pattern = token.left .. token.value .. token.right
        local literal = token.literal or token.raw
        if uri then
            -- Destinations percent-encode spaces but retain Unicode characters.
            pattern = token.left:gsub(' ', '%%%%20') .. token.value
                .. token.right:gsub(' ', '%%%%20')
            literal = literal:gsub('[^A-Za-z0-9._~%-]', function(char)
                return string.format('%%%02X', string.byte(char))
            end)
        end
        text = text:gsub(pattern, function() return literal end)
    end
    return text
end

-- Restore opaque strings (code, math, raw nodes, URLs, attributes, metadata
-- strings) as well as identifiers. Str nodes are decoded separately below so
-- escaped openings and separators can remain syntax barriers/information.
local function restore_fields(value, protection)
    if type(value) == 'string' then return restore_text(value, protection) end
    if type(value) ~= 'table' then return value end
    if value.t == 'Str' then return value end
    local result = setmetatable({}, getmetatable(value))
    for key, child in pairs(value) do
        result[restore_text(key, protection)] = restore_fields(child, protection)
    end
    if value.t == 'Link' or value.t == 'Image' then
        result.c[3][1] = restore_text(value.c[3][1], protection, true)
    end
    return result
end

local function decode_run(run, protection)
    local text, result, cursor = TextRun.prefix(run), List{}, 1
    while true do
        local first, last = text:find(protection.prefix .. '.-' .. TOKEN_END, cursor)
        if not first then break end
        local token = protection.by_value[text:sub(first, last)]
        -- Markdown collapses each padding run into one Space inline.
        first = first - (token.left ~= '' and 1 or 0)
        last = last + (token.right ~= '' and 1 or 0)
        if token.kind == Annotations.ESCAPED_OPENING then last = last + 1 end
        result:extend(TextRun.slice(run, cursor, first - 1))
        result:insert(Annotations.create(token.kind, token.raw))
        cursor = last + 1
    end
    result:extend(TextRun.slice(run, cursor, math.huge))
    return result
end

local function decode_inlines(inlines, protection)
    return TextRun.map(inlines, function(run) return decode_run(run, protection) end, TextRun.plain_text)
end

function Reader(sources, options)
    local protection = new_protection(tostring(sources))
    local protected = sources:map(function(source)
        return { name = source.name, text = protect_source(source.text, protection, options.tab_stop) }
    end)
    local doc = pandoc.read(pandoc.types.Sources(protected), {
        format = 'markdown', extensions = options.extensions,
    }, options)
    if #protection.tokens == 0 then return doc end
    local json = restore_fields(pandoc.json.decode(pandoc.json.encode(doc), false), protection)
    doc = pandoc.read(pandoc.json.encode(json), 'json')
    return doc:walk { Inlines = function(inlines) return decode_inlines(inlines, protection) end }
end
