package models

import (
	"time"

	"github.com/google/uuid"
)

type Batch struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Filename    string    `gorm:"not null" json:"filename"`
	UploadedAt  time.Time `gorm:"not null;default:now()" json:"uploaded_at"`
	UploadedBy  uuid.UUID `gorm:"type:uuid;not null" json:"uploaded_by"`
	RecordCount int       `gorm:"not null;default:0" json:"record_count"`
}
