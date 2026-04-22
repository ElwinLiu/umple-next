package generate

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestReadGeneratedFilesReturnsCombinedAndStructuredFiles(t *testing.T) {
	dir := t.TempDir()

	if err := os.WriteFile(filepath.Join(dir, "model.ump"), []byte("class Invoice {}"), 0o644); err != nil {
		t.Fatalf("write entry file: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "billing"), 0o755); err != nil {
		t.Fatalf("create package dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "billing", "Invoice.java"), []byte("class Invoice {}"), 0o644); err != nil {
		t.Fatalf("write invoice file: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, "billing", "Customer.java"), []byte("class Customer {}"), 0o644); err != nil {
		t.Fatalf("write customer file: %v", err)
	}

	combined, files, paths, err := readGeneratedFiles(dir, "Java", "model.ump")
	if err != nil {
		t.Fatalf("readGeneratedFiles returned error: %v", err)
	}

	if len(files) != 2 {
		t.Fatalf("len(files) = %d, want 2", len(files))
	}
	if len(paths) != 2 {
		t.Fatalf("len(paths) = %d, want 2", len(paths))
	}

	if files[0].Path != "billing/Customer.java" || files[0].Name != "Customer.java" {
		t.Fatalf("first file = %#v, want billing/Customer.java", files[0])
	}
	if files[1].Path != "billing/Invoice.java" || files[1].Name != "Invoice.java" {
		t.Fatalf("second file = %#v, want billing/Invoice.java", files[1])
	}

	if !strings.Contains(combined, "class Customer {}") || !strings.Contains(combined, "class Invoice {}") {
		t.Fatalf("combined output missing generated content:\n%s", combined)
	}
	if strings.Contains(combined, "class Invoice {}class Customer {}") {
		t.Fatalf("combined output should separate files with a newline:\n%s", combined)
	}
}
