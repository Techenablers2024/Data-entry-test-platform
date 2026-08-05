package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type FieldValidation struct {
	Expected string `json:"expected"`
	Entered  string `json:"entered"`
	Correct  bool   `json:"correct"`
}

type UserSubmission struct {
	ID             uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID         uuid.UUID      `gorm:"type:uuid;not null" json:"user_id"`
	DataRecordID   uuid.UUID      `gorm:"type:uuid;not null" json:"data_record_id"`
	SessionID      uuid.UUID      `gorm:"type:uuid;not null" json:"session_id"`
	SubmittedAt    time.Time      `gorm:"not null;default:now()" json:"submitted_at"`
	InputValues    datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"input_values"`
	SequenceNumber int            `gorm:"not null" json:"sequence_number"`
	Validation     datatypes.JSON `gorm:"type:jsonb;not null;default:'{}'" json:"validation"`
	CorrectCount   int            `gorm:"not null;default:0" json:"correct_count"`
	TotalCount     int            `gorm:"not null;default:0" json:"total_count"`
	Accuracy       float64        `gorm:"type:numeric(5,2);not null;default:0" json:"accuracy"`
}
