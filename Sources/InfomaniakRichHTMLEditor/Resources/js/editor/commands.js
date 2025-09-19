"use strict";

/**
 * Executes a command with document.execCommand().
 * If the command changes the selected text, the WKWebView will be notified.
 *
 * @param {string} command - The name of the command to execute
 * @param {string|null} argument - An optional argument for the command
 */
function execCommand(command, argument) {
    document.execCommand(command, false, argument);
    reportSelectedTextAttributesIfNecessary();
}

/**
 * Saves the current caret position for later restoration.
 * This is a general version that works for any DOM transformation.
 *
 * @returns {Object} - Object containing caret position information
 */
function saveGeneralCaretPosition() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;
    
    const range = selection.getRangeAt(0);
    
    // Get the text content and caret offset within the editor
    const editor = getEditor();
    const editorText = editor.textContent || '';
    const caretOffset = getCaretOffsetInElement(editor, range);
    
    return {
        editor: editor,
        textContent: editorText,
        caretOffset: caretOffset,
        range: range.cloneRange()
    };
}

/**
 * Restores the caret position after DOM manipulation.
 * This is a general version that works for any DOM transformation.
 *
 * @param {Object} savedRange - The saved caret position information
 */
function restoreGeneralCaretPosition(savedRange) {
    if (!savedRange || !savedRange.editor) return;
    
    try {
        const selection = window.getSelection();
        const range = document.createRange();
        
        // Find the text node in the editor and set the caret position
        const textNodes = getTextNodes(savedRange.editor);
        let currentOffset = 0;
        let targetNode = null;
        let targetOffset = 0;
        
        for (const textNode of textNodes) {
            const nodeLength = textNode.textContent.length;
            if (currentOffset + nodeLength >= savedRange.caretOffset) {
                targetNode = textNode;
                targetOffset = savedRange.caretOffset - currentOffset;
                break;
            }
            currentOffset += nodeLength;
        }
        
        if (targetNode) {
            range.setStart(targetNode, Math.min(targetOffset, targetNode.textContent.length));
            range.setEnd(targetNode, Math.min(targetOffset, targetNode.textContent.length));
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // Fallback: place caret at the end of the editor
            range.selectNodeContents(savedRange.editor);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    } catch (error) {
        console.warn('Could not restore caret position:', error);
    }
}

/**
 * Gets the caret offset within an element.
 *
 * @param {Element} element - The element to measure within
 * @param {Range} range - The range containing the caret
 * @returns {number} - The offset position
 */
function getCaretOffsetInElement(element, range) {
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
}

/**
 * Gets all text nodes within an element.
 *
 * @param {Element} element - The element to search within
 * @returns {Array} - Array of text nodes
 */
function getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }
    
    return textNodes;
}

/**
 * Transforms ul/ol elements wrapped in span or font with color styling.
 * Converts the wrapper to font tags within each list item.
 */
function transformColoredLists() {
    const editor = getEditor();
    if (!editor) return;
    
    // Save the current caret position before making changes
    const savedRange = saveGeneralCaretPosition();
    
    // Find all spans with color styling that contain lists
    const spansWithLists = editor.querySelectorAll('span[style*="color"]');
    spansWithLists.forEach(span => {
        const listElement = span.querySelector('ul, ol');
        if (listElement) {
            const colorValue = extractColorFromStyle(span.getAttribute('style'));
            if (colorValue) {
                transformListItems(listElement, colorValue);
                span.parentNode.replaceChild(listElement, span);
            }
        }
    });
    
    // Find all font tags with color that contain lists
    const fontsWithLists = editor.querySelectorAll('font[color]');
    fontsWithLists.forEach(font => {
        const lists = font.querySelectorAll('ul, ol');
        if (lists.length > 0) {
            const colorValue = font.getAttribute('color');
            lists.forEach(list => {
                transformListItems(list, colorValue);
            });
            // Replace the font tag with its content
            while (font.firstChild) {
                font.parentNode.insertBefore(font.firstChild, font);
            }
            font.remove();
        }
    });
    
    // Restore the caret position after making changes
    if (savedRange) {
        setTimeout(() => restoreGeneralCaretPosition(savedRange), 0);
    }
    
    reportSelectedTextAttributesIfNecessary();
}

/**
 * Transforms list items to wrap their content with font tags
 */
function transformListItems(listElement, color) {
    const listItems = listElement.querySelectorAll('li');
    listItems.forEach(li => {
        const content = li.innerHTML;
        li.innerHTML = `<font color="${color}">${content}</font>`;
    });
}

/**
 * Extracts color value from a style string and converts it to hex format.
 *
 * @param {string} styleString - The style attribute string
 * @returns {string|null} - The hex color value or null if not found
 */
function extractColorFromStyle(styleString) {
    if (!styleString) return null;

    // Match color property in style string
    const colorMatch = styleString.match(/color\s*:\s*([^;]+)/i);
    if (!colorMatch) return null;

    const colorValue = colorMatch[1].trim();

    // Convert rgb() to hex if needed
    if (colorValue.startsWith('rgb(')) {
        const rgb = colorValue.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
            const r = parseInt(rgb[0]);
            const g = parseInt(rgb[1]);
            const b = parseInt(rgb[2]);
            return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        }
    }

    // Return the color value as-is if it's already in a valid format
    return colorValue;
}

/**
 * Sets the HTML content of the editor.
 * The current content will be replaced by the new content.
 *
 * @param {string} content - The new HTML content of the editor
 */
function setContent(content) {
    getEditor().innerHTML = content;
}

/**
 * Injects new CSS rules to the editor to change its style.
 *
 * @param {string} content - The new CSS rules to add to the editor
 */
function injectCSS(content) {
    const styleElement = document.createElement("style");
    styleElement.textContent = content;
    document.head.appendChild(styleElement);
}
