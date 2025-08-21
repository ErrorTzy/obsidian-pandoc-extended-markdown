-- Simplified Syntax Filter for Example Lists
-- Uses {::LABEL} for both examples and references
-- Supports apostrophes and other special characters in labels

local pandoc = require 'pandoc'
local List = require 'pandoc.List'

-- Configuration
local DEBUG = false
local SYNTAX_PATTERN = "{::([^}]+)}"  -- Matches {::anything}

-- Store for labels
local label_map = {}
local is_example_line = {}

-- Debug function
local function debug(msg)
    if DEBUG then
        io.stderr:write("[DEBUG] " .. msg .. "\n")
    end
end

-- Function to create a formatted label display
local function format_label(label)
    return "(" .. label .. ")"
end

-- First pass: identify which lines are examples vs references
function identify_examples(blocks)
    for i, block in ipairs(blocks) do
        if block.t == "Para" or block.t == "Plain" then
            local text = pandoc.utils.stringify(block)
            
            -- Check if line starts with {::LABEL} (with optional whitespace)
            if text:match("^%s*" .. SYNTAX_PATTERN) then
                local label = text:match("^%s*" .. SYNTAX_PATTERN)
                debug("Found example: " .. label)
                label_map[label] = format_label(label)
                is_example_line[i] = true
            end
        end
    end
end

-- Process inline content to replace {::LABEL} with appropriate format
function process_inlines(inlines, is_example)
    local result = pandoc.List{}
    
    for _, elem in ipairs(inlines) do
        if elem.t == "Str" then
            local text = elem.text
            local new_text = text
            
            -- Replace {::LABEL} patterns
            new_text = text:gsub(SYNTAX_PATTERN, function(label)
                if is_example then
                    -- First occurrence in an example line - just return formatted label
                    is_example = false  -- Only replace first occurrence
                    return format_label(label)
                elseif label_map[label] then
                    -- It's a reference to an existing label
                    debug("Replacing reference to: " .. label)
                    return label_map[label]
                else
                    -- Unknown label in reference position
                    debug("Warning: Unknown label: " .. label)
                    return "{::" .. label .. "}"
                end
            end)
            
            result:insert(pandoc.Str(new_text))
        else
            result:insert(elem)
        end
    end
    
    return result
end

-- Main document processor
function Pandoc(doc)
    -- First pass: identify all example lines
    identify_examples(doc.blocks)
    
    -- Second pass: transform blocks
    local new_blocks = pandoc.List{}
    local current_list_items = pandoc.List{}
    
    for i, block in ipairs(doc.blocks) do
        if is_example_line[i] then
            -- This is an example line - transform to list item
            debug("Processing example line " .. i)
            
            local text = pandoc.utils.stringify(block)
            local label, content = text:match("^%s*" .. SYNTAX_PATTERN .. "%s*(.*)$")
            
            if label then
                -- Create list item with formatted label
                local item_inlines = pandoc.List{
                    pandoc.Str(format_label(label))
                }
                
                -- Add content if present
                if content and content ~= "" then
                    item_inlines:insert(pandoc.Space())
                    -- Parse content preserving formatting
                    for word in content:gmatch("%S+") do
                        item_inlines:insert(pandoc.Str(word))
                        item_inlines:insert(pandoc.Space())
                    end
                    -- Remove trailing space
                    if #item_inlines > 0 and item_inlines[#item_inlines].t == "Space" then
                        item_inlines:remove(#item_inlines)
                    end
                end
                
                current_list_items:insert({pandoc.Plain(item_inlines)})
            end
        else
            -- Not an example line
            if #current_list_items > 0 then
                -- Output accumulated list
                debug("Creating list with " .. #current_list_items .. " items")
                new_blocks:insert(pandoc.OrderedList(current_list_items))
                current_list_items = pandoc.List{}
            end
            
            -- Process references in this block
            if block.t == "Para" then
                local new_inlines = process_inlines(block.content, false)
                new_blocks:insert(pandoc.Para(new_inlines))
            elseif block.t == "Plain" then
                local new_inlines = process_inlines(block.content, false)
                new_blocks:insert(pandoc.Plain(new_inlines))
            else
                -- For other block types, just copy
                new_blocks:insert(block)
            end
        end
    end
    
    -- Handle remaining list items
    if #current_list_items > 0 then
        debug("Creating final list with " .. #current_list_items .. " items")
        new_blocks:insert(pandoc.OrderedList(current_list_items))
    end
    
    doc.blocks = new_blocks
    return doc
end

-- Return the filter
return {{Pandoc = Pandoc}}