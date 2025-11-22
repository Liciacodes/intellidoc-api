import { Router, Response, Request} from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import {body, validationResult} from 'express-validator'
import { PrismaClient } from "@prisma/client";

const router = Router()

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET environment variable");
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_APP_USER,
    pass: process.env.GMAIL_APP_PASS
  }
});

router.post("/register",[
body('email')
.isEmail()
.normalizeEmail()
.withMessage('Please provide a valid email'),

body('password')
.isLength({min: 6})
.withMessage('Password must be at least 6 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
], async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and Password required" });

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser)
    return res.status(409).json({ error: "User already exists" });

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
    },
  });

  return res
    .status(201)
    .json({ message: "User registered successfully", userId: user.id });
});

router.post("/login", [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ], async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email and password not found" });
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user)
    return res.status(401).json({
      error: "Invalid Credentials",
    });

  const validPassword = await bcrypt.compare(password, user.password);

  if (!validPassword)
    return res.status(401).json({
      error: "Invalid Credentials",
    });

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "1h" });
  res.json({ token });
});

router.post('/forgot-password', [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address')
  ], async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    console.log('Forgot password request for:', email);

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ 
        message: 'If this email exists in our system, a password reset link has been sent.' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

    // Update user with reset token
    await prisma.user.update({
      where: { email },
      data: {
        resetToken,
        resetTokenExpiry
      }
    });

    const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;

    await transporter.sendMail({
      from: `'Intellidoc Support' <${process.env.GMAIL_USER}`,
      to: email,
      subject: 'Password Reset Request',
      text: `You requested a password reset. Use this link to reset your password:\n\n${resetUrl}\n\nThis link expires in 15 minutes.`,
      html: `<p>You requested a password reset. Click the link below to reset your password:</p>
             <a href="${resetUrl}">${resetUrl}</a>
             <p>This link expires in 15 minutes.</p>`
    });

    return res.json({
      message: 'If this email exists in our system, a password reset link has been sent.'
    });

  } catch (error: any) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/reset-password',[
    // query('token')
    //   .notEmpty()
    //   .withMessage('Reset token is required'),
    
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/^(?=.*[A-Z])/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/^(?=.*\d)/)
      .withMessage('Password must contain at least one number')
  ], async (req: Request, res: Response) => {
  const token = req.query.token as string;
  const { newPassword } = req.body;

  if (!token || !newPassword)
    return res.status(400).json({ error: "Token and new password required" });

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gt: new Date() }
    },
  });

  if (!user) return res.status(400).json({ error: 'Invalid or expired token'});

  const hashed = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      resetToken: null,
      resetTokenExpiry: null
    }
  });

  return res.json({ message: 'Password reset successful' });
});

export default router;
