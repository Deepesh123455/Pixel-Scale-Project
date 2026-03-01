import { eq } from "drizzle-orm";
import { db } from "../../config/db";
import { UserTable } from "./user.schema";
import { ApiError } from "../../shared/utils/AppError";



export const getUserEmailById = async (userId: string) => {
    const user = await db.query.UserTable.findFirst({
        where: eq(UserTable.id, userId),
        columns:{
            email: true,
        }
    })
    if(!user){
        throw new ApiError("User not found", 404);
    }

    return user.email;
}