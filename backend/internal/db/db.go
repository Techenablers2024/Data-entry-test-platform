package db

import (
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Init(dsn string) *gorm.DB {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("failed to get underlying sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)

	DB = db
	return db
}

func RunMigrations(db *gorm.DB) {
	files := []string{
		"internal/db/migrations/001_initial.sql",
		"internal/db/migrations/002_validation.sql",
		"internal/db/migrations/003_add_fixed_field_type.sql",
		"internal/db/migrations/004_add_group_to_field_configs.sql",
		"internal/db/migrations/005_add_display_id_to_users.sql",
		"internal/db/migrations/006_add_record_code.sql",
	}
	for _, path := range files {
		sql, err := os.ReadFile(path)
		if err != nil {
			log.Fatalf("failed to read migration file %s: %v", path, err)
		}
		if err := db.Exec(string(sql)).Error; err != nil {
			log.Fatalf("failed to run migration %s: %v", path, err)
		}
		log.Printf("Migration applied: %s", path)
	}
}
