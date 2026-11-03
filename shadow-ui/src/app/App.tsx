import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { answerPermission, searchChats } from "@/lib/api";
import { loadPref, PREF, savePref } from "@/lib/prefs";
import { useExit } from "@/hooks/useExit";
import { useHotkey } from "@/hooks/useHotkey";
import { useWidth } from "@/hooks/useWidth";
import { applyAppearance, loadAppearance, saveAppearance, type Appearance } from "@/theme/appearance";
import { MessageList } from "@/features/chat";
import { sourcesOf } from "@/features/chat/lib/conversation";
import { Composer, type ComposerHandle } from "@/features/composer";
import RunPicker from "@/features/composer/RunPicker";
import { HomeHero, Suggestions, suggestionsFor, type Suggestion } from "@/features/home";
import { HistoryPanel, Inspector, Sidebar, TopBar } from "@/features/layout";
import PreviewProvider from "@/features/markdown/PreviewProvider";
import { useBrain } from "./hooks/useBrain";
import { useChatRunner } from "./hooks/useChatRunner";
import { useConversations } from "./hooks/useConversations";
import { useGreetings } from "./hooks/useGreetings";
import { useSkills } from "./hooks/useSkills";

// Screens that aren't on the first paint load on demand, so the chat opens
// without waiting for the settings window or voice mode to download.
const Dashboard = lazy(() => import("@/features/onboarding/Dashboard"));
const Onboarding = lazy(() => import("@/features/onboarding/Onboarding"));
const SettingsModal = lazy(() => import("@/features/settings/SettingsModal"));
const VoiceScreen = lazy(() => import("@/features/voice/components/VoiceScreen"));

// Tier ids the brain no longer uses. A remembered preference shouldn't send
// the UI looking for a model that was renamed or dropped.
const OLD_TIERS: Record<string, string> = { potato: "default", medium: "default", good: "plus" };

function initialModel() {
  const saved = loadPref(PREF.model);
  return saved ? (OLD_TIERS[saved] ?? saved) : null;
}

/* `?voice` opens voice mode straight away. */
function voiceRequested() {
  try {
    return new URLSearchParams(window.location.search).has("voice");
  } catch {
    return false;
  }
}

export default function App() {
  const brain = useBrain();
  const { status, connected } = brain;
  const chats = useConversations(connected);
  const { active } = chats;
  const skills = useSkills(connected);
  const { greetings, reloadGreetings } = useGreetings(connected);

  const [model, setModel] = useState<string | null>(initialModel);
  const [effort, setEffort] = useState(() => loadPref(PREF.effort) ?? "medium");
  const [appearance, setAppearance] = useState<Appearance>(loadAppearance);
  const [settings, setSettings] = useState<{ open: boolean; section?: string }>({ open: false });
  const [voiceOpen, setVoiceOpen] = useState(voiceRequested);
  // The dashboard takes the whole window: it is about every assistant, so
  // it shouldn't sit inside one of them.
  const [assistantsOpen, setAssistantsOpen] = useState(false);
  const [history, setHistory] = useState({ open: false, instant: false });
  // On a phone-sized window the sidebar starts closed and opens over the chat.
  const small = () => window.matchMedia("(max-width: 767px)").matches;
  const [sidebarOpen, setSidebarOpen] = useState(() => !small() && loadPref("shadow.sidebar") !== "collapsed");
  // A shortcut toggles the sidebar instantly; a click slides it.
  const [sidebarInstant, setSidebarInstant] = useState(false);
  // The inspector docks on a wide workspace (remembered) and is a drawer on
  // a narrow one (closed until asked for).
  const [inspectorOpen, setInspectorOpen] = useState(() => loadPref("shadow.inspector") !== "closed");
  const [inspectorPeek, setInspectorPeek] = useState(false);
  const workspaceRef = useRef<HTMLElement>(null);
  const wide = useWidth(workspaceRef) >= 1100;
  const peek = useExit(!wide && inspectorPeek, 180);
  const composerRef = useRef<ComposerHandle>(null);

  const runner = useChatRunner({
    active,
    options: { model, effort },
    setActiveId: chats.setActiveId,
    setConversations: chats.setConversations,
    update: chats.update,
    reload: chats.reload,
    setSpend: brain.setSpend,
  });

  const models = status?.models ?? [];
  const currentModel = models.find((m) => m.id === model);
  const assistantName = status?.assistant?.name ?? "Shadow";
  const isEmpty = !voiceOpen && active.messages?.length === 0;
  // One greeting per new chat, not a new one on every render.
  const greeting = useMemo(
    () => greetings[Math.floor(Math.random() * greetings.length)] ?? "What can I help with?",
    [active.id, greetings],
  );

  const sources = useMemo(() => sourcesOf(active.messages), [active.messages]);

  function toggleSidebar(instant = false) {
    setSidebarInstant(instant);
    setSidebarOpen((o) => {
      savePref("shadow.sidebar", o ? "collapsed" : "open");
      return !o;
    });
  }

  function toggleInspector() {
    if (!wide) {
      setInspectorPeek((o) => !o);
      return;
    }
    setInspectorOpen((o) => {
      savePref("shadow.inspector", o ? "closed" : "open");
      return !o;
    });
  }

  function changeModel(id: string) {
    setModel(id);
    savePref(PREF.model, id);
  }

  function changeEffort(id: string) {
    setEffort(id);
    savePref(PREF.effort, id);
  }

  // If the saved model isn't usable on this computer, fall back to one that is.
  useEffect(() => {
    if (!status) return;
    if (status.models.find((m) => m.id === model)?.available) return;
    const fallback =
      status.models.find((m) => m.id === status.default_model && m.available) ?? status.models.find((m) => m.available);
    if (fallback) setModel(fallback.id);
  }, [status, model]);

  function changeAppearance(next: Appearance) {
    setAppearance(next);
    applyAppearance(next);
    saveAppearance(next);
  }

  async function handleSettingsSaved(saved: Record<string, string>, patch: Record<string, unknown>) {
    if ("model" in patch) changeModel(saved.model ?? (patch.model as string));
    if ("effort" in patch) changeEffort(saved.effort ?? (patch.effort as string));
    brain.loadSettings();
    await brain.refresh();
  }

  async function adoptAssistantDefaults() {
    const s = await brain.refresh();
    if (s) {
      changeModel(s.default_model);
      changeEffort(s.default_effort);
    }
  }

  /* Switching assistant changes which chats exist, so everything keyed to
     the old one goes: the list, the open chat and the greetings. */
  function handleAssistantSwitched() {
    runner.abortAll();
    chats.resetForAssistant();
    adoptAssistantDefaults();
    reloadGreetings();
  }

  function startNew() {
    chats.startNew();
    if (small()) setSidebarOpen(false);
    setVoiceOpen(false);
    requestAnimationFrame(() => composerRef.current?.focus());
  }

  /* The logo: the address goes back to "/" (dropping ?voice and the like)
     and a fresh chat opens. */
  function goHome() {
    if (window.location.pathname + window.location.search !== "/") window.history.pushState(null, "", "/");
    startNew();
  }

  function openVoice() {
    setVoiceOpen(true);
    chats.update(active.id, (c) => (c.voice ? c : { ...c, voice: true }));
  }

  // Mounted from the first open on, so its closing animation can play.
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const openSettings = useCallback((section?: string) => {
    setSettingsLoaded(true);
    setSettings({ open: true, section });
  }, []);
  const closeHistory = useCallback(() => setHistory((h) => ({ ...h, open: false })), []);
  const toggleHistory = (instant: boolean) => setHistory((h) => ({ open: !h.open, instant }));

  // Keyboard-opened panels appear instantly: a shortcut is used too often to animate.
  useHotkey(",", () => openSettings());
  useHotkey("k", () => toggleHistory(true));
  useHotkey("o", (e) => e.shiftKey && startNew());
  useHotkey("b", () => toggleSidebar(true));

  function pickSuggestion(s: Suggestion) {
    if (s.kind === "skill") composerRef.current?.pickSkill(s.skill);
    else composerRef.current?.insert(s.text);
  }

  // First run. Gated on the brain's own flag, and only once it has answered -
  // a brain that is still starting up must not look like a fresh install.
  if (status && status.onboarded === false) {
    return (
      <Suspense fallback={null}>
        <Onboarding
          onFinished={async () => {
            await brain.refresh();
            handleAssistantSwitched();
          }}
        />
      </Suspense>
    );
  }

  if (assistantsOpen) {
    return (
      <Suspense fallback={null}>
        <Dashboard
          onClose={() => setAssistantsOpen(false)}
          onHome={() => {
            setAssistantsOpen(false);
            goHome();
          }}
          onSwitched={handleAssistantSwitched}
          onEdited={adoptAssistantDefaults}
        />
      </Suspense>
    );
  }

  const busy = runner.pendingId !== null || !connected;

  return (
    <PreviewProvider>
      <div className="relative flex h-full bg-sidebar text-ink">
        <Sidebar
          conversations={chats.conversations}
          activeId={active.id}
          voiceOpen={voiceOpen}
          assistantName={assistantName}
          modelLabel={currentModel?.label}
          connected={connected}
          sending={!!currentModel?.sends_data}
          pinned={sidebarOpen}
          instant={sidebarInstant}
          onTogglePin={() => toggleSidebar()}
          onNew={startNew}
          onHome={goHome}
          onSearch={() => toggleHistory(false)}
          onVoice={openVoice}
          onAssistants={() => setAssistantsOpen(true)}
          onSettings={openSettings}
          onSelect={(id) => {
            setVoiceOpen(false);
            chats.select(id);
            if (small()) setSidebarOpen(false);
          }}
          onRename={chats.rename}
          onDelete={chats.remove}
          onExport={chats.exportOne}
        />

        {/* The workspace: an inset panel with a hairline and one rounded
            corner, set into the rail and sidebar around it. */}
        <main ref={workspaceRef} className="relative mt-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-tl-2xl border-l border-t border-line bg-bg">
          {voiceOpen ? (
            <Suspense fallback={null}>
              <VoiceScreen
                messages={active.messages}
                streaming={runner.pendingId === active.id}
                onSend={(text: string) => runner.send(text, [], null, true)}
                onStop={runner.stop}
                onExit={() => setVoiceOpen(false)}
              />
            </Suspense>
          ) : (
            <div className="relative flex min-h-0 flex-1">
              <div className="relative flex min-w-0 flex-1 flex-col">
                {/* The empty chat's ground: a dot grid fading out from the middle. */}
                {isEmpty && <div aria-hidden="true" className="dot-field animate-fade pointer-events-none absolute inset-0" />}
                  <TopBar
                    title={active.title || "New chat"}
                    saved={active.saved && !isEmpty}
                    connected={connected}
                    authFailed={brain.authFailed}
                    model={currentModel}
                    spend={brain.spend}
                    sourceCount={sources.files.length + sources.links.length}
                    inspectorOpen={wide ? inspectorOpen : inspectorPeek}
                    onToggleInspector={toggleInspector}
                    onRename={(title) => chats.rename(active.id, title)}
                    onExport={(format) => chats.exportOne(active.id, format)}
                    onDelete={() => chats.remove(active.id)}
                    onNew={startNew}
                  />

                  {/* One list and one prompt bar, always in the same place in the
                      tree. An empty chat only keeps more room under the bar, so
                      the first message slides it down instead of remounting it.
                      Switching chats cross-fades the list. */}
                  <div key={active.id} className="animate-fade flex min-h-0 flex-1 flex-col">
                    <MessageList
                      messages={active.messages}
                      empty={
                        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-end px-6 pb-8">
                          <div className="relative w-full flex justify-center">
                            <HomeHero greeting={greeting} connected={connected} modelLabel={currentModel?.label} sending={!!currentModel?.sends_data} />
                          </div>
                        </div>
                      }
                      onPermission={answerPermission}
                      reasons={status?.feedback_reasons ?? []}
                      busy={busy}
                      onRegenerate={runner.regenerate}
                      onEdit={runner.editLast}
                      onRate={runner.rate}
                      onOpenSettings={openSettings}
                    />
                  </div>

                  <div className={`dock relative shrink-0 ${isEmpty ? "pb-[30vh]" : "pb-3"}`}>
                    <Composer
                      ref={composerRef}
                      onSend={(text, images, skill) => runner.send(text, images, skill)}
                      onStop={runner.stop}
                      onTyping={runner.typing}
                      streaming={runner.pendingId === active.id}
                      disabled={!connected || active.messages === null || (runner.pendingId !== null && runner.pendingId !== active.id)}
                      canAttach={currentModel?.vision ?? false}
                      skills={skills}
                      offline={brain.offline}
                      onToggleOffline={() => brain.toggleOffline().catch((e) => window.alert((e as Error).message))}
                      onOpenVoice={openVoice}
                      assistantName={assistantName}
                      history={[...new Set((active.messages ?? []).filter((m) => m.role === "user" && m.content).map((m) => m.content).reverse())].slice(0, 6)}
                      onDeepSearch={() => {
                        // Reading several pages takes steps: at least High.
                        if (["low", "medium"].includes(effort)) changeEffort("high");
                      }}
                      picker={
                        <RunPicker models={models} model={model} onModelChange={changeModel} effort={effort} onEffortChange={changeEffort} />
                      }
                    />
                    {isEmpty && (
                      <div key={active.id} className="relative px-4">
                        <Suggestions items={suggestionsFor(skills)} onPick={pickSuggestion} />
                      </div>
                    )}
                  </div>
              </div>

              {wide ? (
                <div
                  className="side-slot shrink-0 border-l border-line [--slot-from:24px] [--slot-w:300px]"
                  data-open={inspectorOpen}
                  inert={!inspectorOpen}
                >
                  <Inspector
                    messages={active.messages}
                    model={currentModel}
                    effort={effort}
                    offline={brain.offline}
                    sources={sources}
                    onToggleOffline={() => brain.toggleOffline().catch((e) => window.alert((e as Error).message))}
                    onClose={toggleInspector}
                  />
                </div>
              ) : (
                peek.mounted && (
                  <div
                    className={`${peek.leaving ? "drawer-out pointer-events-none" : "drawer-in"} absolute inset-y-0 right-0 z-30 border-l border-line shadow-[-16px_0_40px_-12px_var(--shadow-color)]`}
                  >
                    <Inspector
                      messages={active.messages}
                      model={currentModel}
                      effort={effort}
                      offline={brain.offline}
                      sources={sources}
                      onToggleOffline={() => brain.toggleOffline().catch((e) => window.alert((e as Error).message))}
                      onClose={toggleInspector}
                    />
                  </div>
                )
              )}
            </div>
          )}
        </main>

        <HistoryPanel
          open={history.open}
          instant={history.instant}
          onClose={closeHistory}
          conversations={chats.conversations}
          activeId={active.id}
          onSelect={(id) => {
            setVoiceOpen(false);
            chats.select(id);
          }}
          onNew={startNew}
          onRename={chats.rename}
          onDelete={chats.remove}
          onExport={chats.exportOne}
          onSearch={searchChats}
        />

        {settingsLoaded && (
          <Suspense fallback={null}>
            <SettingsModal
              open={settings.open}
              initialSection={settings.section}
              onClose={() => setSettings({ open: false })}
              onSaved={handleSettingsSaved}
              appearance={appearance}
              onAppearanceChange={changeAppearance}
            />
          </Suspense>
        )}
      </div>
    </PreviewProvider>
  );
}
