--[[
  Fenced div cross-reference filter for Pandoc.

  Collects native Div blocks with identifiers, adds a generated title block,
  and replaces matching citation nodes such as @prop:a with independently
  numbered reference text such as "Proposition 1". Unknown citations are left
  untouched for citeproc or other filters.
--]]

local pandoc = require 'pandoc'

local TEMP_INDEX_ATTRIBUTE = 'data-pem-crossref-index'
local references = {}
local div_metadata = {}
local counters = {}

local function trim(value)
    return (value or ''):gsub('^%s+', ''):gsub('%s+$', '')
end

local function strip_quotes(value)
    if #value < 2 then
        return value
    end

    local quote = value:sub(1, 1)
    if (quote ~= '"' and quote ~= "'") or value:sub(-1) ~= quote then
        return value
    end

    return value:sub(2, -2)
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

local function humanize_class_name(class_name)
    local text = trim((class_name or ''):gsub('[_:%.%-]+', ' '):gsub('%s+', ' '))
    if text == '' then
        return ''
    end

    return text:gsub('(%f[%a]%a)', string.upper)
end

local function type_label_for_div(div)
    local title = title_for_div(div)
    if title ~= '' then
        return title
    end

    if div.classes and #div.classes > 0 then
        local label = humanize_class_name(div.classes[1])
        if label ~= '' then
            return label
        end
    end

    return 'Div'
end

local function should_render_block_title(div)
    return title_for_div(div) ~= '' or (div.classes and #div.classes > 0)
end

local function type_key_for_label(label)
    local key = label:lower():gsub('[^a-z0-9]+', '-'):gsub('^-+', ''):gsub('-+$', '')
    if key == '' then
        return 'div'
    end

    return key
end

local function register_div(div)
    local type_label = type_label_for_div(div)
    local type_key = type_key_for_label(type_label)
    local number = (counters[type_key] or 0) + 1
    counters[type_key] = number
    local reference = {
        type_label = type_label,
        type_key = type_key,
        number = number,
        reference_text = type_label .. ' ' .. tostring(number),
        block_title_text = should_render_block_title(div)
            and type_label .. ' ' .. tostring(number)
            or ''
    }
    table.insert(div_metadata, reference)

    local id = div.identifier
    if id and id ~= '' and not references[id] then
        references[id] = reference
    end

    div.attributes[TEMP_INDEX_ATTRIBUTE] = tostring(#div_metadata)
end

local function is_generated_title_block(block)
    return block and
        block.t == 'Div' and
        block.classes and
        block.classes:includes('pem-fenced-div-title')
end

local function title_block(reference)
    return pandoc.Div(
        { pandoc.Plain({ pandoc.Str(reference.block_title_text) }) },
        pandoc.Attr('', { 'pem-fenced-div-title' }, {})
    )
end

local function scan_blocks(blocks)
    for _, block in ipairs(blocks) do
        if block.t == 'Div' then
            if not is_generated_title_block(block) then
                register_div(block)
            end
            scan_blocks(block.content)
        elseif block.t == 'BlockQuote' then
            scan_blocks(block.content)
        elseif block.t == 'BulletList' or block.t == 'OrderedList' then
            for _, item in ipairs(block.content) do
                scan_blocks(item)
            end
        elseif block.t == 'DefinitionList' then
            for _, item in ipairs(block.content) do
                local definitions = item[2]
                for _, definition in ipairs(definitions) do
                    scan_blocks(definition)
                end
            end
        end
    end
end

local function has_affixes(citation)
    return (citation.prefix and #citation.prefix > 0) or
        (citation.suffix and #citation.suffix > 0)
end

local function cite(cite_node)
    if #cite_node.citations ~= 1 then
        return nil
    end

    local citation = cite_node.citations[1]
    if has_affixes(citation) then
        return nil
    end

    local reference = references[citation.id]
    if not reference then
        return nil
    end

    return pandoc.Str(reference.reference_text)
end

local function div(div_node)
    local index = tonumber(div_node.attributes[TEMP_INDEX_ATTRIBUTE] or '')
    div_node.attributes[TEMP_INDEX_ATTRIBUTE] = nil
    local reference = index and div_metadata[index] or nil
    if not reference then
        return nil
    end

    if reference.block_title_text ~= '' and not is_generated_title_block(div_node.content[1]) then
        div_node.content:insert(1, title_block(reference))
    end

    return div_node
end

function Pandoc(doc)
    references = {}
    div_metadata = {}
    counters = {}
    scan_blocks(doc.blocks)

    return doc:walk({
        Cite = cite,
        Div = div
    })
end
