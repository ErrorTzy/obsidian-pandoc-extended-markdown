#!/bin/bash

# Fix import paths in unit test files (need extra ../)
find tests/unit -name "*.spec.ts" -type f | while read file; do
    sed -i "s|from '\.\./\.\./\.\./src/|from '../../../../src/|g" "$file"
done

# Fix import paths in integration test files
find tests/integration -name "*.spec.ts" -type f | while read file; do
    sed -i "s|from '\.\./src/|from '../../src/|g" "$file"
done

echo "Import paths fixed!"