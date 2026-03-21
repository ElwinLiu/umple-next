package model

import (
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Store manages filesystem-based model storage, mirroring the PHP DataStore pattern.
type Store struct {
	root string
}

func NewStore(root string) (*Store, error) {
	if err := os.MkdirAll(root, 0755); err != nil {
		return nil, fmt.Errorf("create store root: %w", err)
	}
	if err := os.MkdirAll(filepath.Join(root, "tasks"), 0755); err != nil {
		return nil, fmt.Errorf("create tasks dir: %w", err)
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

// Get loads a model by ID.
func (s *Store) Get(id string) (*Model, error) {
	id = sanitizeID(id)
	dir := filepath.Join(s.root, id)
	data, err := os.ReadFile(filepath.Join(dir, "model.ump"))
	if err != nil {
		return nil, fmt.Errorf("model not found: %s", id)
	}
	return &Model{ID: id, Code: string(data)}, nil
}

// Update writes new code to an existing model.
func (s *Store) Update(id, code string) error {
	id = sanitizeID(id)
	dir := filepath.Join(s.root, id)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return fmt.Errorf("model not found: %s", id)
	}
	return os.WriteFile(filepath.Join(dir, "model.ump"), []byte(code), 0644)
}

// ModelDir returns the filesystem path for a model ID.
func (s *Store) ModelDir(id string) string {
	return filepath.Join(s.root, sanitizeID(id))
}

// Exists checks if a model directory exists.
func (s *Store) Exists(id string) bool {
	_, err := os.Stat(filepath.Join(s.root, sanitizeID(id)))
	return err == nil
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

// Bookmark copies a temporary model to a named bookmark directory.
func (s *Store) Bookmark(id, name string) error {
	id = sanitizeID(id)
	name = sanitizeID(name)

	srcDir := filepath.Join(s.root, id)
	if _, err := os.Stat(srcDir); os.IsNotExist(err) {
		return fmt.Errorf("model not found: %s", id)
	}

	dstDir := filepath.Join(s.root, "bookmarks", name)
	if err := os.MkdirAll(dstDir, 0755); err != nil {
		return fmt.Errorf("create bookmark dir: %w", err)
	}

	// Copy model.ump
	data, err := os.ReadFile(filepath.Join(srcDir, "model.ump"))
	if err != nil {
		return fmt.Errorf("read source model: %w", err)
	}
	if err := os.WriteFile(filepath.Join(dstDir, "model.ump"), data, 0644); err != nil {
		return fmt.Errorf("write bookmark model: %w", err)
	}

	return nil
}

// CreateTask creates a new model in the tasks/ subdirectory.
func (s *Store) CreateTask(code string) (*Model, error) {
	id := "task" + randomID()
	dir := filepath.Join(s.root, "tasks", id)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create task dir: %w", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "model.ump"), []byte(code), 0644); err != nil {
		return nil, err
	}
	return &Model{ID: id, Code: code}, nil
}

// GetTask loads a model from the tasks/ subdirectory.
func (s *Store) GetTask(id string) (*Model, error) {
	id = sanitizeID(id)
	dir := filepath.Join(s.root, "tasks", id)
	data, err := os.ReadFile(filepath.Join(dir, "model.ump"))
	if err != nil {
		return nil, fmt.Errorf("task not found: %s", id)
	}
	return &Model{ID: id, Code: string(data)}, nil
}

// UpdateTask writes new code to an existing task.
func (s *Store) UpdateTask(id, code string) error {
	id = sanitizeID(id)
	dir := filepath.Join(s.root, "tasks", id)
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return fmt.Errorf("task not found: %s", id)
	}
	return os.WriteFile(filepath.Join(dir, "model.ump"), []byte(code), 0644)
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
