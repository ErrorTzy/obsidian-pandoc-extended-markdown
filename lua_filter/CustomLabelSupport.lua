-- Shared reader/filter contract and inline operations. This module owns no
-- document state; keep it beside CustomLabelReader.lua and CustomLabelList.lua.

local pandoc = require 'pandoc'
local List = require 'pandoc.List'
local KIND_ATTRIBUTE = 'data-pem-custom-label'
local RAW_WHITESPACE_ATTRIBUTE = 'data-pem-custom-label-whitespace'

local Annotations = {
    WHITESPACE = 'whitespace',
    SEPARATOR = 'separator',
    ESCAPED_OPENING = 'escaped-opening',
}

function Annotations.kind(inline)
    return inline.t == 'Span' and inline.attributes[KIND_ATTRIBUTE] or nil
end

function Annotations.create(kind, raw_whitespace)
    local content, attributes = {}, {{ KIND_ATTRIBUTE, kind }}
    if kind == Annotations.WHITESPACE then
        -- Unmatched markers display normal Markdown whitespace. Only the
        -- parser/registry sees the exact source identity through text().
        content = { pandoc.Space() }
        attributes[#attributes + 1] = { RAW_WHITESPACE_ATTRIBUTE, raw_whitespace }
    elseif kind == Annotations.ESCAPED_OPENING then
        content = { pandoc.Str('{') }
    end
    return pandoc.Span(content, pandoc.Attr('', {}, attributes))
end

function Annotations.text(inline)
    local kind = Annotations.kind(inline)
    if kind == Annotations.SEPARATOR then return ' ' end
    if kind == Annotations.WHITESPACE then return inline.attributes[RAW_WHITESPACE_ATTRIBUTE] end
    -- Escaped openings are barriers until syntax processing is complete.
    return nil
end

function Annotations.unwrap(span)
    local kind = Annotations.kind(span)
    if kind == Annotations.ESCAPED_OPENING or kind == Annotations.SEPARATOR
        or kind == Annotations.WHITESPACE then return span.content end
end

local TextRun = {}

function TextRun.plain_text(inline)
    if inline.t == 'Str' then return inline.text end
    if inline.t == 'Space' then return ' ' end
    return nil
end

function TextRun.text(inline)
    return TextRun.plain_text(inline) or Annotations.text(inline)
end

function TextRun.prefix(inlines)
    local parts = {}
    for _, inline in ipairs(inlines) do
        local text = TextRun.text(inline)
        if not text then break end
        parts[#parts + 1] = text
    end
    return table.concat(parts)
end

-- Lua patterns use byte offsets. Keep whole nodes wherever possible, splitting
-- only text at syntax edges and preserving rich nodes when slicing item bodies.
function TextRun.slice(inlines, first, last)
    local result, offset = List{}, 1
    for _, inline in ipairs(inlines) do
        local text = TextRun.text(inline)
        local length = text and #text or 0
        if offset > last then break end
        if not text then
            if offset >= first then result:insert(inline) end
        elseif offset + length > first then
            local from = math.max(1, first - offset + 1)
            local to = math.min(length, last - offset + 1)
            if from == 1 and to == length then
                result:insert(inline)
            elseif to >= from then
                result:insert(pandoc.Str(text:sub(from, to)))
            end
        end
        offset = offset + length
    end
    return result
end

-- Map only contiguous syntax-bearing runs, preserving intervening nodes. The
-- reader uses plain_text to decode tokens; the filter uses text to include the
-- resulting whitespace/separator annotations while excluding escaped openings.
function TextRun.map(inlines, transform, text_of)
    text_of = text_of or TextRun.text
    local result, run = List{}, List{}
    local function flush()
        if #run > 0 then
            result:extend(transform(run))
            run = List{}
        end
    end
    for _, inline in ipairs(inlines) do
        if text_of(inline) then
            run:insert(inline)
        else
            flush()
            result:insert(inline)
        end
    end
    flush()
    return result
end

return { Annotations = Annotations, TextRun = TextRun }
