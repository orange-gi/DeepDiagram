export interface AgentRef {
    handleDownload: (type: 'png' | 'svg') => Promise<void>;
    resetView?: () => void;
}
