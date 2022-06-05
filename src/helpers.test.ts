import helpers from "./helpers";

describe("Helpers", () => {
  describe("snakeCaseValues", () => {
    it("converts camel cases to snake cases", () => {
      const res = helpers.snakeCaseValues({
        documentId: "documentId",
        revisionId: "revisionId",
      });
      expect(res).toEqual({
        documentId: "document_id",
        revisionId: "revision_id",
      });
    });

    it("keeps snake cases", () => {
      const res = helpers.snakeCaseValues({
        documentId: "document_id",
        revisionId: "revision_id",
      });
      expect(res).toEqual({
        documentId: "document_id",
        revisionId: "revision_id",
      });
    });

    it("converts capitalized camel cases to snake cases", () => {
      const res = helpers.snakeCaseValues({
        documentId: "DocumentId",
        revisionId: "RevisionId",
      });
      expect(res).toEqual({
        documentId: "document_id",
        revisionId: "revision_id",
      });
    });

    it("converts screaming camel case to snake cases", () => {
      const res = helpers.snakeCaseValues({
        documentId: "DOCUMENT_ID",
        revisionId: "REVISION_ID",
      });
      expect(res).toEqual({
        documentId: "document_id",
        revisionId: "revision_id",
      });
    });
  });

  describe("calcDelta", () => {
    it("returns a difference in email addresses", () => {
      expect.assertions(2);

      const user1 = {
        id: 1,
        email: "test@user.com",
        encrypted_password:
          "$2a$10$rNIOuy1pDl7bI5dTE.xMle/vcB51V2nJVpb/EBAwG4egXE42UfDMS",
        reset_password_token: null,
        reset_password_sent_at: null,
        account_completed: false,
      };

      const user2 = {
        id: 1,
        email: "test2@user.com",
        encrypted_password:
          "$2a$10$rNIOuy1pDl7bI5dTE.xMle/vcB51V2nJVpb/EBAwG4egXE42UfDMS",
        reset_password_token: null,
        reset_password_sent_at: null,
        account_completed: false,
      };

      const exclude = ["id", "created_at", "updated_at"];

      const res = helpers.calcDelta(user1, user2, exclude, true);

      expect(res?.[0].lhs).toEqual("test@user.com");
      expect(res?.[0].rhs).toEqual("test2@user.com");
    });

    it("returns a difference in null value", () => {
      expect.assertions(2);

      const user1 = {
        id: 1,
        email: "test@user.com",
        encrypted_password:
          "$2a$10$rNIOuy1pDl7bI5dTE.xMle/vcB51V2nJVpb/EBAwG4egXE42UfDMS",
        reset_password_token: null,
        reset_password_sent_at: null,
        account_completed: false,
      };

      const user2 = {
        id: 1,
        email: "test@user.com",
        encrypted_password:
          "$2a$10$rNIOuy1pDl7bI5dTE.xMle/vcB51V2nJVpb/EBAwG4egXE42UfDMS",
        reset_password_token: true,
        reset_password_sent_at: null,
        account_completed: false,
      };

      const exclude = ["id", "created_at", "updated_at"];

      const res = helpers.calcDelta(user1, user2, exclude, true);

      expect(res?.[0].lhs).toEqual(null);
      expect(res?.[0].rhs).toEqual(true);
    });

    it("returns a difference in a boolean", () => {
      expect.assertions(2);

      const user1 = {
        id: 1,
        email: "test@user.com",
        encrypted_password:
          "$2a$10$rNIOuy1pDl7bI5dTE.xMle/vcB51V2nJVpb/EBAwG4egXE42UfDMS",
        reset_password_token: null,
        reset_password_sent_at: null,
        account_completed: false,
      };

      const user2 = {
        id: 1,
        email: "test@user.com",
        encrypted_password:
          "$2a$10$rNIOuy1pDl7bI5dTE.xMle/vcB51V2nJVpb/EBAwG4egXE42UfDMS",
        reset_password_token: null,
        reset_password_sent_at: null,
        account_completed: true,
      };

      const exclude = ["id", "created_at", "updated_at"];

      const res = helpers.calcDelta(user1, user2, exclude, true);

      expect(res?.[0].lhs).toEqual(false);
      expect(res?.[0].rhs).toEqual(true);
    });

    it("returns no difference in strings and numbers when strict is false", () => {
      expect.assertions(1);

      const obj1 = {
        name: "User",
        age: "18",
      };

      const obj2 = {
        name: "User",
        age: 18,
      };

      const res = helpers.calcDelta(obj1, obj2, [], false);

      expect(res).toEqual(null);
    });

    it("returns a difference in strings and numbers when strict is true", () => {
      expect.assertions(2);

      const obj1 = {
        name: "User",
        age: "18",
      };

      const obj2 = {
        name: "User",
        age: 18,
      };

      const res = helpers.calcDelta(obj1, obj2, [], true);

      expect(typeof res?.[0].lhs).toEqual("string");
      expect(typeof res?.[0].rhs).toEqual("number");
    });

    it("returns a difference in strings and decimals when strict is true", () => {
      expect.assertions(2);

      const obj1 = {
        name: "User",
        age: "18.1",
      };

      const obj2 = {
        name: "User",
        age: 18.1,
      };

      const res = helpers.calcDelta(obj1, obj2, [], true);

      expect(typeof res?.[0].lhs).toEqual("string");
      expect(typeof res?.[0].rhs).toEqual("number");
    });

    it("returns no difference in strings and decimals when strict is false", () => {
      expect.assertions(1);

      const obj1 = {
        name: "User",
        age: "18.1",
      };

      const obj2 = {
        name: "User",
        age: 18.1,
      };

      const res = helpers.calcDelta(obj1, obj2, [], false);

      expect(res).toEqual(null);
    });
  });

  describe("Helper.debugConsole", () => {
    test("does not throw an error", () => {
      expect(() => {
        helpers.debugConsole(
          "logging revisions for",
          new URL("https://github.com/yujiosaka/sequelize-revision")
        );
      }).not.toThrow();
    });
  });
});
