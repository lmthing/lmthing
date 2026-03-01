import { test, expect } from '@playwright/test';

test.describe('Agent Management & Interactions', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/workspace/local%2Feducation/studio');
        await expect(page.locator('text=Agents').first()).toBeVisible();
    });

    test('should display agents in sidebar and allow agent selection', async ({ page }) => {
        // AssessmentAgent is an agent in education
        await expect(page.locator('text=AssessmentAgent').first()).toBeVisible();
        await page.locator('text=AssessmentAgent').first().click();

        // Check if the URL changed to the agent route
        await page.waitForURL(/\/workspace\/.*\/studio\/agent\/.*/);
    });

    test('should open agent chat when clicking Chat button', async ({ page }) => {
        await page.locator('text=AssessmentAgent').first().click();
        await page.waitForURL(/\/workspace\/.*\/studio\/agent\/.*/);

        // Click the Chat button
        const chatBtn = page.locator('button', { hasText: 'Chat' }).first();
        await chatBtn.click();

        // Verify chat modal opens
        await expect(page.locator('text=Runtime Conversation Preview').first()).toBeVisible({ timeout: 10000 });
    });

    test('should create a new agent', async ({ page }) => {
        const createAgentBtn = page.locator('text=+ Create Agent').first();
        await expect(createAgentBtn).toBeVisible();
        await createAgentBtn.click();

        // Fill in the modal
        const nameInput = page.locator('input[placeholder="e.g. Assessment Assistant"]').first();
        await expect(nameInput).toBeVisible();
        await nameInput.fill('New Agent');
        await page.locator('button:has-text("Create")').first().click();

        // Verify that the URL changes and the new agent is opened
        await page.waitForURL(/\/workspace\/.*\/studio\/agent\/agent-.*/);
        await expect(page.locator('text=New Agent').first()).toBeVisible();
    });
});
