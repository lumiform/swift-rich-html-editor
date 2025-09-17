"use strict";

// MARK: - Variables

/** Information about the current selection */
let currentSelectedTextAttributes = {};

/** Dictionary of commands that return a boolean state with the function `document.queryCommandState()` */
const stateCommands = {
    hasBold: "bold",
    hasItalic: "italic",
    hasUnderline: "underline",
    hasStrikeThrough: "strikeThrough",
    hasSubscript: "subscript",
    hasSuperscript: "superscript",
    hasOrderedList: "insertOrderedList",
    hasUnorderedList: "insertUnorderedList"
};
/** Dictionary of commands that return a value with the function `document.queryCommandValue()` */
const valueCommands = {
    fontName: "fontName",
    rawFontSize: "fontSize",
    rawForegroundColor: "foreColor",
    rawBackgroundColor: "backColor",
    formatBlock: "formatBlock"
};

// MARK: - Compute and report TextAttributes

function reportSelectedTextAttributesIfNecessary() {
    const newSelectedTextAttributes = getSelectionFormatting();
    if (compareObjectProperties(currentSelectedTextAttributes, newSelectedTextAttributes)) {
        return;
    }

    currentSelectedTextAttributes = newSelectedTextAttributes;
    reportSelectedTextAttributesDidChange(currentSelectedTextAttributes);
}

function getSelectedTextAttributes() {
    let textAttributes = {};
    getTextAttributesFromStateCommands(textAttributes);
    getTextAttributesFromValueCommands(textAttributes);
    getTextAttributesFromCustomCommands(textAttributes);

    return textAttributes;
}


function defaultFormatting() {
    return {
        hasBold: false,
        hasItalic: false,
        hasUnderline: false,
        hasStrikeThrough: false,
        hasSubscript: false,
        hasSuperscript: false,
        hasOrderedList: false,
        hasUnorderedList: false,
        fontName: null,
        rawFontSize: null,
        rawForegroundColor: null,
        rawBackgroundColor: null,
        formatBlock: null,
        hasLink: false,
        textJustification: null
    };
}


function getSelectionFormatting() {
    const selection = window.getSelection();
    if (selection.isCollapsed) { return getSelectedTextAttributes(); }
    if (!selection.rangeCount) return defaultFormatting();

    const range = selection.getRangeAt(0);
    const nodes = [];

    // Case: selection inside single text node
        if (
            range.startContainer === range.endContainer &&
            range.startContainer.nodeType === Node.TEXT_NODE
        ) {
            if (range.startContainer.textContent && range.startContainer.textContent.trim().length > 0) {
                nodes.push(range.startContainer);
            }
        } else {
            // Case: spans multiple nodes
            const treeWalker = document.createTreeWalker(
                range.commonAncestorContainer,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        // Only accept nodes that intersect with the range and have non-empty content
                        if (
                            range.intersectsNode(node) &&
                            node.textContent &&
                            node.textContent.trim().length > 0
                        ) {
                            return NodeFilter.FILTER_ACCEPT;
                        }
                        return NodeFilter.FILTER_REJECT;
                    },
                }
            );

            while (treeWalker.nextNode()) {
                // Only add nodes that are actually within the selection range
                const node = treeWalker.currentNode;
                // Further check: node must be at least partially selected
                const nodeRange = document.createRange();
                nodeRange.selectNodeContents(node);
                if (
                    range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
                    range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0
                ) {
                    nodes.push(node);
                }
            }
        }

    // Extract formatting for each node
    const nodeFormats = nodes
    .map((textNode) => {
        const parentEl = textNode.parentElement;
        if (!parentEl || textNode.textContent?.trim().length === 0) {
            return false;
        }

        const styles = window.getComputedStyle(parentEl);
        const inheritedDecoration = getInheritedTextDecoration(parentEl);

        return {
            hasBold: styles.fontWeight === "bold" || parseInt(styles.fontWeight) >= 600,
            hasItalic: styles.fontStyle === "italic" || parentEl.tagName.toLowerCase() === "i",
            hasUnderline: inheritedDecoration.includes("underline"),
            hasStrikeThrough: inheritedDecoration.includes("line-through"),
            hasSubscript: parentEl.tagName.toLowerCase() === "sub",
            hasSuperscript: parentEl.tagName.toLowerCase() === "sup",
            hasOrderedList: parentEl.closest("ol") !== null,
            hasUnorderedList: parentEl.closest("ul") !== null,

            fontName: styles.fontFamily,
            rawFontSize: styles.fontSize,
            rawForegroundColor: styles.color,
            rawBackgroundColor: styles.backgroundColor,
            formatBlock: parentEl.tagName.toLowerCase(),

            hasLink: parentEl.closest("a") !== null ? true : false,
            textJustification: (() => {
                const align = styles.textAlign;
                if (align === "justify") return "full";
                if (["left", "center", "right"].includes(align)) return align;
                return "left";
            })(),
        };
    })
    .filter(Boolean);

    // Find attributes that are common across all nodes
    if (nodeFormats.length === 0) return defaultFormatting;

    const finalFormatting = {};
    const keys = Object.keys(nodeFormats[0]);

    keys.forEach((key) => {
        const firstVal = nodeFormats[0][key];
        const allSame = nodeFormats.every((f) => f[key] === firstVal);
        if (allSame) {
            finalFormatting[key] = firstVal;
        } else  if(typeof firstVal === 'boolean') {
            finalFormatting[key] = false;
        } else if( key === 'rawForegroundColor' ) {
            finalFormatting[key] = 'rgb(0, 0, 0)';
        }  else if( key === 'rawBackgroundColor' ) {
            finalFormatting[key] = 'rgba(0, 0, 0, 0)';
        }
        else {
            finalFormatting[key] = nodeFormats[0][key];
        }
    });

    return finalFormatting;
}

function getInheritedTextDecoration(element) {
    let decorations = new Set();

    // Walk up the DOM tree
    let currentElement = element;
    while (currentElement && currentElement !== document.body) {
        const styles = window.getComputedStyle(currentElement);
        const textDecoration = styles.textDecoration;

        if (textDecoration && textDecoration !== 'none') {
            // Split by space and add each decoration
            textDecoration.split(' ').forEach(decoration => {
                if (decoration.trim()) {
                    decorations.add(decoration.trim());
                }
            });
        }

        currentElement = currentElement.parentElement;
    }

    // Convert Set back to string
    return Array.from(decorations).join(' ');
}

document.onreadystatechange = function () {
    if (document.readyState === "complete") {
        // Example usage
        document.addEventListener("mouseup", () => {
            const formatting = getSelectionFormatting();
        });
    }
}

// MARK: - Utils

function getTextAttributesFromStateCommands(textAttributes) {
    for (const command in stateCommands) {
        const commandName = stateCommands[command];
        textAttributes[command] = document.queryCommandState(commandName);
    }
}

function getTextAttributesFromValueCommands(textAttributes) {
    for (const command in valueCommands) {
        const commandName = valueCommands[command];
        textAttributes[command] = document.queryCommandValue(commandName);
    }
}

function getTextAttributesFromCustomCommands(textAttributes) {
    textAttributes["hasLink"] = hasLink();
    textAttributes["textJustification"] = computeTextJustification();
}

function computeTextJustification() {
    const sides = {
        "left": "justifyLeft",
        "center": "justifyCenter",
        "right": "justifyRight",
        "full": "justifyFull"
    }

    for (const side in sides) {
        if (document.queryCommandState(sides[side])) {
            return side;
        }
    }
    return null;
}

