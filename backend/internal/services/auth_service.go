package services

import (
	"errors"
	"fmt"
	"time"

	"dataentry-platform/backend/internal/models"
	"dataentry-platform/backend/internal/utils"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService struct {
	db        *gorm.DB
	jwtSecret string
}

func NewAuthService(db *gorm.DB, jwtSecret string) *AuthService {
	return &AuthService{db: db, jwtSecret: jwtSecret}
}

type SignupInput struct {
	Name            string  `json:"name" binding:"required"`
	Mobile          string  `json:"mobile" binding:"required"`
	Password        string  `json:"password" binding:"required,min=6"`
	ConfirmPassword string  `json:"confirm_password" binding:"required"`
	Email           *string `json:"email"`
}

type LoginInput struct {
	Mobile     string  `json:"mobile" binding:"required"`
	Password   string  `json:"password" binding:"required"`
	DeviceID   string  `json:"device_id" binding:"required"`
	DeviceName *string `json:"device_name"`
}

type ActiveSessionInfo struct {
	SessionID      uuid.UUID `json:"session_id"`
	SessionNumber  int16     `json:"session_number"`
	DeviceName     *string   `json:"device_name"`
	StartedAt      time.Time `json:"started_at"`
	ElapsedSeconds int       `json:"elapsed_seconds"`
}

type LoginResponse struct {
	Token          string             `json:"token"`
	User           *models.User       `json:"user"`
	DeviceConflict bool               `json:"device_conflict"`
	ActiveSession  *ActiveSessionInfo `json:"active_session,omitempty"`
}

func (s *AuthService) Signup(input SignupInput) (*models.User, error) {
	if input.Password != input.ConfirmPassword {
		return nil, errors.New("Passwords do not match.")
	}

	var existing models.User
	if err := s.db.Where("mobile = ?", input.Mobile).First(&existing).Error; err == nil {
		return nil, errors.New("Mobile number already registered.")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	last3 := input.Mobile
	if len(last3) > 3 {
		last3 = last3[len(last3)-3:]
	}

	user := &models.User{
		Name:         input.Name,
		Mobile:       input.Mobile,
		Email:        input.Email,
		PasswordHash: string(hash),
		Status:       models.UserStatusPending,
		DisplayID:    fmt.Sprintf("DEP-%s-%s", last3, now.Format("020106")),
	}
	if err := s.db.Create(user).Error; err != nil {
		return nil, err
	}
	return user, nil
}

func (s *AuthService) CreateAdmin(name, mobile, password string, email *string) (*models.User, error) {
	var existing models.User
	if err := s.db.Where("mobile = ?", mobile).First(&existing).Error; err == nil {
		return nil, errors.New("Mobile number already registered.")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	last3 := mobile
	if len(last3) > 3 {
		last3 = last3[len(last3)-3:]
	}

	user := &models.User{
		Name:         name,
		Mobile:       mobile,
		Email:        email,
		PasswordHash: string(hash),
		Status:       models.UserStatusActive,
		IsAdmin:      true,
		DisplayID:    fmt.Sprintf("DEP-%s-%s", last3, now.Format("020106")),
	}
	if err := s.db.Create(user).Error; err != nil {
		return nil, err
	}
	return user, nil
}

func (s *AuthService) ResetPasswordWithToken(resetToken, newPassword string) error {
	claims, err := utils.ParseResetToken(resetToken, s.jwtSecret)
	if err != nil {
		return err
	}
	var user models.User
	if err := s.db.Where("mobile = ?", claims.Mobile).First(&user).Error; err != nil {
		return errors.New("User not found.")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.db.Model(&user).Update("password_hash", string(hash)).Error
}

func (s *AuthService) Login(input LoginInput) (*LoginResponse, error) {
	var user models.User
	if err := s.db.Where("mobile = ?", input.Mobile).First(&user).Error; err != nil {
		return nil, errors.New("Invalid mobile number or password.")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return nil, errors.New("Invalid mobile number or password.")
	}

	if user.Status == models.UserStatusPending {
		return nil, errors.New("Account is pending admin approval.")
	}
	if user.Status == models.UserStatusDisabled {
		return nil, errors.New("Account has been disabled. Please contact admin.")
	}

	var activeSession models.UserSession
	deviceConflict := false
	var activeSessionInfo *ActiveSessionInfo

	err := s.db.Where("user_id = ? AND status = ?", user.ID, models.SessionStatusActive).
		First(&activeSession).Error

	if err == nil && activeSession.DeviceID != input.DeviceID {
		deviceConflict = true
		activeSessionInfo = &ActiveSessionInfo{
			SessionID:      activeSession.ID,
			SessionNumber:  activeSession.SessionNumber,
			DeviceName:     activeSession.DeviceName,
			StartedAt:      activeSession.StartedAt,
			ElapsedSeconds: activeSession.ElapsedSeconds,
		}
	}

	token, err := utils.GenerateToken(user.ID, user.Mobile, user.IsAdmin, input.DeviceID, s.jwtSecret)
	if err != nil {
		return nil, err
	}

	return &LoginResponse{
		Token:          token,
		User:           &user,
		DeviceConflict: deviceConflict,
		ActiveSession:  activeSessionInfo,
	}, nil
}

func (s *AuthService) GetUserByID(id uuid.UUID) (*models.User, error) {
	var user models.User
	if err := s.db.First(&user, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *AuthService) GetUserByMobile(mobile string) (*models.User, error) {
	var user models.User
	if err := s.db.Where("mobile = ?", mobile).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *AuthService) JWTSecret() string {
	return s.jwtSecret
}
