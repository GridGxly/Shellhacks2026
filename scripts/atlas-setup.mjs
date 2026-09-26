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
const noteResult = { bsonType: 'object', required: ['index', 'status', 'playedMidi', 'onsetOffsetMs'], properties: { index: { ...count, maximum: 63 }, status: { enum: ['hit', 'wrong', 'silent'] }, playedMidi: { bsonType: ['int', 'long', 'double', 'null'], minimum: 0, maximum: 127 }, onsetOffsetMs: { bsonType: ['int', 'long', 'double', 'null'], minimum: -2000, maximum: 2000 } } };
const feedback = { bsonType: 'object', required: ['source', 'castor', 'pollux'], properties: { source: { enum: ['gemini', 'offline'] }, castor: { bsonType: 'string', maxLength: 400 }, pollux: { bsonType: 'string', maxLength: 400 } } };
const summary = { bsonType: 'object', required: ['pitches', 'rhythm', 'sources'], properties: { pitches: { bsonType: 'array', minItems: 12, maxItems: 12, items: { bsonType: 'object', required: ['attempts', 'hits'], properties: { attempts: count, hits: count } } }, rhythm: { bsonType: 'object', required: ['early', 'steady', 'late', 'unknown'], properties: { early: count, steady: count, late: count, unknown: count } }, sources: { bsonType: 'object', required: ['adventure', 'tavern', 'training'], properties: { adventure: count, tavern: count, training: count } } } };
const music = { bsonType: 'object', required: ['id', 'title', 'tempo', 'beatsPerBar', 'bars', 'type', 'notes'], properties: { id: { bsonType: 'string', maxLength: 80 }, title: { bsonType: 'string', maxLength: 100 }, tempo: { ...num, minimum: 60, maximum: 120 }, beatsPerBar: { enum: [4] }, bars: { enum: [2, 4] }, type: { enum: ['scale', 'rhythm', 'chord', 'encore'] }, notes: { bsonType: 'array', minItems: 3, maxItems: 32, items: { bsonType: 'object', required: ['midi', 'startBeat', 'durBeats'], properties: { midi: { ...num, minimum: 60, maximum: 84 }, startBeat: { ...count, maximum: 16 }, durBeats: { ...num, minimum: .5, maximum: 4 } } } } } };
const plan = { bsonType: ['object', 'null'], required: ['id', 'source', 'regiment', 'focusSummary', 'exercises'], properties: { id: { bsonType: 'string', maxLength: 64 }, source: { enum: ['gemini', 'offline'] }, fallbackReason: { enum: ['not_configured', 'unavailable', 'invalid_response'] }, regiment: { bsonType: 'object', required: ['mode', 'instrument', 'concertKey', 'spelling', 'focus', 'tempo'], properties: { mode: { enum: ['recommended', 'custom'] }, instrument: { enum: INSTRUMENTS }, concertKey: { ...num, minimum: 0, maximum: 11 }, spelling: { enum: ['sharps', 'flats'] }, focus: { enum: ['pitch', 'rhythm', 'mixed'] }, tempo: { ...num, minimum: 60, maximum: 120 } } }, focusSummary: { bsonType: 'string', maxLength: 180 }, exercises: { bsonType: 'array', minItems: 4, maxItems: 4, items: { bsonType: 'object', required: ['id', 'role', 'goal', 'music'], properties: { id: { bsonType: 'string', maxLength: 80 }, role: { enum: ['drill', 'final'] }, goal: { bsonType: 'string', maxLength: 120 }, music } } } } };

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
      trainingBuff: { bsonType: 'bool' },
    },
  },
  trainingDaily: {
    bsonType: 'object', required: ['_id', 'userId', 'day', 'state', 'createdAt', 'updatedAt', 'expiresAt'],
    properties: {
      _id: { bsonType: 'string' }, userId: { bsonType: 'string' }, day: { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, createdAt: { bsonType: 'date' }, updatedAt: { bsonType: 'date' }, expiresAt: { bsonType: 'date' },
      state: { bsonType: 'object', required: ['day', 'resetsAt', 'serverNow', 'revision', 'plan', 'status', 'nextIndex', 'receipts', 'claimed', 'pendingBuff', 'weaknesses'], properties: {
        day: { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, resetsAt: count, serverNow: count, revision: count, plan, status: { enum: ['ready', 'active', 'paused', 'complete'] }, nextIndex: { ...num, minimum: 0, maximum: 4 }, claimed: { bsonType: 'bool' }, pendingBuff: { bsonType: 'bool' }, weaknesses: summary,
        activeAttempt: { bsonType: 'object', required: ['id', 'exerciseId', 'startAt'], properties: { id: { bsonType: 'string', maxLength: 80 }, exerciseId: { bsonType: 'string', maxLength: 80 }, startAt: count } }, finalFeedback: feedback,
        receipts: { bsonType: 'array', maxItems: 4, items: { bsonType: 'object', required: ['exerciseId', 'attemptId', 'hits', 'total', 'notes', 'simulated', 'feedback', 'completedAt'], properties: { exerciseId: { bsonType: 'string', maxLength: 80 }, attemptId: { bsonType: 'string', maxLength: 80 }, hits: { ...count, maximum: 32 }, total: { ...num, minimum: 3, maximum: 32 }, notes: { bsonType: 'array', minItems: 3, maxItems: 32, items: noteResult }, simulated: { bsonType: 'bool' }, feedback, completedAt: count } } },
      } },
    },
  },
  practiceProfiles: { bsonType: 'object', required: ['_id', 'summary', 'updatedAt'], properties: { _id: { bsonType: 'string' }, summary, updatedAt: { bsonType: 'date' } } },
  performanceEvents: { bsonType: 'object', required: ['_id', 'userId', 'source', 'attemptId', 'digest', 'instrument', 'total', 'hits', 'simulated', 'at'], properties: { _id: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' }, userId: { bsonType: 'string' }, source: { enum: ['adventure', 'tavern', 'training'] }, attemptId: { bsonType: 'string', maxLength: 160 }, digest: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' }, instrument: { enum: INSTRUMENTS }, total: { ...num, minimum: 1, maximum: 64 }, hits: { ...count, maximum: 64 }, simulated: { bsonType: 'bool' }, at: { bsonType: 'date' } } },
  rewardClaims: { bsonType: 'object', required: ['_id', 'userId', 'runId', 'tavern', 'training', 'tips', 'createdAt'], properties: { _id: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' }, userId: { bsonType: 'string' }, runId: { bsonType: 'string', pattern: '^[A-Za-z0-9-]{1,64}$' }, tavern: { bsonType: 'bool' }, training: { bsonType: 'bool' }, tips: { enum: [0, 120, 240] }, createdAt: { bsonType: 'date' } } },
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
await Promise.all([
  db.collection('trainingDaily').createIndex({ userId: 1, day: 1 }, { unique: true }),
  db.collection('trainingDaily').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  db.collection('performanceEvents').createIndex({ userId: 1, source: 1, attemptId: 1 }, { unique: true }),
  db.collection('rewardClaims').createIndex({ userId: 1, runId: 1 }, { unique: true }),
]);
await client.close();
