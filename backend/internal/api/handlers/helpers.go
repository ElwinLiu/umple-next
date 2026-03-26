package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"

	"github.com/umple/umple-next/backend/internal/model"
)

// resolveModel ensures a model directory exists with the given code written to
// model.ump. If modelID is empty a new model is created; otherwise the
// existing directory is reused. Returns the resolved model ID and directory.
func resolveModel(store *model.Store, modelID, code string) (string, string, error) {
	if modelID == "" {
		m, err := store.Create(code)
		if err != nil {
			return "", "", err
		}
		return m.ID, store.ModelDir(m.ID), nil
	}

	dir := store.ModelDir(modelID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", "", err
	}
	if err := os.WriteFile(filepath.Join(dir, "model.ump"), []byte(code), 0644); err != nil {
		return "", "", err
	}
	return modelID, dir, nil
}

func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
