import { Page } from '@playwright/test';

export interface ClickStrategy {
  selector: string;
  method: 'click' | 'locator' | 'role';
  roleOptions?: { name: string | RegExp; exact?: boolean };
  label: string;
}

/**
 * Try multiple click strategies in order. Returns on first success; throws if all fail.
 */
export async function clickWithFallback(
  page: Page,
  strategies: ClickStrategy[],
  log: (msg: string) => void,
  timeout = 5000,
): Promise<void> {
  for (const strategy of strategies) {
    try {
      switch (strategy.method) {
        case 'click':
          await page.click(strategy.selector, { timeout });
          break;
        case 'locator':
          await page.locator(strategy.selector).click({ timeout });
          break;
        case 'role':
          if (!strategy.roleOptions) throw new Error('roleOptions required for role method');
          await page.getByRole('button', strategy.roleOptions).click({ timeout });
          break;
      }
      log(`${strategy.label} (${strategy.method}: ${strategy.selector})`);
      return;
    } catch (_) {
      log(`${strategy.label} failed with ${strategy.method}, trying next...`);
    }
  }

  throw new Error(`All click strategies failed for: ${strategies[0]?.label || 'unknown'}`);
}
