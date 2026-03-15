/**
 * Property controller unit tests — DB is fully mocked.
 */
import { Request, Response, NextFunction } from "express";

// ─── Mock db ─────────────────────────────────────────────────────────────────
const queryBuilder: any = {};
queryBuilder.select = jest.fn().mockReturnValue(queryBuilder);
queryBuilder.where = jest.fn().mockReturnValue(queryBuilder);
queryBuilder.whereNot = jest.fn().mockReturnValue(queryBuilder);
queryBuilder.orderBy = jest.fn().mockReturnValue(queryBuilder);
queryBuilder.limit = jest.fn().mockReturnValue(queryBuilder);
queryBuilder.offset = jest.fn().mockReturnValue(queryBuilder);
queryBuilder.first = jest.fn();
queryBuilder.insert = jest.fn().mockReturnValue(queryBuilder);
queryBuilder.update = jest.fn().mockReturnValue(queryBuilder);
queryBuilder.delete = jest.fn().mockReturnValue(queryBuilder);
queryBuilder.del = jest.fn().mockResolvedValue(1);
queryBuilder.returning = jest.fn();
queryBuilder.increment = jest.fn().mockReturnValue(queryBuilder);
queryBuilder.leftJoin = jest.fn().mockReturnValue(queryBuilder);
queryBuilder.count = jest.fn().mockReturnValue(queryBuilder);
queryBuilder.whereILike = jest.fn().mockReturnValue(queryBuilder);
queryBuilder.orWhereILike = jest.fn().mockReturnValue(queryBuilder);
queryBuilder.groupBy = jest.fn().mockReturnValue(queryBuilder);
queryBuilder.then = jest.fn();

const mockDb: any = jest.fn().mockReturnValue(queryBuilder);
mockDb.fn = { now: jest.fn() };

jest.mock("../config/db", () => mockDb);
jest.mock("uuid", () => ({ v4: jest.fn().mockReturnValue("test-uuid") }));

import { createProperty, deleteProperty } from "../controllers/propertyController";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const mockNext: NextFunction = jest.fn();

// ─── createProperty ───────────────────────────────────────────────────────────
describe("createProperty", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when user is not authenticated", async () => {
    const req = {
      body: { title: "Test", price: 100000, location: "Lagos" },
      files: [],
      user: undefined,
    } as unknown as Request;
    const res = mockRes();
    await createProperty(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const req = {
      body: { title: "", price: "", location: "" },
      files: [],
      user: { id: "owner-1", email: "o@o.com" },
    } as unknown as Request;
    const res = mockRes();
    await createProperty(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("required") })
    );
  });

  it("creates property and returns 201 on valid input", async () => {
    const newProp = { id: "test-uuid", title: "Cozy Apartment", price: 500000, location: "Lekki" };
    queryBuilder.returning.mockResolvedValueOnce([newProp]);
    const req = {
      body: { title: "Cozy Apartment", price: 500000, location: "Lekki", description: "Nice" },
      files: [],
      user: { id: "owner-1", email: "owner@test.com" },
    } as unknown as Request;
    const res = mockRes();
    await createProperty(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(newProp);
  });
});

// ─── deleteProperty ───────────────────────────────────────────────────────────
describe("deleteProperty", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 404 when property does not exist", async () => {
    queryBuilder.first.mockResolvedValueOnce(null);
    const req = {
      params: { id: "non-existent" },
      user: { id: "owner-1" },
    } as unknown as Request;
    const res = mockRes();
    await deleteProperty(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 403 when user does not own the property", async () => {
    queryBuilder.first.mockResolvedValueOnce({ id: "prop-1", owner_id: "other-owner" });
    const req = {
      params: { id: "prop-1" },
      user: { id: "owner-1" },
    } as unknown as Request;
    const res = mockRes();
    await deleteProperty(req, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("deletes property when owner matches", async () => {
    queryBuilder.first.mockResolvedValueOnce({ id: "prop-1", owner_id: "owner-1" });
    queryBuilder.delete.mockResolvedValueOnce(1);
    const req = {
      params: { id: "prop-1" },
      user: { id: "owner-1" },
    } as unknown as Request;
    const res = mockRes();
    await deleteProperty(req, res, mockNext);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) })
    );
  });
});
