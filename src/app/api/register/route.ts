import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
    console.log("POST /api/register - Request received");
    try {
        const body = await req.json();
        console.log("Request body:", { ...body, password: '***' });
        const { firstName, lastName, email, password } = body;

        if (!firstName || !lastName || !email || !password) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        console.log("Checking if user exists:", email);
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            console.log("User already exists:", email);
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }

        console.log("Hashing password...");
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log("Password hashed successfully");

        const user = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email,
                password: hashedPassword,
            },
        });

        return NextResponse.json({ message: "User registered successfully", userId: user.id }, { status: 201 });
    } catch (error) {
        console.error("Registration error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
