import crypto from "crypto";
import { ApiError } from "./AppError";



export const generateCrypto = (token : string | undefined)=>{
    if(!token){
        throw new ApiError("Token not found", 500);
    }

    return crypto.createHash("sha256").update(token).digest("hex");
}