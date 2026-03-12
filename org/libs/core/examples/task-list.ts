/**
 * Task List example
 *
 * Run with: npx tsx examples/task-list.ts
 *
 * Demonstrates defTaskList for managing a list of tasks with
 * automatic startTask, completeTask, and failTask tools.
 */

import 'dotenv/config';
import { runPrompt } from '../src/runPrompt';
import { z } from 'zod';

async function main() {
  console.log('[main] Starting task list example...\n');

  const { result, prompt } = await runPrompt(async ({ defSystem, defTaskList, defTool, defEffect, $ }) => {
    defSystem('role', 'You are a project assistant that executes tasks methodically.');

    const [tasks] = defTaskList([
      { id: '1', name: 'Gather requirements from stakeholders', status: 'pending' },
      { id: '2', name: 'Draft the technical specification', status: 'pending' },
      { id: '3', name: 'Review specification with the team', status: 'pending' },
      { id: '4', name: 'Create implementation plan', status: 'pending' },
    ]);

    defTool(
      'writeDocument',
      'Write a document with the given title and content',
      z.object({
        title: z.string(),
        content: z.string(),
      }),
      async ({ title, content }) => {
        console.log(`[writeDocument] Writing "${title}" (${content.length} chars)`);
        return { success: true, title };
      }
    );

    defEffect(({ stepNumber }) => {
      console.log(`[step ${stepNumber}] Tasks: ${JSON.stringify(tasks)}`);
    });

    $`Work through the task list in order. Use startTask before beginning each task,
writeDocument to produce any deliverables, and completeTask when finished.
Summarise your progress after all tasks are done.`;
  }, {
    model: 'zai:glm-4.5',
    options: {
      onStepFinish: ({ stepType, toolCalls }) => {
        if (toolCalls && toolCalls.length > 0) {
          for (const tc of toolCalls) {
            console.log(`[tool-call] ${tc.toolName}(${JSON.stringify(tc.args)})`);
          }
        }
        console.log(`[step-finish] type=${stepType}\n`);
      },
    },
  });

  console.log('[main] Streaming response...\n');

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }

  console.log('\n\n[main] Done.');
}

main().catch((err) => {
  console.error('[error]', err);
  process.exit(1);
});
