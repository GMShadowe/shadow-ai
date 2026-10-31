import { useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import StatusBar from "./components/StatusBar.jsx";
import MessageList from "./components/MessageList.jsx";
import Composer from "./components/Composer.jsx";
import SettingsModal from "./components/settings/SettingsModal.jsx";
import PreviewProvider from "./components/rich/previews.jsx";
import VoiceScreen from "./components/voice/VoiceScreen.jsx";
import Onboarding from "./components/onboarding/Onboarding.jsx";
import Dashboard from "./components/onboarding/Dashboard.jsx";
import {
  API_BASE,
  getStatus,
  getHealth,
  streamMessage,
  listConversations,
  getConversation,
  renameConversation,
  deleteConversation,
  answerPermission,
  getGreetings,
  getSkills,
  SKILLS_CHANGED,
  regenerateReply,
  editMessage,
  rateReply,
  exportChat,
  searchChats,
  stopChat,
  warmRouter
} from "./api.js";
import { loadAppearance, saveAppearance, applyAppearance } from "./theme.js";

function newConversation() {
  return { id: crypto.randomUUID(), title: "New chat", messages: [], saved: false, updatedAt: null };
}

function fromServer(m) {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    images: (m.images ?? []).map((name) => `${API_BASE}/images/${name}`),
    tools: m.tools ?? [],
    route: m.route ?? null,
    router: m.router ?? null,
    model: m.model,
    effort: m.effort,
    stopped: !!m.stopped,
    streaming: false,
  };
}

// Tier ids the brain no longer uses. A remembered preference shouldn't send
// the UI looking for a model that was renamed or dropped.
const OLD_TIERS = { potato: "default", medium: "default", good: "plus" };

function loadPref(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function savePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable, ignore
  }
}

export default function App() {
  const [conversations, setConversations] = useState(() => [newConversation()]);
  const [activeId, setActiveId] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [status, setStatus] = useState(null);
  const [connected, setConnected] = useState(false);
  const [model, setModel] = useState(() => {
    const saved = loadPref("shadow.model");
    return OLD_TIERS[saved] ?? saved;
  });
  const [effort, setEffort] = useState(() => loadPref("shadow.effort") ?? "medium");
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Voice mode is a screen, not a composer mode: the sidebar stays, the
  // chat area is replaced. `?voice=` opens it straight away while it is
  // still a visual shell.
  const [voiceOpen, setVoiceOpen] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).has("voice");
    } catch {
      return false;
    }
  });
  const [appearance, setAppearance] = useState(loadAppearance);
  // The assistant dashboard is a screen, like voice mode: the sidebar stays
  // and the chat area is replaced.
  const [assistantsOpen, setAssistantsOpen] = useState(false);
  // Tokens the selected BYOK endpoint has used: this turn, and today.
  const [spend, setSpend] = useState(null);
  // Set when the brain answers /health but refuses real requests, which is a
  // different problem from the brain being down and needs saying differently.
  const [authFailed, setAuthFailed] = useState(false);
  const loadedChats = useRef(false);
  const abortRef = useRef(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => loadPref("shadow.sidebar") === "collapsed");
  const [skills, setSkills] = useState([]);
  const [greetingList, setGreetingList] = useState(["What's on your mind?"]);
  const [greeting, setGreeting] = useState("What's on your mind?");

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];
  const models = status?.models ?? [];

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const s = await getStatus();
        if (!cancelled) {
          setStatus(s);
          setConnected(true);
          setAuthFailed(false);
          // The selected model's running total, so the pill is right after a
          // reload and not only while a turn streams.
          setSpend(s.usage ? { turn: null, today: s.usage.today, host: null } : null);
        }
      } catch {
        if (cancelled) return;
        setConnected(false);
        // "Brain offline" was the only thing the UI could say, and it was a
        // guess. /health needs no token, so a brain that answers it while
        // refusing everything else is a token problem, not a dead brain.
        try {
          await getHealth();
          setAuthFailed(true);
        } catch {
          setAuthFailed(false);
        }
      }
    }
    check();
    const timer = setInterval(check, 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((c) => {
      const next = !c;
      savePref("shadow.sidebar", next ? "collapsed" : "expanded");
      return next;
    });
  }

  // Load saved chats once the brain is reachable.
  useEffect(() => {
    if (!connected || loadedChats.current) return;
    loadedChats.current = true;
    listConversations()
      .then((list) => {
        setConversations((prev) => {
          const ids = new Set(list.map((c) => c.id));
          const local = prev.filter((c) => !ids.has(c.id));
          const saved = list.map((c) => ({
            id: c.id,
            title: c.title,
            messages: null,
            saved: true,
            updatedAt: c.updated_at,
          }));
          return [...local, ...saved];
        });
      })
      .catch(() => {
        loadedChats.current = false;
      });
  }, [connected]);

  // The slash menu's list. The brain never puts this in a prompt; it exists
  // so the user can pick one.
  useEffect(() => {
    if (!connected) return;
    const load = () =>
      getSkills()
        .then((r) => setSkills(r.skills ?? []))
        .catch((e) => console.warn("[skills] couldn't load the list:", e.message));
    load();
    window.addEventListener(SKILLS_CHANGED, load);
    return () => window.removeEventListener(SKILLS_CHANGED, load);
  }, [connected]);

  const greetingLoaded = useRef(false);

  // Fetch personal greetings ONCE, the first time the brain is reachable.
  // The whole list is kept so opening a new chat can re-roll from memory
  // instead of asking the brain again.
  useEffect(() => {
    if (!connected || greetingLoaded.current) return;
    greetingLoaded.current = true;
    getGreetings()
      .then((r) => {
        const list = r.greetings?.length ? r.greetings : ["What's on your mind?"];
        setGreetingList(list);
        setGreeting(list[Math.floor(Math.random() * list.length)]);
      })
      .catch((e) => {
        greetingLoaded.current = false; // let it retry if it failed
        console.warn("[greetings] couldn't load, using the default:", e.message);
      });
  }, [connected]);

  // ⌘, (or Ctrl+,) opens settings.
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // If the saved model isn't usable on this computer, fall back to one that is.
  useEffect(() => {
    if (!status) return;
    const current = status.models.find((m) => m.id === model);
    if (current?.available) return;
    const fallback =
      status.models.find((m) => m.id === status.default_model && m.available) ??
      status.models.find((m) => m.available);
    if (fallback) setModel(fallback.id);
  }, [status, model]);

  function changeModel(id) {
    setModel(id);
    savePref("shadow.model", id);
  }

  function changeEffort(id) {
    setEffort(id);
    savePref("shadow.effort", id);
  }

  function changeAppearance(next) {
    setAppearance(next);
    applyAppearance(next);
    saveAppearance(next);
  }

  async function handleSettingsSaved(settings, patch) {
    if ("model" in patch) changeModel(settings.model ?? patch.model);
    if ("effort" in patch) changeEffort(settings.effort ?? patch.effort);
    try {
      setStatus(await getStatus());
    } catch {
      // status will refresh on the next poll
    }
  }

  function openVoice() {
    setVoiceOpen(true);
    updateConversation(active.id, (c) => (c.voice ? c : { ...c, voice: true }));
  }

  function updateConversation(id, change) {
    setConversations((prev) => prev.map((c) => (c.id === id ? change(c) : c)));
  }

  async function selectConversation(id) {
    setActiveId(id);
    const conv = conversations.find((c) => c.id === id);
    if (!conv || conv.messages !== null) return;
    try {
      const full = await getConversation(id);
      updateConversation(id, (c) => ({ ...c, messages: full.messages.map(fromServer) }));
    } catch (e) {
      updateConversation(id, (c) => ({
        ...c,
        messages: [{ id: "load-error", role: "error", content: `Couldn't load this chat: ${e.message}` }],
      }));
    }
  }

  function handleNew() {
    const empty = conversations.find((c) => !c.saved && c.messages?.length === 0);
    if (empty) {
      setActiveId(empty.id);
      return;
    }
    const fresh = newConversation();
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setGreeting(greetingList[Math.floor(Math.random() * greetingList.length)]);
  }

  async function handleRename(id, title) {
    updateConversation(id, (c) => ({ ...c, title }));
    try {
      await renameConversation(id, title);
    } catch {
      // the title will correct itself on the next reload
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this chat? This can't be undone.")) return;
    try {
      await deleteConversation(id);
    } catch (e) {
      window.alert(e.message);
      return;
    }
    setConversations((prev) => {
      const rest = prev.filter((c) => c.id !== id);
      return rest.length ? rest : [newConversation()];
    });
    if (activeId === id) setActiveId(null);
  }

  async function handleStop() {
    const controller = abortRef.current;
    if (!controller) return;
    // The brain ends the turn and saves what it wrote; cutting the connection
    // first would race the re-read of the chat and lose it from the screen.
    try {
      await stopChat(pendingId);
    } catch (e) {
      console.warn("[stop] the brain didn't confirm, dropping the connection:", e.message);
    }
    controller.abort();
  }

  // Warm the router while someone types. The brain holds off on its own if
  // it predicted recently; this only saves sending a request per keystroke.
  const lastWarm = useRef(0);
  function handleTyping() {
    const now = Date.now();
    if (now - lastWarm.current < 10_000) return;
    lastWarm.current = now;
    warmRouter().catch((e) => console.warn("[router] couldn't warm:", e.message));
  }

  /* Every kind of turn streams the same events back, so they share one
     handler: `request` is whichever call starts it. `msgId` is the placeholder
     reply already on screen. */
  async function runStream(convId, msgId, request) {
    setActiveId(convId);
    setPendingId(convId);

    const patch = (change) =>
      updateConversation(convId, (c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === msgId ? change(m) : m)),
      }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await request((event) => {
        switch (event.type) {
          case "route":
            patch((m) => ({
              ...m,
              route: event.route,
              router: event.router,
              model: event.model,
              effort: event.effort,
              skill: event.skill ?? m.skill ?? null,
            }));
            break;
          case "permission":
            patch((m) => ({
              ...m,
              content: "",
              tools: [
                ...m.tools,
                { kind: "permission", id: event.id, name: event.name, args: event.args,
                  preview: event.preview ?? null, decision: null },
              ],
            }));
            break;
          case "permission_result":
            patch((m) => ({
              ...m,
              tools: m.tools.map((t) =>
                t.kind === "permission" && t.id === event.id ? { ...t, decision: event.decision } : t
              ),
            }));
            break;
          case "tool_start":
            // Text before a tool call is usually "let me check…", so clear it.
            patch((m) => ({
              ...m,
              content: "",
              tools: [...m.tools, { name: event.name, args: event.args, result: null }],
            }));
            break;
          case "tool_end":
            patch((m) => {
              const tools = [...m.tools];
              for (let i = tools.length - 1; i >= 0; i--) {
                if (tools[i].kind !== "permission" && tools[i].name === event.name && tools[i].result === null) {
                  tools[i] = { ...tools[i], result: event.result };
                  break;
                }
              }
              return { ...m, tools };
            });
            break;
          case "token":
            patch((m) => ({ ...m, content: m.content + event.text }));
            break;
          case "done":
            patch((m) => ({ ...m, content: event.reply, streaming: false }));
            break;
          case "usage":
            // A BYOK turn is billed per call. Surface it live, so a runaway
            // turn is noticeable while it runs rather than afterwards.
            setSpend({ turn: event.turn, today: event.today, host: event.host });
            break;
          case "error": {
            // Carry the brain's explanation with the throw, so the catch can
            // offer the action instead of showing bare text.
            const failure = new Error(event.message);
            failure.shadow = { kind: event.kind, action: event.action, model: event.model };
            throw failure;
          }
          default:
            break;
        }
      }, controller.signal);
    } catch (e) {
      if (e.name === "AbortError") {
        patch((m) => ({ ...m, streaming: false, stopped: true }));
      } else {
        patch((m) => ({
          ...m,
          role: "error",
          content: e.message,
          error: e.shadow ?? null,
          streaming: false,
        }));
      }
    } finally {
      patch((m) => (m.streaming ? { ...m, streaming: false } : m));
      abortRef.current = null;
      setPendingId(null);
      // The brain assigns the real message ids, so re-read the chat once the
      // turn has landed: ratings and re-runs need the stored ids.
      try {
        const full = await getConversation(convId);
        updateConversation(convId, (c) => ({ ...c, messages: full.messages.map(fromServer) }));
      } catch {
        // the on-screen version is still correct; ids catch up on reload
      }
    }
  }

  function placeholder(skillName = null) {
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      tools: [],
      route: null,
      router: null,
      skill: skillName,
      streaming: true,
    };
  }

  async function handleSend(text, images = [], skillName = null, { voice = false } = {}) {
    if (active.messages === null) return;
    const convId = active.id;
    const reply = placeholder(skillName);

    // Add the messages and move this chat to the top of the list.
    setConversations((prev) => {
      const conv = prev.find((c) => c.id === convId);
      if (!conv) return prev;
      const updated = {
        ...conv,
        saved: true,
        updatedAt: new Date().toISOString(),
        title: conv.messages.length === 0 ? (text || "Image").replace(/\s+/g, " ").slice(0, 60) : conv.title,
        messages: [
          ...conv.messages,
          { id: crypto.randomUUID(), role: "user", content: text, images: images.map((i) => i.dataUrl) },
          reply,
        ],
      };
      return [updated, ...prev.filter((c) => c.id !== convId)];
    });

    await runStream(convId, reply.id, (onEvent, signal) =>
      streamMessage(
        convId,
        text,
        { model, effort, images: images.map((i) => i.base64), skill: skillName, voice },
        onEvent,
        signal
      )
    );
  }

  /* Ask the same question again. The old reply goes, on screen and in
     chats.db, and the current model/effort pickers are what runs. */
  async function handleRegenerate() {
    if (pendingId !== null || active.messages === null) return;
    const convId = active.id;
    const previous = active.messages;
    const lastUser = [...previous].reverse().find((m) => m.role === "user");
    if (!lastUser) return;

    const cut = previous.slice(0, previous.indexOf(lastUser) + 1);
    const reply = placeholder(previous[previous.length - 1]?.skill ?? null);
    updateConversation(convId, (c) => ({ ...c, messages: [...cut, reply] }));

    await runStream(convId, reply.id, (onEvent, signal) =>
      regenerateReply(convId, { model, effort }, onEvent, signal)
    );
  }

  /* Fix the last question and answer it again. */
  async function handleEditLast(text) {
    if (pendingId !== null || active.messages === null) return;
    const convId = active.id;
    const previous = active.messages;
    const lastUser = [...previous].reverse().find((m) => m.role === "user");
    if (!lastUser || !text.trim()) return;

    const cut = previous.slice(0, previous.indexOf(lastUser));
    const reply = placeholder(previous[previous.length - 1]?.skill ?? null);
    updateConversation(convId, (c) => ({
      ...c,
      messages: [...cut, { ...lastUser, content: text }, reply],
    }));

    await runStream(convId, reply.id, (onEvent, signal) =>
      editMessage(convId, text, { model, effort }, onEvent, signal)
    );
  }

  /* A rating is training signal, so it goes to the brain, which files it
     with the whole turn. Throws on failure: MessageActions shows why and
     puts the thumb back. */
  async function handleRate(messageId, { rating, reasonCode, reason }) {
    const convId = active.id;
    await rateReply({ conversationId: convId, messageId, rating, reasonCode, reason });
    updateConversation(convId, (c) => ({
      ...c,
      messages: c.messages.map((m) =>
        m.id === messageId
          ? { ...m, rating, rating_reason: reason || null, rating_reason_code: reasonCode || null }
          : m
      ),
    }));
  }

  async function handleExport(id, format) {
    try {
      const { filename, content } = await exportChat(id, format);
      const url = URL.createObjectURL(
        new Blob([content], { type: format === "json" ? "application/json" : "text/markdown" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      window.alert(`Couldn't export this chat: ${e.message}`);
    }
  }

  const composerEl = (
    <Composer
      onSend={handleSend}
      onStop={handleStop}
      onTyping={handleTyping}
      streaming={pendingId === active.id}
      disabled={!connected || active.messages === null || (pendingId !== null && pendingId !== active.id)}
      models={models}
      model={model}
      onModelChange={changeModel}
      effort={effort}
      onEffortChange={changeEffort}
      canAttach={models.find((m) => m.id === model)?.vision ?? false}
      skills={skills}
    />
  );

  /* Switching assistant changes which chats exist, so everything keyed to
     the old one has to go: the list, the open conversation, and the greeting
     built from that assistant's memory. */
  async function handleAssistantSwitched() {
    abortRef.current?.abort();
    setPendingId(null);
    loadedChats.current = false;
    setConversations([newConversation()]);
    setActiveId(null);
    try {
      const s = await getStatus();
      setStatus(s);
      changeModel(s.default_model);
      changeEffort(s.default_effort);
    } catch {
      // the poll will pick it up
    }
    listConversations()
      .then((list) => {
        loadedChats.current = true;
        setConversations((prev) => {
          const saved = list.map((c) => ({
            id: c.id,
            title: c.title,
            messages: null,
            saved: true,
            updatedAt: c.updated_at,
          }));
          const ids = new Set(list.map((c) => c.id));
          return [...prev.filter((c) => !ids.has(c.id) && !c.saved), ...saved];
        });
      })
      .catch(() => {
        loadedChats.current = false;
      });
    getGreetings()
      .then((r) => {
        const list = r.greetings ?? [];
        if (list.length) {
          setGreetingList(list);
          setGreeting(list[Math.floor(Math.random() * list.length)]);
        }
      })
      .catch(() => {
        // the generic greeting already on screen is fine
      });
  }

  // First run. Gated on the brain's own flag, and only once it has answered -
  // a brain that is still starting up must not look like a fresh install.
  if (status && status.onboarded === false) {
    return (
      <Onboarding
        onFinished={async () => {
          try {
            setStatus(await getStatus());
          } catch {
            // the poll will pick it up
          }
          handleAssistantSwitched();
        }}
      />
    );
  }

  return (
    <PreviewProvider>
    <div className="flex h-screen bg-bg p-2 pl-0">
      <Sidebar
        conversations={conversations}
        activeId={active.id}
        onSelect={selectConversation}
        onNew={handleNew}
        onRename={handleRename}
        onDelete={handleDelete}
        onExport={handleExport}
        onSearch={searchChats}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenVoice={openVoice}
        onOpenAssistants={() => setAssistantsOpen(true)}
        assistant={status?.assistant}
        connected={connected}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        model={models.find((m) => m.id === model)}
      />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_1px_3px_var(--shadow-color),0_20px_50px_-30px_var(--shadow-color)]">
        {assistantsOpen ? (
          <Dashboard
            onClose={() => setAssistantsOpen(false)}
            onSwitched={handleAssistantSwitched}
            onEdited={async () => {
              // Renaming the active assistant changes the sidebar and the
              // pickers; don't make the user wait for the next status poll.
              try {
                const s = await getStatus();
                setStatus(s);
                changeModel(s.default_model);
                changeEffort(s.default_effort);
              } catch {
                // the poll will pick it up
              }
            }}
          />
        ) : voiceOpen ? (
          <VoiceScreen
            messages={active.messages}
            streaming={pendingId === active.id}
            onSend={(text) => handleSend(text, [], null, { voice: true })}
            onStop={handleStop}
            onExit={() => setVoiceOpen(false)}
          />
        ) : (
          <>
            <StatusBar
              title={active.title}
              connected={connected}
              authFailed={authFailed}
              model={models.find((m) => m.id === model)}
              spend={spend}
            />
            {/* One list and one prompt bar, always in the same place in the
                tree. An empty chat only keeps more room under the bar, so
                the first message slides it down instead of remounting it -
                which used to drop focus and any attached images. */}
            <MessageList
              messages={active.messages}
              greeting={greeting}
              onPermission={answerPermission}
              reasons={status?.feedback_reasons ?? []}
              busy={pendingId !== null || !connected}
              onRegenerate={handleRegenerate}
              onEdit={handleEditLast}
              onRate={handleRate}
              onOpenSettings={() => setSettingsOpen(true)}
            />
            <div className={`dock shrink-0 ${active.messages?.length === 0 ? "pb-[38vh]" : "pb-0"}`}>
              {composerEl}
            </div>
          </>
        )}
      </main>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={handleSettingsSaved}
        appearance={appearance}
        onAppearanceChange={changeAppearance}
      />
    </div>
    </PreviewProvider>
  );
}
