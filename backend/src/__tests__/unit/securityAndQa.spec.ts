import { Request, Response } from "express";
import AppError from "../../errors/AppError";
import envTokenAuth from "../../middleware/envTokenAuth";
import {
  assertSafeExternalUrl,
  isPrivateOrReservedIPv4,
  isPrivateOrReservedIPv6
} from "../../utils/urlValidator";

describe("Security & QA Hardening Unit Suite", () => {
  describe("AppError", () => {
    it("defaults statusCode to 400 when not provided", () => {
      const err = new AppError("ERR_VALIDATION");
      expect(err.message).toBe("ERR_VALIDATION");
      expect(err.statusCode).toBe(400);
    });

    it("preserves custom statusCode", () => {
      const err = new AppError("ERR_NO_PERMISSION", 403);
      expect(err.message).toBe("ERR_NO_PERMISSION");
      expect(err.statusCode).toBe(403);
    });
  });

  describe("SSRF Protection (urlValidator)", () => {
    it("blocks private, loopback, link-local, and multicast IPv4 ranges", () => {
      expect(isPrivateOrReservedIPv4("127.0.0.1")).toBe(true);
      expect(isPrivateOrReservedIPv4("10.0.0.1")).toBe(true);
      expect(isPrivateOrReservedIPv4("172.16.0.1")).toBe(true);
      expect(isPrivateOrReservedIPv4("172.31.255.255")).toBe(true);
      expect(isPrivateOrReservedIPv4("192.168.1.1")).toBe(true);
      expect(isPrivateOrReservedIPv4("169.254.169.254")).toBe(true);
      expect(isPrivateOrReservedIPv4("0.0.0.0")).toBe(true);
      expect(isPrivateOrReservedIPv4("224.0.0.1")).toBe(true);
      expect(isPrivateOrReservedIPv4("malformed")).toBe(true);
    });

    it("allows public IPv4 addresses", () => {
      expect(isPrivateOrReservedIPv4("8.8.8.8")).toBe(false);
      expect(isPrivateOrReservedIPv4("1.1.1.1")).toBe(false);
      expect(isPrivateOrReservedIPv4("172.32.0.1")).toBe(false);
    });

    it("blocks loopback, bracketed, link-local, ULA, and IPv4-mapped IPv6 addresses", () => {
      expect(isPrivateOrReservedIPv6("::1")).toBe(true);
      expect(isPrivateOrReservedIPv6("[::1]")).toBe(true);
      expect(isPrivateOrReservedIPv6("::ffff:127.0.0.1")).toBe(true);
      expect(isPrivateOrReservedIPv6("::ffff:7f00:1")).toBe(true);
      expect(isPrivateOrReservedIPv6("::ffff:a9fe:a9fe")).toBe(true);
      expect(isPrivateOrReservedIPv6("fe80::1")).toBe(true);
      expect(isPrivateOrReservedIPv6("fc00::1")).toBe(true);
      expect(isPrivateOrReservedIPv6("fd12:3456::1")).toBe(true);
    });

    it("allows public IPv6 addresses and public IPv4-mapped IPv6", () => {
      expect(isPrivateOrReservedIPv6("2606:4700:4700::1111")).toBe(false);
      expect(isPrivateOrReservedIPv6("::ffff:8.8.8.8")).toBe(false);
      expect(isPrivateOrReservedIPv6("::ffff:808:808")).toBe(false);
    });

    it("rejects unsafe URLs (localhost, IPv6 loopback, cloud metadata, non-HTTP protocols)", async () => {
      await expect(
        assertSafeExternalUrl("http://localhost:3000/webhook")
      ).rejects.toBeInstanceOf(AppError);
      await expect(
        assertSafeExternalUrl("http://[::1]:8080/internal")
      ).rejects.toBeInstanceOf(AppError);
      await expect(
        assertSafeExternalUrl("http://[::ffff:127.0.0.1]:3000/secret")
      ).rejects.toBeInstanceOf(AppError);
      await expect(
        assertSafeExternalUrl("http://169.254.169.254/latest/meta-data/")
      ).rejects.toBeInstanceOf(AppError);
      await expect(
        assertSafeExternalUrl("file:///etc/passwd")
      ).rejects.toBeInstanceOf(AppError);
    });

    it("accepts safe public literal IP URLs", async () => {
      const parsed = await assertSafeExternalUrl("https://1.1.1.1/webhook");
      expect(parsed.hostname).toBe("1.1.1.1");
    });
  });

  describe("envTokenAuth Middleware (Timing-Safe Verification)", () => {
    const originalEnvToken = process.env.ENV_TOKEN;

    beforeEach(() => {
      process.env.ENV_TOKEN = "super-secret-env-token-12345";
    });

    afterAll(() => {
      process.env.ENV_TOKEN = originalEnvToken;
    });

    it("throws 403 when token is missing or invalid", () => {
      const reqMissing = { body: {}, query: {} } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn();

      expect(() => envTokenAuth(reqMissing, res, next)).toThrow(AppError);
      expect(next).not.toHaveBeenCalled();

      const reqWrong = {
        body: { token: "wrong-token" },
        query: {}
      } as unknown as Request;
      expect(() => envTokenAuth(reqWrong, res, next)).toThrow(AppError);
      expect(next).not.toHaveBeenCalled();
    });

    it("calls next() when valid ENV_TOKEN is provided", () => {
      const reqValid = {
        body: { token: "super-secret-env-token-12345" },
        query: {}
      } as unknown as Request;
      const res = {} as Response;
      const next = jest.fn();

      envTokenAuth(reqValid, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
