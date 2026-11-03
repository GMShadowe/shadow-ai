import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteConversation,
  exportChat,
  getConversation,
  listConversations,
  renameConversation,
} from "@/lib/api";
import { downloadText } from "@/lib/format";
import { fromServer, fromSummary, newConversation } from "@/features/chat/lib/conversation";
import type { Conversation, ExportFormat } from "@/types";

/* The chat list and which chat is open. Saved chats arrive as summaries
   (messages: null) and are fetched the first time they're opened. */
export function useConversations(connected: boolean) {
  const [conversations, setConversations] = useState<Conversation[]>(() => [newConversation()]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const loaded = useRef(false);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];

  const update = useCallback((id: string, change: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? change(c) : c)));
  }, []);

  /** Re-read one chat from the brain, which assigns the stored message ids. */
  const reload = useCallback(
    async (id: string) => {
      const full = await getConversation(id);
      update(id, (c) => ({ ...c, messages: full.messages.map(fromServer) }));
    },
    [update],
  );

  const loadList = useCallback((dropLocalSaved = false) => {
    return listConversations()
      .then((list) => {
        loaded.current = true;
        setConversations((prev) => {
          const ids = new Set(list.map((c) => c.id));
          const local = prev.filter((c) => !ids.has(c.id) && !(dropLocalSaved && c.saved));
          return [...local, ...list.map(fromSummary)];
        });
      })
      .catch(() => {
        loaded.current = false;
      });
  }, []);

  // Load saved chats once the brain is reachable.
  useEffect(() => {
    if (!connected || loaded.current) return;
    loaded.current = true;
    loadList();
  }, [connected, loadList]);

  async function select(id: string) {
    setActiveId(id);
    const conv = conversations.find((c) => c.id === id);
    if (!conv || conv.messages !== null) return;
    try {
      await reload(id);
    } catch (e) {
      update(id, (c) => ({
        ...c,
        messages: [{ id: "load-error", role: "error", content: `Couldn't load this chat: ${(e as Error).message}` }],
      }));
    }
  }

  /** Opens an empty chat, reusing one that is already empty. Returns true if a new one was made. */
  function startNew(): boolean {
    const empty = conversations.find((c) => !c.saved && c.messages?.length === 0);
    if (empty) {
      setActiveId(empty.id);
      return false;
    }
    const fresh = newConversation();
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    return true;
  }

  async function rename(id: string, title: string) {
    update(id, (c) => ({ ...c, title }));
    try {
      await renameConversation(id, title);
    } catch {
      // the title corrects itself on the next reload
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this chat? This can't be undone.")) return;
    try {
      await deleteConversation(id);
    } catch (e) {
      window.alert((e as Error).message);
      return;
    }
    setConversations((prev) => {
      const rest = prev.filter((c) => c.id !== id);
      return rest.length ? rest : [newConversation()];
    });
    if (activeId === id) setActiveId(null);
  }

  async function exportOne(id: string, format: ExportFormat) {
    try {
      const { filename, content } = await exportChat(id, format);
      downloadText(filename, content, format === "json" ? "application/json" : "text/markdown");
    } catch (e) {
      window.alert(`Couldn't export this chat: ${(e as Error).message}`);
    }
  }

  /** After switching assistant: everything keyed to the old one goes. */
  function resetForAssistant() {
    loaded.current = false;
    setConversations([newConversation()]);
    setActiveId(null);
    loadList(true);
  }

  return {
    conversations,
    setConversations,
    active,
    setActiveId,
    update,
    reload,
    select,
    startNew,
    rename,
    remove,
    exportOne,
    resetForAssistant,
  };
}
