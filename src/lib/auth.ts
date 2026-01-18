import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

export interface AuthenticatedUser {
    userId: number;
    email: string;
}

/**
 * Extract and validate user ID from JWT token in request cookies
 * @throws Error if token is missing or invalid
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<number> {
    const token = request.cookies.get('token')?.value;

    if (!token) {
        throw new Error('Not authenticated');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
        return decoded.userId;
    } catch (error) {
        throw new Error('Invalid token');
    }
}

/**
 * Verify authentication and return full user details from JWT
 * @throws Error if token is missing or invalid
 */
export async function verifyAuthentication(request: NextRequest): Promise<AuthenticatedUser> {
    const token = request.cookies.get('token')?.value;

    if (!token) {
        throw new Error('Not authenticated');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
        return {
            userId: decoded.userId,
            email: decoded.email
        };
    } catch (error) {
        throw new Error('Invalid token');
    }
}
