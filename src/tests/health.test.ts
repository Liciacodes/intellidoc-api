import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";


describe("Health check", () => {
    it("should return a 200 status and correct message", async() => {
        const response = await request(app).get('/api-health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({status: "ok", message: "Intellidoc API is running"});
    })
})

// describe("Health check", () => {
//     it("should return a 200 status and correct message", async () => {
//         const response = await request(app).get("/api-health");

//         expect(response.status).toBe(200);
//         expect(response.body).toEqual({ status: "ok", message: "Intellidoc API is running" });
//     });
// });