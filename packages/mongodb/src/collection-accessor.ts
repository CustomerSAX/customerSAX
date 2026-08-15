/**
 * Shared repository primitives for the CSA MongoDB data layer.
 *
 * Every domain repository (clients, projects, smtp-profiles, users) used to
 * hand-roll the same three things: an `ObjectId` parse guard, a "find one by
 * id" read, and "update/delete one by id" writes that translate a Mongo
 * result into a plain boolean. That boilerplate was copy-pasted across four
 * files, which is exactly the kind of drift risk this module removes.
 *
 * `createCollectionAccessor()` wraps a collection-resolver thunk (typically one
 * of the getters in `admin/db.ts`, which resolve collection/db names from env
 * at call time) and returns a small, consistently-behaving set of id-keyed
 * helpers. Repositories keep their domain-specific query/validation logic and
 * delegate only the mechanical `_id` plumbing here.
 *
 * Design notes:
 *  - The accessor takes a `() => Promise<Collection<T>>` thunk rather than a
 *    `(collectionName, { dbName })` pair so it composes directly with the
 *    existing env-driven collection getters without duplicating that env logic.
 *  - `updateById`/`deleteById` return `matchedCount > 0` / `deletedCount > 0`,
 *    preserving the exact boolean semantics the repositories exposed before.
 *  - `extraFilter` lets tenant-scoped repositories (e.g. smtp-profiles, which
 *    key every operation on `{ _id, clientId }`) reuse the same helpers.
 *
 * This module is internal to `@csa/mongodb`; it is intentionally not re-exported
 * from the package index and forms no part of the public API surface.
 */

import { ObjectId, type Collection, type Document, type Filter } from "mongodb";

/**
 * Parses a hex string into an `ObjectId`, returning `null` for malformed input
 * instead of throwing. Used as the "is this a valid id?" guard that every
 * id-keyed repository operation performs before touching the database.
 */
export function toObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

/** Consistent id-keyed helpers shared by the domain repositories. */
export interface CollectionAccessor<T extends Document> {
  /** Resolves the underlying collection (delegates to the provided thunk). */
  collection(): Promise<Collection<T>>;
  /**
   * Finds a single document by its `_id`. Returns `null` when the id is
   * malformed or no document matches. `extraFilter` is ANDed with `_id` for
   * tenant-scoped lookups.
   */
  findById(id: string, extraFilter?: Filter<T>): Promise<T | null>;
  /**
   * Applies a Mongo update document (`{ $set }`, `{ $set, $unset }`, …) to the
   * document with the given `_id`. Returns `true` when a document matched.
   */
  updateById(id: string, update: Document, extraFilter?: Filter<T>): Promise<boolean>;
  /**
   * Deletes the document with the given `_id`. Returns `true` when a document
   * was actually removed.
   */
  deleteById(id: string, extraFilter?: Filter<T>): Promise<boolean>;
}

/**
 * Builds a {@link CollectionAccessor} over the collection produced by
 * `getCollection`. The thunk is invoked on every call so env-driven collection
 * resolution and connection caching behave exactly as they did inline.
 */
export function createCollectionAccessor<T extends Document = Document>(
  getCollection: () => Promise<Collection<T>>
): CollectionAccessor<T> {
  function scopedFilter(oid: ObjectId, extraFilter?: Filter<T>): Filter<T> {
    return { _id: oid, ...(extraFilter ?? {}) } as Filter<T>;
  }

  return {
    collection: getCollection,

    async findById(id, extraFilter) {
      const oid = toObjectId(id);
      if (!oid) return null;
      const col = await getCollection();
      return (await col.findOne(scopedFilter(oid, extraFilter))) as T | null;
    },

    async updateById(id, update, extraFilter) {
      const oid = toObjectId(id);
      if (!oid) return false;
      const col = await getCollection();
      const result = await col.updateOne(scopedFilter(oid, extraFilter), update as never);
      return result.matchedCount > 0;
    },

    async deleteById(id, extraFilter) {
      const oid = toObjectId(id);
      if (!oid) return false;
      const col = await getCollection();
      const result = await col.deleteOne(scopedFilter(oid, extraFilter));
      return result.deletedCount > 0;
    },
  };
}
