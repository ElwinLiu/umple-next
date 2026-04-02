package model

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// TabInfo represents a single editor tab for JSON serialization.
type TabInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Code string `json:"code"`
}

// TabsData is the structure written to tabs.json.
type TabsData struct {
	ActiveTabID string    `json:"activeTabId"`
	Tabs        []TabInfo `json:"tabs"`
}

// Store manages filesystem-based model storage, mirroring the PHP DataStore pattern.
type Store struct {
	root string
}

func NewStore(root string) (*Store, error) {
	if err := os.MkdirAll(root, 0755); err != nil {
		return nil, fmt.Errorf("create store root: %w", err)
	}
	return &Store{root: root}, nil
}

// Create generates a new model directory with a random ID and writes the initial code.
func (s *Store) Create(code string) (*Model, error) {
	id := "tmp" + randomID()
	dir := filepath.Join(s.root, id)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}
	if err := os.WriteFile(filepath.Join(dir, "model.ump"), []byte(code), 0644); err != nil {
		return nil, err
	}
	return &Model{ID: id, Code: code}, nil
}

// ModelDir returns the filesystem path for a model ID.
func (s *Store) ModelDir(id string) string {
	return filepath.Join(s.root, sanitizeID(id))
}

// Get loads a model by ID from the store root.
func (s *Store) Get(id string) (*Model, error) {
	id = sanitizeID(id)
	dir := filepath.Join(s.root, id)
	data, err := os.ReadFile(filepath.Join(dir, "model.ump"))
	if err != nil {
		return nil, fmt.Errorf("model not found: %s", id)
	}
	return &Model{ID: id, Code: string(data)}, nil
}

// CleanupLoop periodically removes tmp model directories older than maxAge.
func (s *Store) CleanupLoop(interval time.Duration) {
	maxAge := 24 * time.Hour
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		s.cleanup(maxAge)
	}
}

// SaveTabs writes tab metadata to {modelDir}/tabs.json.
func (s *Store) SaveTabs(modelID string, data *TabsData) error {
	dir := s.ModelDir(modelID)
	b, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("marshal tabs: %w", err)
	}
	return os.WriteFile(filepath.Join(dir, "tabs.json"), b, 0644)
}

// LoadTabs reads tab metadata from {modelDir}/tabs.json.
// Returns nil, nil if the file does not exist (backward compat).
func (s *Store) LoadTabs(modelID string) (*TabsData, error) {
	dir := s.ModelDir(modelID)
	b, err := os.ReadFile(filepath.Join(dir, "tabs.json"))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, fmt.Errorf("read tabs: %w", err)
	}
	var data TabsData
	if err := json.Unmarshal(b, &data); err != nil {
		return nil, fmt.Errorf("unmarshal tabs: %w", err)
	}
	return &data, nil
}

func (s *Store) cleanup(maxAge time.Duration) {
	entries, err := os.ReadDir(s.root)
	if err != nil {
		log.Printf("cleanup: failed to read store: %v", err)
		return
	}
	cutoff := time.Now().Add(-maxAge)
	for _, e := range entries {
		if !e.IsDir() || !strings.HasPrefix(e.Name(), "tmp") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			path := filepath.Join(s.root, e.Name())
			if err := os.RemoveAll(path); err != nil {
				log.Printf("cleanup: failed to remove %s: %v", path, err)
			} else {
				log.Printf("cleanup: removed old model %s", e.Name())
			}
		}
	}
}

func randomID() string {
	const chars = "0123456789abcdefghijklmnopqrstuvwxyz"
	b := make([]byte, 10)
	for i := range b {
		n, _ := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		b[i] = chars[n.Int64()]
	}
	return string(b)
}

func sanitizeID(id string) string {
	// Prevent directory traversal
	id = filepath.Base(id)
	id = strings.ReplaceAll(id, "..", "")
	return id
}
