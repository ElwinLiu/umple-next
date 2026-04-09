package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/umple/umpleonline/backend/internal/api/handlers/generate"
	"github.com/umple/umpleonline/backend/internal/compiler"
	"github.com/umple/umpleonline/backend/internal/config"
	"github.com/umple/umpleonline/backend/internal/model"
)

type GenerateRequest = generate.GenerateRequest
type GeneratedArtifact = generate.GeneratedArtifact
type GenerateResponse = generate.GenerateResponse

type GenerateHandler struct {
	pool    *compiler.Pool
	store   *model.Store
	service *generate.Service
}

func NewGenerateHandler(pool *compiler.Pool, store *model.Store, cfg *config.Config) *GenerateHandler {
	return &GenerateHandler{
		pool:    pool,
		store:   store,
		service: generate.NewService(cfg.UmpleSyncJar),
	}
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

	baseLanguage, suboptions := generate.ParseLanguageSpec(req.Language)
	if !generate.IsValidLanguage(baseLanguage) {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("unsupported language: %s", baseLanguage))
		return
	}

	entryFile := resolveEntryFile(h.store, req.ModelID, req.ActiveTabID)
	modelID, dir, err := h.resolveModelDir(req.ModelID, req.Code)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.pool.LockModel(dir)
	defer h.pool.UnlockModel(dir)

	if err := h.writeModelFile(dir, req.Code, entryFile); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	resp, err := h.service.Generate(baseLanguage, dir, modelID, entryFile, suboptions)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *GenerateHandler) resolveModelDir(modelID, code string) (string, string, error) {
	if modelID == "" {
		m, err := h.store.Create(code)
		if err != nil {
			return "", "", fmt.Errorf("failed to create model")
		}
		return m.ID, h.store.ModelDir(m.ID), nil
	}

	dir := h.store.ModelDir(modelID)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", "", fmt.Errorf("failed to create model dir")
	}
	return modelID, dir, nil
}

func (h *GenerateHandler) writeModelFile(dir, code, entryFile string) error {
	return os.WriteFile(filepath.Join(dir, entryFile), []byte(code), 0o644)
}
