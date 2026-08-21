import { Dimensions } from 'react-native';

export interface AnchorPosition {
    top: number;
    left: number;
    arrowOffset: number;
    right?: number;
}

/**
 * Calculates the anchor position for a dropdown panel to be centered under a trigger icon.
 * Ensures the panel stays within screen bounds and calculates the arrow's offset.
 */
export const calculateAnchorPosition = (
    pageX: number,
    pageY: number,
    width: number,
    height: number,
    panelWidth: number = 300
): AnchorPosition => {
    const windowWidth = Dimensions.get('window').width;
    const iconCenter = pageX + width / 2;

    // Center the panel relative to the icon
    let left = iconCenter - panelWidth / 2;

    // Clamp to screen bounds with some margin
    const margin = 10;
    if (left < margin) left = margin;
    if (left + panelWidth > windowWidth - margin) {
        left = windowWidth - panelWidth - margin;
    }

    // Calculate where the arrow should be relative to the panel's left
    const arrowOffset = iconCenter - left;

    return {
        top: pageY + height,
        left,
        arrowOffset,
    };
};

/**
 * Legacy alias for calculateAnchorPosition
 */
export const calculateAnchor = calculateAnchorPosition;

/**
 * Event-based wrapper for calculateAnchorPosition
 */
export const calculateAnchorPositionFromEvent = (event: any, panelWidth: number = 220): AnchorPosition => {
    const { pageX, pageY } = event.nativeEvent || {};
    // Fallback for web events that might not have nativeEvent.pageX directly
    const px = pageX ?? event.pageX ?? 0;
    const py = pageY ?? event.pageY ?? 0;
    return calculateAnchorPosition(px, py, 0, 0, panelWidth);
};
