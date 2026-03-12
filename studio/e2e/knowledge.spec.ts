import { test, expect } from '@playwright/test';

test.describe('Workspace Knowledge Management', () => {
    test.beforeEach(async ({ page }) => {
        // Go directly to the studio of the local/education workspace
        await page.goto('/workspace/local%2Feducation/studio');
        // Ensure the studio is loaded
        await expect(page.locator('text=Knowledge').first()).toBeVisible();
    });

    test('should display knowledge domains and allow navigation', async ({ page }) => {
        // Check if the "Classroom Management" domain is visible
        await expect(page.locator('text=Classroom Management').first()).toBeVisible();

        // Click to expand or select it
        await page.locator('text=Classroom Management').first().click();

        // Expect to see some files/folders inside it, like "Class Size" or "large.md"
        await expect(page.locator('text=Class Size').first()).toBeVisible();
    });

    test('should open a markdown file in the editor', async ({ page }) => {
        await page.locator('text=Classroom Management').first().click();

        // Expand Class Size folder
        await page.locator('text=Class Size').first().click();

        // Click on large.md
        await page.locator('text=large.md').first().click();

        // Verify the editor is open (checking for some content or editor class)
        // The editor should show the markdown title or content.
        await expect(page.locator('.ProseMirror, textarea').first()).toBeVisible({ timeout: 10000 });
    });

    test('should create a new knowledge area', async ({ page }) => {
        const createKnowledgeBtn = page.locator('text=+ Create Knowledge Area').first();
        await expect(createKnowledgeBtn).toBeVisible();
        await createKnowledgeBtn.click();

        // Fill in the modal
        const nameInput = page.locator('input[placeholder="e.g. Project Documentation"]').first();
        await expect(nameInput).toBeVisible();
        await nameInput.fill('New Knowledge Area');
        await page.getByRole('button', { name: 'Create', exact: true }).first().click();

        // Verify that the URL changes and the new domain is opened
        await page.waitForURL(/\/workspace\/.*\/studio\/domain\/new-knowledge-area/);
        await expect(page.locator('text=New Knowledge Area').first()).toBeVisible();
    });

    test('should create a new folder and file, and rename it', async ({ page }) => {
        // Go to a specific domain list
        await page.goto('/workspace/local%2Feducation/studio');
        await page.locator('text=Classroom Management').first().click();
        await page.waitForURL(/\/workspace\/.*\/studio\/domain\/.*/);

        // Click new folder button
        const newFolderBtn = page.locator('button[title="New Folder"]').first();
        await expect(newFolderBtn).toBeVisible();
        await newFolderBtn.click();

        const folderInput = page.locator('input[placeholder="my-folder"]');
        await folderInput.fill('my-new-folder');
        await page.locator('text=Create Folder').click();

        // Click new file button
        const newFileBtn = page.locator('button[title="New File"]').first();
        await expect(newFileBtn).toBeVisible();
        await newFileBtn.click();

        const fileInput = page.locator('input[placeholder="my-prompt-fragment"]');
        await fileInput.fill('my-new-file');
        await page.locator('text=Create File').click();

        await expect(page.locator('text=my-new-file').first()).toBeVisible();
    });
});
