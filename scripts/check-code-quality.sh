#!/bin/bash

# Code Quality Check Script for Pandoc Lists Plugin
# Run this script to check for coding protocol violations

echo "🔍 Checking code quality..."
echo "================================"

# Color codes
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Counters
violations=0
warnings=0

# Check 1: Files exceeding 400 lines
echo -e "\n📏 Checking file sizes (max 400 lines)..."
while IFS= read -r file; do
    lines=$(wc -l < "$file")
    if [ "$lines" -gt 400 ]; then
        echo -e "${RED}✗${NC} $file: $lines lines ($(( (lines - 400) * 100 / 400 ))% over limit)"
        ((violations++))
    fi
done < <(find src -name "*.ts" -type f)

# Check 2: Functions exceeding 50 lines
echo -e "\n📐 Checking function sizes (max 50 lines)..."
for file in $(find src -name "*.ts" -type f); do
    # Look for function/method declarations and count lines until next function or end of class
    awk '/^[[:space:]]*(export[[:space:]]+)?(async[[:space:]]+)?function|^[[:space:]]*(public|private|protected)?[[:space:]]*(async[[:space:]]+)?[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*\(/ {
        start=NR;
        name=$0;
        gsub(/^[[:space:]]*/, "", name);
        brace_count=0
    }
    start && /{/ {
        brace_count++
    }
    start && /}/ {
        brace_count--
        if (brace_count == 0) {
            lines = NR - start + 1
            if (lines > 50) {
                print FILENAME ":" start ": " lines " lines - " substr(name, 1, 60)
            }
            start = 0
        }
    }' "$file"
done | while IFS=: read -r file line count desc; do
    if [ ! -z "$file" ]; then
        echo -e "${YELLOW}⚠${NC} $file:$line - $desc"
        ((warnings++))
    fi
done

# Check 3: Direct style manipulation
echo -e "\n🎨 Checking for direct style manipulation..."
if grep -r "\.style\." src --include="*.ts" | grep -v "// TODO\|// FIXME\|//.*style" > /dev/null 2>&1; then
    grep -r "\.style\." src --include="*.ts" | grep -v "// TODO\|// FIXME\|//.*style" | head -5 | while IFS=: read -r file rest; do
        echo -e "${YELLOW}⚠${NC} $file: Direct style manipulation"
    done
    ((warnings++))
fi

# Check 4: Inline regex patterns (not in patterns.ts)
echo -e "\n🔤 Checking for inline regex patterns..."
for file in $(find src -name "*.ts" -type f | grep -v patterns.ts); do
    if grep -E "/(\\\\.|[^/])+/[gimsu]*" "$file" | grep -v "^[[:space:]]*//" > /dev/null 2>&1; then
        matches=$(grep -n -E "/(\\\\.|[^/])+/[gimsu]*" "$file" | grep -v "^[[:space:]]*//" | head -2)
        if [ ! -z "$matches" ]; then
            echo -e "${YELLOW}⚠${NC} $file: Inline regex pattern"
        fi
    fi
done

# Check 5: innerHTML usage
echo -e "\n🔒 Checking for innerHTML usage..."
if grep -r "innerHTML\|outerHTML\|insertAdjacentHTML" src --include="*.ts" | grep -v "^[[:space:]]*//" > /dev/null 2>&1; then
    grep -r "innerHTML\|outerHTML\|insertAdjacentHTML" src --include="*.ts" | grep -v "^[[:space:]]*//" | while IFS=: read -r file rest; do
        echo -e "${RED}✗${NC} $file: Unsafe HTML manipulation"
        ((violations++))
    done
fi

# Check 6: Missing JSDoc
echo -e "\n📝 Checking for missing JSDoc on public functions..."
missing_jsdoc=0
for file in $(find src -name "*.ts" -type f); do
    # Look for public functions without preceding JSDoc
    awk '
    /^[[:space:]]*\/\*\*/ { has_jsdoc=1 }
    /^[[:space:]]*\*\// { has_jsdoc=0 }
    /^[[:space:]]*export[[:space:]]+(async[[:space:]]+)?function|^[[:space:]]*public[[:space:]]+(async[[:space:]]+)?[a-zA-Z_]/ {
        if (!has_jsdoc) {
            print FILENAME ":" NR ": Missing JSDoc"
            missing_jsdoc++
        }
        has_jsdoc=0
    }
    ' "$file"
done | head -5

# Summary
echo -e "\n================================"
echo "📊 Summary:"
if [ $violations -eq 0 ] && [ $warnings -eq 0 ]; then
    echo -e "${GREEN}✓${NC} All code quality checks passed!"
else
    [ $violations -gt 0 ] && echo -e "${RED}Violations: $violations${NC}"
    [ $warnings -gt 0 ] && echo -e "${YELLOW}Warnings: $warnings${NC}"
    echo -e "\nRun 'bash scripts/check-code-quality.sh' regularly to maintain code quality."
fi

exit $violations