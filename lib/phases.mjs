// 5 phases, 16 total tasks
export const PHASES = [
  {
    phase: 1,
    label: 'Ideation',
    tasks: [
      { name: 'Brainstorming session', description: 'Generate and evaluate potential project ideas', rewardRange: [0.25, 0.75] },
      { name: 'Idea selection', description: 'Select the most viable concept based on feasibility', rewardRange: [0.25, 0.50] },
      { name: 'Requirements generation', description: 'Draft initial project requirements and scope', rewardRange: [0.50, 1.00] },
    ],
  },
  {
    phase: 2,
    label: 'Requirements',
    tasks: [
      { name: 'API specification', description: 'Define API endpoints and data contracts', rewardRange: [0.50, 1.00] },
      { name: 'Data model design', description: 'Design database schema and entity relationships', rewardRange: [0.50, 1.00] },
      { name: 'Validation plan', description: 'Create test and validation strategy', rewardRange: [0.25, 0.75] },
    ],
  },
  {
    phase: 3,
    label: 'Development',
    tasks: [
      { name: 'Project scaffolding', description: 'Set up project structure and boilerplate', rewardRange: [0.50, 1.00] },
      { name: 'Core logic implementation', description: 'Build primary business logic and algorithms', rewardRange: [1.00, 2.00] },
      { name: 'UI components', description: 'Develop user interface components and layouts', rewardRange: [0.75, 1.50] },
      { name: 'Unit test suite', description: 'Write unit tests for core modules', rewardRange: [0.50, 1.00] },
      { name: 'Bug fixes & polish', description: 'Fix issues found during development', rewardRange: [0.50, 1.00] },
    ],
  },
  {
    phase: 4,
    label: 'Testing',
    tasks: [
      { name: 'Integration testing', description: 'Run end-to-end integration tests', rewardRange: [0.50, 1.00] },
      { name: 'Requirements verification', description: 'Verify all requirements are met', rewardRange: [0.25, 0.75] },
      { name: 'Performance testing', description: 'Benchmark and optimize performance', rewardRange: [0.50, 1.00] },
    ],
  },
  {
    phase: 5,
    label: 'Demo',
    tasks: [
      { name: 'Demo page creation', description: 'Build interactive demo page for showcase', rewardRange: [0.75, 1.50] },
      { name: 'Staging deployment', description: 'Deploy to staging environment for review', rewardRange: [0.50, 1.00] },
    ],
  },
];

export function getTaskReward(rewardRange) {
  const [min, max] = rewardRange;
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}
