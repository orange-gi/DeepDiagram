import { create } from 'zustand';
import type { ChatState, Message, AgentType, Step } from '../types';

export const useChatStore = create<ChatState>((set) => ({
    messages: [],
    input: '',
    activeAgent: 'mindmap',
    currentCode: '',
    isLoading: false,
    sessionId: null,
    sessions: [],
    allMessages: [],
    inputImages: [],
    isStreamingCode: false,
    activeMessageId: null,
    selectedVersions: {},
    toast: null,
    activeStepRef: null,

    setInput: (input: string) => set({ input }),
    setAgent: (agent: AgentType) => set({ activeAgent: agent }),

    addMessage: (message: Message) => set((state) => {
        const newMessage = { ...message, created_at: message.created_at || new Date().toISOString() };

        if (newMessage.turn_index === undefined) {
            const msgs = state.messages;
            if (msgs.length > 0) {
                const lastTurn = msgs[msgs.length - 1].turn_index ?? 0;
                newMessage.turn_index = lastTurn + 1;
            } else {
                newMessage.turn_index = 0;
            }
        }

        const allMsgs = [...state.allMessages, newMessage];
        const turnIndex = newMessage.turn_index;
        const newSelectedVersions = { ...state.selectedVersions };

        if (newMessage.id) {
            newSelectedVersions[turnIndex] = newMessage.id;
        } else {
            delete newSelectedVersions[turnIndex];
        }

        const turnMap: Record<number, Message[]> = {};
        allMsgs.forEach(m => {
            const turn = m.turn_index || 0;
            if (!turnMap[turn]) turnMap[turn] = [];
            turnMap[turn].push(m);
        });

        const sortedTurns = Object.keys(turnMap).map(Number).sort((a, b) => a - b);
        const newMessages: Message[] = [];
        sortedTurns.forEach(turn => {
            const siblings = turnMap[turn];
            const selectedId = newSelectedVersions[turn];
            const selected = siblings.find(s => s.id === selectedId) || siblings[siblings.length - 1];
            newMessages.push(selected);
        });

        return {
            allMessages: allMsgs,
            messages: newMessages,
            selectedVersions: newSelectedVersions
        };
    }),

    setCurrentCode: (code: string | ((prev: string) => string)) =>
        set((state) => ({
            currentCode: typeof code === 'function' ? code(state.currentCode) : code
        })),

    setLoading: (loading: boolean) => set({ isLoading: loading }),
    setStreamingCode: (streaming: boolean) => set({ isStreamingCode: streaming }),
    setSessionId: (id: number | null) => set({ sessionId: id }),
    setMessages: (messages: Message[]) => set({ messages }),
    setActiveMessageId: (id: number | null) => set({ activeMessageId: id }),

    updateLastMessage: (content: string) => set((state) => {
        const allMsgs = [...state.allMessages];
        const activeId = state.activeMessageId;
        let targetIdx = -1;
        if (activeId !== null) targetIdx = allMsgs.findIndex(m => m.id === activeId);
        if (targetIdx === -1 && allMsgs.length > 0) targetIdx = allMsgs.length - 1;

        if (targetIdx !== -1) {
            allMsgs[targetIdx].content = content;
            const turnMap: Record<number, Message[]> = {};
            allMsgs.forEach(m => {
                const turn = m.turn_index || 0;
                if (!turnMap[turn]) turnMap[turn] = [];
                turnMap[turn].push(m);
            });

            const sortedTurns = Object.keys(turnMap).map(Number).sort((a, b) => a - b);
            const newMessages: Message[] = [];
            sortedTurns.forEach(turn => {
                const siblings = turnMap[turn];
                const selectedId = state.selectedVersions[turn];
                const selected = siblings.find(s => s.id === selectedId) || siblings[siblings.length - 1];
                newMessages.push(selected);
            });
            return { allMessages: allMsgs, messages: newMessages };
        }
        return {};
    }),

    setInputImages: (images: string[]) => set({ inputImages: images }),
    addInputImage: (image: string) => set((state) => ({ inputImages: [...state.inputImages, image] })),
    clearInputImages: () => set({ inputImages: [] }),

    addStepToLastMessage: (step: Step) => set((state) => {
        const allMsgs = [...state.allMessages];
        const activeId = state.activeMessageId;
        let targetIdx = -1;
        if (activeId !== null) targetIdx = allMsgs.findIndex(m => m.id === activeId);
        if (targetIdx === -1 && allMsgs.length > 0) targetIdx = allMsgs.length - 1;

        if (targetIdx !== -1) {
            const lastMsg = allMsgs[targetIdx];
            if (lastMsg.role === 'assistant') {
                lastMsg.steps = lastMsg.steps || [];
                lastMsg.steps.push(step);

                const turnMap: Record<number, Message[]> = {};
                allMsgs.forEach(m => {
                    const turn = m.turn_index || 0;
                    if (!turnMap[turn]) turnMap[turn] = [];
                    turnMap[turn].push(m);
                });
                const sortedTurns = Object.keys(turnMap).map(Number).sort((a, b) => a - b);
                const newMessages: Message[] = [];
                sortedTurns.forEach(turn => {
                    const siblings = turnMap[turn];
                    const selectedId = state.selectedVersions[turn];
                    const selected = siblings.find(s => s.id === selectedId) || siblings[siblings.length - 1];
                    newMessages.push(selected);
                });
                return { allMessages: allMsgs, messages: newMessages };
            }
        }
        return {};
    }),

    updateLastStepContent: (content: string, isStreaming?: boolean, status?: 'running' | 'done', type?: Step['type'], append: boolean = true) => set((state) => {
        const allMsgs = [...state.allMessages];
        const activeId = state.activeMessageId;
        let targetIdx = -1;
        if (activeId !== null) targetIdx = allMsgs.findIndex(m => m.id === activeId);
        if (targetIdx === -1 && allMsgs.length > 0) targetIdx = allMsgs.length - 1;

        if (targetIdx !== -1) {
            const lastMsg = allMsgs[targetIdx];
            if (lastMsg.role === 'assistant' && lastMsg.steps && lastMsg.steps.length > 0) {
                const lastStep = lastMsg.steps[lastMsg.steps.length - 1];
                if (typeof content === 'string') {
                    if (append) {
                        lastStep.content = (lastStep.content || '') + content;
                    } else {
                        lastStep.content = content;
                    }
                }
                if (isStreaming !== undefined) lastStep.isStreaming = isStreaming;
                if (status !== undefined) lastStep.status = status;
                if (type !== undefined) lastStep.type = type;

                const turnMap: Record<number, Message[]> = {};
                allMsgs.forEach(m => {
                    const turn = m.turn_index || 0;
                    if (!turnMap[turn]) turnMap[turn] = [];
                    turnMap[turn].push(m);
                });
                const sortedTurns = Object.keys(turnMap).map(Number).sort((a, b) => a - b);
                const newMessages: Message[] = [];
                sortedTurns.forEach(turn => {
                    const siblings = turnMap[turn];
                    const selectedId = state.selectedVersions[turn];
                    const selected = siblings.find(s => s.id === selectedId) || siblings[siblings.length - 1];
                    newMessages.push(selected);
                });
                return { allMessages: allMsgs, messages: newMessages };
            }
        }
        return {};
    }),

    setActiveStepRef: (ref: { messageIndex: number, stepIndex: number } | null) => set({ activeStepRef: ref }),

    reportError: (errorMsg: string) => set((state) => {
        const msgs = [...state.messages];
        if (msgs.length > 0) {
            msgs[msgs.length - 1].content += `\n\n[Error: ${errorMsg}]`;
        }
        return { messages: msgs, toast: { message: errorMsg, type: 'error' } };
    }),

    reportSuccess: () => { },

    markLastStepAsError: (errorMsg: string) => set((state) => {
        const allMsgs = [...state.allMessages];
        const activeId = state.activeMessageId;
        let targetIdx = -1;
        if (activeId !== null) targetIdx = allMsgs.findIndex(m => m.id === activeId);
        if (targetIdx === -1 && allMsgs.length > 0) targetIdx = allMsgs.length - 1;

        if (targetIdx !== -1) {
            const lastMsg = allMsgs[targetIdx];
            if (lastMsg.role === 'assistant' && lastMsg.steps && lastMsg.steps.length > 0) {
                lastMsg.steps[lastMsg.steps.length - 1].status = 'error';
                lastMsg.steps[lastMsg.steps.length - 1].error = errorMsg;
            }
        }
        return { allMessages: allMsgs, toast: { message: errorMsg, type: 'error' } };
    }),

    clearToast: () => set({ toast: null }),

    loadSessions: async () => {
        try {
            const response = await fetch('/api/sessions');
            if (response.ok) {
                const sessions = await response.json();
                set({ sessions });
            }
        } catch (error) {
            console.error('Failed to load sessions:', error);
        }
    },

    selectSession: async (sessionId: number) => {
        set({ isLoading: true, sessionId, messages: [], allMessages: [], selectedVersions: {} });
        try {
            const response = await fetch(`/api/sessions/${sessionId}`);
            if (response.ok) {
                const data = await response.json();
                const history = data.messages || [];
                const persistedCode = data.current_code || '';

                const mappedMessages: Message[] = history.map((msg: any) => ({
                    id: msg.id,
                    parent_id: msg.parent_id,
                    role: msg.role,
                    content: msg.content,
                    images: msg.images || [],
                    steps: msg.steps || [],
                    agent: msg.agent,
                    turn_index: msg.turn_index,
                    created_at: msg.created_at
                }));

                const turnMap: Record<number, Message[]> = {};
                mappedMessages.forEach(m => {
                    const turn = m.turn_index || 0;
                    if (!turnMap[turn]) turnMap[turn] = [];
                    turnMap[turn].push(m);
                });

                const sortedTurns = Object.keys(turnMap).map(Number).sort((a, b) => a - b);
                const initialSelected: Record<number, number> = {};
                const activeMessages: Message[] = [];

                sortedTurns.forEach(turn => {
                    const siblings = turnMap[turn];
                    const selected = siblings[siblings.length - 1]; // Pick latest version
                    initialSelected[turn] = selected.id!;
                    activeMessages.push(selected);
                });

                let lastCode = persistedCode;
                let lastAgent: AgentType = 'mindmap';

                // If persistedCode is empty, fallback to walk-back
                if (!lastCode) {
                    for (let i = activeMessages.length - 1; i >= 0; i--) {
                        const msg = activeMessages[i];
                        if (msg.role === 'assistant' && msg.steps) {
                            const lastStep = [...msg.steps].reverse().find((s: any) => s.type === 'tool_end' && s.content);
                            if (lastStep && lastStep.content) {
                                lastCode = lastStep.content;
                                break;
                            }
                        }
                    }
                }

                // Detect agent from any message in the path (backwards)
                for (let i = activeMessages.length - 1; i >= 0; i--) {
                    const msg = activeMessages[i];
                    if (msg.role === 'assistant' && msg.agent) {
                        lastAgent = msg.agent as AgentType;
                        break;
                    }
                }

                set({
                    messages: activeMessages,
                    allMessages: mappedMessages,
                    selectedVersions: initialSelected,
                    currentCode: lastCode,
                    activeAgent: lastAgent,
                    activeMessageId: activeMessages[activeMessages.length - 1]?.id || null,
                    isLoading: false
                });
            }
        } catch (error) {
            console.error('Failed to load session history:', error);
            set({ isLoading: false });
        }
    },

    syncCodeToMessage: (messageId: number) => {
        set((state) => {
            const allMsgs = state.allMessages;
            const targetMsg = allMsgs.find(m => m.id === messageId);
            if (!targetMsg) return {};

            const targetTurn = targetMsg.turn_index || 0;
            let lastCode = '';
            let lastAgent = state.activeAgent;

            for (let t = targetTurn; t >= 0; t--) {
                const selectedId = t === targetTurn ? messageId : state.selectedVersions[t];
                const msg = allMsgs.find(m => m.id === selectedId);
                if (msg && msg.role === 'assistant' && msg.steps) {
                    const lastStep = [...msg.steps].reverse().find((s: any) => s.type === 'tool_end' && s.content);
                    if (lastStep && lastStep.content) {
                        lastCode = lastStep.content;
                        if (msg.agent) lastAgent = msg.agent as AgentType;
                        break;
                    }
                }
            }
            return { currentCode: lastCode, activeAgent: lastAgent, activeMessageId: messageId, isStreamingCode: false };
        });
    },

    switchMessageVersion: (messageId: number) => {
        console.log('🔄 switchMessageVersion called with messageId:', messageId);
        console.log('📌 Current activeMessageId:', useChatStore.getState().activeMessageId);
        set((state) => {
            const allMsgs = state.allMessages;
            const targetMsg = allMsgs.find(m => m.id === messageId);
            if (!targetMsg) {
                console.log('❌ Target message not found');
                return {};
            }
            console.log('📝 Target message:', targetMsg);

            const turnIndex = targetMsg.turn_index || 0;
            const newSelectedVersions = { ...state.selectedVersions, [turnIndex]: messageId };

            const turnMap: Record<number, Message[]> = {};
            allMsgs.forEach(m => {
                const turn = m.turn_index || 0;
                if (!turnMap[turn]) turnMap[turn] = [];
                turnMap[turn].push(m);
            });

            const sortedTurns = Object.keys(turnMap).map(Number).sort((a, b) => a - b);
            const newMessages: Message[] = [];
            sortedTurns.forEach(turn => {
                const siblings = turnMap[turn];
                const selectedId = newSelectedVersions[turn];
                const selected = siblings.find(s => s.id === selectedId) || siblings[siblings.length - 1];
                newMessages.push(selected);
            });

            // 直接从目标消息中提取代码和 agent
            let lastCode = '';
            let lastAgent = state.activeAgent;

            if (targetMsg.role === 'assistant') {
                // 从目标消息的 steps 中提取代码
                if (targetMsg.steps) {
                    console.log('🔍 Target message has steps:', targetMsg.steps.length);
                    const lastStep = [...targetMsg.steps].reverse().find((s: any) => s.type === 'tool_end' && s.content);
                    if (lastStep && lastStep.content) {
                        lastCode = lastStep.content;
                        console.log('✅ Found code, length:', lastCode.length);
                    } else {
                        console.log('⚠️ No tool_end step with content found');
                    }
                } else {
                    console.log('⚠️ Target message has no steps');
                }
                // 使用目标消息的 agent
                if (targetMsg.agent) {
                    lastAgent = targetMsg.agent as AgentType;
                    console.log('✅ Using agent:', lastAgent);
                }
            }

            console.log('🎯 Final update:', {
                currentCode: lastCode ? lastCode.substring(0, 50) + '...' : '(empty)',
                activeAgent: lastAgent,
                activeMessageId: messageId
            });

            return {
                messages: newMessages,
                selectedVersions: newSelectedVersions,
                currentCode: lastCode || '',
                activeAgent: lastAgent,
                activeMessageId: messageId,
                isStreamingCode: false
            };
        });
    },

    createNewChat: () => {
        set({
            messages: [],
            allMessages: [],
            selectedVersions: {},
            sessionId: null,
            currentCode: '',
            input: '',
            inputImages: []
        });
    },

    deleteSession: async (sessionId: number) => {
        try {
            const response = await fetch(`/api/sessions/${sessionId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                set((state) => ({
                    sessions: state.sessions.filter(s => s.id !== sessionId),
                    sessionId: state.sessionId === sessionId ? null : state.sessionId,
                    messages: state.sessionId === sessionId ? [] : state.messages
                }));
            }
        } catch (error) {
            console.error('Failed to delete session:', error);
        }
    }
}));
