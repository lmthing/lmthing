import fs from "fs/promises";
import path from "path";

const MOCK_DATA_DIR = path.resolve("./mock_data/workspaces");
const OUT_DIR = path.resolve("./mock_data_new");

async function migrate() {
  console.log("Starting migration script...");
  console.log(`MOCK_DATA_DIR resolved to: ${MOCK_DATA_DIR}`);
  console.log(`OUT_DIR resolved to: ${OUT_DIR}`);

  try {
    console.log(`Creating OUT_DIR: ${OUT_DIR}`);
    await fs.mkdir(OUT_DIR, { recursive: true });
  } catch (err: any) {
    console.error(`Failed to create OUT_DIR:`, err);
    return;
  }

  let workspaces: string[];
  try {
    console.log(`Reading MOCK_DATA_DIR: ${MOCK_DATA_DIR}`);
    workspaces = await fs.readdir(MOCK_DATA_DIR);
    console.log(`Found ${workspaces.length} items in workspaces directory:`, workspaces);
  } catch (err: any) {
    console.error(`Failed to read MOCK_DATA_DIR:`, err);
    return;
  }

  for (const workspace of workspaces) {
    if (workspace === ".DS_Store") {
      console.log("Skipping .DS_Store");
      continue;
    }

    console.log(`\n--- Migrating workspace: ${workspace} ---`);
    const workspacePath = path.join(MOCK_DATA_DIR, workspace);
    const outWorkspacePath = path.join(OUT_DIR, workspace);

    console.log(`Workspace path: ${workspacePath}`);
    console.log(`Out workspace path: ${outWorkspacePath}`);

    try {
      const stat = await fs.stat(workspacePath);
      if (!stat.isDirectory()) {
        console.log(`Skipping ${workspace} because it is not a directory`);
        continue;
      }
    } catch (err: any) {
      console.error(`Failed to stat workspace path ${workspacePath}:`, err);
      continue;
    }

    console.log(`Creating directories for workspace ${workspace}...`);
    try {
      await fs.mkdir(outWorkspacePath, { recursive: true });
      await fs.mkdir(path.join(outWorkspacePath, "agents"), { recursive: true });
      await fs.mkdir(path.join(outWorkspacePath, "flows"), { recursive: true });
    } catch (err: any) {
      console.error(`Failed to create output directories for workspace ${workspace}:`, err);
      continue;
    }

    // 1. Agent Builder Data
    const agentBuilderDataPath = path.join(workspacePath, "sections", "agent-builder", "data.json");
    console.log(`Trying to read agent builder data from: ${agentBuilderDataPath}`);

    try {
      const agentDataRaw = await fs.readFile(agentBuilderDataPath, "utf8");
      console.log(`Successfully read data.json for agent-builder (length: ${agentDataRaw.length})`);

      const agentData = JSON.parse(agentDataRaw);
      console.log(`Parsed agent data keys:`, Object.keys(agentData));

      // Extract agents into individual files inside /agents
      if (agentData.savedAgentConfigs) {
        console.log(
          `Found ${agentData.savedAgentConfigs.length} savedAgentConfigs. Extracting to /agents...`,
        );
        for (const agent of agentData.savedAgentConfigs) {
          if (!agent || !agent.id) {
            console.warn("Agent is missing an ID, skipping:", agent);
            continue;
          }

          const agentDir = path.join(outWorkspacePath, "agents", agent.id);
          await fs.mkdir(agentDir, { recursive: true });

          // extract SlashAction mappings
          let slashActions = [];
          if (agent.attachedFlows && Array.isArray(agent.attachedFlows)) {
            slashActions = agent.attachedFlows.map((f: any) => f.slashAction).filter(Boolean);
          }

          // create instruct.md
          let instructContent = "---\n";
          instructContent += `name: "${agent.name || agent.id}"\n`;
          if (agent.description) {
            instructContent += `description: "${agent.description.replace(/"/g, '\\"')}"\n`;
          }
          instructContent += `tools: ${JSON.stringify((agent.enabledTools || []).map((t: any) => t.toolId || t.name || t))}\n`;
          instructContent += `enabledKnowledgeFields: ${JSON.stringify(agent.enabledKnowledgeFields || [])}\n`;
          instructContent += "---\n\n";
          instructContent += agent.mainInstruction || "";

          if (slashActions.length > 0) {
            instructContent += "\n\n";
            for (const action of slashActions) {
              instructContent += `<slash_action name="${action.name}" description="${action.description}" flowId="${action.flowId}">\n`;
              instructContent += `/${action.actionId}\n`;
              instructContent += `</slash_action>\n`;
            }
          }

          await fs.writeFile(path.join(agentDir, "instruct.md"), instructContent);

          // create config.json
          const configData = {
            runtimeFields: agent.runtimeFields || [],
          };
          await fs.writeFile(
            path.join(agentDir, "config.json"),
            JSON.stringify(configData, null, 2),
          );

          // create values.json
          await fs.writeFile(
            path.join(agentDir, "values.json"),
            JSON.stringify(agent.formValues || {}, null, 2),
          );

          console.log(`  -> Wrote agent directory ${agentDir}`);
        }
      } else {
        console.log(`No savedAgentConfigs found in ${workspace}.`);
      }

      if (agentData.toolLibrary && Array.isArray(agentData.toolLibrary)) {
        console.log(`Writing package.json for ${workspace}...`);
        const dependencies: Record<string, string> = {};
        for (const tool of agentData.toolLibrary) {
          if (tool.package && tool.version) {
            dependencies[tool.package] = tool.version;
          }
        }
        const packageJson = {
          name: workspace,
          version: "1.0.0",
          description: `Workspace: ${workspace}`,
          dependencies,
        };
        await fs.writeFile(
          path.join(outWorkspacePath, "package.json"),
          JSON.stringify(packageJson, null, 2),
        );
      }
    } catch (err: any) {
      console.warn(`Could not process agent builder data for ${workspace}: ${err.message}`);
    }

    // 2. Flow Builder Data
    const flowBuilderDataPath = path.join(workspacePath, "sections", "flow-builder", "data.json");
    console.log(`Trying to read flow builder data from: ${flowBuilderDataPath}`);

    try {
      const flowDataRaw = await fs.readFile(flowBuilderDataPath, "utf8");
      console.log(`Successfully read data.json for flow-builder (length: ${flowDataRaw.length})`);

      const flowData = JSON.parse(flowDataRaw);

      const outFlowsDir = path.join(outWorkspacePath, "flows");
      await fs.mkdir(outFlowsDir, { recursive: true });

      if (flowData.flows && Array.isArray(flowData.flows)) {
        console.log(`Found ${flowData.flows.length} flows. Extracting to /flows...`);
        for (const flow of flowData.flows) {
          const flowDir = path.join(outFlowsDir, flow.id);
          await fs.mkdir(flowDir, { recursive: true });

          const flowTasks = flowData.tasks
            ? flowData.tasks.filter((t: any) => t.flowId === flow.id)
            : [];

          let indexMd = "---\n";
          const { description, ...flowConfig } = flow;
          for (const key of Object.keys(flowConfig)) {
            const val = flowConfig[key];
            if (typeof val === "string") {
              indexMd += `${key}: "${val.replace(/"/g, '\\"')}"\n`;
            } else {
              indexMd += `${key}: ${JSON.stringify(val)}\n`;
            }
          }
          indexMd += "---\n\n";
          indexMd += description || "";

          await fs.writeFile(path.join(flowDir, "index.md"), indexMd);

          for (const task of flowTasks) {
            const config = task.config || {};
            let md = "---\n";
            md += `description: "${(task.description || "").replace(/"/g, '\\"')}"\n`;
            if (task.type) md += `type: "${task.type}"\n`;

            const { taskInstructions, outputSchema, targetFieldName, ...restConfig } = config;

            for (const key of Object.keys(restConfig)) {
              const val = restConfig[key];
              if (typeof val === "string") {
                md += `${key}: "${val.replace(/"/g, '\\"')}"\n`;
              } else {
                md += `${key}: ${JSON.stringify(val)}\n`;
              }
            }

            md += "---\n\n";
            md += taskInstructions || "";

            if (outputSchema) {
              if (targetFieldName) {
                md += `\n\n<output target="${targetFieldName.replace(/"/g, '\\"')}">\n`;
              } else {
                md += "\n\n<output>\n";
              }
              md += JSON.stringify(outputSchema, null, 2) + "\n";
              md += "</output>\n";
            }

            const safeName = (task.name || "task").replace(/[/\\?%*:|"<>]/g, "-");
            const fileName = `${task.order !== undefined ? task.order : 0}.${safeName}.md`;

            await fs.writeFile(path.join(flowDir, fileName), md);
          }

          console.log(
            `  -> Wrote flow directory ${flowDir} with ${flowTasks.length} tasks as markdown`,
          );
        }
      } else {
        console.log(`No flows found in ${workspace}.`);
      }
    } catch (err: any) {
      console.warn(`Could not process flow builder data for ${workspace}: ${err.message}`);
    }

    // 3. Prompt Library Data
    const promptLibraryDataPath = path.join(
      workspacePath,
      "sections",
      "prompt-library",
      "data.json",
    );
    console.log(`Trying to read prompt library data from: ${promptLibraryDataPath}`);

    try {
      const promptDataRaw = await fs.readFile(promptLibraryDataPath, "utf8");
      console.log(
        `Successfully read data.json for prompt-library (length: ${promptDataRaw.length})`,
      );

      const promptData = JSON.parse(promptDataRaw);
      const promptLibOutPath = path.join(outWorkspacePath, "knowledge");

      async function processPromptNode(node: any) {
        // Ensure the path is relative and doesn't contain leading slash for path.join
        let relativePath = node.path || "";
        if (relativePath.startsWith("/")) {
          relativePath = relativePath.slice(1);
        }

        const nodeAbsPath = path.join(promptLibOutPath, relativePath);

        if (node.type === "directory") {
          await fs.mkdir(nodeAbsPath, { recursive: true });

          // Save directory config if it exists
          if (node.config && Object.keys(node.config).length > 0) {
            await fs.writeFile(
              path.join(nodeAbsPath, "config.json"),
              JSON.stringify(node.config, null, 2),
            );
          }

          // Process children
          if (Array.isArray(node.children)) {
            for (const child of node.children) {
              await processPromptNode(child);
            }
          }
        } else if (node.type === "file") {
          // Ensure the parent directory exists
          await fs.mkdir(path.dirname(nodeAbsPath), { recursive: true });

          let content = "";
          if (node.frontmatter && Object.keys(node.frontmatter).length > 0) {
            content += "---\n";
            for (const [k, v] of Object.entries(node.frontmatter)) {
              content += `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}\n`;
            }
            content += "---\n\n";
          }

          content += node.content || "";
          await fs.writeFile(nodeAbsPath, content);
        }
      }

      if (promptData.fileSystem) {
        console.log(`Found fileSystem. Extracting prompt library...`);
        await processPromptNode(promptData.fileSystem);
        console.log(`  -> Wrote prompt library to ${promptLibOutPath}`);
      }
    } catch (err: any) {
      console.warn(`Could not process prompt library data for ${workspace}: ${err.message}`);
    }

    // 4. Agent Runtime Data
    const agentRuntimeDataPath = path.join(workspacePath, "sections", "agent-runtime", "data.json");
    console.log(`Trying to read agent runtime data from: ${agentRuntimeDataPath}`);

    try {
      const runtimeDataRaw = await fs.readFile(agentRuntimeDataPath, "utf8");
      console.log(
        `Successfully read data.json for agent-runtime (length: ${runtimeDataRaw.length})`,
      );

      const runtimeData = JSON.parse(runtimeDataRaw);

      if (runtimeData.conversations && Array.isArray(runtimeData.conversations)) {
        console.log(`Found ${runtimeData.conversations.length} conversations. Extracting...`);
        for (const conversation of runtimeData.conversations) {
          if (!conversation.agentId) {
            console.warn("Conversation is missing agentId, skipping:", conversation.id);
            continue;
          }

          const convDir = path.join(
            outWorkspacePath,
            "agents",
            conversation.agentId,
            "conversations",
          );
          await fs.mkdir(convDir, { recursive: true });

          const convFileName = `${conversation.id}.json`;
          await fs.writeFile(
            path.join(convDir, convFileName),
            JSON.stringify(conversation, null, 2),
          );
          console.log(`  -> Wrote conversation ${conversation.id} to ${convDir}`);
        }
      } else {
        console.log(`No conversations found in ${workspace}.`);
      }
    } catch (err: any) {
      console.warn(`Could not process agent runtime data for ${workspace}: ${err.message}`);
    }
  }

  console.log("Migration complete!");
}

migrate().catch((err) => {
  console.error("Unhandled error during migration:", err);
});
