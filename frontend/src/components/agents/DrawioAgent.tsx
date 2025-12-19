import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { useChatStore } from '../../store/chatStore';
import type { AgentRef } from './types';

export const DrawioAgent = forwardRef<AgentRef>((_, ref) => {
    const { currentCode, setCurrentCode } = useChatStore();
    const [iframeReady, setIframeReady] = useState(false);
    const drawioIframeRef = useRef<HTMLIFrameElement>(null);

    useImperativeHandle(ref, () => ({
        handleDownload: async (type: 'png' | 'svg') => {
            if (drawioIframeRef.current?.contentWindow) {
                drawioIframeRef.current.contentWindow.postMessage(JSON.stringify({
                    action: 'export',
                    format: type,
                    spin: true
                }), '*');
            } else {
                alert('Editor not ready.');
            }
        }
    }));

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (!event.data || typeof event.data !== 'string') return;

            let msg;
            try {
                msg = JSON.parse(event.data);
            } catch (e) {
                return;
            }

            if (msg.event === 'export') {
                if (msg.data) {
                    const downloadFile = (url: string, ext: string) => {
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `deepdiagram-drawio-${new Date().getTime()}.${ext}`;
                        a.click();
                    };
                    // msg.format might be 'xmlsvg' or 'png', etc.
                    downloadFile(msg.data, msg.format === 'xmlsvg' || msg.format === 'svg' ? 'svg' : 'png');
                }
            }
            if (msg.event === 'configure') {
                drawioIframeRef.current?.contentWindow?.postMessage(JSON.stringify({
                    action: 'configure',
                    config: {
                        compressXml: false,
                        sidebarVisible: false,
                        formatVisible: false,
                        showFormatPanel: false
                    }
                }), '*');
            }
            if (msg.event === 'init') {
                setIframeReady(true);
            }
            else if (msg.event === 'save' || msg.event === 'autosave') {
                if (msg.xml) {
                    setCurrentCode(msg.xml);
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [currentCode, setCurrentCode]);

    useEffect(() => {
        if (iframeReady && currentCode && drawioIframeRef.current) {
            let cleanXml = currentCode.replace(/```xml\s?/, '').replace(/```/, '').trim();
            if (cleanXml.startsWith('<')) {
                const win = drawioIframeRef.current.contentWindow;
                win?.postMessage(JSON.stringify({
                    action: 'load',
                    xml: cleanXml,
                    autosave: 1,
                    fit: 1
                }), '*');
                // Send explicit fit to be sure
                setTimeout(() => {
                    win?.postMessage(JSON.stringify({ action: 'fit' }), '*');
                }, 500);
            }
        }
    }, [iframeReady, currentCode]);

    return (
        <div className="w-full h-full">
            <iframe
                ref={drawioIframeRef}
                src="https://embed.diagrams.net/?embed=1&ui=atlas&menubar=0&toolbar=0&status=0&format=0&libraries=0&layers=0&libs=0&clibs=0&modified=unsavedChanges&proto=json&configure=1&fit=1&sidebar=0"
                className="w-full h-full border-none"
                title="Draw.io Editor"
            />
        </div>
    );
});
