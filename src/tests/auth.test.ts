import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app"; 


describe("POST /api/auth/register", () => {
    it("should reject an invalid email", async () => {
        const response = await request(app)
        .post("/api/auth/register")
        .send({
            name: 'Felicia',
            email: 'not-an-email',
            password: 'password123'
        })

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("Please provide a valid email");
    })
})


it("should reject a missing name", async () => {
    const response = await request(app)
    .post("/api/auth/register")
    .send({
        email: 'felicia@example.com',
        password: 'password123'
    })

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Name is required");
})

it('should reject a password without an uppercase letter', async () => {
    const response = await request(app)
    .post('/api/auth/register')
    .send({
        name: 'Felicia',
        email: 'felicia@example.com',
        password: 'password123'
    })

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Password must contain at least one lowercase letter, one uppercase letter, and one number");
})

it("should reject a password shorter than 6 characters", async () => {
    const response = await request(app)
    .post('/api/auth/register')
    .send({
        name: 'Felicia',
        email: 'felicia@example.com',
        password: 'Pass1'
    })

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Password must be at least 6 characters");
})