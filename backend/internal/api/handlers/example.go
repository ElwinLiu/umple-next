package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
)

type ExampleHandler struct {
	examplePath string
}

func NewExampleHandler(examplePath string) *ExampleHandler {
	return &ExampleHandler{examplePath: examplePath}
}

type ExampleEntry struct {
	Name     string `json:"name"`
	Filename string `json:"filename"`
	Category string `json:"category,omitempty"`
}

func (h *ExampleHandler) List(w http.ResponseWriter, r *http.Request) {
	entries, err := os.ReadDir(h.examplePath)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]ExampleEntry{})
		return
	}

	var examples []ExampleEntry
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".ump") {
			continue
		}
		name := strings.TrimSuffix(e.Name(), ".ump")
		examples = append(examples, ExampleEntry{
			Name:     name,
			Filename: e.Name(),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(examples)
}

func (h *ExampleHandler) Get(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	// Sanitize
	name = filepath.Base(name)
	if !strings.HasSuffix(name, ".ump") {
		name += ".ump"
	}

	data, err := os.ReadFile(filepath.Join(h.examplePath, name))
	if err != nil {
		writeError(w, http.StatusNotFound, "example not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"name": strings.TrimSuffix(name, ".ump"),
		"code": string(data),
	})
}
