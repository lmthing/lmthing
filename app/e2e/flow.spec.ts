import { test, expect } from '@playwright/test';

test.describe('Flow Management', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the local/plants workspace (which has the Indoor Plant Coach)
        await page.goto('/workspace/local%2Fplants/studio');
        await expect(page.locator('text=Agents').first()).toBeVisible();
    });

    test('should open flow editor when clicking Edit action', async ({ page }) => {
        // Click the "Indoor Plant Coach" agent
        await expect(page.locator('text=Indoor Plant Coach').first()).toBeVisible();
        await page.locator('text=Indoor Plant Coach').first().click();

        // Check we arrive at the agent builder page
        await page.waitForURL(/\/workspace\/.*\/studio\/agent\/.*/);

        // Look for the action card or panel containing "Edit action"
        const editActionBtn = page.locator('[title="Edit action"]').first();
        await editActionBtn.click();

        // The URL should change to the agent flow editing view or modal should open
        // From StudioLayout router we expect: /agent/:agentId/actions/:actionId
        await page.waitForURL(/\/workspace\/.*\/studio\/agent\/.*\/actions\/.*/);

        // Check if the flow editor modal/view is open by looking for an element inside it
        await expect(page.locator('text=Step').first()).toBeVisible({ timeout: 10000 });
    });
});
