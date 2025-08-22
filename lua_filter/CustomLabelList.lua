--[[
  Universal Labeled Example Filter for Pandoc
  ============================================
  
  Purpose: Transform {::LABEL} syntax into formatted labels for examples and references.
  Features:
    - Custom labels for list items (e.g., P, Q, Alpha)
    - Auto-numbering with (#placeholder) syntax
    - Cross-references throughout the document
    - Format-specific output (LaTeX/PDF vs Word/DOCX)
  
  Architecture:
    1. Label Parser - Extract and parse labels from text
    2. Placeholder Manager - Handle auto-numbering
    3. Label Registry - Store and retrieve label definitions
    4. Output Formatter - Generate format-specific output
    5. Main Pipeline - Orchestrate the filter process
--]]

local pandoc = require 'pandoc'
local List = require 'pandoc.List'

-- ============================================================================
-- CONFIGURATION
-- ============================================================================

local Config = {
    DEBUG = false,
    SYNTAX_PATTERN = "{::([^}]+)}",           -- Matches {::anything}
    PLACEHOLDER_PATTERN = "%(#([^%)]+)%)",    -- Matches (#anything)
}

-- ============================================================================
-- UTILITIES
-- ============================================================================

local Utils = {}

function Utils.debug(msg)
    if Config.DEBUG then
        io.stderr:write("[DEBUG] " .. msg .. "\n")
    end
end

function Utils.format_label(label)
    return "(" .. label .. ")"
end

-- ============================================================================
-- PLACEHOLDER MANAGER
-- Handles auto-numbering of (#placeholder) patterns
-- ============================================================================

local PlaceholderManager = {
    numbers = {},      -- Map: placeholder_name -> assigned_number
    next_number = 1,   -- Counter for next assignment
}

function PlaceholderManager:reset()
    self.numbers = {}
    self.next_number = 1
end

function PlaceholderManager:get_number(placeholder_name)
    if not self.numbers[placeholder_name] then
        self.numbers[placeholder_name] = self.next_number
        self.next_number = self.next_number + 1
        Utils.debug("Assigned number " .. self.numbers[placeholder_name] .. 
                   " to placeholder '" .. placeholder_name .. "'")
    end
    return self.numbers[placeholder_name]
end

function PlaceholderManager:process_label(raw_label)
    -- Return label as-is if no placeholders
    if not raw_label:match(Config.PLACEHOLDER_PATTERN) then
        return raw_label
    end
    
    -- Replace all placeholders with their assigned numbers
    return raw_label:gsub(Config.PLACEHOLDER_PATTERN, function(placeholder_name)
        return tostring(self:get_number(placeholder_name))
    end)
end

-- ============================================================================
-- LABEL REGISTRY
-- Stores and manages label definitions and references
-- ============================================================================

local LabelRegistry = {
    definitions = {},      -- Map: processed_label -> formatted_label
    raw_to_processed = {}, -- Map: raw_label -> processed_label
}

function LabelRegistry:reset()
    self.definitions = {}
    self.raw_to_processed = {}
end

function LabelRegistry:register(raw_label, processed_label)
    -- Always store the raw to processed mapping
    self.raw_to_processed[raw_label] = processed_label
    
    if self.definitions[processed_label] then
        Utils.debug("Warning: Duplicate label '" .. processed_label .. "'")
    else
        self.definitions[processed_label] = Utils.format_label(processed_label)
        Utils.debug("Registered: raw='" .. raw_label .. "' processed='" .. processed_label .. 
                   "' -> '" .. self.definitions[processed_label] .. "'")
    end
end

function LabelRegistry:lookup(raw_label)
    -- First check if it's a known raw label
    local processed = self.raw_to_processed[raw_label]
    if processed and self.definitions[processed] then
        return self.definitions[processed]
    end
    
    -- Check if it's already a processed label
    if self.definitions[raw_label] then
        return self.definitions[raw_label]
    end
    
    -- For labels with placeholders, only process if we know the base label exists
    if raw_label:match(Config.PLACEHOLDER_PATTERN) then
        local ref_processed = PlaceholderManager:process_label(raw_label)
        if self.definitions[ref_processed] then
            return self.definitions[ref_processed]
        else
            -- Check if this is a pure expression like (#a)+(#b)
            -- These are special cases that should be processed
            if raw_label:match("^%(#[^%)]+%)") or raw_label:match("%+") then
                -- It's an expression with placeholders
                return Utils.format_label(ref_processed)
            else
                -- It's an undefined label with placeholders - don't process
                return nil
            end
        end
    end
    
    -- Unknown label
    return nil
end

-- ============================================================================
-- LABEL PARSER
-- Extracts and processes labels from inline content
-- ============================================================================

local LabelParser = {}

function LabelParser.extract_label_from_inlines(inlines)
    if #inlines == 0 then return nil end
    
    -- Concatenate text to handle split labels
    local text = ""
    local max_check = math.min(10, #inlines)
    
    for i = 1, max_check do
        local elem = inlines[i]
        if elem.t == "Str" then
            text = text .. elem.text
        elseif elem.t == "Space" then
            text = text .. " "
        else
            break
        end
        
        -- Check for complete label
        local label = text:match("^" .. Config.SYNTAX_PATTERN)
        if label then
            return label
        end
    end
    
    return nil
end

function LabelParser.split_by_softbreak(inlines)
    local groups = {}
    local current = pandoc.List{}
    
    for _, inline in ipairs(inlines) do
        if inline.t == "SoftBreak" then
            if #current > 0 then
                table.insert(groups, current)
                current = pandoc.List{}
            end
        else
            current:insert(inline)
        end
    end
    
    if #current > 0 then
        table.insert(groups, current)
    end
    
    return groups
end

-- ============================================================================
-- INLINE PROCESSOR
-- Handles replacement of {::LABEL} patterns in inline content
-- ============================================================================

local InlineProcessor = {}

function InlineProcessor.process_split_label(inlines, start_idx, is_definition, first_in_def)
    local text = inlines[start_idx].text
    
    -- Check if this starts a split label
    if not (text:match("^{::") and not text:match("}")) then
        return nil, start_idx
    end
    
    -- Reconstruct the split label
    local combined = text
    local end_idx = start_idx
    
    for j = start_idx + 1, math.min(#inlines, start_idx + 10) do
        local elem = inlines[j]
        if elem.t == "Str" then
            combined = combined .. elem.text
            if elem.text:match("}") then
                end_idx = j
                break
            end
        elseif elem.t == "Space" then
            combined = combined .. " "
        else
            break
        end
    end
    
    -- Extract the label if complete
    local raw_label = combined:match(Config.SYNTAX_PATTERN)
    if not raw_label then
        return nil, start_idx
    end
    
    -- Process the label
    local replacement
    if is_definition and first_in_def then
        local processed = LabelRegistry.raw_to_processed[raw_label] or raw_label
        replacement = Utils.format_label(processed)
    else
        replacement = LabelRegistry:lookup(raw_label) or ("{::" .. raw_label .. "}")
    end
    
    -- Handle remaining text after the label
    local remaining = combined:gsub("^" .. Config.SYNTAX_PATTERN:gsub("%)%}", ")%%}"), "")
    if remaining ~= "" then
        replacement = replacement .. remaining
    end
    
    return pandoc.Str(replacement), end_idx
end

function InlineProcessor.process(inlines, is_definition)
    local result = pandoc.List{}
    local first_replaced = false
    local i = 1
    
    while i <= #inlines do
        local elem = inlines[i]
        
        if elem.t == "Str" then
            -- Try to handle split label
            local replacement, new_idx = InlineProcessor.process_split_label(
                inlines, i, is_definition, not first_replaced
            )
            
            if replacement then
                result:insert(replacement)
                if is_definition then first_replaced = true end
                i = new_idx + 1
            else
                -- Process normal text with complete labels
                local new_text = elem.text:gsub(Config.SYNTAX_PATTERN, function(raw_label)
                    if is_definition and not first_replaced then
                        first_replaced = true
                        local processed = LabelRegistry.raw_to_processed[raw_label] or raw_label
                        return Utils.format_label(processed)
                    else
                        local replacement = LabelRegistry:lookup(raw_label)
                        return replacement or ("{::" .. raw_label .. "}")
                    end
                end)
                
                result:insert(pandoc.Str(new_text))
                i = i + 1
            end
        else
            result:insert(elem)
            i = i + 1
        end
    end
    
    return result
end

-- ============================================================================
-- OUTPUT FORMATTER
-- Generates format-specific output (LaTeX/Word)
-- ============================================================================

local OutputFormatter = {}

function OutputFormatter.is_word_format()
    return FORMAT and (FORMAT:match("docx") or FORMAT:match("odt") or FORMAT:match("rtf"))
end

function OutputFormatter.create_definition_list_item(label, content)
    -- Create term
    local term = pandoc.List{pandoc.Str(Utils.format_label(label))}
    
    -- Create definition (skip the label part in content)
    local def_inlines = pandoc.List{}
    local label_pattern = "^%(" .. label:gsub("([%^%$%(%)%%%.%[%]%*%+%-%?])", "%%%1") .. "%)%s*"
    local skip_first = true
    
    for _, inline in ipairs(content) do
        if skip_first and inline.t == "Str" then
            local text = inline.text:gsub(label_pattern, "")
            if text ~= "" then
                def_inlines:insert(pandoc.Str(text))
            end
            skip_first = false
        elseif not skip_first then
            def_inlines:insert(inline)
        end
    end
    
    return {term, {{pandoc.Plain(def_inlines)}}}
end

function OutputFormatter.create_word_paragraph(content)
    -- Extract label for bold formatting
    local label_text = ""
    local i = 1
    
    while i <= #content and content[i].t == "Str" do
        label_text = label_text .. content[i].text
        i = i + 1
        if i <= #content and content[i].t == "Space" then
            break
        end
    end
    
    -- Build paragraph with bold label
    local result = pandoc.List{pandoc.Strong({pandoc.Str(label_text)})}
    
    if i <= #content then
        result:insert(pandoc.Str("\t"))
        for j = i + 1, #content do
            result:insert(content[j])
        end
    end
    
    return pandoc.Para(result)
end

-- ============================================================================
-- DOCUMENT SCANNER
-- First pass to identify and register all label definitions
-- ============================================================================

local DocumentScanner = {}

function DocumentScanner.scan(blocks)
    local example_blocks = {}
    
    for i, block in ipairs(blocks) do
        if block.t == "Para" or block.t == "Plain" then
            local groups = LabelParser.split_by_softbreak(block.content)
            local has_examples = false
            
            for _, group in ipairs(groups) do
                local raw_label = LabelParser.extract_label_from_inlines(group)
                if raw_label then
                    -- Process and register the label
                    local processed = PlaceholderManager:process_label(raw_label)
                    LabelRegistry:register(raw_label, processed)
                    has_examples = true
                end
            end
            
            if has_examples then
                example_blocks[i] = true
            end
        end
    end
    
    return example_blocks
end

-- ============================================================================
-- BLOCK TRANSFORMER
-- Second pass to transform blocks with labels and references
-- ============================================================================

local BlockTransformer = {}

function BlockTransformer.process_example_group(group)
    local raw_label = LabelParser.extract_label_from_inlines(group)
    if not raw_label then
        return nil, nil
    end
    
    local processed_label = LabelRegistry.raw_to_processed[raw_label] or raw_label
    local processed_inlines = InlineProcessor.process(group, true)
    
    return processed_inlines, processed_label
end

function BlockTransformer.transform(blocks, example_blocks)
    local new_blocks = pandoc.List{}
    local definition_items = {}
    local is_word = OutputFormatter.is_word_format()
    
    for i, block in ipairs(blocks) do
        if example_blocks[i] then
            -- Process example block
            local groups = LabelParser.split_by_softbreak(block.content)
            
            for _, group in ipairs(groups) do
                local content, label = BlockTransformer.process_example_group(group)
                
                if content and label then
                    if is_word then
                        -- Output any pending definition items first
                        if #definition_items > 0 then
                            for _, item in ipairs(definition_items) do
                                new_blocks:insert(OutputFormatter.create_word_paragraph(item))
                            end
                            definition_items = {}
                        end
                        
                        -- Create Word paragraph
                        new_blocks:insert(OutputFormatter.create_word_paragraph(content))
                    else
                        -- Accumulate for definition list
                        table.insert(definition_items, 
                                   OutputFormatter.create_definition_list_item(label, content))
                    end
                end
            end
        else
            -- Output pending definition list
            if #definition_items > 0 and not is_word then
                new_blocks:insert(pandoc.DefinitionList(definition_items))
                definition_items = {}
            end
            
            -- Process references in regular blocks
            if block.t == "Para" then
                new_blocks:insert(pandoc.Para(InlineProcessor.process(block.content, false)))
            elseif block.t == "Plain" then
                new_blocks:insert(pandoc.Plain(InlineProcessor.process(block.content, false)))
            else
                new_blocks:insert(block)
            end
        end
    end
    
    -- Output any remaining definition items
    if #definition_items > 0 and not is_word then
        new_blocks:insert(pandoc.DefinitionList(definition_items))
    end
    
    return new_blocks
end

-- ============================================================================
-- MAIN FILTER PIPELINE
-- ============================================================================

function Pandoc(doc)
    -- Reset all managers
    PlaceholderManager:reset()
    LabelRegistry:reset()
    
    -- First pass: scan and register all labels
    local example_blocks = DocumentScanner.scan(doc.blocks)
    
    -- Second pass: transform blocks
    doc.blocks = BlockTransformer.transform(doc.blocks, example_blocks)
    
    return doc
end

-- Return the filter
return {{Pandoc = Pandoc}}