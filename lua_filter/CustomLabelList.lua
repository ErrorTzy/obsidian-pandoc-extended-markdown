--[[
  Custom label lists: {::LABEL} body and {::LABEL} references.

  Pipeline invariants:
    1. One parser separates markers from bodies without flattening rich inlines.
    2. Only definitions allocate placeholders, in document traversal order.
    3. Every block sequence is transformed in its original container.
    4. Reference resolution is read-only; unmatched nodes remain untouched.

  Keep the expression grammar and prime matching aligned with
  src/shared/utils/placeholderProcessor.ts and src/shared/patterns.ts.
  This filter is self-contained because it is also bundled as a single resource.
--]]

local pandoc = require 'pandoc'
local List = require 'pandoc.List'
local SYNTAX_PATTERN = '{::([^}]+)}'
local PLACEHOLDER_PATTERN = '%(#([^%)]+)%)'

local function format_label(label)
    return '(' .. label .. ')'
end

local function base_label(label)
    return (label:gsub("'+$", ''))
end

-- JavaScript \s includes Unicode whitespace; Lua's byte-oriented %s does not.
-- Share this predicate between marker parsing and expression validation.
local Whitespace = {}
local UNICODE_WHITESPACE = {
    [0x00a0] = true, [0x1680] = true, [0x2028] = true, [0x2029] = true,
    [0x202f] = true, [0x205f] = true, [0x3000] = true, [0xfeff] = true,
}

function Whitespace.contains(codepoint)
    return (codepoint >= 0x09 and codepoint <= 0x0d) or codepoint == 0x20
        or (codepoint >= 0x2000 and codepoint <= 0x200a) or UNICODE_WHITESPACE[codepoint]
end

function Whitespace.skip(text, offset)
    while offset <= #text and Whitespace.contains(utf8.codepoint(text, offset)) do
        offset = utf8.offset(text, 2, offset) or (#text + 1)
    end
    return offset
end

function Whitespace.normalize(text)
    local parts = {}
    for _, codepoint in utf8.codes(text) do
        table.insert(parts, Whitespace.contains(codepoint) and ' ' or utf8.char(codepoint))
    end
    return table.concat(parts)
end

-- Text-run operations use byte offsets, like Lua patterns. Str and Space are
-- the only syntax-bearing nodes. Breaks, code, math, and rich nodes are barriers.
local TextRun = {}

function TextRun.text(inline)
    if inline.t == 'Str' then return inline.text end
    if inline.t == 'Space' then return ' ' end
    return nil
end

function TextRun.prefix(inlines)
    local parts = {}
    for _, inline in ipairs(inlines) do
        local text = TextRun.text(inline)
        if not text then break end
        table.insert(parts, text)
    end
    return table.concat(parts)
end

-- Keep whole nodes wherever possible, splitting only a Str at a syntax edge.
function TextRun.slice(inlines, first, last)
    local result = List{}
    local offset = 1
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

local MarkerParser = {}

function MarkerParser.definition(inlines)
    local text = TextRun.prefix(inlines)
    -- Match the complete marker and mandatory following whitespace, exactly as
    -- CUSTOM_LABEL_LIST does. The body is sliced from the original AST.
    local start = Whitespace.skip(text, 1)
    local first, finish, label = text:find(SYNTAX_PATTERN, start)
    if first ~= start then return nil end
    local body_start = Whitespace.skip(text, finish + 1)
    if body_start == finish + 1 then return nil end
    return { raw = label, body = TextRun.slice(inlines, body_start, math.huge) }
end

function MarkerParser.lines(inlines)
    local lines = {}
    local line = { content = List{}, separator = nil }
    for _, inline in ipairs(inlines) do
        if inline.t == 'SoftBreak' or inline.t == 'LineBreak' then
            table.insert(lines, line)
            line = { content = List{}, separator = inline }
        else
            line.content:insert(inline)
        end
    end
    table.insert(lines, line)
    return lines
end

-- The document registry owns all state. Resolving a reference never calls the
-- allocator, even when its processed text could coincide with a manual label.
local LabelRegistry = {}
LabelRegistry.__index = LabelRegistry

function LabelRegistry.new()
    return setmetatable({ numbers = {}, next_number = 1, raw = {}, bases = {} }, LabelRegistry)
end

function LabelRegistry:register(label)
    if self.raw[label] then return end
    local processed = label:gsub(PLACEHOLDER_PATTERN, function(name)
        if not self.numbers[name] then
            self.numbers[name] = self.next_number
            self.next_number = self.next_number + 1
        end
        return tostring(self.numbers[name])
    end)
    self.raw[label] = processed
    self.bases[base_label(processed)] = true
end

local function is_expression(label)
    local remainder = label:gsub(PLACEHOLDER_PATTERN, '')
    -- Equivalent to PURE_EXPRESSION_PATTERN: one optional ASCII letter prefix,
    -- then whitespace, arithmetic operators, commas, parentheses, primes, digits.
    return Whitespace.normalize(remainder):match("^[A-Za-z]?[ +%-%*/,()'%d]*$") ~= nil
end

function LabelRegistry:resolve(label)
    if self.raw[label] then return self.raw[label] end
    local known, has_placeholders = true, false
    local processed = label:gsub(PLACEHOLDER_PATTERN, function(name)
        has_placeholders = true
        if not self.numbers[name] then
            known = false
            return '(#' .. name .. ')'
        end
        return tostring(self.numbers[name])
    end)
    if not known then return nil end
    if has_placeholders and is_expression(label) then return processed end
    if self.bases[base_label(processed)] then return processed end
    return nil
end

local DocumentScanner = {}

function DocumentScanner.scan(blocks, registry)
    local filter = { traverse = 'topdown' }
    local function scan_paragraph(block)
        -- Register line markers before scanning notes on that same line, then
        -- proceed to the next line. A paragraph-level scan alone would register
        -- later lines before an earlier footnote, breaking document order.
        for _, line in ipairs(MarkerParser.lines(block.content)) do
            local marker = MarkerParser.definition(line.content)
            if marker then registry:register(marker.raw) end
            pandoc.Inlines(line.content):walk {
                traverse = 'topdown',
                Note = function(note)
                    pandoc.Pandoc(note.content):walk(filter)
                    return note, false
                end,
            }
        end
        return block, false
    end
    filter.Para = scan_paragraph
    filter.Plain = scan_paragraph
    -- Metadata is not a source of list definitions. Pandoc's walker visits all
    -- body containers, including table cells, native definitions, and notes.
    pandoc.Pandoc(blocks):walk(filter)
end

local OutputFormatter = {}

function OutputFormatter.is_word_format()
    return FORMAT and (FORMAT:match('docx') or FORMAT:match('odt') or FORMAT:match('rtf'))
end

function OutputFormatter.word_item(item, registry)
    local label = format_label(registry.raw[item.raw])
    local inlines = List{ pandoc.Strong{ pandoc.Str(label) } }
    if #item.body > 0 then
        inlines:insert(pandoc.Str('\t'))
        inlines:extend(item.body)
    end
    return pandoc.Para(inlines)
end

function OutputFormatter.definition_item(item, registry)
    local term = { pandoc.Str(format_label(registry.raw[item.raw])) }
    return { term, {{ pandoc.Plain(item.body) }} }
end

local BlockTransformer = {}

function BlockTransformer.paragraph_parts(block)
    local parts = {}
    local current = { body = List{} }
    local has_definition = false
    for _, line in ipairs(MarkerParser.lines(block.content)) do
        local marker = MarkerParser.definition(line.content)
        if marker then
            if #current.body > 0 or current.raw then table.insert(parts, current) end
            current = { raw = marker.raw, body = marker.body }
            has_definition = true
        else
            if line.separator then current.body:insert(line.separator) end
            current.body:extend(line.content)
        end
    end
    if #current.body > 0 or current.raw then table.insert(parts, current) end
    return has_definition and parts or nil
end

function BlockTransformer.transform(blocks, registry)
    local result, items = List{}, {}
    local word = OutputFormatter.is_word_format()
    local function flush()
        if #items > 0 then
            result:insert(pandoc.DefinitionList(items))
            items = {}
        end
    end
    for _, block in ipairs(blocks) do
        local parts = (block.t == 'Para' or block.t == 'Plain')
            and BlockTransformer.paragraph_parts(block)
        if not parts then
            flush()
            result:insert(block)
        else
            for _, part in ipairs(parts) do
                if not part.raw then
                    flush()
                    result:insert(block.t == 'Plain' and pandoc.Plain(part.body) or pandoc.Para(part.body))
                elseif word then
                    result:insert(OutputFormatter.word_item(part, registry))
                else
                    table.insert(items, OutputFormatter.definition_item(part, registry))
                end
            end
        end
    end
    flush()
    return result
end

local InlineProcessor = {}

function InlineProcessor.resolve_run(run, registry)
    local text = TextRun.prefix(run)
    local result, cursor, search = List{}, 1, 1
    while true do
        local first, last, raw = text:find(SYNTAX_PATTERN, search)
        if not first then break end
        local label = registry:resolve(raw)
        if label then
            result:extend(TextRun.slice(run, cursor, first - 1))
            result:insert(pandoc.Str(format_label(label)))
            cursor = last + 1
        end
        search = last + 1
    end
    result:extend(TextRun.slice(run, cursor, math.huge))
    return result
end

function InlineProcessor.process(inlines, registry)
    local result, run = List{}, List{}
    local function flush()
        if #run > 0 then
            result:extend(InlineProcessor.resolve_run(run, registry))
            run = List{}
        end
    end
    for _, inline in ipairs(inlines) do
        if TextRun.text(inline) then
            run:insert(inline)
        else
            flush()
            result:insert(inline)
        end
    end
    flush()
    return result
end

local function process_document(doc)
    local registry = LabelRegistry.new()
    DocumentScanner.scan(doc.blocks, registry)
    -- Bottom-up Blocks traversal transforms every original sequence once,
    -- preserving parent containers and avoiding re-parsing generated bodies.
    doc.blocks = pandoc.Pandoc(doc.blocks):walk {
        Blocks = function(blocks) return BlockTransformer.transform(blocks, registry) end,
    }.blocks
    return doc:walk {
        Inlines = function(inlines) return InlineProcessor.process(inlines, registry) end,
    }
end

return {{ Pandoc = process_document }}
