/**
 * DEPRECATED/REMOVED
 * Custom DB Memory has been removed in favor of LangChain ConversationBufferMemory (stateless).
 * These stubs are kept to prevent build errors if there are lingering imports.
 */

export async function saveMessage(...args: any[]) { console.warn('saveMessage called but memory is removed'); }
export async function loadMessages(...args: any[]) { return []; }
export async function clearConversation(...args: any[]) { }
export async function getOrCreateConversation(...args: any[]) { return { id: 0 }; }
