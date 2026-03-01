
import { getMyProfile } from "./user.controller";
import { requireAuth } from "../../shared/middlewares/auth.strict.middleware";
import { Router } from "express";

const router : Router = Router();


router.get("/me",requireAuth,getMyProfile);