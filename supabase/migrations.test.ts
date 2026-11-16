// @vitest-environment node
/**
 * [Req 4.1, 4.2, 10.3, 10.6, 11.1, 11.4] The database migrations, run against a real Postgres
 * (PGlite, with pgvector and pg_trgm) set up like a new Supabase project.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asRole, embedding, migratedDatabase } from './__fixtures__/db';

let db: PGlite;

type Business = {
  name: string;
  category: string;
  suburb: string;
  phone: string;
  dial: string;
  description: string;
  is_spirit?: boolean;
  axis: number | null;
};

const businesses: Business[] = [
  {
    name: 'Ndlovu Plumbing',
    category: 'Plumber',
    suburb: 'Edenvale',
    phone: '011 000 1001',
    dial: '61001',
    description: 'Burst geysers fixed day and night',
    axis: 0,
  },
  {
    name: 'Rand Gate Motors',
    category: 'Gate motors',
    suburb: 'Randburg',
    phone: '011 000 1002',
    dial: '61002',
    description: 'Gate motor repairs and batteries',
    axis: 1,
  },
  {
    name: 'Kempton Geyser Doctor',
    category: 'Plumber',
    suburb: 'Kempton Park',
    phone: '011 000 1003',
    dial: '61003',
    description: 'Geyser installs and repairs',
    axis: 0,
  },
  {
    name: 'The Midnight Locksmith',
    category: 'Locksmith',
    suburb: 'Edenvale',
    phone: '011 000 1004',
    dial: '31301',
    description: 'Opens any door, even the ones that should stay shut',
    is_spirit: true,
    axis: 2,
  },
  {
    name: 'Unembedded Panel Beaters',
    category: 'Panel beater',
    suburb: 'Germiston',
    phone: '011 000 1005',
    dial: '61005',
    description: 'Dents and scratches',
    axis: null,
  },
];

const residents = [
  {
    surname: 'Botha',
    initials: 'J',
    suburb: 'Edenvale',
    phone: '011 000 2001',
    dial: '72001',
    axis: 10,
  },
  {
    surname: 'van der Merwe',
    initials: 'A',
    suburb: 'Roodepoort',
    phone: '011 000 2002',
    dial: '72002',
    axis: 11,
  },
  {
    surname: 'Nkosi',
    initials: 'T',
    suburb: 'Soweto',
    phone: '011 000 2003',
    dial: '72003',
    axis: 12,
  },
];

beforeAll(async () => {
  db = await migratedDatabase();
  for (const b of businesses) {
    await db.query(
      `insert into businesses (name, category, suburb, address, phone, dial_number, hours, description, is_spirit, embedding)
       values ($1, $2, $3, '1 Main Road', $4, $8, 'Mon to Fri 8 to 5', $5, $6, $7)`,
      [
        b.name,
        b.category,
        b.suburb,
        b.phone,
        b.description,
        b.is_spirit ?? false,
        b.axis === null ? null : embedding(b.axis),
        b.dial,
      ],
    );
  }
  for (const r of residents) {
    await db.query(
      `insert into residents (surname, initials, suburb, address, phone, dial_number, embedding)
       values ($1, $2, $3, '2 Side Street', $4, $6, $5)`,
      [r.surname, r.initials, r.suburb, r.phone, embedding(r.axis), r.dial],
    );
  }
}, 60_000);

describe('row level security', () => {
  it('[Req 10.6] is on for every table', async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r' order by relname`,
    );
    expect(rows.map((r) => r.relname)).toEqual(['businesses', 'rate_limits', 'residents']);
    for (const row of rows) expect(row.relrowsecurity, row.relname).toBe(true);
  });

  it('[Req 10.6] keeps the public key out of every table, for reading and for writing', async () => {
    for (const role of ['anon', 'authenticated']) {
      for (const table of ['businesses', 'residents', 'rate_limits']) {
        await expect(
          asRole(db, role, () => db.query(`select * from ${table}`)),
          `${role} reads ${table}`,
        ).rejects.toThrow();
      }
      await expect(
        asRole(db, role, () => db.query(`insert into rate_limits (id) values ('ip:x:1')`)),
      ).rejects.toThrow();
    }
  });

  it('[Req 10.6] gives the public key no right to run any database function, and the server the right to run them all', async () => {
    const functions = [
      'increment_rate_limit(text, text, timestamptz, date)',
      'lookup_number(text)',
      'search_businesses(extensions.vector, text, text, boolean, boolean, int)',
      'search_residents(extensions.vector, text, text, text, int)',
    ];
    for (const fn of functions) {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const { rows } = await db.query<{ allowed: boolean }>(
          `select has_function_privilege($1, $2, 'execute') as allowed`,
          [role, fn],
        );
        expect(rows[0]?.allowed, `${role} on ${fn}`).toBe(role === 'service_role');
      }
    }
  });

  it('[Req 10.6] lets only the server, with the secret key, run the database functions', async () => {
    const calls = [
      `select increment_rate_limit('ip:abc:1', 'search_count')`,
      `select * from lookup_number('0110001001')`,
      `select * from search_businesses('${embedding(0)}', 'geyser')`,
      `select * from search_residents('${embedding(10)}', 'Botha')`,
    ];
    for (const sql of calls) {
      for (const role of ['anon', 'authenticated']) {
        await expect(
          asRole(db, role, () => db.query(sql)),
          `${role}: ${sql}`,
        ).rejects.toThrow(/permission denied/);
      }
      await expect(asRole(db, 'service_role', () => db.query(sql))).resolves.toBeDefined();
    }
  });
});

describe('increment_rate_limit', () => {
  const bump = async (id: string, field: string) =>
    (
      await asRole(db, 'service_role', () =>
        db.query<{ n: number }>(`select increment_rate_limit($1, $2) as n`, [id, field]),
      )
    ).rows[0]?.n;

  it('[Req 10.1] counts the first request of the hour as 1, then 2, then 3', async () => {
    expect(await bump('ip:first:100', 'operator_count')).toBe(1);
    expect(await bump('ip:first:100', 'operator_count')).toBe(2);
    expect(await bump('ip:first:100', 'operator_count')).toBe(3);
  });

  it('[Req 10.2, 10.3] keeps each counter separate, and each window separate', async () => {
    expect(await bump('ip:sep:100', 'operator_count')).toBe(1);
    expect(await bump('ip:sep:100', 'search_count')).toBe(1);
    expect(await bump('ip:sep:101', 'operator_count')).toBe(1);
    expect(await bump('global:2026-11-15', 'claude_count')).toBe(1);
    expect(await bump('global:2026-11-15', 'claude_count')).toBe(2);
  });

  it('refuses a counter it does not know, so a typo cannot pass silently', async () => {
    await expect(bump('ip:typo:1', 'opertor_count')).rejects.toThrow();
  });

  it('never stores the raw IP: it keeps only the hash from the id', async () => {
    await bump('ip:0123456789abcdef:7', 'search_count');
    const { rows } = await db.query<{ ip_hash: string }>(
      `select ip_hash from rate_limits where id = 'ip:0123456789abcdef:7'`,
    );
    expect(rows[0]?.ip_hash).toBe('0123456789abcdef');
  });
});

describe('search_businesses', () => {
  type Row = { name: string; is_spirit: boolean; score: number };
  const search = async (args: string) =>
    (
      await asRole(db, 'service_role', () =>
        db.query<Row>(`select name, is_spirit, score from search_businesses(${args})`),
      )
    ).rows;

  it('[Req 4.1] ranks by meaning, words and suburb together', async () => {
    const rows = await search(`'${embedding(0)}', 'geyser', 'Edenvale'`);
    expect(rows[0]?.name).toBe('Ndlovu Plumbing');
    expect(rows[1]?.name).toBe('Kempton Geyser Doctor');
  });

  it('[Req 4.1] lets the suburb decide between two equally good matches', async () => {
    const rows = await search(`'${embedding(0)}', 'geyser', 'Kempton Park'`);
    expect(rows[0]?.name).toBe('Kempton Geyser Doctor');
  });

  it('[Req 7.2] leaves spirit listings out unless asked for', async () => {
    expect((await search(`'${embedding(2)}', 'locksmith'`)).some((r) => r.is_spirit)).toBe(false);
    const spooky = await search(`'${embedding(2)}', 'locksmith', null, true`);
    expect(spooky[0]?.name).toBe('The Midnight Locksmith');
  });

  it('[Req 7.3] returns only spirit listings for 1313', async () => {
    const rows = await search(`'${embedding(0)}', '', null, false, true`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.is_spirit)).toBe(true);
  });

  it("[Req 11.7] returns each listing's dial number for the book", async () => {
    const { rows } = await asRole(db, 'service_role', () =>
      db.query<{ name: string; dial_number: string }>(
        `select name, dial_number from search_businesses('${embedding(0)}', 'geyser', 'Edenvale')`,
      ),
    );
    expect(rows[0]).toEqual({ name: 'Ndlovu Plumbing', dial_number: '61001' });
  });

  it('[Req 4.4] returns at most the number asked for, 10 by default', async () => {
    expect(await search(`'${embedding(0)}', 'repairs', null, true, false, 2`)).toHaveLength(2);
    expect((await search(`'${embedding(0)}', 'repairs'`)).length).toBeLessThanOrEqual(10);
  });

  it('never ranks a listing with no embedding above a real match, and never returns a null score', async () => {
    const rows = await search(`'${embedding(0)}', 'geyser'`);
    expect(rows[0]?.name).not.toBe('Unembedded Panel Beaters');
    for (const r of rows) expect(r.score).not.toBeNull();
  });
});

describe('search_residents', () => {
  type Row = { surname: string; score: number };
  const search = async (args: string) =>
    (
      await asRole(db, 'service_role', () =>
        db.query<Row>(`select surname, score from search_residents(${args})`),
      )
    ).rows;

  it('[Req 4.2] finds the exact surname first', async () => {
    expect((await search(`'${embedding(99)}', 'Botha'`))[0]?.surname).toBe('Botha');
  });

  it('[Req 4.2] finds a surname spelt a little differently', async () => {
    expect((await search(`'${embedding(99)}', 'Bota'`))[0]?.surname).toBe('Botha');
    expect((await search(`'${embedding(99)}', 'Vandermerwe'`))[0]?.surname).toBe('van der Merwe');
  });

  it('[Req 4.2] uses the suburb to break a tie', async () => {
    expect((await search(`'${embedding(99)}', 'Nkosie', null, 'Soweto'`))[0]?.surname).toBe(
      'Nkosi',
    );
  });
});

describe('lookup_number', () => {
  type Row = { kind: string; name: string };
  const lookup = async (digits: string) =>
    (
      await asRole(db, 'service_role', () =>
        db.query<Row>(`select kind, name from lookup_number($1)`, [digits]),
      )
    ).rows;

  it('[Req 11.2] finds a listing by its short dial number too, and says what that number is', async () => {
    expect(await lookup('61001')).toEqual([{ kind: 'business', name: 'Ndlovu Plumbing' }]);
    expect(await lookup('72003')).toEqual([{ kind: 'resident', name: 'Nkosi T' }]);
    const { rows } = await asRole(db, 'service_role', () =>
      db.query<{ dial_number: string }>(`select dial_number from lookup_number('0110001001')`),
    );
    expect(rows[0]?.dial_number).toBe('61001');
  });

  it('[Req 11.1] refuses a dial number that is not five digits starting 2 to 9, or starts like 666, 911 or 999', async () => {
    for (const dial of ['10230', '13130', '01234', '1234', '612345', '66601', '91100', '99900']) {
      await expect(
        db.query(
          `insert into businesses (name, category, suburb, address, phone, dial_number, hours, description)
           values ('Bad Dial', 'Plumber', 'Edenvale', '3 Road', '011 000 1099', $1, 'Never', 'Must not exist')`,
          [dial],
        ),
        dial,
      ).rejects.toThrow(/check constraint|not-null/);
    }
  });

  it('[Req 11.1] refuses two listings with the same dial number', async () => {
    await expect(
      db.query(
        `insert into businesses (name, category, suburb, address, phone, dial_number, hours, description)
         values ('Copy Dial', 'Plumber', 'Edenvale', '3 Road', '011 000 1098', '61001', 'Never', 'Same dial')`,
      ),
    ).rejects.toThrow(/unique|duplicate/);
  });

  it('[Req 11.1] needs a dial number on every listing', async () => {
    await expect(
      db.query(
        `insert into businesses (name, category, suburb, address, phone, hours, description)
         values ('No Dial', 'Plumber', 'Edenvale', '3 Road', '011 000 1097', 'Never', 'No dial number')`,
      ),
    ).rejects.toThrow(/not-null|null value/);
  });

  it('[Req 11.2, 11.4] finds the business or the household behind a dialled number', async () => {
    expect(await lookup('0110001001')).toEqual([{ kind: 'business', name: 'Ndlovu Plumbing' }]);
    expect(await lookup('0110002003')).toEqual([{ kind: 'resident', name: 'Nkosi T' }]);
  });

  it('[Req 11.8] finds nothing for a number nobody has', async () => {
    expect(await lookup('0110009999')).toEqual([]);
    expect(await lookup('1023')).toEqual([]);
  });

  it('[Req 6.3, 11.1] refuses any listing number outside the fictional 011 000 xxxx range', async () => {
    for (const phone of ['011 123 4567', '082 000 1234', '011 000 123', '1023']) {
      await expect(
        db.query(
          `insert into businesses (name, category, suburb, address, phone, dial_number, hours, description)
           values ('Real Number', 'Plumber', 'Edenvale', '3 Road', $1, '69999', 'Never', 'Must not exist')`,
          [phone],
        ),
        phone,
      ).rejects.toThrow(/check constraint/);
    }
  });

  it('[Req 11.1] refuses a second listing with the same number, however it is spaced', async () => {
    await expect(
      db.query(
        `insert into businesses (name, category, suburb, address, phone, dial_number, hours, description)
         values ('Copycat', 'Plumber', 'Edenvale', '3 Road', '0110001001', '69998', 'Never', 'Same number')`,
      ),
    ).rejects.toThrow(/unique|duplicate/);
    await expect(
      db.query(
        `insert into residents (surname, initials, suburb, address, phone, dial_number)
         values ('Dlamini', 'S', 'Soweto', '4 Street', '011-000-2001', '79999')`,
      ),
    ).rejects.toThrow(/unique|duplicate/);
  });
});
