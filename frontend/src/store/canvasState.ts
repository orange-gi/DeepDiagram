// Simple window-based state for canvas rendering
// This bypasses zustand completely for canvas updates

interface CanvasState {
    currentCode: string;
    activeAgent: string;
    activeMessageId: number | null;
}

declare global {
    interface Window {
        __canvasState: CanvasState;
    }
}

// Initialize
if (typeof window !== 'undefined') {
    window.__canvasState = {
        currentCode: '',
        activeAgent: 'mindmap',
        activeMessageId: null
    };
}

export const setCanvasState = (state: Partial<CanvasState>) => {
    if (typeof window === 'undefined') return;

    window.__canvasState = {
        ...window.__canvasState,
        ...state
    };

    // Notify all listeners
    window.dispatchEvent(new CustomEvent('canvas-state-change', {
        detail: window.__canvasState
    }));
};

export const getCanvasState = (): CanvasState => {
    if (typeof window === 'undefined') {
        return {
            currentCode: '',
            activeAgent: 'mindmap',
            activeMessageId: null
        };
    }
    return window.__canvasState;
};
