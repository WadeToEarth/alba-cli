import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';
import { neon, tag } from './colors.mjs';
import { callClaude } from './agent.mjs';

// ── Directory helpers ────────────────────────────────────

const BUILDS_ROOT = join(homedir(), '.alba', 'builds');

export function getProjectDir(projectId) {
  return join(BUILDS_ROOT, projectId);
}

export function createProjectDir(projectId) {
  const dir = getProjectDir(projectId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ── File writing with size logging ──────────────────────

function writeProjectFile(projectDir, relativePath, content) {
  const fullPath = join(projectDir, relativePath);
  const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
  mkdirSync(dirPath, { recursive: true });
  writeFileSync(fullPath, content, 'utf-8');
  const sizeKB = (Buffer.byteLength(content, 'utf-8') / 1024).toFixed(1);
  console.log(`  ${tag.task} ${neon.dim(`Writing ${relativePath}`)} ${neon.dim(`(${sizeKB} KB)`)}`);
}

// ── Template-based generation (no API key fallback) ─────

function getTemplateComponent(projectName, projectTag, description) {
  const tagLower = (projectTag || '').toLowerCase();

  // Choose interactive content based on tag
  let interactiveSection = '';

  if (tagLower.includes('productivity') || tagLower.includes('dev tools')) {
    interactiveSection = `
        {/* Interactive Todo List */}
        <section className="mt-12 w-full max-w-lg">
          <h2 className="text-xl font-semibold text-cyan-400 mb-4">Task Board</h2>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div
                key={i}
                onClick={() => toggleItem(i)}
                className={\`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all \${
                  item.done
                    ? 'border-green-500/30 bg-green-500/5 line-through text-gray-500'
                    : 'border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10'
                }\`}
              >
                <span className={item.done ? 'text-green-400' : 'text-cyan-400'}>
                  {item.done ? '\\u2713' : '\\u25CB'}
                </span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              placeholder="Add a task..."
              className="flex-1 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={addItem}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors"
            >
              Add
            </button>
          </div>
        </section>`;
  } else if (tagLower.includes('communication') || tagLower.includes('webrtc')) {
    interactiveSection = `
        {/* Chat Widget */}
        <section className="mt-12 w-full max-w-lg">
          <h2 className="text-xl font-semibold text-cyan-400 mb-4">Chat</h2>
          <div className="border border-gray-700 rounded-lg overflow-hidden">
            <div className="h-64 overflow-y-auto p-4 space-y-3 bg-gray-900/50">
              {messages.map((msg, i) => (
                <div key={i} className={\`flex \${msg.self ? 'justify-end' : 'justify-start'}\`}>
                  <div className={\`max-w-[70%] px-3 py-2 rounded-lg \${
                    msg.self ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-200'
                  }\`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 p-3 border-t border-gray-700">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={sendMessage}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </section>`;
  } else if (tagLower.includes('analytics') || tagLower.includes('fintech')) {
    interactiveSection = `
        {/* Dashboard Metrics */}
        <section className="mt-12 w-full max-w-2xl">
          <h2 className="text-xl font-semibold text-cyan-400 mb-4">Dashboard</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.map((m, i) => (
              <div key={i} className="p-4 rounded-lg border border-gray-700 bg-gray-900/50">
                <div className="text-2xl font-bold text-cyan-400">{m.value}</div>
                <div className="text-sm text-gray-400 mt-1">{m.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 rounded-lg border border-gray-700 bg-gray-900/50">
            <div className="text-sm text-gray-400 mb-2">Activity (last 7 days)</div>
            <div className="flex items-end gap-1 h-32">
              {barData.map((val, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t opacity-80 hover:opacity-100 transition-opacity"
                  style={{ height: \`\${val}%\` }}
                />
              ))}
            </div>
          </div>
        </section>`;
  } else if (tagLower.includes('e-commerce') || tagLower.includes('saas')) {
    interactiveSection = `
        {/* Pricing Cards */}
        <section className="mt-12 w-full max-w-3xl">
          <h2 className="text-xl font-semibold text-cyan-400 mb-4">Pricing</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={\`p-6 rounded-lg border transition-all cursor-pointer \${
                  selectedPlan === i
                    ? 'border-cyan-500 bg-cyan-500/10 scale-105'
                    : 'border-gray-700 bg-gray-900/50 hover:border-gray-500'
                }\`}
                onClick={() => setSelectedPlan(i)}
              >
                <div className="text-lg font-semibold text-white">{plan.name}</div>
                <div className="text-3xl font-bold text-cyan-400 mt-2">{plan.price}</div>
                <div className="text-sm text-gray-400 mt-1">/month</div>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((f, j) => (
                    <li key={j} className="text-sm text-gray-300 flex items-center gap-2">
                      <span className="text-cyan-400">\\u2713</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>`;
  } else {
    // Default: feature cards + counter
    interactiveSection = `
        {/* Feature Cards */}
        <section className="mt-12 w-full max-w-2xl">
          <h2 className="text-xl font-semibold text-cyan-400 mb-4">Features</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {features.map((feat, i) => (
              <div key={i} className="p-4 rounded-lg border border-gray-700 bg-gray-900/50 hover:border-cyan-500/50 transition-colors">
                <div className="text-2xl mb-2">{feat.icon}</div>
                <div className="font-semibold text-white">{feat.title}</div>
                <div className="text-sm text-gray-400 mt-1">{feat.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive Counter */}
        <section className="mt-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setCount(c => Math.max(0, c - 1))} className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white text-lg flex items-center justify-center transition-colors">-</button>
            <span className="text-3xl font-bold text-cyan-400 min-w-[3ch] text-center">{count}</span>
            <button onClick={() => setCount(c => c + 1)} className="w-10 h-10 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-lg flex items-center justify-center transition-colors">+</button>
          </div>
        </section>`;
  }

  // Build the state hooks needed based on tag
  let stateHooks = '';
  if (tagLower.includes('productivity') || tagLower.includes('dev tools')) {
    stateHooks = `
  const [items, setItems] = useState([
    { text: 'Set up project repository', done: true },
    { text: 'Design system architecture', done: false },
    { text: 'Implement core features', done: false },
    { text: 'Write unit tests', done: false },
    { text: 'Deploy to production', done: false },
  ]);
  const [newItem, setNewItem] = useState('');

  const toggleItem = (index) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, done: !item.done } : item));
  };

  const addItem = () => {
    if (newItem.trim()) {
      setItems(prev => [...prev, { text: newItem.trim(), done: false }]);
      setNewItem('');
    }
  };`;
  } else if (tagLower.includes('communication') || tagLower.includes('webrtc')) {
    stateHooks = `
  const [messages, setMessages] = useState([
    { text: 'Welcome to the chat!', self: false },
    { text: 'Thanks! This looks great.', self: true },
    { text: 'Feel free to send a message below.', self: false },
  ]);
  const [chatInput, setChatInput] = useState('');

  const sendMessage = () => {
    if (chatInput.trim()) {
      setMessages(prev => [...prev, { text: chatInput.trim(), self: true }]);
      setChatInput('');
      setTimeout(() => {
        setMessages(prev => [...prev, { text: 'Got your message!', self: false }]);
      }, 800);
    }
  };`;
  } else if (tagLower.includes('analytics') || tagLower.includes('fintech')) {
    stateHooks = `
  const metrics = [
    { label: 'Users', value: '12.4K' },
    { label: 'Revenue', value: '$84K' },
    { label: 'Orders', value: '3,241' },
    { label: 'Growth', value: '+18%' },
  ];
  const barData = [45, 62, 78, 55, 89, 72, 95];`;
  } else if (tagLower.includes('e-commerce') || tagLower.includes('saas')) {
    stateHooks = `
  const [selectedPlan, setSelectedPlan] = useState(1);
  const plans = [
    { name: 'Starter', price: '$9', features: ['5 projects', '1 GB storage', 'Email support'] },
    { name: 'Pro', price: '$29', features: ['Unlimited projects', '10 GB storage', 'Priority support', 'API access'] },
    { name: 'Enterprise', price: '$99', features: ['Everything in Pro', '100 GB storage', 'Dedicated account manager', 'Custom integrations', 'SLA guarantee'] },
  ];`;
  } else {
    stateHooks = `
  const [count, setCount] = useState(0);
  const features = [
    { icon: '\\u26A1', title: 'Lightning Fast', desc: 'Optimized for speed and performance' },
    { icon: '\\uD83D\\uDD12', title: 'Secure', desc: 'Enterprise-grade security built in' },
    { icon: '\\uD83C\\uDF10', title: 'Global CDN', desc: 'Deployed worldwide for low latency' },
    { icon: '\\uD83D\\uDCC8', title: 'Scalable', desc: 'Grows with your needs seamlessly' },
  ];`;
  }

  return `'use client';

import { useState } from 'react';

export default function Home() {
  ${stateHooks}

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-6 py-16">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 to-green-400 bg-clip-text text-transparent">
          ${projectName}
        </h1>
        <p className="mt-4 text-lg text-gray-400 max-w-xl">
          ${description}
        </p>
        <div className="mt-3 inline-block px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
          ${projectTag}
        </div>
      </div>

      {/* CTA */}
      <div className="flex gap-3 mt-4">
        <button className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-green-600 hover:from-cyan-500 hover:to-green-500 text-white font-medium transition-all transform hover:scale-105">
          Get Started
        </button>
        <button className="px-6 py-2.5 rounded-lg border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-medium transition-all">
          Learn More
        </button>
      </div>
      ${interactiveSection}

      {/* Footer */}
      <footer className="mt-20 text-center text-sm text-gray-600">
        Built by <span className="text-cyan-500">ALBA</span> — AI Labor Bureau for Agents
      </footer>
    </main>
  );
}
`;
}

// ── AI-powered generation ────────────────────────────────

async function generatePageWithAI(projectName, projectTag, description) {
  const systemPrompt = `You are an expert React/Next.js developer. Generate a single-page Next.js App Router page component.

Rules:
- Output ONLY valid TypeScript/JSX code, no markdown fences, no explanations
- Use 'use client' directive at the top
- Use React useState for interactivity
- Use Tailwind CSS for styling
- Use a dark theme with gray-950 background
- Use cyan-400 and green-400 as accent colors
- Make it visually impressive and functional
- Include the project name as the main heading
- Include interactive elements relevant to the project type
- Add a footer that says "Built by ALBA"
- The component should be the default export named Home
- Do NOT import any external packages beyond React`;

  const userPrompt = `Create a page.tsx for a project called "${projectName}" (category: ${projectTag}).

Description: ${description}

Generate a beautiful, functional single-page app with:
1. A hero section with the project name and description
2. Interactive elements relevant to the project type (e.g., forms, lists, charts, cards)
3. A dark theme with neon cyan/green accents
4. Responsive design using Tailwind CSS
5. React useState for managing state

Output ONLY the component code, starting with 'use client';`;

  const result = await callClaude(systemPrompt, userPrompt);

  if (result) {
    // Clean up: remove markdown code fences if present
    let code = result.trim();
    if (code.startsWith('```')) {
      code = code.replace(/^```(?:tsx?|jsx?|javascript|typescript)?\n?/, '').replace(/\n?```$/, '');
    }
    return code;
  }

  return null;
}

async function generateDescriptionWithAI(projectName, projectTag) {
  const systemPrompt = 'You write concise product descriptions. Output only the description text, no quotes, no markdown.';
  const userPrompt = `Write a one-sentence product description (under 120 characters) for a software project called "${projectName}" in the "${projectTag}" category. Be specific and compelling.`;

  const result = await callClaude(systemPrompt, userPrompt);
  if (result) {
    return result.trim().replace(/^["']|["']$/g, '');
  }
  return null;
}

async function generateSpecWithAI(projectName, projectTag, description) {
  const systemPrompt = 'You are a technical product manager. Output a brief spec in plain text, no markdown headings, keep it under 300 words.';
  const userPrompt = `Write a brief technical specification for "${projectName}" (${projectTag}).
Description: ${description}
Include: key features (3-5 bullet points), tech stack, target users, and one key metric for success.`;

  return await callClaude(systemPrompt, userPrompt);
}

// ── Fallback description templates ──────────────────────

const DESCRIPTION_TEMPLATES = {
  'AI / LLM': 'AI-powered tool that leverages large language models to automate intelligent workflows.',
  'Productivity': 'Streamlined productivity tool designed to help teams organize and ship faster.',
  'WebRTC': 'Real-time communication platform built with WebRTC for seamless video and audio.',
  'Dev Tools': 'Developer-focused toolkit that accelerates the coding and deployment workflow.',
  'SaaS': 'Cloud-based SaaS platform delivering scalable solutions for modern businesses.',
  'Fintech': 'Financial technology solution providing smart insights and seamless transactions.',
  'Analytics': 'Comprehensive analytics dashboard that turns raw data into actionable insights.',
  'Communication': 'Modern communication platform enabling instant, reliable team collaboration.',
  'E-commerce': 'Full-featured e-commerce solution with streamlined checkout and inventory management.',
  'Utility': 'Lightweight utility tool built for speed, simplicity, and everyday use.',
};

function getFallbackDescription(projectName, projectTag) {
  return DESCRIPTION_TEMPLATES[projectTag] || `${projectName} — a modern web application built with Next.js and Tailwind CSS.`;
}

// ── Static project files ─────────────────────────────────

function getPackageJson(projectName) {
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
  return JSON.stringify({
    name: `alba-${safeName}`,
    version: '1.0.0',
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
    },
    dependencies: {
      next: '14.2.21',
      react: '^18.3.1',
      'react-dom': '^18.3.1',
    },
    devDependencies: {
      '@types/node': '^20',
      '@types/react': '^18',
      '@types/react-dom': '^18',
      autoprefixer: '^10.4.20',
      postcss: '^8.4.49',
      tailwindcss: '^3.4.17',
      typescript: '^5',
    },
  }, null, 2);
}

function getNextConfig() {
  return `/** @type {import('next').NextConfig} */
const nextConfig = {};
module.exports = nextConfig;
`;
}

function getTailwindConfig() {
  return `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`;
}

function getPostcssConfig() {
  return `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
}

function getTsConfig() {
  return JSON.stringify({
    compilerOptions: {
      target: 'es5',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./*'] },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  }, null, 2);
}

function getGlobalsCss() {
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 255, 255, 255;
  --background-rgb: 3, 7, 18;
}

body {
  color: rgb(var(--foreground-rgb));
  background: rgb(var(--background-rgb));
}
`;
}

function getLayoutTsx(projectName) {
  return `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '${projectName}',
  description: 'Built by ALBA — AI Labor Bureau for Agents',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
}

// ── Main exports ─────────────────────────────────────────

export async function generateDescription(projectName, projectTag) {
  console.log(`  ${tag.task} ${neon.cyan('Generating project description with AI...')}`);
  const aiDesc = await generateDescriptionWithAI(projectName, projectTag);
  if (aiDesc) {
    console.log(`  ${tag.task} ${neon.green('\\u2713')} ${neon.dim('AI-generated description')}`);
    return aiDesc;
  }
  const fallback = getFallbackDescription(projectName, projectTag);
  console.log(`  ${tag.task} ${neon.green('\\u2713')} ${neon.dim('Template description (no API key)')}`);
  return fallback;
}

export async function generateSpec(projectName, projectTag, description) {
  console.log(`  ${tag.task} ${neon.cyan('Generating technical specification...')}`);
  const spec = await generateSpecWithAI(projectName, projectTag, description);
  if (spec) {
    console.log(`  ${tag.task} ${neon.green('\\u2713')} ${neon.dim('AI-generated specification')}`);
    return spec;
  }
  const fallback = `Technical Spec for ${projectName}:\n- Category: ${projectTag}\n- Stack: Next.js 14, React 18, Tailwind CSS\n- Target: Web application with interactive UI\n- Key features: Responsive design, dark theme, interactive components`;
  console.log(`  ${tag.task} ${neon.green('\\u2713')} ${neon.dim('Template specification (no API key)')}`);
  return fallback;
}

export async function generateProjectFiles(projectId, projectName, projectTag, description) {
  const projectDir = getProjectDir(projectId);
  mkdirSync(join(projectDir, 'app'), { recursive: true });

  console.log(`  ${tag.task} ${neon.cyan('Creating project files...')}`);

  // Static config files
  writeProjectFile(projectDir, 'package.json', getPackageJson(projectName));
  writeProjectFile(projectDir, 'next.config.js', getNextConfig());
  writeProjectFile(projectDir, 'tailwind.config.js', getTailwindConfig());
  writeProjectFile(projectDir, 'postcss.config.js', getPostcssConfig());
  writeProjectFile(projectDir, 'tsconfig.json', getTsConfig());

  // App files
  writeProjectFile(projectDir, 'app/globals.css', getGlobalsCss());
  writeProjectFile(projectDir, 'app/layout.tsx', getLayoutTsx(projectName));

  // Main page — try AI generation first, fall back to template
  console.log(`  ${tag.task} ${neon.cyan('Generating application code...')}`);
  let pageContent = await generatePageWithAI(projectName, projectTag, description);

  if (pageContent) {
    console.log(`  ${tag.task} ${neon.green('\\u2713')} ${neon.dim('AI-generated page component')}`);
  } else {
    pageContent = getTemplateComponent(projectName, projectTag, description);
    console.log(`  ${tag.task} ${neon.green('\\u2713')} ${neon.dim('Template page component (no API key)')}`);
  }

  writeProjectFile(projectDir, 'app/page.tsx', pageContent);
  console.log(`  ${tag.task} ${neon.green('\\u2713')} ${neon.dim('Project scaffolding')}`);

  return projectDir;
}

export async function buildProject(projectId) {
  const projectDir = getProjectDir(projectId);

  // npm install
  console.log(`  ${tag.build} ${neon.yellow('Running npm install...')}`);
  try {
    const installOutput = execSync('npm install --prefer-offline 2>&1', {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 120000,
      env: { ...process.env, NODE_ENV: 'development' },
    });

    // Count installed packages
    const addedMatch = installOutput.match(/added (\d+) packages/);
    const pkgCount = addedMatch ? addedMatch[1] : '?';
    console.log(`  ${tag.build} ${neon.green('\\u2713')} ${neon.dim(`Dependencies installed (${pkgCount} packages)`)}`);
  } catch (err) {
    console.log(`  ${tag.error} ${neon.yellow('npm install failed:')} ${neon.dim(err.message?.slice(0, 120) || 'unknown')}`);
    return false;
  }

  // npm run build
  console.log(`  ${tag.build} ${neon.yellow('Running build verification...')}`);
  try {
    execSync('npm run build 2>&1', {
      cwd: projectDir,
      encoding: 'utf-8',
      timeout: 180000,
      env: { ...process.env, NODE_ENV: 'production' },
    });
    console.log(`  ${tag.build} ${neon.green('\\u2713')} ${neon.dim('Build successful')}`);
    return true;
  } catch (err) {
    const errMsg = err.stdout || err.stderr || err.message || 'unknown';
    // Extract just the relevant error line
    const lines = errMsg.split('\n').filter(l => l.includes('Error') || l.includes('error')).slice(0, 3);
    const shortErr = lines.length > 0 ? lines.join(' | ').slice(0, 150) : errMsg.slice(0, 150);
    console.log(`  ${tag.error} ${neon.yellow('Build failed:')} ${neon.dim(shortErr)}`);
    return false;
  }
}
