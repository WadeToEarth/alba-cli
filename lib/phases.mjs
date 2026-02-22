// 6 phases, 24 total tasks — role-based multi-phase build system
export const PHASES = [
  {
    phase: 1,
    label: 'Ideation',
    role: 'Product Manager',
    artifact: 'SPEC.md',
    tasks: [
      { name: 'Concept brainstorm', description: 'Generate 3+ wild, unconventional ideas — push beyond obvious solutions', rewardRange: [0.25, 0.75] },
      { name: 'Feature specification', description: 'Define 3-5 features with acceptance criteria for each', rewardRange: [0.50, 1.00] },
      { name: 'Architecture overview', description: 'High-level file tree, component structure, and tech choices', rewardRange: [0.50, 1.00] },
      { name: 'Contribution assessment', description: 'Assess feature complexity, contribution weights, and success metrics', rewardRange: [0.25, 0.50] },
    ],
  },
  {
    phase: 2,
    label: 'Design',
    role: 'UX Designer + Technical Architect',
    artifact: 'DESIGN.md',
    tasks: [
      { name: 'Component detail spec', description: 'Break down every component — props, internal state, methods, responsibilities', rewardRange: [0.50, 1.00] },
      { name: 'UI/UX layout design', description: 'Describe visual layout per screen, responsive behavior, spacing, color usage', rewardRange: [0.50, 1.00] },
      { name: 'State management & data flow', description: 'Define state shape, transitions, lifting state, and component communication', rewardRange: [0.50, 1.00] },
      { name: 'Edge case specification', description: 'Document boundary conditions, empty states, error states, loading states', rewardRange: [0.25, 0.75] },
    ],
  },
  {
    phase: 3,
    label: 'Implementation',
    role: 'Developer + QA',
    artifact: 'source code + tests',
    tasks: [
      { name: 'Project scaffolding', description: 'Set up package.json, config files, layout, and globals.css', rewardRange: [0.50, 1.00] },
      { name: 'Feature 1 implementation', description: 'Implement the first feature per DESIGN.md specs', rewardRange: [0.75, 1.50] },
      { name: 'Feature 1 testing', description: 'Verify feature 1 against acceptance criteria', rewardRange: [0.25, 0.75] },
      { name: 'Feature 2 implementation', description: 'Implement the second feature per DESIGN.md specs', rewardRange: [0.75, 1.50] },
      { name: 'Feature 2 testing', description: 'Verify feature 2 against acceptance criteria', rewardRange: [0.25, 0.75] },
      { name: 'Remaining features', description: 'Implement and test all remaining features from DESIGN.md', rewardRange: [1.00, 2.00] },
    ],
  },
  {
    phase: 4,
    label: 'Review',
    role: 'Security Auditor + QA',
    artifact: 'BUG_REPORT.md',
    tasks: [
      { name: 'Security review', description: 'Audit for XSS, injection, exposed secrets, unsafe patterns', rewardRange: [0.50, 1.00] },
      { name: 'Integration testing', description: 'Test feature interactions, state management, and edge cases', rewardRange: [0.50, 1.00] },
      { name: 'Accessibility/UX review', description: 'Check color contrast, keyboard nav, responsiveness, error states', rewardRange: [0.50, 1.00] },
      { name: 'Bug triage', description: 'Classify bugs as P0/P1/P2, create fix plan', rewardRange: [0.25, 0.75] },
    ],
  },
  {
    phase: 5,
    label: 'Bug Fixing',
    role: 'Debugger',
    artifact: 'fixed source code',
    tasks: [
      { name: 'P0/P1 bug fixes', description: 'Fix all critical and high-priority bugs', rewardRange: [0.75, 1.50] },
      { name: 'P2 fixes + polish', description: 'Fix remaining issues and improve code quality', rewardRange: [0.50, 1.00] },
      { name: 'Build verification', description: 'Verify npm run build succeeds cleanly', rewardRange: [0.25, 0.50] },
    ],
  },
  {
    phase: 6,
    label: 'Demo',
    role: 'Demo Creator',
    artifact: 'preview.html + ZIP',
    tasks: [
      { name: 'Demo page creation', description: 'Create standalone preview.html showcasing all features', rewardRange: [0.75, 1.50] },
      { name: 'Demo verification', description: 'Verify preview.html covers all SPEC.md features', rewardRange: [0.25, 0.75] },
      { name: 'Package and list', description: 'Package as ZIP and upload to marketplace', rewardRange: [0.50, 1.00] },
    ],
  },
];

export function getTaskReward(rewardRange) {
  const [min, max] = rewardRange;
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}
