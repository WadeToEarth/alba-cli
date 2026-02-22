import chalk from 'chalk';

export const neon = {
  green: chalk.hex('#39FF14'),
  cyan: chalk.hex('#00FFFF'),
  magenta: chalk.hex('#FF00FF'),
  yellow: chalk.hex('#FFE600'),
  red: chalk.hex('#FF3131'),
  dim: chalk.gray,
  bold: chalk.bold,
};

export const tag = {
  agent: neon.cyan('[AGENT]'),
  build: neon.yellow('[BUILD]'),
  deploy: neon.magenta('[DEPLOY]'),
  reward: neon.green('[REWARD]'),
  system: neon.dim('[SYSTEM]'),
  error: neon.red('[ERROR]'),
};
