package utils

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID   uuid.UUID `json:"user_id"`
	Mobile   string    `json:"mobile"`
	IsAdmin  bool      `json:"is_admin"`
	DeviceID string    `json:"device_id"`
	jwt.RegisteredClaims
}

func GenerateToken(userID uuid.UUID, mobile string, isAdmin bool, deviceID string, secret string) (string, error) {
	claims := Claims{
		UserID:   userID,
		Mobile:   mobile,
		IsAdmin:  isAdmin,
		DeviceID: deviceID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseToken(tokenStr string, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

type ResetClaims struct {
	Mobile  string `json:"mobile"`
	Purpose string `json:"purpose"`
	jwt.RegisteredClaims
}

func GenerateResetToken(mobile, secret string) (string, error) {
	claims := ResetClaims{
		Mobile:  mobile,
		Purpose: "reset",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(5 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ParseResetToken(tokenStr, secret string) (*ResetClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &ResetClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, errors.New("reset token expired or invalid")
	}
	claims, ok := token.Claims.(*ResetClaims)
	if !ok || !token.Valid || claims.Purpose != "reset" {
		return nil, errors.New("invalid reset token")
	}
	return claims, nil
}
