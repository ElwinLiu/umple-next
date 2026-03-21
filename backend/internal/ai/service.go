package ai

import (
	"errors"
)

// ErrNotConfigured is returned when the AI service has not been configured.
var ErrNotConfigured = errors.New("AI service not configured")

// Service defines the interface for AI provider integration.
type Service interface {
	// AnalyzeRequirements takes natural-language requirements and returns Umple code.
	AnalyzeRequirements(requirements string) (*AIResponse, error)

	// ExplainCode takes Umple code and returns a natural-language explanation.
	ExplainCode(code string) (*AIResponse, error)
}

// AIResponse holds the result from an AI provider call.
type AIResponse struct {
	Result string `json:"result"`
	Error  string `json:"error,omitempty"`
}

// StubService is a placeholder that returns ErrNotConfigured for all calls.
type StubService struct{}

// NewStubService creates a stub AI service.
func NewStubService() *StubService {
	return &StubService{}
}

func (s *StubService) AnalyzeRequirements(requirements string) (*AIResponse, error) {
	return nil, ErrNotConfigured
}

func (s *StubService) ExplainCode(code string) (*AIResponse, error) {
	return nil, ErrNotConfigured
}
