package models

import (
	"time"

	"github.com/google/uuid"
)

type UserStatus string

const (
	UserStatusPending  UserStatus = "pending"
	UserStatusActive   UserStatus = "active"
	UserStatusDisabled UserStatus = "disabled"
)

type User struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DisplayID    string     `gorm:"not null;default:''" json:"display_id"`
	Name         string     `gorm:"not null" json:"name"`
	Mobile       string     `gorm:"not null;uniqueIndex" json:"mobile"`
	Email        *string    `json:"email,omitempty"`
	PasswordHash string     `gorm:"not null" json:"-"`
	Status       UserStatus `gorm:"type:user_status;not null;default:pending" json:"status"`
	IsAdmin      bool       `gorm:"not null;default:false" json:"is_admin"`
	CreatedAt    time.Time  `json:"created_at"`
	ApprovedAt   *time.Time `json:"approved_at,omitempty"`
	ApprovedBy   *uuid.UUID `gorm:"type:uuid" json:"approved_by,omitempty"`
}
