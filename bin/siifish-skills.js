#!/usr/bin/env node

import { homedir } from 'node:os';
import { REPO_ROOT, detectAgents, loadRepository } from '../src/library.js';
import { displayPath, getStatus, installSkills, uninstallSkills } from '../src/manager.js';

const HELP = `siifish-skills - manage a personal cross-agent skill library

Usage:
  siifish-skills detect
  siifish-skills list
  siifish-skills status [--agent <id>]
  siifish-skills install [--agent <id>] [--dry-run] [--dev]
  siifish-skills uninstall [--agent <id>]

Options:
  --agent <id>  Limit the command to a detected Agent; repeatable
  --dry-run     Preview installation without writing files
  --dev         Link directly to this Git checkout
  -h, --help    Show this help
`;

function parseArguments(argv) {
  const args = [...argv];
  const command = args.shift();
  const options = { requestedAgents: [], dryRun: false, dev: false };
  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '--agent') {
      const id = args.shift();
      if (!id || id.startsWith('-')) throw new Error('--agent requires an ID');
      options.requestedAgents.push(id);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--dev') {
      options.dev = true;
    } else if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return { command, options };
}

function printInstallResult(result, home) {
  if (result.dryRun) console.log('Dry run; no files were changed.');
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
  for (const item of result.skipped) console.log(`skip ${item.skill}: ${item.reason}`);
  for (const action of result.actions) {
    if (action.type === 'copy') {
      console.log(`${result.dryRun ? 'would copy' : 'copied'} ${action.skill} -> ${displayPath(action.target, home)}`);
    } else if (action.type === 'link') {
      console.log(`${result.dryRun ? 'would link' : 'linked'} ${action.agent}/${action.skill} -> ${displayPath(action.source, home)}`);
    } else if (action.type === 'noop') {
      console.log(`ok ${action.agent}/${action.skill}`);
    }
  }
  for (const conflict of result.conflicts) {
    console.error(`conflict ${conflict.agent}/${conflict.skill}: ${conflict.reason} (${displayPath(conflict.target, home)})`);
  }
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  if (!command || options.help || command === 'help') {
    console.log(HELP);
    return;
  }

  const home = homedir();
  if (command === 'detect') {
    if (options.requestedAgents.length || options.dryRun || options.dev) throw new Error('detect does not accept these options');
    const agents = await detectAgents({ home, repoRoot: REPO_ROOT });
    if (agents.length === 0) console.log('No supported Agents detected.');
    for (const agent of agents) console.log(`${agent.id}\t${agent.name}\t${displayPath(agent.configPath, home)}`);
    return;
  }

  if (command === 'list') {
    if (options.requestedAgents.length || options.dryRun || options.dev) throw new Error('list does not accept these options');
    const { skills } = await loadRepository(REPO_ROOT);
    for (const skill of skills) {
      const dependencies = [
        ...(skill.requires?.applications || []),
        ...(skill.requires?.commands || []),
      ].join(', ') || '-';
      console.log(`${skill.name}\t${(skill.platforms || ['all']).join(',')}\t${dependencies}`);
    }
    return;
  }

  if (command === 'status') {
    if (options.dryRun || options.dev) throw new Error('status accepts only --agent');
    const result = await getStatus({ home, repoRoot: REPO_ROOT, requestedAgents: options.requestedAgents });
    if (result.agents.length === 0) console.log('No supported Agents detected.');
    for (const entry of result.entries) {
      console.log(`${entry.agent}\t${entry.skill}\t${entry.status}\t${displayPath(entry.target, home)}`);
      if (entry.reason) console.log(`  ${entry.reason}`);
    }
    return;
  }

  if (command === 'install') {
    const result = await installSkills({
      home,
      repoRoot: REPO_ROOT,
      requestedAgents: options.requestedAgents,
      dryRun: options.dryRun,
      dev: options.dev,
    });
    printInstallResult(result, home);
    if (result.conflicts.length > 0) process.exitCode = 2;
    return;
  }

  if (command === 'uninstall') {
    if (options.dryRun || options.dev) throw new Error('uninstall accepts only --agent');
    const result = await uninstallSkills({ home, repoRoot: REPO_ROOT, requestedAgents: options.requestedAgents });
    for (const action of result.actions) {
      console.log(`${action.type === 'unlink' ? 'unlinked' : 'already absent'} ${action.agent}/${action.skill}`);
    }
    for (const conflict of result.conflicts) {
      console.error(`preserved ${conflict.agent}/${conflict.skill}: ${conflict.reason}`);
    }
    if (result.conflicts.length > 0) process.exitCode = 2;
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
});
