import { map, noop } from "lodash";
import { Sequelize, STRING, BIGINT } from "sequelize";
import { createNamespace } from "cls-hooked";
import { SequelizeRevision } from "../src/index";

describe("SequelizeRevision", () => {
  let sequelizeRevision: SequelizeRevision;
  let sequelize: Sequelize;
  let RevisionChange: any;
  let Revision: any;
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

    user = await User.create({ name: "yujiosaka" });
  });

  describe("logging revisions", () => {
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
      expect(revisions[0].document).toEqual({
        name: "sequelize-paper-trail",
        version: 1,
      });
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
      expect(revisions[0].document).toEqual({
        name: "sequelize-revision",
        version: 1,
      });
      expect(revisions[0].documentId).toBe(project.id);
      expect(revisions[0].operation).toBe("update");
      expect(revisions[0].revision).toBe(revisions[0].id);

      expect(revisions[1].id).toBe(project.revision);
      expect(revisions[1].model).toBe("Project");
      expect(revisions[1].document).toEqual({
        name: "sequelize-revision",
        version: 2,
      });
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
      expect(revisions[0].document).toEqual({
        name: "sequelize-paper-trail",
        version: "1",
      });
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
      expect(revisions[0].document).toEqual({
        name: "sequelize-paper-trail",
        version: 1,
      });
      expect(revisions[0].documentId).toBe(project.id);
      expect(revisions[0].operation).toBe("destroy");
      expect(revisions[0].revision).toBe(revisions[0].id);
    });
  });

  describe("logging revisions for upsert", () => {
    beforeEach(async () => {
      sequelizeRevision = new SequelizeRevision(sequelize, {
        enableMigration: true,
      });
      ({ Revision } = await sequelizeRevision.defineModels());

      await sequelizeRevision.trackRevision(sequelize.model("Project"));
    });

    it("does not log revisions when upserting a project with noRevision=true", async () => {
      let [project] = await Project.upsert(
        { name: "sequelize-paper-trail", version: 1 },
        { noRevision: true }
      );
      [project] = await Project.upsert(
        { id: project.id, version: 2 },
        { noRevision: true }
      );

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);
    });

    it("logs revisions when upserting a project", async () => {
      let [project] = await Project.upsert({
        name: "sequelize-paper-trail",
        version: 1,
      });
      [project] = await Project.upsert({
        id: project.id,
        name: "sequelize-paper-trail",
        version: 2,
      });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(2);

      expect(revisions[0].id).toBe(project.revision);
      expect(revisions[0].model).toBe("Project");
      expect(revisions[0].document).toEqual({
        name: "sequelize-paper-trail",
        version: 1,
      });
      expect(revisions[0].documentId).toBe(project.id);
      expect(revisions[0].operation).toBe("upsert");

      expect(revisions[1].id).not.toBe(project.revision);
      expect(revisions[1].model).toBe("Project");
      expect(revisions[1].document).toEqual({
        name: "sequelize-paper-trail",
        version: 2,
      });
      expect(revisions[1].documentId).toBe(project.id);
      expect(revisions[1].operation).toBe("upsert");
    });

    it("does not log revisions when failing a transaction", async () => {
      try {
        await sequelize.transaction(async (transaction) => {
          let [project] = await Project.upsert(
            {
              name: "sequelize-paper-trail",
              version: 1,
            },
            { transaction }
          );
          [project] = await Project.upsert(
            { id: project.id, name: "sequelize-paper-trail", version: 2 },
            { transaction }
          );
          throw new Error("Transaction is failed");
        });
      } catch {
        // ignore error
      }
      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(0);
    });
  });

  describe("logging revision changes", () => {
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
      await Project.create({
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

    it("logs revisions with userId in options", async () => {
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

  describe("saving meta data", () => {
    const ns = createNamespace("ns3");

    beforeEach(async () => {
      sequelizeRevision = new SequelizeRevision(sequelize, {
        enableMigration: true,
        continuationNamespace: "ns3",
        metaDataContinuationKey: "metaData",
        metaDataFields: { userRole: false, server: false },
      });

      Revision = sequelizeRevision.Revision;
      Revision.rawAttributes["userRole"] = {
        type: STRING,
      };
      Revision.rawAttributes["server"] = {
        type: STRING,
      };

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      Revision.refreshAttributes();

      await sequelizeRevision.defineModels();
      await sequelizeRevision.trackRevision(Project);
      await sequelizeRevision.trackRevision(User);
    });

    it("logs revisions without meta data", async () => {
      const project = await Project.create({
        name: "sequelize-paper-trail",
        version: 1,
      });
      await project.update({ name: "sequelize-revision" });
      await project.destroy();

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(3);

      expect(map(revisions, "userRole")).toEqual([null, null, null]);
    });

    it("logs revisions with meta data in continuous local storage", (done) => {
      ns.run(async () => {
        ns.set("metaData", { userRole: "admin" });

        const project = await Project.create({
          name: "sequelize-paper-trail",
          version: 1,
        });
        await project.update({ name: "sequelize-revision" });
        await project.destroy();

        const revisions = await Revision.findAll();
        expect(revisions.length).toBe(3);

        expect(map(revisions, "userRole")).toEqual(["admin", "admin", "admin"]);
        done();
      });
    });

    it("logs revisions with meta data in options", async () => {
      const revisionMetaData = { server: "api" };
      const project = await Project.create(
        {
          name: "sequelize-paper-trail",
          version: 1,
        },
        { revisionMetaData }
      );
      await project.update(
        { name: "sequelize-revision" },
        { revisionMetaData }
      );
      await project.destroy({ revisionMetaData });

      const revisions = await Revision.findAll();
      expect(revisions.length).toBe(3);

      expect(map(revisions, "server")).toEqual(["api", "api", "api"]);
    });

    it("logs revisions with meta data in both continuous local storage and options", (done) => {
      ns.run(async () => {
        ns.set("metaData", { userRole: "admin" });

        const revisionMetaData = { server: "api" };
        const project = await Project.create(
          {
            name: "sequelize-paper-trail",
            version: 1,
          },
          { revisionMetaData }
        );
        await project.update(
          { name: "sequelize-revision" },
          { revisionMetaData }
        );
        await project.destroy({ revisionMetaData });

        const revisions = await Revision.findAll();
        expect(revisions.length).toBe(3);

        expect(map(revisions, "userRole")).toEqual(["admin", "admin", "admin"]);
        expect(map(revisions, "server")).toEqual(["api", "api", "api"]);
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

  describe("logging revisions for excludeed attributes for each model", () => {
    beforeEach(async () => {
      sequelizeRevision = new SequelizeRevision(sequelize, {
        enableMigration: true,
      });
      ({ Revision } = await sequelizeRevision.defineModels());

      await sequelizeRevision.trackRevision(Project, { exclude: ["version"] });
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
