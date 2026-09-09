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
	ID              uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DisplayID       string     `gorm:"not null;default:''" json:"display_id"`
	Name            string     `gorm:"not null" json:"name"`
	Mobile          string     `gorm:"not null;uniqueIndex" json:"mobile"`
	Email           *string    `json:"email,omitempty"`
	PasswordHash    string     `gorm:"not null" json:"-"`
	Status          UserStatus `gorm:"type:user_status;not null;default:pending" json:"status"`
	IsAdmin         bool       `gorm:"not null;default:false" json:"is_admin"`
	CreatedAt       time.Time  `json:"created_at"`
	ApprovedAt      *time.Time `json:"approved_at,omitempty"`
	ApprovedBy      *uuid.UUID `gorm:"type:uuid" json:"approved_by,omitempty"`
	// Profile fields — set by admin after registration
	DOB           *time.Time `gorm:"column:dob" json:"dob,omitempty"`
	Pincode       string     `gorm:"column:pincode;not null;default:''" json:"pincode"`
	State         string     `gorm:"column:state;not null;default:''" json:"state"`
	District      string     `gorm:"column:district;not null;default:''" json:"district"`
	Taluk         string     `gorm:"column:taluk;not null;default:''" json:"taluk"`
	ReferenceName string     `gorm:"column:reference_name;not null;default:''" json:"reference_name"`
	// Bank details — set by member
	AccountHolderName   string     `gorm:"column:account_holder_name;not null;default:''" json:"account_holder_name"`
	BankName            string     `gorm:"column:bank_name;not null;default:''" json:"bank_name"`
	AccountNumber       string     `gorm:"column:account_number;not null;default:''" json:"account_number"`
	IfscCode            string     `gorm:"column:ifsc_code;not null;default:''" json:"ifsc_code"`
	// Credential validity
	CredentialValidUntil *time.Time `gorm:"column:credential_valid_until;type:date" json:"credential_valid_until,omitempty"`
	// Computed — not stored in DB
	ApprovedByName string `gorm:"-" json:"approved_by_name,omitempty"`
}
