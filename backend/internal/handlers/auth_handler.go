package handlers

import (
	"dataentry-platform/backend/internal/middleware"
	"dataentry-platform/backend/internal/services"
	"dataentry-platform/backend/internal/utils"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AuthHandler struct {
	authService *services.AuthService
}

func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
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
		utils.Unauthorized(c, err.Error())
		return
	}

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
	// JWT is stateless; the client should discard the token.
	// If an active session exists for this user+device, we end it here.
	claims := c.MustGet(middleware.UserKey).(*utils.Claims)
	_ = claims // session ending will be handled by session service in Phase 2

	utils.OK(c, gin.H{"message": "logged out successfully"})
}

// GetUserIDFromContext is a helper used by other handlers.
func GetUserIDFromContext(c *gin.Context) uuid.UUID {
	claims := c.MustGet(middleware.UserKey).(*utils.Claims)
	return claims.UserID
}
