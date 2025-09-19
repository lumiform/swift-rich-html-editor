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

/**
 * Converts the current list to an ordered list, cleaning up HTML structure.
 */
function convertToOrderedList() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    // Save the current caret position
    const savedRange = saveCaretPosition();
    
    const range = selection.getRangeAt(0);
    const listItem = range.commonAncestorContainer.closest ? 
        range.commonAncestorContainer.closest('li') : 
        range.commonAncestorContainer.parentElement?.closest('li');
    
    if (listItem) {
        const list = listItem.closest('ul, ol');
        if (list) {
            // Check if we're already in an ordered list
            if (list.tagName.toLowerCase() === 'ol') {
                // Already an ordered list - remove the list formatting
                removeListFormatting(listItem, list, savedRange);
            } else {
                // Convert from unordered to ordered list
                convertListItemToOrderedList(listItem, list, savedRange);
            }
        } else {
            // Single list item, create new ordered list
            execCommand('insertOrderedList');
        }
    } else {
        execCommand('insertOrderedList');
    }
    
    reportSelectedTextAttributesIfNecessary();
}

/**
 * Converts the current list to an unordered list, cleaning up HTML structure.
 */
function convertToUnorderedList() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    // Save the current caret position
    const savedRange = saveCaretPosition();
    
    const range = selection.getRangeAt(0);
    const listItem = range.commonAncestorContainer.closest ? 
        range.commonAncestorContainer.closest('li') : 
        range.commonAncestorContainer.parentElement?.closest('li');
    
    if (listItem) {
        const list = listItem.closest('ul, ol');
        if (list) {
            // Check if we're already in an unordered list
            if (list.tagName.toLowerCase() === 'ul') {
                // Already an unordered list - remove the list formatting
                removeListFormatting(listItem, list, savedRange);
            } else {
                // Convert from ordered to unordered list
                convertListItemToUnorderedList(listItem, list, savedRange);
            }
        } else {
            // Single list item, create new unordered list
            execCommand('insertUnorderedList');
        }
    } else {
        execCommand('insertUnorderedList');
    }
    
    reportSelectedTextAttributesIfNecessary();
}

/**
 * Saves the current caret position for later restoration.
 *
 * @returns {Object} - Object containing caret position information
 */
function saveCaretPosition() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;
    
    const range = selection.getRangeAt(0);
    const listItem = range.commonAncestorContainer.closest ? 
        range.commonAncestorContainer.closest('li') : 
        range.commonAncestorContainer.parentElement?.closest('li');
    
    if (!listItem) return null;
    
    // Get the text content and caret offset within the list item
    const listItemText = listItem.textContent || '';
    const caretOffset = getCaretOffsetInElement(listItem, range);
    
    return {
        listItem: listItem,
        textContent: listItemText,
        caretOffset: caretOffset,
        range: range.cloneRange()
    };
}

/**
 * Restores the caret position after DOM manipulation.
 *
 * @param {Object} savedRange - The saved caret position information
 * @param {Element} newElement - The new element to place the caret in
 */
function restoreCaretPosition(savedRange, newElement) {
    if (!savedRange || !newElement) return;
    
    try {
        const selection = window.getSelection();
        const range = document.createRange();
        
        // Find the text node in the new element and set the caret position
        const textNodes = getTextNodes(newElement);
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
            // Fallback: place caret at the end of the new element
            range.selectNodeContents(newElement);
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
 * Removes list formatting from a list item while preserving all other formatting.
 *
 * @param {Element} listItem - The list item to remove formatting from
 * @param {Element} currentList - The current list containing the item
 * @param {Object} savedRange - The saved caret position
 */
function removeListFormatting(listItem, currentList, savedRange) {
    const itemIndex = Array.from(currentList.children).indexOf(listItem);
    const isLastItem = itemIndex === currentList.children.length - 1;
    const isFirstItem = itemIndex === 0;
    
    // Extract the content with all formatting preserved
    const content = cleanListItemContent(listItem.innerHTML);
    let newElement = null;
    
    if (isFirstItem && isLastItem) {
        // Single item - replace the entire list with a div containing the content
        const div = document.createElement('div');
        div.innerHTML = content;
        currentList.parentNode.replaceChild(div, currentList);
        newElement = div;
    } else if (isLastItem) {
        // Last item - remove it from the list and add as a div after
        const div = document.createElement('div');
        div.innerHTML = content;
        currentList.removeChild(listItem);
        currentList.parentNode.insertBefore(div, currentList.nextSibling);
        newElement = div;
    } else if (isFirstItem) {
        // First item - remove it from the list and add as a div before
        const div = document.createElement('div');
        div.innerHTML = content;
        currentList.removeChild(listItem);
        currentList.parentNode.insertBefore(div, currentList);
        newElement = div;
    } else {
        // Middle item - split the list and place the removed item between the parts
        const parent = currentList.parentNode;
        const items = Array.from(currentList.children);
        const beforeItems = items.slice(0, itemIndex);
        const afterItems = items.slice(itemIndex + 1);
        
        // Create the removed item as a div
        const div = document.createElement('div');
        div.innerHTML = content;
        newElement = div;
        
        // Remove the original list
        parent.removeChild(currentList);
        
        // Insert elements in the correct order (before items, removed item, after items)
        let insertAfter = null;
        
        // Create new list with items before the removed item
        if (beforeItems.length > 0) {
            const beforeList = currentList.cloneNode(false);
            beforeItems.forEach(li => beforeList.appendChild(li));
            parent.insertBefore(beforeList, insertAfter);
            insertAfter = beforeList;
        }
        
        // Insert the removed item as a div
        parent.insertBefore(div, insertAfter ? insertAfter.nextSibling : null);
        insertAfter = div;
        
        // Create new list with items after the removed item
        if (afterItems.length > 0) {
            const afterList = currentList.cloneNode(false);
            afterItems.forEach(li => afterList.appendChild(li));
            parent.insertBefore(afterList, insertAfter ? insertAfter.nextSibling : null);
        }
    }
    
    // Restore the caret position
    if (newElement && savedRange) {
        setTimeout(() => restoreCaretPosition(savedRange, newElement), 0);
    }
}

/**
 * Converts a specific list item to an ordered list, handling list splitting intelligently.
 *
 * @param {Element} listItem - The list item to convert
 * @param {Element} currentList - The current list containing the item
 */
function convertListItemToOrderedList(listItem, currentList, savedRange) {
    const itemIndex = Array.from(currentList.children).indexOf(listItem);
    const isLastItem = itemIndex === currentList.children.length - 1;
    const isFirstItem = itemIndex === 0;
    let newElement = null;
    
    if (isFirstItem && isLastItem) {
        // Single item - convert the entire list
        const newList = document.createElement('ol');
        const newLi = document.createElement('li');
        newLi.innerHTML = cleanListItemContent(listItem.innerHTML);
        newList.appendChild(newLi);
        currentList.parentNode.replaceChild(newList, currentList);
        newElement = newLi;
    } else if (isLastItem) {
        // Last item - split the list and convert only the last item
        const newList = document.createElement('ol');
        const newLi = document.createElement('li');
        newLi.innerHTML = cleanListItemContent(listItem.innerHTML);
        newList.appendChild(newLi);
        
        // Remove the last item from the original list
        currentList.removeChild(listItem);
        
        // Insert the new list after the original list
        currentList.parentNode.insertBefore(newList, currentList.nextSibling);
        newElement = newLi;
    } else {
        // Middle item - split the list and convert only the clicked item
        const parent = currentList.parentNode;
        const items = Array.from(currentList.children);
        const beforeItems = items.slice(0, itemIndex);
        const afterItems = items.slice(itemIndex + 1);
        
        // Create the converted item
        const newList = document.createElement('ol');
        const newLi = document.createElement('li');
        newLi.innerHTML = cleanListItemContent(listItem.innerHTML);
        newList.appendChild(newLi);
        newElement = newLi;
        
        // Remove the original list
        parent.removeChild(currentList);
        
        // Insert elements in the correct order (before items, converted item, after items)
        let insertAfter = null;
        
        // Create new list with items before the converted item
        if (beforeItems.length > 0) {
            const beforeList = currentList.cloneNode(false);
            beforeItems.forEach(li => beforeList.appendChild(li));
            parent.insertBefore(beforeList, insertAfter);
            insertAfter = beforeList;
        }
        
        // Insert the converted item as a new list
        parent.insertBefore(newList, insertAfter ? insertAfter.nextSibling : null);
        insertAfter = newList;
        
        // Create new list with items after the converted item
        if (afterItems.length > 0) {
            const afterList = currentList.cloneNode(false);
            afterItems.forEach(li => afterList.appendChild(li));
            parent.insertBefore(afterList, insertAfter ? insertAfter.nextSibling : null);
        }
    }
    
    // Restore the caret position
    if (newElement && savedRange) {
        setTimeout(() => restoreCaretPosition(savedRange, newElement), 0);
    }
}

/**
 * Converts a specific list item to an unordered list, handling list splitting intelligently.
 *
 * @param {Element} listItem - The list item to convert
 * @param {Element} currentList - The current list containing the item
 */
function convertListItemToUnorderedList(listItem, currentList, savedRange) {
    const itemIndex = Array.from(currentList.children).indexOf(listItem);
    const isLastItem = itemIndex === currentList.children.length - 1;
    const isFirstItem = itemIndex === 0;
    let newElement = null;
    
    if (isFirstItem && isLastItem) {
        // Single item - convert the entire list
        const newList = document.createElement('ul');
        const newLi = document.createElement('li');
        newLi.innerHTML = cleanListItemContent(listItem.innerHTML);
        newList.appendChild(newLi);
        currentList.parentNode.replaceChild(newList, currentList);
        newElement = newLi;
    } else if (isLastItem) {
        // Last item - split the list and convert only the last item
        const newList = document.createElement('ul');
        const newLi = document.createElement('li');
        newLi.innerHTML = cleanListItemContent(listItem.innerHTML);
        newList.appendChild(newLi);
        
        // Remove the last item from the original list
        currentList.removeChild(listItem);
        
        // Insert the new list after the original list
        currentList.parentNode.insertBefore(newList, currentList.nextSibling);
        newElement = newLi;
    } else {
        // Middle item - split the list and convert only the clicked item
        const parent = currentList.parentNode;
        const items = Array.from(currentList.children);
        const beforeItems = items.slice(0, itemIndex);
        const afterItems = items.slice(itemIndex + 1);
        
        // Create the converted item
        const newList = document.createElement('ul');
        const newLi = document.createElement('li');
        newLi.innerHTML = cleanListItemContent(listItem.innerHTML);
        newList.appendChild(newLi);
        newElement = newLi;
        
        // Remove the original list
        parent.removeChild(currentList);
        
        // Insert elements in the correct order (before items, converted item, after items)
        let insertAfter = null;
        
        // Create new list with items before the converted item
        if (beforeItems.length > 0) {
            const beforeList = currentList.cloneNode(false);
            beforeItems.forEach(li => beforeList.appendChild(li));
            parent.insertBefore(beforeList, insertAfter);
            insertAfter = beforeList;
        }
        
        // Insert the converted item as a new list
        parent.insertBefore(newList, insertAfter ? insertAfter.nextSibling : null);
        insertAfter = newList;
        
        // Create new list with items after the converted item
        if (afterItems.length > 0) {
            const afterList = currentList.cloneNode(false);
            afterItems.forEach(li => afterList.appendChild(li));
            parent.insertBefore(afterList, insertAfter ? insertAfter.nextSibling : null);
        }
    }
    
    // Restore the caret position
    if (newElement && savedRange) {
        setTimeout(() => restoreCaretPosition(savedRange, newElement), 0);
    }
}

/**
 * Cleans up the content of a list item to ensure proper HTML structure.
 * This function removes invalid nesting and ensures proper formatting.
 *
 * @param {string} content - The HTML content of the list item
 * @returns {string} - Cleaned HTML content
 */
function cleanListItemContent(content) {
    // Create a temporary container to parse the HTML
    const temp = document.createElement('div');
    temp.innerHTML = content;
    
    // Find all text nodes and their formatting
    const textNodes = [];
    const walker = document.createTreeWalker(
        temp,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    let node;
    while (node = walker.nextNode()) {
        if (node.textContent.trim()) {
            // Get the formatting from all parent elements
            const formatting = extractAllFormatting(node);
            textNodes.push({
                text: node.textContent,
                formatting: formatting
            });
        }
    }
    
    // If no text nodes found, return the original content
    if (textNodes.length === 0) {
        return content;
    }
    
    // Rebuild the content with proper structure
    let result = '';
    textNodes.forEach(({ text, formatting }) => {
        if (Object.keys(formatting).length === 0) {
            result += text;
        } else {
            let wrappedText = text;
            
            // Apply formatting in the correct order
            if (formatting.bold) wrappedText = `<strong>${wrappedText}</strong>`;
            if (formatting.italic) wrappedText = `<em>${wrappedText}</em>`;
            if (formatting.underline) wrappedText = `<u>${wrappedText}</u>`;
            if (formatting.strikethrough) wrappedText = `<s>${wrappedText}</s>`;
            if (formatting.color) wrappedText = `<font color="${formatting.color}">${wrappedText}</font>`;
            if (formatting.backgroundColor) wrappedText = `<span style="background-color: ${formatting.backgroundColor}">${wrappedText}</span>`;
            
            result += wrappedText;
        }
    });
    
    return result;
}

/**
 * Extracts formatting information from all parent elements of a text node.
 *
 * @param {Node} textNode - The text node to extract formatting from
 * @returns {Object} - Object containing all formatting information
 */
function extractAllFormatting(textNode) {
    const formatting = {};
    let currentElement = textNode.parentElement;
    
    // Walk up the DOM tree to collect all formatting
    while (currentElement && currentElement.tagName !== 'LI' && currentElement.tagName !== 'DIV') {
        const elementFormatting = extractFormatting(currentElement);
        
        // Merge formatting, with more specific (closer to text) taking precedence
        Object.keys(elementFormatting).forEach(key => {
            if (elementFormatting[key] && !formatting[key]) {
                formatting[key] = elementFormatting[key];
            }
        });
        
        currentElement = currentElement.parentElement;
    }
    
    return formatting;
}

/**
 * Extracts formatting information from an element.
 *
 * @param {Element} element - The element to extract formatting from
 * @returns {Object} - Object containing formatting information
 */
function extractFormatting(element) {
    const formatting = {};
    
    // Check for bold
    if (element.tagName.toLowerCase() === 'strong' || element.tagName.toLowerCase() === 'b' ||
        element.style.fontWeight === 'bold' || parseInt(element.style.fontWeight) >= 600) {
        formatting.bold = true;
    }
    
    // Check for italic
    if (element.tagName.toLowerCase() === 'em' || element.tagName.toLowerCase() === 'i' ||
        element.style.fontStyle === 'italic') {
        formatting.italic = true;
    }
    
    // Check for underline
    if (element.tagName.toLowerCase() === 'u' ||
        element.style.textDecoration.includes('underline')) {
        formatting.underline = true;
    }
    
    // Check for strikethrough
    if (element.tagName.toLowerCase() === 's' || element.tagName.toLowerCase() === 'strike' ||
        element.style.textDecoration.includes('line-through')) {
        formatting.strikethrough = true;
    }
    
    // Check for color - improved logic
    const computedStyle = window.getComputedStyle(element);
    let colorValue = element.getAttribute('color') || element.style.color || computedStyle.color;
    
    // Handle different color formats
    if (colorValue) {
        // Convert rgb() to hex if needed
        if (colorValue.startsWith('rgb(')) {
            const rgb = colorValue.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                const r = parseInt(rgb[0]);
                const g = parseInt(rgb[1]);
                const b = parseInt(rgb[2]);
                colorValue = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            }
        }
        
        if (colorValue && colorValue !== 'rgb(0, 0, 0)' && colorValue !== '#000000' && colorValue !== 'black' && colorValue !== '#000') {
            formatting.color = colorValue;
        }
    }
    
    // Check for background color
    const backgroundColorValue = computedStyle.backgroundColor || element.style.backgroundColor;
    if (backgroundColorValue && backgroundColorValue !== 'rgba(0, 0, 0, 0)' && backgroundColorValue !== 'transparent') {
        formatting.backgroundColor = backgroundColorValue;
    }
    
    return formatting;
}
