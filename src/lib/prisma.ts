import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const prismaClientSingleton = () => {
    const adapter = new PrismaBetterSqlite3({ url: './prisma/dev.db' })
    return new PrismaClient({ adapter })
}

declare global {
    var prismaRefreshed: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaRefreshed ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaRefreshed = prisma
