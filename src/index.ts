import { forEach, map, filter, keys, omit, omitBy, pickBy } from "lodash";
import {
  Sequelize,
  ModelAttributes,
  INTEGER,
  TEXT,
  JSONB,
  STRING,
  UUID,
  UUIDV4,
} from "sequelize";
import { ModelDefined } from "sequelize/types/model";
import { createNamespace, getNamespace, Namespace } from "cls-hooked";
import * as jsdiff from "diff";
import helpers from "./helpers";
import { Options, SequelizeRevisionOptions, defaultOptions } from "./options";

export class SequelizeRevision {
  private options: Options;
  private ns: Namespace | undefined;
  private log: (...data: any[]) => void;
  private postgres: boolean;
  private failHard = false;

  constructor(
    private sequelize: Sequelize,
    sequelizeRevisionOptions?: SequelizeRevisionOptions
  ) {
    this.options = <Options>{
      ...defaultOptions,
      ...sequelizeRevisionOptions,
    };

    if (this.options.continuationNamespace) {
      this.ns = getNamespace(this.options.continuationNamespace);
      if (!this.ns) {
        this.ns = createNamespace(this.options.continuationNamespace);
      }
    }

    if (this.options.underscoredAttributes) {
      helpers.toUnderscored(this.options.defaultAttributes);
    }

    this.postgres = this.sequelize.getDialect() === "postgres";
    this.log = this.options.log || console.log;
  }

  // Return defineModels()
  public async defineModels(): Promise<{
    Revision: ModelDefined<any, any>;
    RevisionChange?: ModelDefined<any, any>;
  }> {
    // Attributes for RevisionModel
    let attributes: ModelAttributes = {
      model: {
        type: TEXT,
        allowNull: false,
      },
      document: {
        type: this.postgres ? JSONB : TEXT,
        allowNull: false,
      },
      [this.options.defaultAttributes.documentId]: {
        type: this.options.UUID ? INTEGER : UUID,
        allowNull: false,
      },
      operation: STRING(7),
      [this.options.revisionAttribute]: {
        type: INTEGER,
        allowNull: false,
      },
    };

    if (this.options.UUID) {
      attributes.id = {
        primaryKey: true,
        type: UUID,
        defaultValue: UUIDV4,
      };
    }

    if (this.options.debug) {
      this.log("attributes", attributes);
    }

    // Revision model
    const Revision = this.sequelize.define(
      this.options.revisionModel,
      attributes,
      {
        underscored: this.options.underscored,
        tableName: this.options.tableName,
      }
    );

    if (this.options.userModel) {
      Revision.belongsTo(this.sequelize.model(this.options.userModel), {
        foreignKey: this.options.userModelAttribute,
        ...this.options.belongsToUserOptions,
      });
    }

    if (this.options.enableMigration) {
      await Revision.sync();
    }

    if (this.options.enableRevisionChangeModel) {
      // Attributes for RevisionChangeModel
      attributes = {
        path: {
          type: TEXT,
          allowNull: false,
        },
        document: {
          type: this.postgres ? JSONB : TEXT,
          allowNull: false,
        },
        diff: {
          type: this.postgres ? JSONB : TEXT,
          allowNull: false,
        },
      };

      if (this.options.UUID) {
        attributes.id = {
          primaryKey: true,
          type: UUID,
          defaultValue: UUIDV4,
        };
      }
      // RevisionChange model
      const RevisionChange = this.sequelize.define(
        this.options.revisionChangeModel,
        attributes,
        {
          underscored: this.options.underscored,
        }
      );

      // Set associations
      Revision.hasMany(RevisionChange, {
        foreignKey: this.options.defaultAttributes.revisionId,
        constraints: false,
      });

      RevisionChange.belongsTo(Revision, {
        foreignKey: this.options.defaultAttributes.revisionId,
      });

      if (this.options.enableMigration) {
        await RevisionChange.sync();
      }

      return { Revision, RevisionChange };
    }

    return { Revision };
  }

  // order in which sequelize processes the hooks
  // (1)
  // beforeBulkCreate(instances, options, fn)
  // beforeBulkDestroy(instances, options, fn)
  // beforeBulkUpdate(instances, options, fn)
  // (2)
  // beforeValidate(instance, options, fn)
  // (-)
  // validate
  // (3)
  // afterValidate(instance, options, fn)
  // - or -
  // validationFailed(instance, options, error, fn)
  // (4)
  // beforeCreate(instance, options, fn)
  // beforeDestroy(instance, options, fn)
  // beforeUpdate(instance, options, fn)
  // (-)
  // create
  // destroy
  // update
  // (5)
  // afterCreate(instance, options, fn)
  // afterDestroy(instance, options, fn)
  // afterUpdate(instance, options, fn)
  // (6)
  // afterBulkCreate(instances, options, fn)
  // afterBulkDestroy(instances, options, fn)
  // afterBulkUpdate(instances, options, fn)

  // Extend model prototype with "trackRevision" function
  // Call model.trackRevision() to enable revisions for model
  public async trackRevision(model: ModelDefined<any, any>): Promise<void> {
    if (this.options.debug) {
      this.log("Enabling paper trail on", model.name);
    }

    model.rawAttributes[this.options.revisionAttribute] = {
      type: INTEGER,
      defaultValue: 0,
    };

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    model.refreshAttributes();

    if (this.options.enableMigration) {
      const tableName = model.getTableName();

      const queryInterface = this.sequelize.getQueryInterface();

      const attributes = await queryInterface.describeTable(tableName);
      if (!attributes[this.options.revisionAttribute]) {
        if (this.options.debug) {
          this.log("adding revision attribute to the database");
        }

        try {
          await queryInterface.addColumn(
            tableName,
            this.options.revisionAttribute,
            {
              type: INTEGER,
              defaultValue: 0,
            }
          );
        } catch (err) {
          this.log("something went really wrong..", err);
        }
      }
    }

    model.addHook("beforeCreate", this.createBeforeHook("create"));
    model.addHook("beforeDestroy", this.createBeforeHook("destroy"));
    model.addHook("beforeUpdate", this.createBeforeHook("update"));
    model.addHook("afterCreate", this.createAfterHook("create"));
    model.addHook("afterDestroy", this.createAfterHook("destroy"));
    model.addHook("afterUpdate", this.createAfterHook("update"));

    // create association
    model.hasMany(this.sequelize.models[this.options.revisionModel], {
      foreignKey: this.options.defaultAttributes.documentId,
      constraints: false,
      scope: {
        model: model.name,
      },
    });
  }

  /**
   * Throw exceptions when the user identifier from CLS is not set or if the
   * revisionAttribute was not loaded on the model.
   */
  enableFailHard() {
    this.failHard = true;
  }

  private createBeforeHook(operation: string) {
    return (instance: any, opt: any) => {
      if (this.options.debug) {
        this.log("beforeHook called");
        this.log("instance:", instance);
        this.log("opt:", opt);
      }

      if (opt.noRevision) {
        if (this.options.debug) {
          this.log("noRevision opt: is true, not logging");
        }
        return;
      }

      const destroyOperation = operation === "destroy";

      let previousVersion: any = {};
      let currentVersion: any = {};
      if (!destroyOperation && this.options.enableCompression) {
        forEach(opt.defaultFields, (a) => {
          previousVersion[a] = instance._previousDataValues[a];
          currentVersion[a] = instance.dataValues[a];
        });
      } else {
        previousVersion = instance._previousDataValues;
        currentVersion = instance.dataValues;
      }
      // Supported nested models.
      previousVersion = omitBy(
        previousVersion,
        (i) => i != null && typeof i === "object" && !(i instanceof Date)
      );
      previousVersion = omit(previousVersion, this.options.exclude);

      currentVersion = omitBy(
        currentVersion,
        (i) => i != null && typeof i === "object" && !(i instanceof Date)
      );
      currentVersion = omit(currentVersion, this.options.exclude);

      // Disallow change of revision
      instance.set(
        this.options.revisionAttribute,
        instance._previousDataValues[this.options.revisionAttribute]
      );

      // Get diffs
      const delta = helpers.calcDelta(
        previousVersion,
        currentVersion,
        this.options.exclude,
        this.options.enableStrictDiff
      );

      const currentRevisionId = instance.get(this.options.revisionAttribute);

      if (this.failHard && !currentRevisionId && opt.type === "UPDATE") {
        throw new Error("Revision Id was undefined");
      }

      if (this.options.debug) {
        this.log("delta:", delta);
        this.log("revisionId", currentRevisionId);
      }
      // Check if all required fields have been provided to the opts / CLS
      if (this.options.metaDataFields) {
        // get all required field keys as an array
        const requiredFields = keys(
          pickBy(this.options.metaDataFields, (required) => required)
        );
        if (requiredFields && requiredFields.length) {
          const metaData =
            (this.ns && this.ns.get(this.options.metaDataContinuationKey)) ||
            opt.metaData;
          const requiredFieldsProvided = filter(
            requiredFields,
            (field) => metaData[field] !== undefined
          );
          if (requiredFieldsProvided.length !== requiredFields.length) {
            this.log(
              "Required fields: ",
              this.options.metaDataFields,
              requiredFields
            );
            this.log(
              "Required fields provided: ",
              metaData,
              requiredFieldsProvided
            );
            throw new Error(
              "Not all required fields are provided to paper trail!"
            );
          }
        }
      }

      if (destroyOperation || (delta && delta.length > 0)) {
        const revisionId = (currentRevisionId || 0) + 1;
        instance.set(this.options.revisionAttribute, revisionId);

        if (!instance.context) {
          instance.context = {};
        }
        instance.context.delta = delta;
      } else {
        if (instance.context) {
          instance.context.delta = null;
        }
      }

      if (this.options.debug) {
        this.log("end of beforeHook");
      }
    };
  }

  private createAfterHook(operation: string) {
    return async (instance: any, opt: any) => {
      if (this.options.debug) {
        this.log("afterHook called");
        this.log("instance:", instance);
        this.log("opt:", opt);
        if (this.ns) {
          this.log(
            `CLS ${this.options.continuationKey}:`,
            this.ns.get(this.options.continuationKey)
          );
        }
      }

      const destroyOperation = operation === "destroy";

      if (
        instance.context &&
        ((instance.context.delta && instance.context.delta.length > 0) ||
          destroyOperation)
      ) {
        const Revision = this.sequelize.model(this.options.revisionModel);
        let RevisionChange: ModelDefined<any, any>;

        if (this.options.enableRevisionChangeModel) {
          RevisionChange = this.sequelize.model(
            this.options.revisionChangeModel
          );
        }

        const { delta } = instance.context;

        let previousVersion: any = {};
        let currentVersion: any = {};
        if (!destroyOperation && this.options.enableCompression) {
          forEach(opt.defaultFields, (a) => {
            previousVersion[a] = instance._previousDataValues[a];
            currentVersion[a] = instance.dataValues[a];
          });
        } else {
          previousVersion = instance._previousDataValues;
          currentVersion = instance.dataValues;
        }

        // Supported nested models.
        previousVersion = omitBy(
          previousVersion,
          (i) => i != null && typeof i === "object" && !(i instanceof Date)
        );
        previousVersion = omit(previousVersion, this.options.exclude);

        currentVersion = omitBy(
          currentVersion,
          (i) => i != null && typeof i === "object" && !(i instanceof Date)
        );
        currentVersion = omit(currentVersion, this.options.exclude);

        if (
          this.failHard &&
          this.ns &&
          !this.ns.get(this.options.continuationKey)
        ) {
          throw new Error(
            `The CLS continuationKey ${this.options.continuationKey} was not defined.`
          );
        }

        let document = currentVersion;

        if (!this.postgres) {
          document = JSON.stringify(document);
        }

        // Build revision
        const query: any = {
          model: instance.constructor.name,
          document,
          operation,
        };

        // Add all extra data fields to the query object
        if (this.options.metaDataFields) {
          const metaData =
            (this.ns && this.ns.get(this.options.metaDataContinuationKey)) ||
            opt.metaData;
          if (metaData) {
            forEach(this.options.metaDataFields, (required, field) => {
              const value = metaData[field];
              if (this.options.debug) {
                this.log(
                  `Adding metaData field to Revision - ${field} => ${value}`
                );
              }
              if (!(field in query)) {
                query[field] = value;
              } else if (this.options.debug) {
                this.log(
                  `Revision object already has a value at ${field} => ${query[field]}`
                );
                this.log("Not overwriting the original value");
              }
            });
          }
        }

        // in case of custom user models that are not 'userId'
        query[this.options.userModelAttribute] =
          (this.ns && this.ns.get(this.options.continuationKey)) || opt.userId;

        query[this.options.defaultAttributes.documentId] = instance.id;

        const revision: any = Revision.build(query);

        revision[this.options.revisionAttribute] = instance.get(
          this.options.revisionAttribute
        );

        // Save revision
        try {
          const objectRevision = await revision.save({
            transaction: opt.transaction,
          });
          // Loop diffs and create a revision-diff for each
          if (this.options.enableRevisionChangeModel) {
            await Promise.all(
              map(delta, async (difference) => {
                const o = helpers.diffToString(
                  difference.item ? difference.item.lhs : difference.lhs
                );
                const n = helpers.diffToString(
                  difference.item ? difference.item.rhs : difference.rhs
                );

                // let document = difference;
                document = difference;
                let diff: any = o || n ? jsdiff.diffChars(o, n) : [];

                if (!this.postgres) {
                  document = JSON.stringify(document);
                  diff = JSON.stringify(diff);
                }

                const d = RevisionChange.build({
                  path: difference.path[0],
                  document,
                  diff,
                  revisionId: objectRevision.id,
                });

                try {
                  const savedD = await d.save({ transaction: opt.transaction });
                  // Add diff to revision
                  objectRevision[
                    `add${helpers.capitalizeFirstLetter(
                      this.options.revisionChangeModel
                    )}`
                  ](savedD);
                } catch (err) {
                  this.log("RevisionChange save error", err);
                  throw err;
                }
              })
            );
          }
        } catch (err) {
          this.log("Revision save error", err);
          throw err;
        }
      }

      if (this.options.debug) {
        this.log("end of afterHook");
      }
    };
  }
}
