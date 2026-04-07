package task

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestValidateName_ValidNames(t *testing.T) {
	valid := []string{
		"assignment1",
		"hw.1",
		"test_2",
		"UOtt_2020_SEG2105F.A1",
		"a",
		"ABC123",
	}
	for _, name := range valid {
		if err := ValidateName(name); err != nil {
			t.Errorf("ValidateName(%q) = %v, want nil", name, err)
		}
	}
}

func TestValidateName_InvalidNames(t *testing.T) {
	invalid := []string{
		"",
		"has spaces",
		"../../etc",
		"name/with/slash",
		"special!char",
		"tab\there",
		string(make([]byte, 101)), // too long
	}
	for _, name := range invalid {
		if err := ValidateName(name); err == nil {
			t.Errorf("ValidateName(%q) = nil, want error", name)
		}
	}
}

func TestValidateName_ReservedNames(t *testing.T) {
	reserved := []string{"responses", "Responses", "RESPONSES"}
	for _, name := range reserved {
		if _, err := sanitizeName(name); err == nil {
			t.Errorf("sanitizeName(%q) should reject reserved name", name)
		}
	}
}

func TestSanitizeName_CaseInsensitive(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"Assignment1", "assignment1"},
		{"UPPER", "upper"},
		{"already_lower", "already_lower"},
		{"MiXeD.CaSe", "mixed.case"},
	}
	for _, tt := range tests {
		got, err := sanitizeName(tt.input)
		if err != nil {
			t.Errorf("sanitizeName(%q) error: %v", tt.input, err)
			continue
		}
		if got != tt.want {
			t.Errorf("sanitizeName(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

// helper to create a store with a temp root.
func newTestStore(t *testing.T) *Store {
	t.Helper()
	store, err := NewStore(filepath.Join(t.TempDir(), "tasks"))
	if err != nil {
		t.Fatal(err)
	}
	return store
}

func TestCreateTask_Success(t *testing.T) {
	store := newTestStore(t)
	before := time.Now().Add(-time.Second)

	view, err := store.CreateTask(CreateTaskRequest{
		TaskName:      "hw1",
		RequestorName: "Prof Smith",
		Instructions:  "## Do this\nBuild a model.",
		ModelCode:     "class Foo {}",
		CompletionURL: "https://example.com/done",
		IsExperiment:  true,
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	if view.TaskName != "hw1" {
		t.Errorf("TaskName = %q, want %q", view.TaskName, "hw1")
	}
	if view.RequestorName != "Prof Smith" {
		t.Errorf("RequestorName = %q, want %q", view.RequestorName, "Prof Smith")
	}
	if view.EditKey == "" {
		t.Error("EditKey should be non-empty")
	}
	if view.Instructions != "## Do this\nBuild a model." {
		t.Errorf("Instructions mismatch: %q", view.Instructions)
	}
	if view.ModelCode != "class Foo {}" {
		t.Errorf("ModelCode = %q, want %q", view.ModelCode, "class Foo {}")
	}
	if view.CompletionURL != "https://example.com/done" {
		t.Errorf("CompletionURL = %q", view.CompletionURL)
	}
	if !view.IsExperiment {
		t.Error("IsExperiment should be true")
	}
	if view.CreatedAt.Before(before) {
		t.Errorf("CreatedAt %v is before test start %v", view.CreatedAt, before)
	}
}

func TestCreateTask_WritesFiles(t *testing.T) {
	store := newTestStore(t)

	view, err := store.CreateTask(CreateTaskRequest{
		TaskName:      "hw2",
		RequestorName: "Prof",
		Instructions:  "instructions text",
		ModelCode:     "class Bar {}",
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	dir := filepath.Join(store.root, "hw2")

	// Check taskdetails.json
	raw, err := os.ReadFile(filepath.Join(dir, "taskdetails.json"))
	if err != nil {
		t.Fatalf("read taskdetails.json: %v", err)
	}
	var details TaskDetails
	if err := json.Unmarshal(raw, &details); err != nil {
		t.Fatalf("unmarshal taskdetails.json: %v", err)
	}
	if details.EditKey != view.EditKey {
		t.Errorf("editKey on disk = %q, want %q", details.EditKey, view.EditKey)
	}

	// Check instructions.md
	data, err := os.ReadFile(filepath.Join(dir, "instructions.md"))
	if err != nil {
		t.Fatalf("read instructions.md: %v", err)
	}
	if string(data) != "instructions text" {
		t.Errorf("instructions.md = %q", string(data))
	}

	// Check model.ump
	data, err = os.ReadFile(filepath.Join(dir, "model.ump"))
	if err != nil {
		t.Fatalf("read model.ump: %v", err)
	}
	if string(data) != "class Bar {}" {
		t.Errorf("model.ump = %q", string(data))
	}
}

func TestCreateTask_DuplicateName(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateTask(CreateTaskRequest{TaskName: "dup", RequestorName: "A"})
	if err != nil {
		t.Fatal(err)
	}

	_, err = store.CreateTask(CreateTaskRequest{TaskName: "dup", RequestorName: "B"})
	if err != ErrAlreadyExists {
		t.Errorf("expected ErrAlreadyExists, got %v", err)
	}
}

func TestCreateTask_InvalidName(t *testing.T) {
	store := newTestStore(t)

	invalid := []string{"", "has spaces", "../../etc", "a/b"}
	for _, name := range invalid {
		_, err := store.CreateTask(CreateTaskRequest{TaskName: name, RequestorName: "A"})
		if err != ErrInvalidName {
			t.Errorf("CreateTask(%q): got %v, want ErrInvalidName", name, err)
		}
	}
}

func TestCreateTask_CaseInsensitiveDuplicate(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateTask(CreateTaskRequest{TaskName: "Assignment1", RequestorName: "A"})
	if err != nil {
		t.Fatal(err)
	}

	_, err = store.CreateTask(CreateTaskRequest{TaskName: "assignment1", RequestorName: "B"})
	if err != ErrAlreadyExists {
		t.Errorf("expected ErrAlreadyExists, got %v", err)
	}
}

func TestCreateTask_MultiTab(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateTask(CreateTaskRequest{
		TaskName:      "multitab",
		RequestorName: "Prof",
		Instructions:  "multi-tab task",
		Tabs: []TabFile{
			{Name: "Person.ump", Code: "class Person { name; }"},
			{Name: "Student.ump", Code: "class Student { isA Person; }"},
		},
	})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}

	dir := filepath.Join(store.root, "multitab")

	// Check tabs.json exists
	if _, err := os.Stat(filepath.Join(dir, "tabs.json")); err != nil {
		t.Fatalf("tabs.json should exist: %v", err)
	}

	// Check tab files
	for _, name := range []string{"Person.ump", "Student.ump"} {
		if _, err := os.Stat(filepath.Join(dir, name)); err != nil {
			t.Errorf("%s should exist: %v", name, err)
		}
	}

	// model.ump should NOT exist when tabs are provided
	if _, err := os.Stat(filepath.Join(dir, "model.ump")); !os.IsNotExist(err) {
		t.Error("model.ump should not exist when tabs are provided")
	}
}

func TestGetTask_Success(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateTask(CreateTaskRequest{
		TaskName:      "hw1",
		RequestorName: "Prof",
		Instructions:  "do stuff",
		ModelCode:     "class A {}",
	})
	if err != nil {
		t.Fatal(err)
	}

	view, err := store.GetTask("hw1")
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if view.TaskName != "hw1" {
		t.Errorf("TaskName = %q", view.TaskName)
	}
	if view.RequestorName != "Prof" {
		t.Errorf("RequestorName = %q", view.RequestorName)
	}
	if view.Instructions != "do stuff" {
		t.Errorf("Instructions = %q", view.Instructions)
	}
	if view.ModelCode != "class A {}" {
		t.Errorf("ModelCode = %q", view.ModelCode)
	}
}

func TestGetTask_NotFound(t *testing.T) {
	store := newTestStore(t)

	_, err := store.GetTask("nonexistent")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestGetTask_CaseInsensitive(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateTask(CreateTaskRequest{
		TaskName:      "myTask",
		RequestorName: "Prof",
		Instructions:  "hello",
		ModelCode:     "class X {}",
	})
	if err != nil {
		t.Fatal(err)
	}

	view, err := store.GetTask("MYTASK")
	if err != nil {
		t.Fatalf("GetTask(MYTASK): %v", err)
	}
	if view.TaskName != "mytask" {
		t.Errorf("TaskName = %q, want %q", view.TaskName, "mytask")
	}
}

func TestGetTask_MultiTab(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateTask(CreateTaskRequest{
		TaskName:      "tabbed",
		RequestorName: "Prof",
		Instructions:  "tabs",
		Tabs: []TabFile{
			{Name: "A.ump", Code: "class A {}"},
			{Name: "B.ump", Code: "class B {}"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	view, err := store.GetTask("tabbed")
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if len(view.Tabs) != 2 {
		t.Fatalf("expected 2 tabs, got %d", len(view.Tabs))
	}
	if view.Tabs[0].Name != "A.ump" || view.Tabs[0].Code != "class A {}" {
		t.Errorf("tab 0 = %+v", view.Tabs[0])
	}
	if view.Tabs[1].Name != "B.ump" || view.Tabs[1].Code != "class B {}" {
		t.Errorf("tab 1 = %+v", view.Tabs[1])
	}
	// ModelCode should be empty when tabs are present
	if view.ModelCode != "" {
		t.Errorf("ModelCode should be empty for multi-tab, got %q", view.ModelCode)
	}
}

func TestGetTaskWithKey_Success(t *testing.T) {
	store := newTestStore(t)

	created, err := store.CreateTask(CreateTaskRequest{
		TaskName:      "hw1",
		RequestorName: "Prof",
		Instructions:  "do it",
		ModelCode:     "class A {}",
	})
	if err != nil {
		t.Fatal(err)
	}

	view, err := store.GetTaskWithKey("hw1", created.EditKey)
	if err != nil {
		t.Fatalf("GetTaskWithKey: %v", err)
	}
	if view.EditKey != created.EditKey {
		t.Errorf("EditKey = %q, want %q", view.EditKey, created.EditKey)
	}
	if view.TaskName != "hw1" {
		t.Errorf("TaskName = %q", view.TaskName)
	}
}

func TestGetTaskWithKey_WrongKey(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateTask(CreateTaskRequest{
		TaskName: "hw1", RequestorName: "Prof",
	})
	if err != nil {
		t.Fatal(err)
	}

	_, err = store.GetTaskWithKey("hw1", "wrongkey")
	if err != ErrForbidden {
		t.Errorf("expected ErrForbidden, got %v", err)
	}
}

func TestGetTaskWithKey_NotFound(t *testing.T) {
	store := newTestStore(t)

	_, err := store.GetTaskWithKey("nosuchtask", "anykey")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestUpdateTask_FullOverwrite(t *testing.T) {
	store := newTestStore(t)

	created, err := store.CreateTask(CreateTaskRequest{
		TaskName: "hw1", RequestorName: "Old Name",
		Instructions: "old", ModelCode: "class A {}",
		CompletionURL: "https://old.com", IsExperiment: true,
	})
	if err != nil {
		t.Fatal(err)
	}

	// Full overwrite — all fields replaced.
	view, err := store.UpdateTask("hw1", created.EditKey, UpdateTaskRequest{
		RequestorName: "New Name",
		Instructions:  "new instructions",
		ModelCode:     "class B {}",
		CompletionURL: "https://new.com",
		IsExperiment:  false,
	})
	if err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}
	if view.RequestorName != "New Name" {
		t.Errorf("RequestorName = %q", view.RequestorName)
	}
	if view.Instructions != "new instructions" {
		t.Errorf("Instructions = %q", view.Instructions)
	}
	if view.ModelCode != "class B {}" {
		t.Errorf("ModelCode = %q", view.ModelCode)
	}
	if view.CompletionURL != "https://new.com" {
		t.Errorf("CompletionURL = %q", view.CompletionURL)
	}
	if view.IsExperiment {
		t.Error("IsExperiment should be false")
	}
	// TaskName and CreatedAt should not change.
	if view.TaskName != "hw1" {
		t.Errorf("TaskName changed to %q", view.TaskName)
	}
	if view.CreatedAt != created.CreatedAt {
		t.Errorf("CreatedAt changed")
	}
}

func TestUpdateTask_CleansStaleTabFiles(t *testing.T) {
	store := newTestStore(t)

	created, err := store.CreateTask(CreateTaskRequest{
		TaskName: "hw1", RequestorName: "Prof",
		Tabs: []TabFile{
			{Name: "A.ump", Code: "class A {}"},
			{Name: "B.ump", Code: "class B {}"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	// Update to different tabs — B.ump should be removed.
	_, err = store.UpdateTask("hw1", created.EditKey, UpdateTaskRequest{
		RequestorName: "Prof",
		Tabs: []TabFile{
			{Name: "A.ump", Code: "class A { updated; }"},
			{Name: "C.ump", Code: "class C {}"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	dir := filepath.Join(store.root, "hw1")
	if _, err := os.Stat(filepath.Join(dir, "B.ump")); !os.IsNotExist(err) {
		t.Error("B.ump should have been removed after tab update")
	}
	if _, err := os.Stat(filepath.Join(dir, "C.ump")); err != nil {
		t.Error("C.ump should exist")
	}
}

func TestUpdateTask_SwitchTabsToSingleFile(t *testing.T) {
	store := newTestStore(t)

	created, err := store.CreateTask(CreateTaskRequest{
		TaskName: "hw1", RequestorName: "Prof",
		Tabs: []TabFile{
			{Name: "A.ump", Code: "class A {}"},
			{Name: "B.ump", Code: "class B {}"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	// Switch to single-file — old tab files and tabs.json should be removed.
	_, err = store.UpdateTask("hw1", created.EditKey, UpdateTaskRequest{
		RequestorName: "Prof",
		ModelCode:     "class X {}",
	})
	if err != nil {
		t.Fatal(err)
	}

	dir := filepath.Join(store.root, "hw1")
	for _, name := range []string{"A.ump", "B.ump", "tabs.json"} {
		if _, err := os.Stat(filepath.Join(dir, name)); !os.IsNotExist(err) {
			t.Errorf("%s should have been removed when switching to single-file", name)
		}
	}
	if _, err := os.Stat(filepath.Join(dir, "model.ump")); err != nil {
		t.Error("model.ump should exist")
	}
}

func TestUpdateTask_CanClearCompletionURL(t *testing.T) {
	store := newTestStore(t)

	created, err := store.CreateTask(CreateTaskRequest{
		TaskName: "hw1", RequestorName: "Prof", CompletionURL: "https://old.com",
	})
	if err != nil {
		t.Fatal(err)
	}

	// Update with empty CompletionURL — should clear it.
	view, err := store.UpdateTask("hw1", created.EditKey, UpdateTaskRequest{
		RequestorName: "Prof",
		CompletionURL: "",
	})
	if err != nil {
		t.Fatal(err)
	}
	if view.CompletionURL != "" {
		t.Errorf("CompletionURL = %q, want empty", view.CompletionURL)
	}
}

func TestUpdateTask_WrongKey(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateTask(CreateTaskRequest{
		TaskName: "hw1", RequestorName: "Prof",
	})
	if err != nil {
		t.Fatal(err)
	}

	_, err = store.UpdateTask("hw1", "wrongkey", UpdateTaskRequest{
		Instructions: "hacked",
	})
	if err != ErrForbidden {
		t.Errorf("expected ErrForbidden, got %v", err)
	}
}

func TestCreateResponse_Success(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateTask(CreateTaskRequest{
		TaskName: "hw1", RequestorName: "Prof", ModelCode: "class A {}",
	})
	if err != nil {
		t.Fatal(err)
	}

	resp, err := store.CreateResponse("hw1")
	if err != nil {
		t.Fatalf("CreateResponse: %v", err)
	}
	if !strings.HasPrefix(resp.ResponseID, "resp") {
		t.Errorf("ResponseID = %q, want resp* prefix", resp.ResponseID)
	}
	if resp.TaskName != "hw1" {
		t.Errorf("TaskName = %q", resp.TaskName)
	}
	if resp.SubmittedAt != "" {
		t.Errorf("SubmittedAt should be empty, got %q", resp.SubmittedAt)
	}
	if resp.ModelCode != "class A {}" {
		t.Errorf("ModelCode = %q, want %q", resp.ModelCode, "class A {}")
	}
}

func TestCreateResponse_MultiTab(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateTask(CreateTaskRequest{
		TaskName: "tabbed", RequestorName: "Prof",
		Tabs: []TabFile{
			{Name: "A.ump", Code: "class A {}"},
			{Name: "B.ump", Code: "class B {}"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	resp, err := store.CreateResponse("tabbed")
	if err != nil {
		t.Fatalf("CreateResponse: %v", err)
	}
	if len(resp.Tabs) != 2 {
		t.Fatalf("expected 2 tabs, got %d", len(resp.Tabs))
	}
	if resp.Tabs[0].Code != "class A {}" {
		t.Errorf("tab 0 code = %q", resp.Tabs[0].Code)
	}
}

func TestCreateResponse_TaskNotFound(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateResponse("nonexistent")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestCreateResponse_UniqueIDs(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateTask(CreateTaskRequest{
		TaskName: "hw1", RequestorName: "Prof",
	})
	if err != nil {
		t.Fatal(err)
	}

	r1, err := store.CreateResponse("hw1")
	if err != nil {
		t.Fatal(err)
	}
	r2, err := store.CreateResponse("hw1")
	if err != nil {
		t.Fatal(err)
	}
	if r1.ResponseID == r2.ResponseID {
		t.Errorf("response IDs should differ: both %q", r1.ResponseID)
	}
}

func TestGetResponse_Success(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateTask(CreateTaskRequest{
		TaskName: "hw1", RequestorName: "Prof", ModelCode: "class A {}",
	})
	if err != nil {
		t.Fatal(err)
	}

	created, err := store.CreateResponse("hw1")
	if err != nil {
		t.Fatal(err)
	}

	resp, err := store.GetResponse(created.ResponseID)
	if err != nil {
		t.Fatalf("GetResponse: %v", err)
	}
	if resp.ResponseID != created.ResponseID {
		t.Errorf("ResponseID = %q", resp.ResponseID)
	}
	if resp.TaskName != "hw1" {
		t.Errorf("TaskName = %q", resp.TaskName)
	}
	if resp.ModelCode != "class A {}" {
		t.Errorf("ModelCode = %q", resp.ModelCode)
	}
}

func TestGetResponse_NotFound(t *testing.T) {
	store := newTestStore(t)

	_, err := store.GetResponse("resp_nonexistent")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestGetResponse_PathTraversal(t *testing.T) {
	store := newTestStore(t)

	for _, id := range []string{"../../../etc/passwd", "resp123/../../", ".."} {
		_, err := store.GetResponse(id)
		if err != ErrNotFound {
			t.Errorf("GetResponse(%q): expected ErrNotFound, got %v", id, err)
		}
	}
}

func TestSubmitResponse_Success(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateTask(CreateTaskRequest{
		TaskName: "hw1", RequestorName: "Prof", ModelCode: "class A {}",
	})
	if err != nil {
		t.Fatal(err)
	}
	created, err := store.CreateResponse("hw1")
	if err != nil {
		t.Fatal(err)
	}

	resp, err := store.SubmitResponse(created.ResponseID)
	if err != nil {
		t.Fatalf("SubmitResponse: %v", err)
	}
	if resp.SubmittedAt == "" {
		t.Error("SubmittedAt should be non-empty after submission")
	}

	// Verify persistence
	got, err := store.GetResponse(created.ResponseID)
	if err != nil {
		t.Fatal(err)
	}
	if got.SubmittedAt != resp.SubmittedAt {
		t.Errorf("persisted SubmittedAt = %q, want %q", got.SubmittedAt, resp.SubmittedAt)
	}
}

func TestSubmitResponse_AlreadySubmitted(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateTask(CreateTaskRequest{
		TaskName: "hw1", RequestorName: "Prof",
	})
	if err != nil {
		t.Fatal(err)
	}
	created, err := store.CreateResponse("hw1")
	if err != nil {
		t.Fatal(err)
	}

	if _, err := store.SubmitResponse(created.ResponseID); err != nil {
		t.Fatal(err)
	}
	_, err = store.SubmitResponse(created.ResponseID)
	if err != ErrAlreadySubmitted {
		t.Errorf("expected ErrAlreadySubmitted, got %v", err)
	}
}

func TestSubmitResponse_NotFound(t *testing.T) {
	store := newTestStore(t)

	_, err := store.SubmitResponse("resp_nonexistent")
	if err != ErrNotFound {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestListResponses_Success(t *testing.T) {
	store := newTestStore(t)

	created, err := store.CreateTask(CreateTaskRequest{
		TaskName: "hw1", RequestorName: "Prof",
	})
	if err != nil {
		t.Fatal(err)
	}

	r1, _ := store.CreateResponse("hw1")
	store.CreateResponse("hw1")
	r3, _ := store.CreateResponse("hw1")
	// Submit one
	store.SubmitResponse(r3.ResponseID)

	list, err := store.ListResponses("hw1", created.EditKey)
	if err != nil {
		t.Fatalf("ListResponses: %v", err)
	}
	if len(list) != 3 {
		t.Fatalf("expected 3 responses, got %d", len(list))
	}

	// At least one should be submitted
	submitted := 0
	for _, r := range list {
		if r.SubmittedAt != "" {
			submitted++
		}
	}
	if submitted != 1 {
		t.Errorf("expected 1 submitted, got %d", submitted)
	}
	_ = r1
}

func TestListResponses_WrongKey(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateTask(CreateTaskRequest{
		TaskName: "hw1", RequestorName: "Prof",
	})
	if err != nil {
		t.Fatal(err)
	}

	_, err = store.ListResponses("hw1", "badkey")
	if err != ErrForbidden {
		t.Errorf("expected ErrForbidden, got %v", err)
	}
}

func TestListResponses_Empty(t *testing.T) {
	store := newTestStore(t)

	created, err := store.CreateTask(CreateTaskRequest{
		TaskName: "hw1", RequestorName: "Prof",
	})
	if err != nil {
		t.Fatal(err)
	}

	list, err := store.ListResponses("hw1", created.EditKey)
	if err != nil {
		t.Fatalf("ListResponses: %v", err)
	}
	if list == nil {
		t.Error("expected empty slice, not nil")
	}
	if len(list) != 0 {
		t.Errorf("expected 0 responses, got %d", len(list))
	}
}

func TestListResponses_FiltersByTask(t *testing.T) {
	store := newTestStore(t)

	createdA, _ := store.CreateTask(CreateTaskRequest{
		TaskName: "taskA", RequestorName: "Prof",
	})
	store.CreateTask(CreateTaskRequest{
		TaskName: "taskB", RequestorName: "Prof",
	})

	store.CreateResponse("taskA")
	store.CreateResponse("taskA")
	store.CreateResponse("taskB")

	list, err := store.ListResponses("taskA", createdA.EditKey)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 {
		t.Errorf("expected 2 responses for taskA, got %d", len(list))
	}
}

func TestCreateTask_EmptyInstructions(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateTask(CreateTaskRequest{
		TaskName: "hw1", RequestorName: "Prof", Instructions: "",
	})
	if err != nil {
		t.Fatalf("should allow empty instructions: %v", err)
	}

	view, _ := store.GetTask("hw1")
	if view.Instructions != "" {
		t.Errorf("Instructions = %q, want empty", view.Instructions)
	}
}

func TestCreateTask_EmptyModelCode(t *testing.T) {
	store := newTestStore(t)

	_, err := store.CreateTask(CreateTaskRequest{
		TaskName: "hw1", RequestorName: "Prof", ModelCode: "",
	})
	if err != nil {
		t.Fatalf("should allow empty model: %v", err)
	}

	view, _ := store.GetTask("hw1")
	if view.ModelCode != "" {
		t.Errorf("ModelCode = %q, want empty", view.ModelCode)
	}
}

func TestResponseID_Sanitization(t *testing.T) {
	store := newTestStore(t)

	malicious := []string{
		"../../../etc/passwd",
		"resp123/../../",
		"..",
		"resp/../secrets",
	}
	for _, id := range malicious {
		_, err := store.GetResponse(id)
		if err != ErrNotFound {
			t.Errorf("GetResponse(%q): expected ErrNotFound, got %v", id, err)
		}
		_, err = store.SubmitResponse(id)
		if err != ErrNotFound {
			t.Errorf("SubmitResponse(%q): expected ErrNotFound, got %v", id, err)
		}
	}
}

func TestCreateTask_ConcurrentSameName(t *testing.T) {
	store := newTestStore(t)

	const n = 10
	errs := make(chan error, n)
	for i := 0; i < n; i++ {
		go func() {
			_, err := store.CreateTask(CreateTaskRequest{
				TaskName: "race", RequestorName: "Prof",
			})
			errs <- err
		}()
	}

	successes := 0
	duplicates := 0
	for i := 0; i < n; i++ {
		err := <-errs
		switch err {
		case nil:
			successes++
		case ErrAlreadyExists:
			duplicates++
		default:
			t.Errorf("unexpected error: %v", err)
		}
	}
	if successes != 1 {
		t.Errorf("expected exactly 1 success, got %d", successes)
	}
	if duplicates != n-1 {
		t.Errorf("expected %d duplicates, got %d", n-1, duplicates)
	}
}

func TestNewStore_CreatesRootDir(t *testing.T) {
	root := filepath.Join(t.TempDir(), "tasks")

	store, err := NewStore(root)
	if err != nil {
		t.Fatalf("NewStore: %v", err)
	}
	if store == nil {
		t.Fatal("expected non-nil store")
	}

	info, err := os.Stat(root)
	if err != nil {
		t.Fatalf("root dir should exist: %v", err)
	}
	if !info.IsDir() {
		t.Fatal("root should be a directory")
	}
}
