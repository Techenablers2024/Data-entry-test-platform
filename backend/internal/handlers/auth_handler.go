package handlers

import (
	"dataentry-platform/backend/internal/logger"
	"dataentry-platform/backend/internal/middleware"
	"dataentry-platform/backend/internal/services"
	"dataentry-platform/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AuthHandler struct {
	authService *services.AuthService
	smsService  *services.SMSService
}

func NewAuthHandler(authService *services.AuthService, smsSvc *services.SMSService) *AuthHandler {
	return &AuthHandler{authService: authService, smsService: smsSvc}
}

func (h *AuthHandler) Signup(c *gin.Context) {
	var input services.SignupInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	user, err := h.authService.Signup(input)
	if err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	utils.Created(c, gin.H{
		"message": "Account created successfully. Please wait for admin approval.",
		"user":    user,
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var input services.LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	resp, err := h.authService.Login(input)
	if err != nil {
		logger.Error("login_failed", err.Error(), input.Mobile)
		utils.Unauthorized(c, err.Error())
		return
	}
	logger.Audit("login_success", "User logged in", resp.User.ID.String())
	utils.OK(c, resp)
}

func (h *AuthHandler) Me(c *gin.Context) {
	claims := c.MustGet(middleware.UserKey).(*utils.Claims)

	user, err := h.authService.GetUserByID(claims.UserID)
	if err != nil {
		utils.NotFound(c, "user not found")
		return
	}

	utils.OK(c, user)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	claims := c.MustGet(middleware.UserKey).(*utils.Claims)
	_ = claims
	utils.OK(c, gin.H{"message": "logged out successfully"})
}

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var body struct {
		Mobile string `json:"mobile" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}
	// Verify mobile exists in DB
	if _, err := h.authService.GetUserByMobile(body.Mobile); err != nil {
		utils.NotFound(c, "Mobile number not registered.")
		return
	}
	if err := h.smsService.SendOTP(body.Mobile); err != nil {
		utils.InternalError(c, err.Error())
		return
	}
	utils.OK(c, gin.H{"message": "OTP sent successfully."})
}

func (h *AuthHandler) VerifyOTP(c *gin.Context) {
	var body struct {
		Mobile string `json:"mobile" binding:"required"`
		OTP    string `json:"otp" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}
	if err := h.smsService.VerifyOTP(body.Mobile, body.OTP); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}
	// Issue short-lived reset token
	token, err := utils.GenerateResetToken(body.Mobile, h.authService.JWTSecret())
	if err != nil {
		utils.InternalError(c, "Failed to generate reset token.")
		return
	}
	utils.OK(c, gin.H{"reset_token": token})
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var body struct {
		ResetToken      string `json:"reset_token" binding:"required"`
		NewPassword     string `json:"new_password" binding:"required,min=6"`
		ConfirmPassword string `json:"confirm_password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}
	if body.NewPassword != body.ConfirmPassword {
		utils.BadRequest(c, "Passwords do not match.")
		return
	}
	if err := h.authService.ResetPasswordWithToken(body.ResetToken, body.NewPassword); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}
	logger.Audit("password_reset", "Password reset via OTP", body.ResetToken[:8]+"...")
	utils.OK(c, gin.H{"message": "Password reset successfully."})
}

// GetUserIDFromContext is a helper used by other handlers.
func GetUserIDFromContext(c *gin.Context) uuid.UUID {
	claims := c.MustGet(middleware.UserKey).(*utils.Claims)
	return claims.UserID
}
