import { CookieOptions, Request, Response } from "express";
import { catchAsync } from "../../shared/utils/CatchAsync";
import {
  sendOtpService,
  signUpService,
  LoginViaPasswordService,
  resetPasswordService,
  forgotPasswordService,
  verifyResetPasswordTokenService,
  updatePasswordService,
  logoutService,
  verifyOtpAndLoginService,
  googleLoginService,
  refreshAccessTokenService,
} from "../auth/auth.service";
import { ApiError } from "../../shared/utils/AppError";
import {
  SendOtpType,
  VerifyType,
  LoginViaPasswordType,
  SignUpViaPasswordType,
  UpdatePasswordType,
  ResetPasswordType,
  GoogleLoginType,
} from "./auth.validation";

// SECURITY: Secure Cookie Configuration
const cookieOptions: CookieOptions = {
  httpOnly: true, // Prevents XSS (JavaScript cannot access cookie)
  secure: process.env.NODE_ENV === "production", // Only send over HTTPS in production
  sameSite: "lax", // Protects against CSRF
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Days
};

//  Helper to reduce redundancy in Controller 
const sendAuthResponse = (
  res: Response,
  result: { user: any; tokens: any },
  message: string,
) => {
  // Set Refresh Token in Cookie
  res.cookie("jwt", result.tokens.refreshToken, cookieOptions);

  res.status(200).json({
    status: "success",
    message,
    data: {
      accessToken: result.tokens.accessToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
    },
  });
};

export const sendOtp = catchAsync(
  async (req: Request<{}, {}, SendOtpType>, res: Response) => {
    const { email } = req.body;
    if (!email) throw new ApiError("Email is required", 400);

    const result = await sendOtpService(email);

    res.status(200).json({
      status: "success",
      message: result.message,
      data: {
        expiresIn: result.expiresIn,
        resendAvailableIn: result.resendAvailableIn,
      },
    });
  },
);

export const verifyOtp = catchAsync(
  async (req: Request<{}, {}, VerifyType>, res: Response) => {
    const { email, otp } = req.body;
    if (!email || !otp) throw new ApiError("Email and OTP are required", 400);

    const result = await verifyOtpAndLoginService(email, otp);

    sendAuthResponse(res, result, "Logged in successfully");
  },
);

export const signUpPassword = catchAsync(
  async (req: Request<{}, {}, SignUpViaPasswordType>, res: Response) => {
    const { email, password } = req.body;

    const result = await signUpService(email, password);

    sendAuthResponse(res, result, "Signed up successfully");
  },
);

export const LoginViaPassword = catchAsync(
  async (req: Request<{}, {}, LoginViaPasswordType>, res: Response) => {
    const { email, password } = req.body;

    const result = await LoginViaPasswordService(email, password);

    sendAuthResponse(res, result, "Logged in successfully");
  },
);

export const forgotPassword = catchAsync(
  async (req: Request<any>, res: Response) => {
    const { email } = req.body;
    if (!email) throw new ApiError("Email is required", 400);

    await forgotPasswordService(email);

    res.json({
      status: "success",
      message: "If an account exists, a password reset email has been sent.",
    });
  },
);

export const verifyResetPasswordToken = catchAsync(
  async (req: Request, res: Response) => {
    // Support token in Body or URL Params
    const token = req.params.token || req.body.token;

    if (!token) throw new ApiError("Token is required", 400);

    const result = await verifyResetPasswordTokenService(token);

    res.json({
      status: "success",
      message: "Token is valid",
      data: {
        email: result.email, // Useful for Frontend UI pre-fill
      },
    });
  },
);

export const resetPassword = catchAsync(
  async (req: Request<any>, res: Response) => {
    // 1. Get Token (from URL params usually) & Password
    const token = req.params.token || req.body.token;
    const { password } = req.body;

    if (!token) throw new ApiError("Token is required", 400);
    if (!password) throw new ApiError("New Password is required", 400);

    // 2. Call Service to Update
    await resetPasswordService(token, password);

    res.json({
      status: "success",
      message:
        "Password reset successfully. Please log in with your new password.",
    });
  },
);

export const updatePassword = catchAsync(
  async (req: Request<{}, {}, UpdatePasswordType>, res: Response) => {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) throw new ApiError("Unauthorized", 401);

    await updatePasswordService(userId, currentPassword, newPassword);

    res.json({
      status: "success",
      message: "Password updated successfully",
    });
  },
);

export const logout = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) throw new ApiError("Unauthorized", 401);

  await logoutService(userId);

  // Clear the cookie from the browser
  res.clearCookie("jwt", cookieOptions);

  res.json({
    status: "success",
    message: "Logged out successfully",
  });
});

export const googleLogin = catchAsync(async (req: Request<{},{},GoogleLoginType>, res: Response) => {
  const { token } = req.body;

  if (!token) throw new ApiError("Token not found", 400);

  const result = await googleLoginService(token);
  sendAuthResponse(res, result, "Logged in successfully");
});

export const refreshSession = catchAsync(
  async (req: Request, res: Response) => {
    // 1. Cookie se refresh token uthao
    const refreshToken = req.cookies?.jwt;

    if (!refreshToken) {
      throw new ApiError("Session expired. Please login again.", 401);
    }

    // 2. Service call karo jo ab clean hai
    const result = await refreshAccessTokenService(refreshToken);

    // 3. Naya access token return karo aur naya refresh token cookie mein set karo
    // Hum wahi 'sendAuthResponse' helper use kar rahe hain jo aapne banaya tha
    sendAuthResponse(res, result, "Token refreshed successfully");
  },
);
