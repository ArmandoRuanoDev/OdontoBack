import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET!;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_SECONDS = parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '604800'); // 7 días en segundos

export interface TokenPayload {
    id_usuario: number;
    nombre_usuario: string;
    correo_electronico: string;
    id_rol_usuario: number;
}

export function generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

export function generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_SECONDS });
}

export async function hashRefreshToken(refreshToken: string): Promise<string> {
    return await bcrypt.hash(refreshToken, 10);
}

export function verifyToken(token: string): TokenPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (error) {
        return null;
    }
}

export function getRefreshTokenExpiry(): Date {
    return new Date(Date.now() + REFRESH_EXPIRES_SECONDS * 1000);
}