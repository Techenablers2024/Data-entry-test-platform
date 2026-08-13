package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type SMSService struct {
	apiKey string
}

func NewSMSService(apiKey string) *SMSService {
	return &SMSService{apiKey: apiKey}
}

type fast2smsResponse struct {
	Return     bool   `json:"return"`
	StatusCode int    `json:"status_code"`
	Message    string `json:"message"`
}

func (s *SMSService) SendOTP(mobile string) error {
	if s.apiKey == "" {
		return errors.New("SMS service not configured.")
	}

	payload := fmt.Sprintf(`{"mobile":"%s","otp_expiry":5,"otp_length":6}`, mobile)
	req, err := http.NewRequest("POST", "https://www.fast2sms.com/dev/otp/send", strings.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return errors.New("Failed to reach SMS service.")
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result fast2smsResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return errors.New("Invalid response from SMS service.")
	}
	if !result.Return {
		return errors.New("Failed to send OTP. Please try again.")
	}
	return nil
}

func (s *SMSService) VerifyOTP(mobile, otp string) error {
	if s.apiKey == "" {
		return errors.New("SMS service not configured.")
	}

	payload := fmt.Sprintf(`{"mobile":"%s","otp":"%s"}`, mobile, otp)
	req, err := http.NewRequest("POST", "https://www.fast2sms.com/dev/otp/verify", strings.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return errors.New("Failed to reach SMS service.")
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result fast2smsResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return errors.New("Invalid response from SMS service.")
	}
	if !result.Return {
		return errors.New("Invalid or expired OTP.")
	}
	return nil
}
