package models

import (
	"time"

	"github.com/google/uuid"
)

type SessionStatus string

const (
	SessionStatusActive  SessionStatus = "active"
	SessionStatusEnded   SessionStatus = "ended"
	SessionStatusExpired SessionStatus = "expired"
)

const (
	MaxSessionSeconds = 4 * 60 * 60 // 4 hours per session
	MaxDailySeconds   = 8 * 60 * 60 // 8 hours per day
	MaxSessionsPerDay = 2
)

type UserSession struct {
	ID             uuid.UUID     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID         uuid.UUID     `gorm:"type:uuid;not null" json:"user_id"`
	SessionNumber  int16         `gorm:"not null" json:"session_number"`
	SessionDate    time.Time     `gorm:"type:date;not null" json:"session_date"`
	StartedAt      time.Time     `gorm:"not null;default:now()" json:"started_at"`
	EndedAt        *time.Time    `json:"ended_at,omitempty"`
	DeviceID       string        `gorm:"not null" json:"device_id"`
	DeviceName     *string       `json:"device_name,omitempty"`
	ElapsedSeconds int           `gorm:"not null;default:0" json:"elapsed_seconds"`
	Status         SessionStatus `gorm:"type:session_status;not null;default:active" json:"status"`
}
