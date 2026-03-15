import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'default-secret';

export function signToken(userId: number, username: string): string {
  return jwt.sign({ userId, username }, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: number; username: string } {
  return jwt.verify(token, SECRET) as { userId: number; username: string };
}
