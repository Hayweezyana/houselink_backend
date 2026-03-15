/**
 * Auth controller unit tests.
 * DB calls are mocked — no real database connection required.
 */
import { Request, Response, NextFunction } from "express";

// ─── Mock db ─────────────────────────────────────────────────────────────────
const mockDb: any = jest.fn();
mockDb.mockReturnValue(mockDb);
mockDb.where = jest.fn().mockReturnValue(mockDb);
mockDb.first = jest.fn();
mockDb.insert = jest.fn().mockReturnValue(mockDb);
mockDb.returning = jest.fn();
mockDb.fn = { now: jest.fn() };

jest.mock("../config/db", () => mockDb);

// ─── Mock bcryptjs ────────────────────────────────────────────────────────────
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed_password"),
  compare: jest.fn(),
}));

// ─── Mock jsonwebtoken ────────────────────────────────────────────────────────
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("mock_access_token"),
  verify: jest.fn(),
}));

import bcrypt from "bcryptjs";
import { register, login } from "../controllers/authController";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  return res as Response;
}

function mockNext(): NextFunction {
  return jest.fn();
}

// ─── register ────────────────────────────────────────────────────────────────
describe("register", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when required fields are missing", async () => {
    const req = { body: { name: "", email: "", password: "" } } as Request;
    const res = mockRes();
    await register(req as any, res, mockNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("required") })
    );
  });

  it("returns 400 when password is shorter than 8 chars", async () => {
    const req = { body: { name: "Jane", email: "jane@test.com", password: "abc" } } as Request;
    const res = mockRes();
    await register(req as any, res, mockNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when email already exists", async () => {
    mockDb.first.mockResolvedValueOnce({ id: "1", email: "jane@test.com" });
    const req = { body: { name: "Jane", email: "jane@test.com", password: "Passw0rd!" } } as Request;
    const res = mockRes();
    await register(req as any, res, mockNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Email already in use" })
    );
  });

  it("creates user and returns 201 on success", async () => {
    mockDb.first.mockResolvedValueOnce(undefined); // no existing user
    mockDb.returning.mockResolvedValueOnce([
      { id: "uuid-1", name: "Jane", email: "jane@test.com", role: "user", created_at: new Date() },
    ]);
    const req = { body: { name: "Jane", email: "jane@test.com", password: "Passw0rd!" } } as Request;
    const res = mockRes();
    await register(req as any, res, mockNext());
    expect(res.status).toHaveBeenCalledWith(201);
    expect(bcrypt.hash).toHaveBeenCalledWith("Passw0rd!", 12);
  });
});

// ─── login ───────────────────────────────────────────────────────────────────
describe("login", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when fields are missing", async () => {
    const req = { body: {} } as Request;
    const res = mockRes();
    await login(req as any, res, mockNext());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 401 when user not found", async () => {
    mockDb.first.mockResolvedValueOnce(null);
    const req = { body: { email: "no@one.com", password: "pass" } } as Request;
    const res = mockRes();
    await login(req as any, res, mockNext());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 when password does not match", async () => {
    mockDb.first.mockResolvedValueOnce({ id: "1", email: "x@x.com", password: "hashed", role: "user" });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
    const req = { body: { email: "x@x.com", password: "wrong" } } as Request;
    const res = mockRes();
    await login(req as any, res, mockNext());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns token and user on success (password stripped)", async () => {
    mockDb.first.mockResolvedValueOnce({
      id: "uuid-1",
      name: "Jane",
      email: "jane@test.com",
      password: "hashed",
      role: "user",
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
    // Mock the insert for refresh token
    mockDb.returning.mockResolvedValueOnce([]);

    const req = {
      body: { email: "jane@test.com", password: "Passw0rd!" },
      cookies: {},
    } as Request;
    const res = mockRes();
    await login(req as any, res, mockNext());

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "mock_access_token",
        user: expect.not.objectContaining({ password: expect.anything() }),
      })
    );
  });
});
