import fs from 'fs/promises';
import path from 'path';

const IN_DIR = path.resolve('./mock_data_new');
const OUT_DIR = path.resolve('./mock_data_reverted');

// basic YAML parser for simple key-value frontmatter where values are strings, arrays or objects (JSON represented)
function parseFrontmatter(content: string) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
    if (!match) return { frontmatter: {}, body: content };

    const fmText = match[1];
    const body = match[2];
    const frontmatter: any = {};

    const lines = fmText.split('\n');
    let currentKey = '';
    let currentVal = '';
    let isParsingObject = false;

    for (const line of lines) {
        if (!line.trim()) continue;
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) {
            // Probably continuation of something, or malformed
            continue;
        }

        const key = line.slice(0, colonIdx).trim();
        let val = line.slice(colonIdx + 1).trim();

        if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1).replace(/\\"/g, '"');
            frontmatter[key] = val;
        } else if (val.startsWith('[') || val.startsWith('{')) {
            try {
                frontmatter[key] = JSON.parse(val);
            } catch (e) {
                frontmatter[key] = val; // fallback
            }
        } else if (val === 'true') {
            frontmatter[key] = true;
        } else if (val === 'false') {
            frontmatter[key] = false;
        } else if (!isNaN(Number(val))) {
            frontmatter[key] = Number(val);
        } else {
            frontmatter[key] = val;
        }
    }

    return { frontmatter, body };
}

async function revert() {
    console.log('Starting un-migration script...');
    console.log(`IN_DIR resolved to: ${IN_DIR}`);
    console.log(`OUT_DIR resolved to: ${OUT_DIR}`);

    try {
        await fs.mkdir(OUT_DIR, { recursive: true });
    } catch (err: any) {
        console.error(`Failed to create OUT_DIR:`, err);
        return;
    }

    let workspaces: string[];
    try {
        workspaces = await fs.readdir(IN_DIR);
    } catch (err: any) {
        console.error(`Failed to read IN_DIR:`, err);
        return;
    }

    for (const workspace of workspaces) {
        if (workspace === '.DS_Store') continue;

        const inWorkspacePath = path.join(IN_DIR, workspace);
        const outWorkspacePath = path.join(OUT_DIR, workspace);

        try {
            const stat = await fs.stat(inWorkspacePath);
            if (!stat.isDirectory()) continue;
        } catch {
            continue;
        }

        console.log(`\n--- Reverting workspace: ${workspace} ---`);

        const sectionsDir = path.join(outWorkspacePath, 'sections');
        await fs.mkdir(sectionsDir, { recursive: true });

        // 1. Agent Builder Data
        console.log(`Reverting agents for ${workspace}...`);
        const agentBuilderData: any = {
            savedAgentConfigs: [],
            toolLibrary: []
        };

        const inAgentsDir = path.join(inWorkspacePath, 'agents');
        try {
            const agents = await fs.readdir(inAgentsDir);
            for (const agentId of agents) {
                if (agentId === '.DS_Store') continue;
                const agentDir = path.join(inAgentsDir, agentId);
                const stat = await fs.stat(agentDir);
                if (!stat.isDirectory()) continue;

                let instructContent = '';
                try {
                    instructContent = await fs.readFile(path.join(agentDir, 'instruct.md'), 'utf8');
                } catch { /* ignore */ }

                let configData: any = {};
                try {
                    configData = JSON.parse(await fs.readFile(path.join(agentDir, 'config.json'), 'utf8'));
                } catch { /* ignore */ }

                let valuesData: any = {};
                try {
                    valuesData = JSON.parse(await fs.readFile(path.join(agentDir, 'values.json'), 'utf8'));
                } catch { /* ignore */ }

                const { frontmatter, body } = parseFrontmatter(instructContent);

                const agent: any = {
                    id: agentId,
                    name: frontmatter.name || agentId,
                    description: frontmatter.description || '',
                    enabledTools: frontmatter.tools || [],
                    selectedDomains: frontmatter.selectedDomains || [],
                    emptyFieldsForRuntime: configData.emptyFieldsForRuntime || [],
                    formValues: valuesData
                };

                // extract slash actions from body
                let mainInstruction = body;
                const attachedFlows: any[] = [];

                const slashRegex = /<slash_action name="([^"]*)" description="([^"]*)" flowId="([^"]*)">\n\/([^\n]+)\n<\/slash_action>/g;
                let match;
                while ((match = slashRegex.exec(body)) !== null) {
                    attachedFlows.push({
                        slashAction: {
                            name: match[1],
                            description: match[2],
                            flowId: match[3],
                            actionId: match[4]
                        }
                    });
                }
                mainInstruction = mainInstruction.replace(slashRegex, '').trim();
                agent.mainInstruction = mainInstruction;

                if (attachedFlows.length > 0) {
                    agent.attachedFlows = attachedFlows;
                }

                agentBuilderData.savedAgentConfigs.push(agent);
            }
        } catch (err) {
            console.log(`No agents directory found or error reading: ${err}`);
        }

        // Package.json dependencies to toolLibrary
        try {
            const pkgJson = JSON.parse(await fs.readFile(path.join(inWorkspacePath, 'package.json'), 'utf8'));
            if (pkgJson.dependencies) {
                for (const [pkg, version] of Object.entries(pkgJson.dependencies)) {
                    agentBuilderData.toolLibrary.push({ package: pkg, version });
                }
            }
        } catch { /* ignore */ }

        if (agentBuilderData.savedAgentConfigs.length > 0 || agentBuilderData.toolLibrary.length > 0) {
            const agentBuilderOutDir = path.join(sectionsDir, 'agent-builder');
            await fs.mkdir(agentBuilderOutDir, { recursive: true });
            await fs.writeFile(path.join(agentBuilderOutDir, 'data.json'), JSON.stringify(agentBuilderData, null, 2));
        }


        // 2. Flow Builder Data
        console.log(`Reverting flows for ${workspace}...`);
        const flowBuilderData: any = {
            flows: [],
            tasks: []
        };

        const inFlowsDir = path.join(inWorkspacePath, 'flows');
        try {
            const flows = await fs.readdir(inFlowsDir);
            for (const flowId of flows) {
                if (flowId === '.DS_Store') continue;
                const flowDir = path.join(inFlowsDir, flowId);
                const stat = await fs.stat(flowDir);
                if (!stat.isDirectory()) continue;

                let indexContent = '';
                try {
                    indexContent = await fs.readFile(path.join(flowDir, 'index.md'), 'utf8');
                } catch { /* ignore */ }

                const { frontmatter: flowFrontmatter, body: flowDesc } = parseFrontmatter(indexContent);
                const flow: any = { ...flowFrontmatter, id: flowId, description: flowDesc.trim() };
                flowBuilderData.flows.push(flow);

                const files = await fs.readdir(flowDir);
                for (const file of files) {
                    if (file === 'index.md' || file === '.DS_Store') continue;

                    const m = file.match(/^(\d+)\.(.+)\.md$/);
                    if (!m) continue;

                    const order = parseInt(m[1], 10);
                    const safeName = m[2];

                    let taskContent = '';
                    try {
                        taskContent = await fs.readFile(path.join(flowDir, file), 'utf8');
                    } catch { continue; }

                    const { frontmatter: taskFrontmatter, body: taskBody } = parseFrontmatter(taskContent);

                    const task: any = {
                        flowId,
                        order,
                        name: safeName.replace(/-/g, ' '), // roughly reverse the replace
                        description: taskFrontmatter.description || '',
                        type: taskFrontmatter.type || ''
                    };

                    const { description, type, ...restConfig } = taskFrontmatter;
                    let taskInstructions = taskBody;
                    let outputSchema = undefined;
                    let targetFieldName = undefined;

                    const outputRegex = /<output(?: target="([^"]*)")?>\n([\s\S]*?)\n<\/output>/;
                    const outMatch = taskBody.match(outputRegex);
                    if (outMatch) {
                        targetFieldName = outMatch[1];
                        try {
                            outputSchema = JSON.parse(outMatch[2]);
                        } catch { /* ignore */ }
                        taskInstructions = taskInstructions.replace(outputRegex, '').trim();
                    } else {
                        taskInstructions = taskInstructions.trim();
                    }

                    task.config = {
                        ...restConfig,
                        taskInstructions
                    };

                    if (outputSchema) {
                        task.config.outputSchema = outputSchema;
                    }
                    if (targetFieldName) {
                        task.config.targetFieldName = targetFieldName;
                    }

                    flowBuilderData.tasks.push(task);
                }
            }
        } catch (err) {
            console.log(`No flows directory found or error reading: ${err}`);
        }

        if (flowBuilderData.flows.length > 0) {
            // Sort tasks by order
            flowBuilderData.tasks.sort((a: any, b: any) => {
                if (a.flowId !== b.flowId) return a.flowId.localeCompare(b.flowId);
                return a.order - b.order;
            });

            const flowBuilderOutDir = path.join(sectionsDir, 'flow-builder');
            await fs.mkdir(flowBuilderOutDir, { recursive: true });
            await fs.writeFile(path.join(flowBuilderOutDir, 'data.json'), JSON.stringify(flowBuilderData, null, 2));
        }

        // 3. Prompt Library Data
        console.log(`Reverting prompt library for ${workspace}...`);
        const inKnowledgeDir = path.join(inWorkspacePath, 'knowledge');
        let promptLibSystem: any = null;

        async function readPromptNode(dir: string, relativeParent: string = '/', itemRelName: string = ''): Promise<any> {
            try {
                const stat = await fs.stat(dir);
                if (!stat.isDirectory()) return null;
            } catch { return null; }

            let config = {};
            try {
                config = JSON.parse(await fs.readFile(path.join(dir, 'config.json'), 'utf8'));
            } catch { /* ignore */ }

            const node: any = {
                id: relativeParent === '/' ? 'root' : 'dir-' + itemRelName,
                name: relativeParent === '/' ? 'Prompt Library' : itemRelName,
                type: 'directory',
                path: relativeParent,
                children: []
            };
            if (Object.keys(config).length > 0) {
                node.config = config;
            }

            const items = await fs.readdir(dir);
            // Sort items intuitively
            items.sort();

            for (const item of items) {
                if (item === 'config.json' || item === '.DS_Store') continue;
                const fullPath = path.join(dir, item);
                const stat = await fs.stat(fullPath);

                const itemRelPath = (relativeParent === '/' ? '/' : relativeParent + '/') + item;

                if (stat.isDirectory()) {
                    const childNode = await readPromptNode(fullPath, itemRelPath, item);
                    if (childNode) node.children.push(childNode);
                } else if (stat.isFile()) {
                    let fileContent = await fs.readFile(fullPath, 'utf8');
                    const { frontmatter, body } = parseFrontmatter(fileContent);

                    const idMatch = item.match(/^(.*?)\.md$/);
                    const fileId = idMatch ? 'frag-' + idMatch[1] : 'frag-' + item;

                    const fileNode: any = {
                        id: fileId,
                        name: item,
                        type: 'file',
                        path: itemRelPath,
                    };

                    if (Object.keys(frontmatter).length > 0) {
                        fileNode.frontmatter = frontmatter;
                    }

                    fileNode.content = body;

                    node.children.push(fileNode);
                }
            }

            // sort children by frontmatter order if present
            node.children.sort((a: any, b: any) => {
                const orderA = a.frontmatter?.order ?? (a.type === 'directory' ? -1 : Number.MAX_SAFE_INTEGER);
                const orderB = b.frontmatter?.order ?? (b.type === 'directory' ? -1 : Number.MAX_SAFE_INTEGER);
                if (orderA !== orderB) return orderA - orderB;
                return a.name.localeCompare(b.name);
            });

            return node;
        }

        try {
            promptLibSystem = await readPromptNode(inKnowledgeDir);
        } catch (err) {
            console.log(`No knowledge dir found or error: ${err}`);
        }

        if (promptLibSystem) {
            const promptLibOutDir = path.join(sectionsDir, 'prompt-library');
            await fs.mkdir(promptLibOutDir, { recursive: true });
            await fs.writeFile(path.join(promptLibOutDir, 'data.json'), JSON.stringify({ fileSystem: promptLibSystem }, null, 2));
        }
    }

    console.log('Un-migration complete!');
}

revert().catch(err => {
    console.error('Unhandled error during un-migration:', err);
});
