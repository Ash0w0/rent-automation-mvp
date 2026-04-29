require('dotenv').config();

const { makeId } = require('../src/lib/rentEngine');
const { issueTemporaryCredential } = require('../server/credentialService');
const { buildPhoneCandidates, normalizePhoneNumber } = require('../server/phoneUtils');
const { createSheetsPrismaClient } = require('../server/sheetsPrisma');

function parseArgs(argv) {
  const output = {};

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = item.slice(2).split('=');
    const value = inlineValue !== undefined ? inlineValue : argv[index + 1];
    output[rawKey] = value;

    if (inlineValue === undefined) {
      index += 1;
    }
  }

  return output;
}

function printTemporaryCode({ owner, temporaryCode, expiresAt }) {
  console.log('Owner credential ready.');
  console.log(`Name: ${owner.name}`);
  console.log(`Phone: ${owner.phone}`);
  console.log(`Temporary invite code: ${temporaryCode}`);
  console.log(`Expires: ${expiresAt}`);
  console.log('Share this once. The owner must set a new password after login.');
}

async function findOwnerByPhone(store, phone) {
  return store.owner.findFirst({
    where: {
      phone: {
        in: buildPhoneCandidates(phone),
      },
    },
  });
}

async function createOwner(store, args) {
  const name = String(args.name || '').trim();
  const phone = normalizePhoneNumber(args.phone);

  if (!name || !phone) {
    throw new Error('Usage: npm run owner:create -- --name "Owner Name" --phone "8002822133"');
  }

  const existingOwner = await findOwnerByPhone(store, phone);
  const owner = existingOwner
    ? await store.owner.update({
        where: { id: existingOwner.id },
        data: { name, phone },
      })
    : await store.owner.create({
        data: {
          id: makeId('owner'),
          name,
          phone,
        },
      });

  const temporaryCredential = await issueTemporaryCredential(store, {
    role: 'owner',
    phone: owner.phone,
    ownerId: owner.id,
  });

  printTemporaryCode({
    owner,
    temporaryCode: temporaryCredential.temporaryCode,
    expiresAt: temporaryCredential.expiresAt,
  });
}

async function resetOwnerPassword(store, args) {
  const phone = normalizePhoneNumber(args.phone);
  const owner = await findOwnerByPhone(store, phone);

  if (!owner) {
    throw new Error('Owner not found for that phone number.');
  }

  const temporaryCredential = await issueTemporaryCredential(store, {
    role: 'owner',
    phone: owner.phone,
    ownerId: owner.id,
  });

  printTemporaryCode({
    owner,
    temporaryCode: temporaryCredential.temporaryCode,
    expiresAt: temporaryCredential.expiresAt,
  });
}

async function main() {
  const command = process.argv[2];
  const args = parseArgs(process.argv.slice(3));
  const store = createSheetsPrismaClient({
    autoInit: true,
  });

  try {
    if (command === 'create') {
      await createOwner(store, args);
      return;
    }

    if (command === 'reset-password') {
      await resetOwnerPassword(store, args);
      return;
    }

    throw new Error(
      'Usage: node scripts/owners.js <create|reset-password> --phone "8002822133" [--name "Owner Name"]',
    );
  } finally {
    await store.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = {
  createOwner,
  resetOwnerPassword,
};
