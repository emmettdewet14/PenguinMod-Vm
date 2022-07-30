// We want to preserve the rotation center of exported SVGs when they are later imported.
// Unfortunately, the SVG itself does not have sufficient information to accomplish this.
// Instead we must add a small amount of extra information to the end of exported SVGs
// that can be read on import.

// Using literal HTML comments tokens will cause this script to be very hard to inline in
// a <script> element, so we'll instead do this terrible hack which the minifier probably
// won't be able to optimize away.
const HTML_COMMENT_START = `<!${'-'.repeat(2)}`;
const HTML_COMMENT_END = `${'-'.repeat(2)}>`;

/**
 * @param {string} svgString SVG source
 * @returns {{source: string; rotationCenter: [number, number]|null}} If the SVG could be parsed, returns an
 * object containing the parsed center of the SVG and the source code of the SVG with the rotation center
 * comment removed. If the SVG couldn't be parsed, returns null.
 */
const parseVectorMetadata = svgString => {
    // TODO: see if this is slow on large strings
    const regex = new RegExp(
        `${HTML_COMMENT_START}rotationCenter:(-?[\\d\\.]+):(-?[\\d\\.]+)${HTML_COMMENT_END}$`
    );
    const match = svgString.match(regex);
    if (!match) {
        return null;
    }

    const detectedX = +match[1];
    const detectedY = +match[2];
    if (Number.isNaN(detectedX) || Number.isNaN(detectedY)) {
        return null;
    }

    const rotationCenter = [detectedX, detectedY];
    const sourceWithCommentRemoved = svgString.replace(regex, '');
    return {
        rotationCenter,
        source: sourceWithCommentRemoved
    };
};

/**
 * @param {Costume} costume scratch-vm costume object
 * @returns {Uint8Array} Binary data to export
 */
const exportCostume = costume => {
    /** @type {Uint8Array} */
    const originalData = costume.asset.data;

    if (costume.dataFormat !== 'svg') {
        return originalData;
    }

    const centerX = costume.rotationCenterX;
    const centerY = costume.rotationCenterY;
    const extraData = `${HTML_COMMENT_START}rotationCenter:${centerX}:${centerY}${HTML_COMMENT_END}`;

    // Avoid unnecessary string parsing.
    const newData = new Uint8Array(originalData.byteLength + extraData.length);
    newData.set(originalData);
    // Don't need to use a full TextEncoder
    const encodedExtraData = new Uint8Array(extraData.split('').map(i => i.charCodeAt(0)));
    newData.set(encodedExtraData, originalData.byteLength);
    return newData;
};

module.exports = {
    parseVectorMetadata,
    exportCostume
};
