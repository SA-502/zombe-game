# ASHFALL shared project

This workspace contains one game and shared Blender deliveries. Before editing, read `PROJECT.md`, `coordination/PROTOCOL.md`, and both status JSON files in `coordination/`. The human assigned one agent to Blender and visual assets, and the primary agent to code, audio, integration, testing, and publishing. Keep that assignment.

- Code has one source of truth: `outputs/house-game`. Blender deliveries have one location: `outputs/blender-delivery`. Do not create a second runtime or move existing files without updating all project references.
- All newly authored visual assets, materials, and animation clips must come from Blender. Runtime integration, animation playback, dynamic UI text, and audio belong to code.
- Blender agent owns `coordination/blender-status.json` and `coordination/blender-log.md`. Code agent owns `coordination/code-status.json`, `coordination/code-log.md`, and `coordination/integration-queue.json`. Each agent reads both statuses, but writes its own status/log. Never report another agent's work as verified without checking it.
- At the start of a batch record the task and claimed paths. At handoff record completed files, remaining work, required support, and validation. Use new versioned asset files; do not overwrite the deployed world's `district.json` or the other agent's files.
- Run `node coordination/update-project-index.mjs` after status updates. This updates `PROJECT.md` from the two statuses and integration queue; it does not edit game files or Blender deliveries.
- Existing site identity and access must remain unchanged. The code agent follows the Sites skill for source synchronization and publication. Existing user authorization covers publishing requested game updates to the existing URL; do not introduce another conversational approval gate.
- This file coordinates the shared workspace; it does not imply the other agent has received a chat message. Read the shared files rather than assuming shared chat history.

For immediate testing of supported exports, read `coordination/LIVE-PREVIEW.md`. The local game at `http://127.0.0.1:8124/?delivery=1` reads the delivery folder directly, and `http://127.0.0.1:8124/__review/index.html` reviews source meshes. Saving completed JSON exports refreshes the local preview; saving only a `.blend` file does not. These tools do not automatically publish production or implement new gameplay schemas. Reuse the running local server. Blender agent should review `outputs/ashfall-blender-v2-integration-feedback.md` before the next architecture batch.
