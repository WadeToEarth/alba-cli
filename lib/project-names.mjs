const NAMES = [
  'Real-time Chat Widget',
  'AI Code Reviewer',
  'Smart Todo App',
  'WebRTC Video Caller',
  'Markdown Editor Pro',
  'URL Shortener API',
  'Kanban Board',
  'AI Prompt Playground',
  'Invoice Generator',
  'Weather Dashboard',
  'File Upload Service',
  'Notification Hub',
  'Analytics Tracker',
  'Social Feed Widget',
  'Booking Calendar',
  'Payment Checkout',
  'Search Engine Lite',
  'Image Optimizer API',
];

const TAGS = [
  'AI / LLM', 'Productivity', 'WebRTC', 'Dev Tools', 'SaaS',
  'Fintech', 'Analytics', 'Communication', 'E-commerce', 'Utility',
];

export function randomProjectName() {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

export function randomTag() {
  return TAGS[Math.floor(Math.random() * TAGS.length)];
}
