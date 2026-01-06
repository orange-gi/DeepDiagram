import { useRef, useState, useEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import { cn } from '../lib/utils';
import { Download, RotateCcw, RefreshCw } from 'lucide-react';
import { MindmapAgent } from './agents/MindmapAgent';
import { FlowAgent } from './agents/FlowAgent';
import { ChartsAgent } from './agents/ChartsAgent';
import { DrawioAgent } from './agents/DrawioAgent';
import { MermaidAgent } from './agents/MermaidAgent';
import type { AgentRef } from './agents/types';

export const CanvasPanel = () => {
    const activeAgent = useChatStore(state => state.activeAgent);
    const currentCode = useChatStore(state => state.currentCode);
    const isLoading = useChatStore(state => state.isLoading);
    const activeMessageId = useChatStore(state => state.activeMessageId);
    const allMessages = useChatStore(state => state.allMessages);
    const [showDownloadMenu, setShowDownloadMenu] = useState(false);
    const [renderKey, setRenderKey] = useState(0);
    const agentRef = useRef<AgentRef>(null);

    // 当 activeMessageId 或 currentCode 变化时，强制重新挂载组件
    useEffect(() => {
        setRenderKey(prev => prev + 1);
        console.log('🔄 Forcing re-mount due to state change:', {
            activeMessageId,
            currentCode: currentCode.substring(0, 50) + '...'
        });
    }, [activeMessageId, currentCode]);

    // 计算当前消息的版本号
    const getCurrentVersionIndex = () => {
        if (!activeMessageId) return 0;
        const activeMsg = allMessages.find(m => m.id === activeMessageId);
        if (!activeMsg) return 0;
        const turnIndex = activeMsg.turn_index || 0;
        const siblings = allMessages.filter(m => (m.turn_index || 0) === turnIndex && m.role === activeMsg.role);
        const currentIdx = siblings.findIndex(s => s.id === activeMessageId);
        return currentIdx >= 0 ? currentIdx : 0;
    };

    const versionIndex = getCurrentVersionIndex();
    console.log('🔑 CanvasPanel key components:', {
        activeMessageId,
        versionIndex,
        renderKey,
        key: `mermaid-${renderKey}`
    });

    const handleDownload = async (type: 'png' | 'svg') => {
        if (agentRef.current) {
            await agentRef.current.handleDownload(type);
        }
        setShowDownloadMenu(false);
    };

    const handleResetView = () => {
        if (agentRef.current?.resetView) {
            agentRef.current.resetView();
        }
    };

    const handleRegenerate = () => {
        // Find the last assistant message in the store
        const { messages } = useChatStore.getState();
        const lastAssistantIdx = [...messages].reverse().findIndex(m => m.role === 'assistant');
        if (lastAssistantIdx !== -1) {
            const actualIdx = messages.length - 1 - lastAssistantIdx;
            // The handleRetry logic is in ChatPanel. We could move it to store,
            // but for now, we can trigger it via a custom event or store action.
            // Since we want to be clean, let's just use the existing handleRetry if possible.
            // Wait, I don't have handleRetry here. 
            // Better: use a custom event or a store-managed retry trigger.
            window.dispatchEvent(new CustomEvent('deepdiagram-retry', { detail: { index: actualIdx } }));
        }
    };

    const useZoomWrapper = activeAgent === 'flowchart' || activeAgent === 'mindmap';

    return (
        <div className="h-full w-full bg-slate-50 relative flex flex-col overflow-hidden">
            {/* Main Content Area */}
            <div className="flex-1 w-full h-full overflow-hidden">
                <div className="w-full h-full relative">
                    {/* Toolbar */}
                    <div className="absolute top-4 right-4 z-10 flex flex-row gap-4 items-center p-2">
                        {/* Download Button (File Icon) */}
                        <div className="relative">
                            <button
                                onClick={() => !isLoading && setShowDownloadMenu(!showDownloadMenu)}
                                disabled={isLoading}
                                className={cn(
                                    "transition-colors duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
                                    showDownloadMenu ? "text-blue-600" : "text-slate-700 hover:text-blue-600"
                                )}
                                title="Download"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                            {showDownloadMenu && (
                                <div className="absolute right-0 top-full mt-2 bg-white/95 backdrop-blur border border-slate-200 shadow-lg rounded-lg p-1 flex flex-col w-32 z-50" onMouseLeave={() => setShowDownloadMenu(false)}>
                                    <button onClick={() => handleDownload('png')} className="px-3 py-2 text-xs text-left hover:bg-slate-50 text-slate-700 rounded-md block w-full transition-colors">Save PNG</button>
                                    <button onClick={() => handleDownload('svg')} className="px-3 py-2 text-xs text-left hover:bg-slate-50 text-slate-700 rounded-md block w-full transition-colors">Save SVG</button>
                                </div>
                            )}
                        </div>

                        {/* Reset View Button */}
                        {useZoomWrapper && (
                            <button
                                onClick={handleResetView}
                                disabled={isLoading}
                                className="text-slate-700 hover:text-blue-600 transition-colors duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Reset View"
                            >
                                <RotateCcw className="w-5 h-5" />
                            </button>
                        )}

                        {/* Regenerate Button */}
                        <button
                            onClick={handleRegenerate}
                            disabled={isLoading}
                            className="text-slate-700 hover:text-blue-600 transition-colors duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Regenerate Diagram"
                        >
                            <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
                        </button>
                    </div>

                    <div className="w-full h-full">
                        {activeAgent === 'flowchart' && <FlowAgent key={`flow-${renderKey}`} ref={agentRef} />}
                        {activeAgent === 'mindmap' && <MindmapAgent key={`mindmap-${renderKey}`} ref={agentRef} />}
                        {activeAgent === 'charts' && <ChartsAgent key={`charts-${renderKey}`} ref={agentRef} />}
                        {activeAgent === 'drawio' && <DrawioAgent key={`drawio-${renderKey}`} ref={agentRef} />}
                        {activeAgent === 'mermaid' && <MermaidAgent key={`mermaid-${renderKey}`} ref={agentRef} />}

                        {!currentCode && (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                <p>No diagram generated yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
