package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBDSN         string
	JWTSecret     string
	Port          string
	AdminName     string
	AdminMobile   string
	AdminPassword string
	Fast2SMSKey   string
	LogKey        string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, reading from environment")
	}
	return &Config{
		DBDSN:         getEnv("DB_DSN", "host=localhost user=postgres password=secret dbname=dataentry port=5432 sslmode=disable TimeZone=Asia/Kolkata"),
		JWTSecret:     getEnv("JWT_SECRET", "dev-secret-change-me"),
		Port:          getEnv("PORT", "8080"),
		AdminName:     getEnv("ADMIN_NAME", "Admin"),
		AdminMobile:   getEnv("ADMIN_MOBILE", "9999999999"),
		AdminPassword: getEnv("ADMIN_PASSWORD", "Admin@123"),
		Fast2SMSKey:   getEnv("FAST2SMS_API_KEY", ""),
		LogKey:        getEnv("LOG_KEY", ""),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
