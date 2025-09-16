#!/usr/bin/env python3
import os
import json

# List of files with their line counts (from wc -l output)
files = [
    (512, "src/live-preview/pipeline/structural/CustomLabelProcessor.ts"),
    (490, "src/live-preview/pipeline/ProcessingPipeline.ts"),
    (484, "src/core/constants.ts"),
    (465, "src/shared/utils/listMarkerDetector.ts"),
    (416, "src/shared/utils/hoverPopovers.ts"),
    (377, "src/core/main.ts"),
    (375, "src/shared/patterns.ts"),
    (365, "src/reading-mode/parsers/customLabelListParser.ts"),
    (348, "src/core/state/pluginStateManager.ts"),
    (348, "src/core/settings.ts"),
    (310, "src/views/panels/ListPanelView.ts"),
    (309, "src/reading-mode/renderer.ts"),
    (307, "src/shared/utils/listRenumbering.ts"),
    (304, "src/views/panels/utils/viewInteractions.ts"),
    (291, "src/editor-extensions/pandocValidator.ts"),
    (288, "src/live-preview/pipeline/utils/codeDetection.ts"),
    (278, "src/views/panels/utils/contentTruncator.ts"),
    (265, "src/editor-extensions/suggestions/customLabelReferenceSuggest.ts"),
    (253, "src/reading-mode/processor.ts"),
    (253, "src/reading-mode/parsers/definitionListParser.ts"),
    (245, "src/live-preview/widgets/customLabelWidget.ts"),
    (244, "src/views/panels/modules/ExampleListPanelModule.ts"),
    (239, "src/reading-mode/parsers/exampleListParser.ts"),
    (238, "src/live-preview/pipeline/structural/DefinitionProcessor.ts"),
    (232, "src/live-preview/scanners/customLabelScanner.ts"),
    (192, "src/reading-mode/parsers/parser.ts"),
    (189, "src/shared/utils/placeholderProcessor.ts"),
    (186, "src/views/panels/modules/DefinitionListPanelModule.ts"),
    (167, "src/views/panels/modules/BasePanelModule.ts"),
    (167, "src/live-preview/pipeline/structural/ListContinuationProcessor.ts"),
    (165, "src/live-preview/pipeline/structural/BaseStructuralProcessor.ts"),
    (158, "src/shared/utils/errorHandler.ts"),
    (151, "src/live-preview/pipeline/inline/CustomLabelReferenceProcessor.ts"),
    (148, "src/live-preview/widgets/BaseWidget.ts"),
    (146, "src/editor-extensions/suggestions/exampleReferenceSuggest.ts"),
    (145, "src/shared/rendering/ContentProcessorRegistry.ts"),
    (139, "src/reading-mode/parsers/fancyListParser.ts"),
    (137, "src/live-preview/pipeline/structural/ExampleListProcessor.ts"),
    (136, "src/views/panels/modules/CustomLabelPanelModule.ts"),
    (135, "src/editor-extensions/listAutocompletion/handlers/emptyListHandler.ts"),
    (132, "src/reading-mode/parsers/superSubParser.ts"),
    (125, "src/views/editor/highlightUtils.ts"),
    (125, "src/live-preview/widgets/listWidgets.ts"),
    (119, "src/shared/extractors/definitionListExtractor.ts"),
    (118, "src/shared/utils/mathRenderer.ts"),
    (115, "src/live-preview/validators/listBlockValidator.ts"),
    (115, "src/live-preview/pipeline/types.ts"),
    (108, "src/editor-extensions/listAutocompletion/handlers/tabHandler.ts"),
    (103, "src/shared/types/listTypes.ts"),
    (102, "src/live-preview/pipeline/structural/StandardListProcessor.ts"),
    (94, "src/shared/extractors/customLabelExtractor.ts"),
    (88, "src/editor-extensions/listAutocompletion/handlers/listItemHandler.ts"),
    (86, "src/shared/utils/listHelpers.ts"),
    (85, "src/live-preview/extension.ts"),
    (84, "src/editor-extensions/listAutocompletion/handlers/enterHandler.ts"),
    (84, "src/editor-extensions/listAutocompletion/handlers/continuationHandler.ts"),
    (83, "src/shared/rendering/processors/WikiLinkProcessor.example.ts"),
    (83, "src/editor-extensions/listAutocompletion/utils/markerDetection.ts"),
    (72, "src/live-preview/scanners/exampleScanner.ts"),
    (71, "src/shared/types/decorationTypes.ts"),
    (71, "src/live-preview/pipeline/inline/ExampleReferenceProcessor.ts"),
    (63, "src/editor-extensions/listAutocompletion/utils/continuationUtils.ts"),
    (59, "src/live-preview/widgets/referenceWidget.ts"),
    (57, "src/shared/types/settingsTypes.ts"),
    (57, "src/live-preview/pipeline/structural/HashListProcessor.ts"),
    (56, "src/shared/extractors/exampleListExtractor.ts"),
    (56, "src/live-preview/widgets/formatWidgets.ts"),
    (56, "src/live-preview/pipeline/structural/FancyListProcessor.ts"),
    (56, "src/live-preview/pipeline/inline/SuperscriptProcessor.ts"),
    (55, "src/shared/types/obsidian-extended.ts"),
    (55, "src/live-preview/pipeline/inline/SubscriptProcessor.ts"),
    (53, "src/reading-mode/utils/domUtils.ts"),
    (52, "src/editor-extensions/listAutocompletion/types.ts"),
    (46, "src/shared/types/processorConfig.ts"),
    (45, "src/editor-extensions/listAutocompletion/handlers/shiftHandlers.ts"),
    (38, "src/editor-extensions/listAutocompletion/utils/indentation.ts"),
    (29, "src/shared/utils/contextUtils.ts"),
    (26, "src/views/panels/modules/PanelTypes.ts"),
    (24, "src/editor-extensions/listAutocompletion/utils/lineInfo.ts"),
    (23, "src/shared/utils/cursorUtils.ts"),
    (23, "src/editor-extensions/listAutocompletion/index.ts"),
    (20, "src/live-preview/widgets/index.ts"),
    (20, "src/live-preview/widgets/definitionWidget.ts"),
    (14, "src/shared/types/codeTypes.ts"),
    (6, "src/live-preview/pipeline/structural/index.ts"),
    (3, "src/live-preview/pipeline/inline/index.ts")
]

# Organize into chunks of ~500 lines
chunks = []
current_chunk = []
current_lines = 0

for lines, filepath in files:
    if current_lines + lines > 550 and current_chunk:  # Start new chunk if over 550 lines
        chunks.append(current_chunk)
        current_chunk = []
        current_lines = 0

    current_chunk.append(filepath)
    current_lines += lines

# Add the last chunk if it has files
if current_chunk:
    chunks.append(current_chunk)

# Print chunks in JSON format
print(json.dumps(chunks, indent=2))
print(f"\nTotal chunks: {len(chunks)}")