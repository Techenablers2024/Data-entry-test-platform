package db

import (
	"log"

	"dataentry-platform/backend/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// SeedAdmin creates the initial admin user if no admin exists yet.
// Credentials are read from the Config passed in.
func SeedAdmin(db *gorm.DB, name, mobile, password string) {
	var count int64
	db.Model(&models.User{}).Where("is_admin = true").Count(&count)
	if count > 0 {
		log.Println("Admin user already exists, skipping seed")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("failed to hash admin password: %v", err)
	}

	admin := models.User{
		Name:         name,
		Mobile:       mobile,
		PasswordHash: string(hash),
		Status:       models.UserStatusActive,
		IsAdmin:      true,
	}
	if err := db.Create(&admin).Error; err != nil {
		log.Fatalf("failed to seed admin user: %v", err)
	}
	log.Printf("Admin user created: mobile=%s\n", mobile)
}
