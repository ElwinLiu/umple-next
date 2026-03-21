package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/umple/umple-next/backend/internal/ai"
)

type AIHandler struct {
	service ai.Service
}

func NewAIHandler(service ai.Service) *AIHandler {
	return &AIHandler{service: service}
}

type AIRequirementsRequest struct {
	Requirements string `json:"requirements"`
}

type AIExplainRequest struct {
	Code string `json:"code"`
}

type AIErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// Requirements handles POST /api/ai/requirements — analyzes requirements via AI.
func (h *AIHandler) Requirements(w http.ResponseWriter, r *http.Request) {
	var req AIRequirementsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Requirements == "" {
		writeError(w, http.StatusBadRequest, "requirements is required")
		return
	}

	result, err := h.service.AnalyzeRequirements(req.Requirements)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotImplemented)
		json.NewEncoder(w).Encode(AIErrorResponse{
			Error:   "not_implemented",
			Message: "AI service is not yet configured",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// Explain handles POST /api/ai/explain — explains Umple code via AI.
func (h *AIHandler) Explain(w http.ResponseWriter, r *http.Request) {
	var req AIExplainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Code == "" {
		writeError(w, http.StatusBadRequest, "code is required")
		return
	}

	result, err := h.service.ExplainCode(req.Code)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotImplemented)
		json.NewEncoder(w).Encode(AIErrorResponse{
			Error:   "not_implemented",
			Message: "AI service is not yet configured",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
