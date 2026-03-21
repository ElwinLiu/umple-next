package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/umple/umple-next/backend/internal/compiler"
	"github.com/umple/umple-next/backend/internal/config"
	"github.com/umple/umple-next/backend/internal/model"
)

type GenerateHandler struct {
	pool  *compiler.Pool
	store *model.Store
	cfg   *config.Config
}

func NewGenerateHandler(pool *compiler.Pool, store *model.Store, cfg *config.Config) *GenerateHandler {
	return &GenerateHandler{pool: pool, store: store, cfg: cfg}
}

type GenerateRequest struct {
	Code     string `json:"code"`
	Language string `json:"language"`
	ModelID  string `json:"modelId,omitempty"`
}

type GenerateResponse struct {
	Output   string `json:"output"`
	Language string `json:"language"`
	Errors   string `json:"errors,omitempty"`
	ModelID  string `json:"modelId"`
}

// validGenerateLanguages lists the languages supported by umple.jar -generate.
var validGenerateLanguages = map[string]bool{
	"Java":         true,
	"Php":          true,
	"Python":       true,
	"Ruby":         true,
	"Cpp":          true,
	"RTCpp":        true,
	"SimpleCpp":    true,
	"Json":         true,
	"Yuml":         true,
	"Ecore":        true,
	"Papyrus":      true,
	"TextUml":      true,
	"Umlet":        true,
	"USE":          true,
	"Sql":          true,
	"Alloy":        true,
	"NuSMV":        true,
	"SimulateJava": true,
}

func (h *GenerateHandler) Generate(w http.ResponseWriter, r *http.Request) {
	var req GenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Code == "" {
		writeError(w, http.StatusBadRequest, "code is required")
		return
	}
	if req.Language == "" {
		writeError(w, http.StatusBadRequest, "language is required")
		return
	}
	if !validGenerateLanguages[req.Language] {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("unsupported language: %s", req.Language))
		return
	}

	// Ensure model directory exists
	modelID := req.ModelID
	if modelID == "" {
		m, err := h.store.Create(req.Code)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create model")
			return
		}
		modelID = m.ID
	} else {
		dir := h.store.ModelDir(modelID)
		if err := os.MkdirAll(dir, 0755); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create model dir")
			return
		}
		if err := os.WriteFile(filepath.Join(dir, "model.ump"), []byte(req.Code), 0644); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to write model")
			return
		}
	}

	dir := h.store.ModelDir(modelID)
	command := fmt.Sprintf("-generate %s %s/model.ump", req.Language, dir)

	result, err := h.pool.Execute(compiler.CompileRequest{
		Command: command,
		WorkDir: dir,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("generation failed: %v", err))
		return
	}

	output := result.Output

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(GenerateResponse{
		Output:   output,
		Language: req.Language,
		Errors:   result.Errors,
		ModelID:  modelID,
	})
}
