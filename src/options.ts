import { AsyncLocalStorage } from "async_hooks";
import type { BelongsToOptions } from "sequelize";

export interface Options {
  exclude: string[];
  revisionAttribute: string;
  revisionIdAttribute: string;
  revisionModel: string;
  revisionChangeModel: string;
  enableRevisionChangeModel: boolean;
  UUID: boolean;
  underscored: boolean;
  underscoredAttributes: boolean;
  userModel?: string;
  userIdAttribute: string;
  enableCompression: boolean;
  enableMigration: boolean;
  enableStrictDiff: boolean;
  asyncLocalStorage?: AsyncLocalStorage<unknown>;
  metaDataFields?: { [key: string]: boolean };
  metaDataAsyncLocalStorage?: AsyncLocalStorage<Record<string, unknown>>;
  tableName?: string;
  changeTableName?: string;
  belongsToUserOptions?: BelongsToOptions;
  useJsonDataType: boolean;
}

export type SequelizeRevisionOptions = Partial<Options>;

export const defaultOptions: Options = {
  exclude: ["id", "createdAt", "updatedAt", "deletedAt", "created_at", "updated_at", "deleted_at", "revision"],
  revisionAttribute: "revision",
  revisionIdAttribute: "revisionId",
  revisionModel: "Revision",
  revisionChangeModel: "RevisionChange",
  enableRevisionChangeModel: false,
  UUID: false,
  underscored: false,
  underscoredAttributes: false,
  userModel: undefined,
  userIdAttribute: "userId",
  enableCompression: false,
  enableMigration: false,
  enableStrictDiff: true,
  asyncLocalStorage: undefined,
  metaDataFields: undefined,
  metaDataAsyncLocalStorage: undefined,
  tableName: undefined,
  changeTableName: undefined,
  belongsToUserOptions: undefined,
  useJsonDataType: true,
};
