// One-time Atlas setup for Slay the Choir. Safe to re-run.
//   node --env-file=.env.local scripts/atlas-setup.mjs
// 1. Atlas Search index "usernames" (autocomplete) for the leaderboard's find-a-climber box.
// 2. $jsonSchema validators on users / runs / fights, so a malformed write fails at the database
//    instead of landing on the leaderboard. Needs dbAdmin (collMod) on the database; the app's
//    own readWrite user can't do this step, so run it with an admin connection string if needed:
//      MONGODB_ADMIN_URI=mongodb+srv://… node --env-file=.env.local scripts/atlas-setup.mjs
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_ADMIN_URI || process.env.MONGODB_URI;
if (!uri) throw new Error('Set MONGODB_URI (or MONGODB_ADMIN_URI) first.');
const client = await new MongoClient(uri).connect();
const db = client.db(process.env.MONGODB_DB ?? 'slay-the-choir');

const num = { bsonType: ['int', 'long', 'double'] };
const count = { ...num, minimum: 0 };
const INSTRUMENTS = ['trumpet', 'clarinet', 'tenorSax', 'altoSax', 'flute', 'frenchHorn']; // lib/content.ts

const validators = {
  users: {
    bsonType: 'object',
    required: ['_id', 'username', 'passwordHash', 'createdAt', 'xp'],
    properties: {
      _id: { bsonType: 'string', pattern: '^[a-z0-9_]{3,16}$' },
      username: { bsonType: 'string', pattern: '^[A-Za-z0-9_]{3,16}$' },
      passwordHash: { bsonType: 'string', minLength: 50 },
      createdAt: { bsonType: 'date' },
      xp: count,
      lastRunAt: { bsonType: 'date' },
      tavernBuff: { bsonType: 'bool' },
    },
  },
  runs: {
    bsonType: 'object',
    required: ['userId', 'runId', 'username', 'instrument', 'score', 'floor', 'victory', 'accuracy', 'notesHit', 'notesTotal', 'cardsLanded', 'cardsFailed', 'encoresLanded', 'rounds', 'endedBy', 'weekKey', 'at'],
    properties: {
      userId: { bsonType: 'string' },
      runId: { bsonType: 'string', pattern: '^[A-Za-z0-9-]{1,64}$' },
      username: { bsonType: 'string' },
      instrument: { enum: INSTRUMENTS },
      score: count,
      floor: { ...num, minimum: 0, maximum: 18 },
      victory: { bsonType: 'bool' },
      accuracy: { ...num, minimum: 0, maximum: 100 },
      notesHit: count,
      notesTotal: count,
      cardsLanded: count,
      cardsFailed: count,
      encoresLanded: count,
      rounds: count,
      durationMs: count,
      endedBy: { enum: ['loss', 'victory'] },
      weekKey: { bsonType: 'string', pattern: '^\\d{4}-W\\d{2}$' },
      at: { bsonType: 'date' },
    },
  },
  fights: {
    bsonType: 'object',
    required: ['enemyId', 'won', 'accuracy', 'rounds', 'instrument', 'at'],
    properties: {
      enemyId: { bsonType: 'string' },
      won: { bsonType: 'bool' },
      accuracy: { ...num, minimum: 0, maximum: 100 },
      rounds: { ...num, minimum: 1, maximum: 50 },
      instrument: { enum: INSTRUMENTS },
      userId: { bsonType: ['string', 'null'] },
      at: { bsonType: 'date' },
    },
  },
};

// 1. Search index
const users = db.collection('users');
const existing = await users.listSearchIndexes('usernames').toArray();
if (existing.length) console.log(`search index "usernames": already there (${existing[0].status})`);
else {
  await users.createSearchIndex({
    name: 'usernames',
    definition: { mappings: { dynamic: false, fields: { username: [{ type: 'autocomplete', tokenization: 'edgeGram', minGrams: 1, maxGrams: 16, foldDiacritics: true }, { type: 'string' }] } } },
  });
  console.log('search index "usernames": created (builds in the background, usually under a minute)');
}

// 2. Validators
for (const [name, schema] of Object.entries(validators)) {
  try {
    await db.command({ collMod: name, validator: { $jsonSchema: schema }, validationLevel: 'strict', validationAction: 'error' });
    console.log(`validator ${name}: applied`);
  } catch (e) {
    if (e?.codeName === 'NamespaceNotFound') {
      await db.createCollection(name, { validator: { $jsonSchema: schema } });
      console.log(`validator ${name}: collection created with validator`);
    } else if (e?.codeName === 'Unauthorized') {
      console.log(`validator ${name}: SKIPPED, this user lacks collMod. Re-run with MONGODB_ADMIN_URI (a dbAdmin user).`);
    } else throw e;
  }
}
await client.close();
