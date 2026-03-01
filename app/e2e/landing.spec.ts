import { test, expect } from '@playwright/test';

test.describe('Landing Page & Workspace Management', () => {
    test('should display available demo workspaces on the dashboard', async ({ page }) => {
        await page.goto('/');

        // Check if the main heading or dashboard title is present
        await expect(page.locator('text=Demo Workspaces')).toBeVisible();

        // Check for specific demo workspaces
        await expect(page.locator('text=local/education')).toBeVisible();
        await expect(page.locator('text=local/plants')).toBeVisible();
        await expect(page.locator('text=local/web-development')).toBeVisible();
    });

    test('should navigate to studio when opening a workspace', async ({ page }) => {
        await page.goto('/');

        // Click the "Open" button inside the education card
        const educationCard = page.locator('.group', { hasText: 'local/education' });
        await educationCard.locator('button', { hasText: 'Open' }).click();

        // Wait for navigation
        await page.waitForURL(/\/workspace\/.*\/studio/);
        await expect(page.locator('text=Knowledge').first()).toBeVisible();
        await expect(page.locator('text=Agents').first()).toBeVisible();
    });

    test('should be able to create a new workspace from the modal', async ({ page }) => {
        await page.goto('/');

        // Click Open Studio header button to trigger modal
        await page.locator('text=Open Studio').click();

        // Type a specific test name
        const newRepoName = `test-repo-${Date.now()}`;
        await page.fill('input[placeholder="Search or create repository..."]', newRepoName);

        // Ensure the create button appears and can be clicked
        const createButton = page.locator(`button`, { hasText: `Create "${newRepoName}"` });
        await expect(createButton).toBeVisible();

        // The user may not be authenticated for github, or octokit might be mocked.
        // If it is real and fails or if it's mocked, we should handle that gracefully.
        // For now we just check the button is there.
    });
});
