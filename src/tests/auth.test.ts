import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prismaMock } from "./mocks/prisma";
import bcrypt from "bcryptjs";

const app = createApp(prismaMock as any);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(( ) => {
    vi.restoreAllMocks();
})

describe("POST /api/auth/register", () => {
  it("should reject an invalid email", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Felicia",
      email: "not-an-email",
      password: "Password123",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Please provide a valid email");
  });

  it("should reject a missing name", async () => {
    const response = await request(app).post("/api/auth/register").send({
      email: "felicia@example.com",
      password: "Password123",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Name is required");
  });

  it("should reject a password without an uppercase letter", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Felicia",
      email: "felicia@example.com",
      password: "password123",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "Password must contain at least one lowercase letter, one uppercase letter, and one number",
    );
  });

  it("should reject a password shorter than 6 characters", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Felicia",
      email: "felicia@example.com",
      password: "Pass1",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Password must be at least 6 characters");
  });

  it("should register a new user successfully", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    prismaMock.user.create.mockResolvedValue({
      id: "user-123",
      name: "Felicia",
      email: "felicia@example.com",
      password: "hashed-password",
    });

    const response = await request(app).post("/api/auth/register").send({
      name: "Felicia",
      email: "felicia@example.com",
      password: "Password123",
    });
    expect(response.status).toBe(201);

    expect(response.body).toEqual({
      message: "User registered successfully",
      userId: "user-123",
      name: "Felicia",
    });

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { email: "felicia@example.com" },
    });
    expect(prismaMock.user.create).toHaveBeenCalledOnce();
  });

  it("should reject registration if user already exists", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user-123",
      name: "Felicia",
      email: "felicia@example.com",
    });

    const response = await request(app).post("/api/auth/register").send({
      name: "Felicia",
      email: "felicia@example.com",
      password: "Password123",
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("User already exists");

    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/login", () => {
  it("should reject an invalid email", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "felicia",
      password: "Password123",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Please provide a valid email address");
  });

  it("should reject login when a user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    const response = await request(app).post("/api/auth/login").send({
      email: "felicia@example.com",
      password: "Password123",
    });
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid Credentials");
  });

  it("should reject login when password is incorrect", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'felicia@example.com',
        name: 'Felicia',
        password: 'hashed-password',
    })

    vi.spyOn(bcrypt, 'compare').mockImplementation(async () => false);

    const response = await request(app).post("/api/auth/login").send({
      email: 'felicia@example.com',
      password: 'wrong-password'
    });
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Invalid Credentials");
  });

  it("should login successfully with correct credentials", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'felicia@example.com',
        name: 'Felicia',
        password: 'hashed-password',
    })

    vi.spyOn(bcrypt, 'compare').mockImplementation(async () => true);

    const response = await request(app).post('/api/auth/login').send({
        email: 'felicia@example.com',
        password: 'Password123'
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');

    expect(response.body.user).toEqual({
        id: 'user-123',
        email: 'felicia@example.com',
        name: 'Felicia'
    });
})
})
