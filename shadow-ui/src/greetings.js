const GREETINGS = [
  "What are we building?",
  "Where should we start?",
  "What's on your mind?",
  "Ready when you are.",
  "What can I do for you?",
  "Let's get into it.",
  "What are you working on?",
  "How can I help?",
  "What's the task?",
  "Good to see you. What's up?",
];

export function randomGreeting(name) {
  const base = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
  // Occasionally use the name if we have one.
  if (name && name !== "Shadow" && Math.random() < 0.4) {
    return base.endsWith("?") ? `${base.slice(0, -1)}, ${name}?` : `${base} ${name}.`;
  }
  return base;
}
