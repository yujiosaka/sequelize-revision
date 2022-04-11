import { map, noop } from "lodash";
import { Sequelize, STRING, BIGINT } from "sequelize";
import { createNamespace } from "cls-hooked";
import { SequelizeRevision } from "../src/index";

describe("SequelizeRevision", () => {
  let sequelize: Sequelize;
  let Project: any;
  let User: any;
  let user: any;

  beforeEach(async () => {
    sequelize = new Sequelize("sqlite::memory:", { logging: false });

    sequelize.define("Project", {
      name: {
        type: STRING,
      },
      version: {
        type: BIGINT({ length: 20 }),
      },
    });

    sequelize.define("User", {
      name: {
        type: STRING,
      },
    });

    await sequelize.sync();

    Project = sequelize.model("Project");
    User = sequelize.model("User");

    user = await User.create({ name: "sequelize-paper-trail" });
  });

  describe("logging revisions", () => {
    let sequelizeRevision: SequelizeRevision;
    let Revision: any;

    beforeEach(async () => {
      sequelizeRevision = new SequelizeRevision(sequelize, {
        enableMigration: true,
      });
      ({ Revision } = await sequelizeRevision.defineModels());

      await sequelizeRevision.trackRevision(sequelize.model("Project"));
    });

    it("does not log revisions when creating a project with noRevision=true", async () => {
      await Project.create(
        { name: "sequelize-paper-trail", version: 1 },
        { noRevision: true }
      );

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);
    });

    it("logs revisions when creating a project", async () => {
      const project = await Project.create({
        name: "sequelize-paper-trail",
        version: 1,
      });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(1);

      expect(revisions[0].id).toBe(project.revision);
      expect(revisions[0].model).toBe("Project");
      expect(revisions[0].document).toBe(
        JSON.stringify({ name: "sequelize-paper-trail", version: 1 })
      );
      expect(revisions[0].documentId).toBe(project.id);
      expect(revisions[0].operation).toBe("create");
      expect(revisions[0].revision).toBe(1);
    });

    it("does not log revisions when updating a project with noRevision=true", async () => {
      const project = await Project.create(
        {
          name: "sequelize-paper-trail",
          version: 1,
        },
        { noRevision: true }
      );
      await project.update(
        { name: "sequelize-paper-trail", version: 1 },
        { noRevision: true }
      );

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);
    });

    it("does not log revisions when updating a project with same versions", async () => {
      const project = await Project.create(
        {
          name: "sequelize-paper-trail",
          version: 1,
        },
        { noRevision: true }
      );
      await project.update({ name: "sequelize-paper-trail", version: 1 });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);
    });

    it("logs revisions when updating a project", async () => {
      const project = await Project.create(
        {
          name: "sequelize-paper-trail",
          version: 1,
        },
        { noRevision: true }
      );
      await project.update({ name: "sequelize-revision" });
      await project.update({ version: 2 });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(2);

      expect(revisions[0].id).not.toBe(project.revision);
      expect(revisions[0].model).toBe("Project");
      expect(revisions[0].document).toBe(
        JSON.stringify({ name: "sequelize-revision", version: 1 })
      );
      expect(revisions[0].documentId).toBe(project.id);
      expect(revisions[0].operation).toBe("update");
      expect(revisions[0].revision).toBe(revisions[0].id);

      expect(revisions[1].id).toBe(project.revision);
      expect(revisions[1].model).toBe("Project");
      expect(revisions[1].document).toBe(
        JSON.stringify({ name: "sequelize-revision", version: 2 })
      );
      expect(revisions[1].documentId).toBe(project.id);
      expect(revisions[1].operation).toBe("update");
      expect(revisions[1].revision).toBe(revisions[1].id);
    });

    it("logs revisions when updating a project in different types", async () => {
      const project = await Project.create(
        {
          name: "sequelize-paper-trail",
          version: 1,
        },
        { noRevision: true }
      );
      await project.update({ name: "sequelize-paper-trail", version: "1" });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(1);

      expect(revisions[0].id).toBe(project.revision);
      expect(revisions[0].model).toBe("Project");
      expect(revisions[0].document).toBe(
        JSON.stringify({ name: "sequelize-paper-trail", version: "1" })
      );
      expect(revisions[0].documentId).toBe(project.id);
      expect(revisions[0].operation).toBe("update");
      expect(revisions[0].revision).toBe(revisions[0].id);
    });

    it("does not log revisions when failing a transaction", async () => {
      try {
        await sequelize.transaction(async (transaction) => {
          const project = await Project.create(
            { name: "sequelize-paper-trail", version: 1 },
            { transaction }
          );
          await project.update({ name: "sequelize-revision" }, { transaction });
          await project.destroy({ transaction });
          throw new Error("Transaction is failed");
        });
      } catch {
        // ignore error
      }
      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);
    });

    it("logs revisions when deleting a project", async () => {
      const project = await Project.create(
        {
          name: "sequelize-paper-trail",
          version: 1,
        },
        { noRevision: true }
      );
      await project.destroy();

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(1);

      expect(revisions[0].id).toBe(project.revision);
      expect(revisions[0].model).toBe("Project");
      expect(revisions[0].document).toBe(
        JSON.stringify({ name: "sequelize-paper-trail", version: 1 })
      );
      expect(revisions[0].documentId).toBe(project.id);
      expect(revisions[0].operation).toBe("destroy");
      expect(revisions[0].revision).toBe(revisions[0].id);
    });
  });

  describe("logging revision changes", () => {
    let sequelizeRevision: SequelizeRevision;
    let RevisionChange: any;

    beforeEach(async () => {
      sequelizeRevision = new SequelizeRevision(sequelize, {
        enableMigration: true,
        enableRevisionChangeModel: true,
      });
      ({ RevisionChange } = await sequelizeRevision.defineModels());

      await sequelizeRevision.trackRevision(sequelize.model("Project"));
    });

    it("does not log revisionChanges when creating a project with noRevision=true", async () => {
      await Project.create(
        { name: "sequelize-paper-trail", version: 1 },
        { noRevision: true }
      );

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(0);
    });

    it("logs revisionChanges when creating a project", async () => {
      const project = await Project.create({
        name: "sequelize-paper-trail",
        version: 1,
      });

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(2);

      expect(map(revisionChanges, "path")).toEqual(["name", "version"]);
    });

    it("does not log revisionChanges when updating a project with noRevision=true", async () => {
      const project = await Project.create(
        {
          name: "sequelize-paper-trail",
          version: 1,
        },
        { noRevision: true }
      );
      await project.update(
        { name: "sequelize-paper-trail", version: 1 },
        { noRevision: true }
      );

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(0);
    });

    it("does not log revisionChanges when updating a project with same versions", async () => {
      const project = await Project.create(
        {
          name: "sequelize-paper-trail",
          version: 1,
        },
        { noRevision: true }
      );
      await project.update({ name: "sequelize-paper-trail", version: 1 });

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(0);
    });

    it("logs revisionChanges when updating a project", async () => {
      const project = await Project.create(
        {
          name: "sequelize-paper-trail",
          version: 1,
        },
        { noRevision: true }
      );
      await project.update({ name: "sequelize-revision" });
      await project.update({ version: 2 });

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(2);

      expect(map(revisionChanges, "path")).toEqual(["name", "version"]);
    });

    it("logs revisionChanges when updating a project in different types", async () => {
      const project = await Project.create(
        {
          name: "sequelize-paper-trail",
          version: 1,
        },
        { noRevision: true }
      );
      await project.update({ name: "sequelize-paper-trail", version: "1" });

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(1);

      expect(map(revisionChanges, "path")).toEqual(["version"]);
    });

    it("does not log revisionChanges when failing a transaction", async () => {
      try {
        await sequelize.transaction(async (transaction) => {
          const project = await Project.create(
            { name: "sequelize-paper-trail", version: 1 },
            { transaction }
          );
          await project.update({ name: "sequelize-revision" }, { transaction });
          await project.destroy({ transaction });
          throw new Error("Transaction is failed");
        });
      } catch {
        // ignore error
      }
      const revisions = await RevisionChange.findAll();
      expect(revisions.length).toBe(0);
    });

    it("does not log revisionChanges when deleting a project", async () => {
      const project = await Project.create(
        {
          name: "sequelize-paper-trail",
          version: 1,
        },
        { noRevision: true }
      );
      await project.destroy();

      const revisionChanges = await RevisionChange.findAll();
      expect(revisionChanges.length).toBe(0);
    });
  });

  describe("tracking users", () => {
    const ns = createNamespace("ns1");

    let sequelizeRevision: SequelizeRevision;
    let Revision: any;

    beforeEach(async () => {
      sequelizeRevision = new SequelizeRevision(sequelize, {
        enableMigration: true,
        continuationNamespace: "ns1",
        userModel: "User",
      });
      ({ Revision } = await sequelizeRevision.defineModels());

      await sequelizeRevision.trackRevision(Project);
      await sequelizeRevision.trackRevision(User);
    });

    it("logs revisions without userId", async () => {
      const project = await Project.create({
        name: "sequelize-paper-trail",
        version: 1,
      });
      await project.update({ name: "sequelize-revision" });
      await project.destroy();

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(3);

      expect(map(revisions, "userId")).toEqual([null, null, null]);
    });

    it("logs revisions with userId in continuous local storage", (done) => {
      ns.run(async () => {
        ns.set("userId", user.id);

        const project = await Project.create({
          name: "sequelize-paper-trail",
          version: 1,
        });
        await project.update({ name: "sequelize-revision" });
        await project.destroy();

        const revisions = await Revision.findAll();
        expect(revisions.length).toBe(3);

        expect(map(revisions, "userId")).toEqual([user.id, user.id, user.id]);
        done();
      });
    });

    it("logs revisions with userId in create option", async () => {
      const project = await Project.create(
        {
          name: "sequelize-paper-trail",
          version: 1,
        },
        { userId: user.id }
      );
      await project.update({ name: "sequelize-revision" }, { userId: user.id });
      await project.destroy({ userId: user.id });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(3);

      expect(map(revisions, "userId")).toEqual([user.id, user.id, user.id]);
    });
  });

  describe("tracking users with underscored column names", () => {
    const ns = createNamespace("ns2");

    let sequelizeRevision: SequelizeRevision;
    let Revision: any;

    beforeEach(async () => {
      sequelizeRevision = new SequelizeRevision(sequelize, {
        enableMigration: true,
        continuationNamespace: "ns2",
        userModel: "User",
        userModelAttribute: "user_id",
        underscored: true,
        underscoredAttributes: true,
      });
      ({ Revision } = await sequelizeRevision.defineModels());

      await sequelizeRevision.trackRevision(Project);
      await sequelizeRevision.trackRevision(User);
    });

    it("logs revisions when creating a project", (done) => {
      ns.run(async () => {
        ns.set("userId", user.id);

        const project = await Project.create({
          name: "sequelize-paper-trail",
          version: 1,
        });

        const revisions = await Revision.findAll();

        expect(revisions.length).toBe(1);

        expect(revisions[0].document_id).toBe(project.id);
        expect(revisions[0].user_id).toBe(user.id);
        done();
      });
    });

    it("logs revisions when updating a project", (done) => {
      ns.run(async () => {
        ns.set("userId", user.id);

        const project = await Project.create(
          {
            name: "sequelize-paper-trail",
            version: 1,
          },
          { noRevision: true }
        );
        await project.update({ name: "sequelize-revision" });

        const revisions = await Revision.findAll();
        expect(revisions.length).toBe(1);

        expect(revisions[0].document_id).toBe(project.id);
        expect(revisions[0].user_id).toBe(user.id);
        done();
      });
    });

    it("logs revisions when deleting a project", (done) => {
      ns.run(async () => {
        ns.set("userId", user.id);
        const project = await Project.create(
          {
            name: "sequelize-paper-trail",
            version: 1,
          },
          { noRevision: true }
        );
        await project.destroy();

        const revisions = await Revision.findAll();
        expect(revisions.length).toBe(1);

        expect(revisions[0].document_id).toBe(project.id);
        expect(revisions[0].user_id).toBe(user.id);
        done();
      });
    });
  });

  describe("logging revisions for excludeed attributes", () => {
    const exclude = [
      "id",
      "createdAt",
      "updatedAt",
      "deletedAt",
      "created_at",
      "updated_at",
      "deleted_at",
      "revision",
      "version",
    ];

    let sequelizeRevision: SequelizeRevision;
    let Revision: any;

    beforeEach(async () => {
      sequelizeRevision = new SequelizeRevision(sequelize, {
        enableMigration: true,
        exclude,
      });
      ({ Revision } = await sequelizeRevision.defineModels());

      await sequelizeRevision.trackRevision(Project);
    });

    it("does not log revision when updated attributes are excluded", async () => {
      const project = await Project.create(
        {
          name: "sequelize-paper-trail",
          version: 1,
        },
        { noRevision: true }
      );
      await project.update({ name: "sequelize-paper-trail", version: 2 });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);
    });
  });

  describe("logging revisions with unstrict diff", () => {
    let sequelizeRevision: SequelizeRevision;
    let Revision: any;

    beforeEach(async () => {
      sequelizeRevision = new SequelizeRevision(sequelize, {
        enableMigration: true,
        enableStrictDiff: false,
      });
      ({ Revision } = await sequelizeRevision.defineModels());

      await sequelizeRevision.trackRevision(Project);
    });

    it("does not log revision when updating project in different types", async () => {
      const project = await Project.create(
        {
          name: "sequelize-paper-trail",
          version: 1,
        },
        { noRevision: true }
      );
      await project.update({ name: "sequelize-paper-trail", version: 1 });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);
    });
  });

  describe("logging revisions with debug mode", () => {
    let sequelizeRevision: SequelizeRevision;
    let Revision: any;

    beforeEach(async () => {
      sequelizeRevision = new SequelizeRevision(sequelize, {
        enableMigration: true,
        debug: true,
        log: noop,
      });
      ({ Revision } = await sequelizeRevision.defineModels());

      await sequelizeRevision.trackRevision(sequelize.model("Project"));
    });

    it("does not fail with debug=true", async () => {
      const project = await Project.create({
        name: "sequelize-paper-trail",
        version: 1,
      });
      await project.update({ name: "sequelize-revision", version: 2 });
      await project.destroy();

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(3);
    });
  });
});
