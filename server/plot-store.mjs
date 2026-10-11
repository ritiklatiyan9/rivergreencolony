import { randomBytes } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export class ApiError extends Error {
  constructor(status, message, code = 'INVALID_REQUEST') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const normalizeId = (value = '') => String(value).replace(/[()\s.\-]/g, '').toUpperCase();
const statuses = new Set(['AVAILABLE', 'RESERVED', 'SOLD', 'UNKNOWN']);
const textFields = { dimensions: 120, facing: 80, block: 40, plot_type: 80, notes: 1000 };
const numericFields = { area_sqft: 1e9, area_sqm: 1e9, total_price: 1e12, price_per_sqft: 1e12 };
const allowedFields = new Set(['plot_number', 'status', 'updated_at', ...Object.keys(textFields), ...Object.keys(numericFields)]);

export async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function atomicJson(path, data, mode = 0o600) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomBytes(8).toString('hex')}.tmp`;
  let file;
  try {
    file = await open(temporary, 'wx', mode);
    await file.writeFile(`${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await file.sync();
    await file.close();
    file = null;
    await rename(temporary, path);
    // Flush the renamed directory entry where the host filesystem supports it.
    let directory;
    try {
      directory = await open(dirname(path), 'r');
      await directory.sync();
    } catch {
      // Some filesystems cannot fsync a directory. The rename has committed;
      // do not report failure and leave in-memory records behind the saved file.
    } finally { await directory?.close(); }
  } finally {
    await file?.close();
    await unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
}

export function validatePatch(input, canonicalId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'Plot details must be a JSON object.');
  const patch = {};
  for (const [field, value] of Object.entries(input)) {
    if (!allowedFields.has(field)) throw new ApiError(400, `The field ${field} is not a public plot field.`);
    if (field === 'plot_number') {
      if (normalizeId(value) !== normalizeId(canonicalId)) throw new ApiError(400, 'The plot number does not match the selected plot.');
      continue;
    }
    if (field === 'updated_at') continue; // Server timestamps always win on imports.
    if (field === 'status') {
      if (typeof value !== 'string' || !statuses.has(value.toUpperCase())) throw new ApiError(400, 'Choose Available, Reserved, Sold or Unknown.');
      patch.status = value.toUpperCase();
    } else if (value === null || value === '') {
      patch[field] = null;
    } else if (field in textFields) {
      if (typeof value !== 'string' || value.length > textFields[field] || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
        throw new ApiError(400, `${field} must be text of ${textFields[field]} characters or fewer.`);
      }
      patch[field] = value.trim();
    } else {
      if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) throw new ApiError(400, `${field} must be a nonnegative number.`);
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0 || number > numericFields[field]) throw new ApiError(400, `${field} must be a nonnegative number below ${numericFields[field]}.`);
      patch[field] = number;
    }
  }
  return patch;
}

export async function createPlotStore({ stateDir, plotIds, clock = () => Date.now() }) {
  const canonical = new Map(plotIds.map((id) => [normalizeId(id), id]));
  if (!plotIds.length || canonical.size !== plotIds.length) throw new Error('Canonical plot IDs must be nonempty and unique.');
  const path = join(stateDir, 'plot-records.json');
  const loaded = await readJson(path);
  let updatedAt = loaded?.updatedAt || null;
  let records = new Map();
  let queue = Promise.resolve();

  function getId(value) {
    const id = canonical.get(normalizeId(value));
    if (!id) throw new ApiError(404, 'This plot is not on the official River Green layout.', 'PLOT_NOT_FOUND');
    return id;
  }
  if (loaded) {
    if (loaded.version !== 1 || !Array.isArray(loaded.overrides) || loaded.overrides.length > plotIds.length) throw new Error('Persistent plot records have an invalid format.');
    for (const record of loaded.overrides) {
      const id = getId(record.plot_number);
      if (records.has(id)) throw new Error('Persistent plot records contain duplicate IDs.');
      const patch = validatePatch(record, id);
      records.set(id, { plot_number: id, status: 'UNKNOWN', ...patch, updated_at: record.updated_at || updatedAt });
    }
  }

  const publicState = () => ({ success: true, overrides: [...records.values()].map((record) => ({ ...record })), updatedAt });
  const serial = (task) => {
    const operation = queue.then(task);
    queue = operation.catch(() => {});
    return operation;
  };
  const save = async (next, timestamp) => {
    await atomicJson(path, { version: 1, updatedAt: timestamp, overrides: [...next.values()] });
    records = next;
    updatedAt = timestamp;
  };
  const merge = (previous, id, patch, timestamp) => {
    // A null marker deliberately clears an official-source detail. Omitting it
    // would make the public source value reappear when clients merge records.
    // Removing the entire override is the separate DELETE/reset operation.
    return { plot_number: id, status: 'UNKNOWN', ...previous, ...patch, updated_at: timestamp };
  };

  return {
    getId,
    publicState,
    upsert(value, input) {
      const id = getId(value);
      const patch = validatePatch(input, id);
      return serial(async () => {
        const timestamp = new Date(clock()).toISOString();
        const next = new Map(records);
        const plot = merge(next.get(id), id, patch, timestamp);
        next.set(id, plot);
        await save(next, timestamp);
        return { success: true, plot: { ...plot }, updatedAt };
      });
    },
    remove(value) {
      const id = getId(value);
      return serial(async () => {
        const next = new Map(records);
        next.delete(id);
        await save(next, new Date(clock()).toISOString());
        return publicState();
      });
    },
    importRecords(input) {
      if (!input || !Array.isArray(input.overrides) || input.overrides.length > plotIds.length) throw new ApiError(400, `Import must contain an overrides array with at most ${plotIds.length} plots.`);
      const prepared = new Map();
      for (const item of input.overrides) {
        const id = getId(item?.plot_number);
        if (prepared.has(id)) throw new ApiError(400, 'Imported plot numbers must be unique.');
        prepared.set(id, validatePatch(item, id));
      }
      return serial(async () => {
        const timestamp = new Date(clock()).toISOString();
        const next = new Map(records);
        for (const [id, patch] of prepared) next.set(id, merge(next.get(id), id, patch, timestamp));
        await save(next, timestamp);
        return publicState();
      });
    },
    flush: () => queue,
  };
}
