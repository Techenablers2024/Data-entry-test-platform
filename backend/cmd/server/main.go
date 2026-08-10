package main

import (
	"log"
	"time"

	"dataentry-platform/backend/internal/config"
	"dataentry-platform/backend/internal/db"
	"dataentry-platform/backend/internal/handlers"
	"dataentry-platform/backend/internal/middleware"
	"dataentry-platform/backend/internal/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	// Database
	database := db.Init(cfg.DBDSN)
	db.RunMigrations(database)
	db.SeedAdmin(database, cfg.AdminName, cfg.AdminMobile, cfg.AdminPassword)

	// Services
	authSvc    := services.NewAuthService(database, cfg.JWTSecret)
	sessionSvc := services.NewSessionService(database)
	dataSvc    := services.NewDataService(database)
	excelSvc   := services.NewExcelService(database)

	// Handlers
	authHandler    := handlers.NewAuthHandler(authSvc)
	sessionHandler := handlers.NewSessionHandler(sessionSvc)
	dataHandler    := handlers.NewDataHandler(dataSvc, excelSvc)
	adminHandler   := handlers.NewAdminHandler(dataSvc, excelSvc, authSvc, database)
	reportHandler  := handlers.NewReportHandler(dataSvc)

	// Background: expire stale sessions every 60 seconds
	go func() {
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			sessionSvc.ExpireStale()
		}
	}()

	// Router
	r := gin.Default()

	// CORS — allow all origins in dev (Electron uses file://, Vite uses localhost)
	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Device-ID"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false, // must be false when AllowAllOrigins is true
		MaxAge:           12 * time.Hour,
	}))

	api := r.Group("/api/v1")

	// Auth routes (public)
	auth := api.Group("/auth")
	auth.POST("/signup", middleware.RateLimit(20, time.Minute), authHandler.Signup)
	auth.POST("/login", middleware.RateLimit(10, time.Minute), authHandler.Login)

	// Auth routes (protected)
	authProtected := api.Group("/auth")
	authProtected.Use(middleware.Auth(cfg))
	authProtected.POST("/logout", authHandler.Logout)
	authProtected.GET("/me", authHandler.Me)

	// Session routes (protected + device-bound)
	sessions := api.Group("/sessions")
	sessions.Use(middleware.Auth(cfg), middleware.Device())
	sessions.POST("/start", sessionHandler.StartSession)
	sessions.GET("/active", sessionHandler.GetActiveSession)
	sessions.GET("/today", sessionHandler.TodaySummary)
	sessions.POST("/:id/heartbeat", sessionHandler.Heartbeat)
	sessions.POST("/:id/takeover", sessionHandler.Takeover)

	// Data entry routes (protected + device-bound)
	records := api.Group("/records")
	records.Use(middleware.Auth(cfg), middleware.Device())
	records.GET("/progress", dataHandler.Progress)
	records.GET("/next", dataHandler.NextRecord)
	records.GET("/:id", dataHandler.GetRecord)
	records.POST("/:id/submit", dataHandler.SubmitRecord)

	// Admin routes (protected + admin-only)
	admin := api.Group("/admin")
	admin.Use(middleware.Auth(cfg), middleware.AdminOnly())
	admin.GET("/users", adminHandler.ListUsers)
	admin.PATCH("/users/:id/approve", adminHandler.ApproveUser)
	admin.PATCH("/users/:id/disable", adminHandler.DisableUser)
	admin.PATCH("/users/:id/enable", adminHandler.EnableUser)
	admin.POST("/users/:id/reset-password", adminHandler.ResetPassword)
	admin.GET("/users/:id/sessions", adminHandler.UserSessions)
	admin.GET("/users/:id/report", reportHandler.AdminUserReport)
	admin.POST("/batches", dataHandler.UploadBatch)
	admin.GET("/batches", adminHandler.ListBatches)
	admin.DELETE("/batches/:id", adminHandler.DeleteBatch)
	admin.GET("/records", adminHandler.ListRecords)
	admin.PATCH("/records/:id/enable", adminHandler.EnableRecord)
	admin.PATCH("/records/:id/disable", adminHandler.DisableRecord)
	admin.DELETE("/records/:id", adminHandler.DeleteRecord)

	// User report (own submissions)
	userReports := api.Group("/report")
	userReports.Use(middleware.Auth(cfg), middleware.Device())
	userReports.GET("/my", reportHandler.MyReport)

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	log.Printf("Server starting on :%s\n", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
