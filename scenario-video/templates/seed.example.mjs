// seed — the data one recording needs, keyed by its run id, so two recordings never share rows.
//
//   node guide-videos/seed.mjs --run <run id>        (make.ts runs it with the settings' seed command)
//
// This example seeds through the app's own HTTP api, which is the safest route: the app's rules
// apply to the seeded rows exactly as to a user's. Replace the calls with whatever this project
// really has — its api, its seed script with a flag, or a database client — and keep three things:
//   1. every row it creates carries the run id in a name, so the video and the scenario can find it;
//   2. any failure exits non-zero with a message — make.ts then records nothing;
//   3. it prints what it created, one line each — that output is kept in seed.log beside the video.
const runFlag = process.argv.indexOf('--run');
const runId = runFlag === -1 ? process.env.SCENARIO_RUN_ID : process.argv[runFlag + 1];
if (!runId) {
  console.error('seed: no run id — pass --run <id> or set SCENARIO_RUN_ID');
  process.exit(1);
}
const api = process.env.SEED_API_ADDRESS ?? 'http://localhost:3000';
const adminToken = process.env.SEED_ADMIN_TOKEN;
if (!adminToken) {
  console.error('seed: SEED_ADMIN_TOKEN is not set — the seed signs its calls with it');
  process.exit(1);
}

async function call(method, path, body) {
  const answer = await fetch(`${api}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await answer.text();
  if (!answer.ok) throw new Error(`${method} ${path} answered ${answer.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

try {
  const team = await call('POST', '/teams', { name: `Team ${runId}`, owner: 'dana@example.com' });
  console.log(`seed: team "${team.name}" (${team.id}) owned by dana@example.com`);
} catch (thrown) {
  console.error(`seed: FAILED — ${thrown instanceof Error ? thrown.message : String(thrown)}`);
  process.exit(1);
}
