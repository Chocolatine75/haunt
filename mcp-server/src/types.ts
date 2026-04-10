import type { Browser, Page } from 'playwright';

export type IssueSeverity = 'critical' | 'major' | 'minor' | 'suggestion';
export type IssueCategory = 'ux' | 'accessibility' | 'performance' | 'security' | 'content';

export interface Issue {
  severity: IssueSeverity;
  category: IssueCategory;
  description: string;
  page_url: string;
  screenshot_path?: string;
  recommendation: string;
}

export interface PersonaScenario {
  name: string;
  goal: string;
  max_steps: number;
}

export interface PersonaConfig {
  name: string;
  description: string;
  system_prompt: string;
  browser: {
    headless: boolean;
    viewport?: { width: number; height: number };
    locale?: string;
  };
  scenarios: PersonaScenario[];
}

export interface HauntSession {
  id: string;
  persona: PersonaConfig;
  browser: Browser;
  page: Page;
  issues: Issue[];
  pages_visited: string[];
  start_time: number;
  step_count: number;
  max_steps: number;
  // Mutable arrays — errors are captured via Playwright events and spliced out per step
  console_errors: string[];
  network_errors: string[];
}
