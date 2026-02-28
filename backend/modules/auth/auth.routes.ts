import { validate } from "../../shared/middlewares/validation.middleware";
import { sendOtp } from "./auth.controller";
import * as authController from "./auth.controller";
import { Router } from "express";
import { forgotPasswordSchema, googleLoginSchema, loginViaPasswordSchema, resetPasswordSchema, sendOtpSchema, signUpViaPasswordSchema, updatePasswordSchema, verifyResetTokenSchema, verifySchema } from "./auth.validation";
import { requireAuth } from "../../shared/middlewares/auth.strict.middleware";

const router : Router = Router();


router.post("/send-otp",validate(sendOtpSchema),authController.sendOtp);
router.post("/verify-otp",validate(verifySchema),authController.verifyOtp);


// password based 
router.post("/sign-up",validate(signUpViaPasswordSchema),authController.signUpPassword);
router.post("/login",validate(loginViaPasswordSchema),authController.LoginViaPassword);

// third party
router.post("/google-login",validate(googleLoginSchema),authController.googleLogin);

router.post("/forgot-password",validate(forgotPasswordSchema),authController.forgotPassword);
router.get("/reset-password/:token",validate(verifyResetTokenSchema),authController.verifyResetPasswordToken);
router.post("/reset-password/:token",validate(resetPasswordSchema),authController.resetPassword);

// protected routes
router.post("/logout",requireAuth,authController.logout);
router.patch("/update-password",requireAuth,validate(updatePasswordSchema),authController.updatePassword);
router.post("/refresh-token",requireAuth,authController.refreshSession);

export default router;