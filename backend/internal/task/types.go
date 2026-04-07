package task

import (
	"errors"
	"time"
)

// Sentinel errors for the task store.
var (
	ErrNotFound         = errors.New("not found")
	ErrInvalidName      = errors.New("invalid task name")
	ErrAlreadyExists    = errors.New("task already exists")
	ErrForbidden        = errors.New("invalid edit key")
	ErrAlreadySubmitted = errors.New("response already submitted")
)

// TaskDetails is the metadata stored in taskdetails.json for a task definition.
type TaskDetails struct {
	TaskName      string    `json:"taskName"`
	RequestorName string    `json:"requestorName"`
	EditKey       string    `json:"editKey,omitempty"`
	CompletionURL string    `json:"completionURL,omitempty"`
	IsExperiment  bool      `json:"isExperiment"`
	CreatedAt     time.Time `json:"createdAt"`
}

// CreateTaskRequest is the input to Store.CreateTask.
type CreateTaskRequest struct {
	TaskName      string    `json:"taskName"`
	RequestorName string    `json:"requestorName"`
	CompletionURL string    `json:"completionURL,omitempty"`
	IsExperiment  bool      `json:"isExperiment"`
	Instructions  string    `json:"instructions"`
	ModelCode     string    `json:"modelCode"`
	Tabs          []TabFile `json:"tabs,omitempty"`
}

// TabFile represents a single tab file for multi-tab models.
type TabFile struct {
	Name string `json:"name"`
	Code string `json:"code"`
}

// TaskView is the public info returned when a participant loads a task.
type TaskView struct {
	TaskName      string    `json:"taskName"`
	RequestorName string    `json:"requestorName"`
	CompletionURL string    `json:"completionURL,omitempty"`
	IsExperiment  bool      `json:"isExperiment"`
	CreatedAt     time.Time `json:"createdAt"`
	Instructions  string    `json:"instructions"`
	ModelCode     string    `json:"modelCode"`
	Tabs          []TabFile `json:"tabs,omitempty"`
}

// TaskOwnerView extends TaskView with the editKey.
type TaskOwnerView struct {
	TaskView
	EditKey string `json:"editKey"`
}

// ResponseDetails is the metadata stored in taskdetails.json for a response.
type ResponseDetails struct {
	TaskName    string `json:"taskName"`
	ResponseID  string `json:"responseId"`
	SubmittedAt string `json:"submittedAt,omitempty"`
}

// ResponseView is the full data returned when loading a response.
type ResponseView struct {
	TaskName    string    `json:"taskName"`
	ResponseID  string    `json:"responseId"`
	SubmittedAt string    `json:"submittedAt,omitempty"`
	ModelCode   string    `json:"modelCode"`
	Tabs        []TabFile `json:"tabs,omitempty"`
}

// ResponseSummary is a short view of a response for listing.
type ResponseSummary struct {
	ResponseID  string `json:"responseId"`
	SubmittedAt string `json:"submittedAt,omitempty"`
}

// UpdateTaskRequest is the input to Store.UpdateTask.
// All fields are overwritten unconditionally (PUT semantics).
type UpdateTaskRequest struct {
	RequestorName string    `json:"requestorName"`
	CompletionURL string    `json:"completionURL"`
	IsExperiment  bool      `json:"isExperiment"`
	Instructions  string    `json:"instructions"`
	ModelCode     string    `json:"modelCode"`
	Tabs          []TabFile `json:"tabs,omitempty"`
}
