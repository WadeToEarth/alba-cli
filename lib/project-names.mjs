const CATEGORY_NAMES = {
  health: [
    'Sleep Tracker Dashboard',
    'Meditation Timer App',
    'Calorie Counter API',
    'Mental Health Journal',
    'Workout Planner Pro',
    'Water Intake Reminder',
  ],
  education: [
    'Flashcard Study Tool',
    'Quiz Generator Engine',
    'Language Learning Bot',
    'Interactive Whiteboard',
    'Student Progress Tracker',
    'Course Catalog Browser',
  ],
  climate: [
    'Carbon Footprint Calculator',
    'Air Quality Monitor',
    'Recycling Guide App',
    'Solar Panel Estimator',
    'EV Charging Finder',
  ],
  social: [
    'Social Feed Widget',
    'Community Poll Maker',
    'Event RSVP Manager',
    'Volunteer Match Board',
    'Neighborhood Alert Hub',
  ],
  gaming: [
    'Leaderboard Service',
    'Turn-Based Game Engine',
    'Achievement Tracker',
    'Pixel Art Editor',
    'Game Lobby Manager',
  ],
  developer: [
    'AI Code Reviewer',
    'API Docs Generator',
    'CI Dashboard Lite',
    'Dependency Audit Tool',
    'Git Commit Analyzer',
    'Markdown Editor Pro',
  ],
  productivity: [
    'Smart Todo App',
    'Kanban Board',
    'Pomodoro Timer Widget',
    'Habit Streak Tracker',
    'Meeting Notes Summarizer',
    'Bookmark Manager',
  ],
  finance: [
    'Invoice Generator',
    'Payment Checkout',
    'Budget Planner App',
    'Expense Split Calculator',
    'Stock Watchlist Widget',
  ],
  creative: [
    'AI Prompt Playground',
    'Color Palette Generator',
    'Font Pairing Tool',
    'SVG Icon Builder',
    'Mood Board Creator',
  ],
  communication: [
    'Real-time Chat Widget',
    'WebRTC Video Caller',
    'Notification Hub',
    'Email Template Builder',
    'Status Page Monitor',
  ],
};

// Flatten all names for backward compat
const ALL_NAMES = Object.values(CATEGORY_NAMES).flat();

const TAGS = [
  'AI / LLM', 'Productivity', 'WebRTC', 'Dev Tools', 'SaaS',
  'Fintech', 'Analytics', 'Communication', 'E-commerce', 'Utility',
  'Health', 'Education', 'Climate', 'Social', 'Gaming', 'Creative',
];

// Session-level dedup
const usedNames = new Set();

export function randomProjectName() {
  // Try to pick an unused name
  const available = ALL_NAMES.filter((n) => !usedNames.has(n));
  const pool = available.length > 0 ? available : ALL_NAMES;
  const name = pool[Math.floor(Math.random() * pool.length)];
  usedNames.add(name);
  return name;
}

export function randomTag() {
  return TAGS[Math.floor(Math.random() * TAGS.length)];
}

/**
 * Returns which category a name belongs to.
 */
export function getIdeaSource(name) {
  for (const [category, names] of Object.entries(CATEGORY_NAMES)) {
    if (names.includes(name)) {
      return {
        ideaSource: 'curated',
        ideaSourceDetail: `Selected from ${category} category pool`,
      };
    }
  }
  return { ideaSource: 'curated', ideaSourceDetail: 'Selected from project pool' };
}

/**
 * Generate a diverse idea using AI. Returns { name, tag, ideaSource, ideaSourceDetail } or null on failure.
 * Requires callClaude to be passed in (avoids circular dependency).
 */
export async function generateDiverseIdea(callClaude) {
  if (!callClaude) return null;
  try {
    const categories = Object.keys(CATEGORY_NAMES);
    const category = categories[Math.floor(Math.random() * categories.length)];
    const prompt = `Generate a single creative software project idea in the "${category}" category. Reply with ONLY a JSON object like: {"name": "Short Project Name", "tag": "Category Tag", "description": "One sentence description"}. No markdown, no explanation.`;
    const response = await callClaude(prompt);
    const match = response.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (!parsed.name || !parsed.tag) return null;
    usedNames.add(parsed.name);
    return {
      name: parsed.name,
      tag: parsed.tag,
      description: parsed.description || '',
      ideaSource: 'ai-generated',
      ideaSourceDetail: `AI-generated from ${category} category`,
    };
  } catch {
    return null;
  }
}
